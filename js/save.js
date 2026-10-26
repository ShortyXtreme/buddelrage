// BuddelRage – Spielstände (Einzelspieler, localStorage) und Welt-Serialisierung (auch für den Host-Wechsel im Mehrspieler)
'use strict';
const SAVE_SLOTS = 3, SAVE_VER = 2; // v2: Wildschweine statt Monster, Team-Seiten, Helfer-Stufe (v1 wird beim Laden umgewandelt)
// nicht speicherbare/flüchtige Felder: KI-Gedächtnis (wird neu aufgebaut), Interpolation, Caches
function saveReplacer(k, v) {
  if ((k === 'ai' || k === 'brain' || k === 'keys' || k === 'aiKeys') && v && typeof v === 'object') return undefined;
  if (k === 'rx' || k === 'ry' || k === 'spots' || k === 'spotsT' || k === 'hpSeen' || k === 'flashT' || k === 'yS' || k === 'tiltR' || k === 'animSeen') return undefined;
  return v;
}
function serializeWorld(w, withMap) {
  const S = {
    v: SAVE_VER, cfg: w.cfg, tick: w.tick, nextId: w.nextId, state: w.state, winner: w.winner, mode: w.mode, goal: w.goal,
    clonks: w.clonks, items: w.items, monsters: w.monsters, animals: w.animals, structs: w.structs, teams: w.teams, vehicles: w.vehicles, fires: w.fires,
    bases: w.bases, baseDir: w.baseDir, plats: w.plats, castleSites: w.castleSites, faunaT: w.faunaT || null,
    surf: Array.from(w.surf), burnt: rleEncode(w.burnt),
  };
  if (withMap) S.mat = rleEncode(w.mat);
  return JSON.parse(JSON.stringify(S, saveReplacer)); // tiefe, saubere Kopie
}
// matSrc: optional vorhandenes Material-Array (Host-Wechsel: die Landschaft des Clients ist aktuell)
function deserializeWorld(S, matSrc) {
  const cfg = S.cfg, w = new World(cfg, false);
  if (S.mat) rleDecode(S.mat, w.mat); else if (matSrc && matSrc.length === w.mat.length) w.mat.set(matSrc);
  w.surf.set(S.surf); if (S.burnt) rleDecode(S.burnt, w.burnt);
  Object.assign(w, { tick: S.tick, nextId: S.nextId, state: S.state, winner: S.winner, mode: S.mode, goal: S.goal, bases: S.bases, baseDir: S.baseDir, plats: S.plats, castleSites: S.castleSites, faunaT: S.faunaT || null });
  w.clonks = S.clonks || []; w.items = S.items || []; w.monsters = S.monsters || []; w.animals = S.animals || []; w.structs = S.structs || []; w.vehicles = S.vehicles || []; w.fires = S.fires || [];
  w.teams = S.teams || [];
  for (const t of w.teams) { t.keys = { ...NOKEYS }; t.brain = null; if (!t.stats) t.stats = newStats(); if (!t.res) t.res = {}; }
  w.setupPools(!cfg.sharedBase); // Teamkasse; alte Stände (eigene Kassen je Spieler) werden zusammengelegt
  for (const c of w.clonks) { c.aiKeys = { ...NOKEYS }; c.ai = null; c.digHold = 0; }
  w.rand = mulberry32(((cfg.seed * 7 + 1) ^ (S.tick * 2654435761)) | 0);
  w.frng = mulberry32(((cfg.seed | 0) ^ (S.tick * 40503)) | 0);
  w.fireSet = new Set(w.fires.map(f => (f.y >> 1) * 4096 + (f.x >> 1)));
  w.recolorAll(); w.activeNext.fill(1);
  return w;
}
// Alte Spielstände (v1): Monster werden zu Wildschweinen (weniger, friedlich), Helfer bekommen eine Stufe
function upgradeSaveV1(S) {
  const cfg = S.cfg; if (cfg.monsterCount) cfg.monsterCount = Math.max(1, Math.round(cfg.monsterCount / 2));
  S.monsters = (S.monsters || []).slice(0, cfg.monsterCount || 2).map(m => Object.assign({}, m, { k: 'boar', hp: Math.min(40, m.hp || 40), bite: 0, wind: 0, chg: 0, flee: 0, cd: 0, act: 'walk' }));
  for (const t of S.teams || []) { if (!t.hdiff) t.hdiff = 'normal'; if (!Number.isInteger(t.side)) t.side = t.id; }
  S.v = SAVE_VER;
}
// Host-Wechsel: letzter vollständiger Stand des alten Hosts + aktuelle Positionen aus den Schnappschüssen des Clients
function mergeLive(w, L) {
  const byId = a => new Map(a.map(o => [o.id, o]));
  const mc = byId(w.clonks), mi = byId(w.items), mm = byId(w.monsters), ma = byId(w.animals), ms = byId(w.structs), mv = byId(w.vehicles);
  let maxId = w.nextId;
  const seen = o => { if (o.id >= maxId) maxId = o.id + 1; };
  w.clonks = L.clonks.map(l => {
    seen(l); let c = mc.get(l.id);
    if (!c) { c = { id: l.id, team: l.team, vx: 0, vy: 0, gold: 0, fightT: 0, cd: 0, tumbleT: 0, deadT: 0, aiKeys: { ...NOKEYS }, punch: 0, digIdle: 0, armor: 0, knight: 0, arrows: 0, block: 0, inside: 0, fire: 0, swing: 0, bowT: 0, veh: 0, blockT: 0 }; }
    Object.assign(c, { x: l.x, y: l.y, dir: l.dir, act: l.act || 'walk', hp: l.hp, anim: l.anim || 0, inv: (l.inv || []).slice(), breath: l.breath, name: l.name, armor: l.armor ? 1 : 0, knight: l.knight ? 1 : 0, arrows: l.arrows || 0, inside: l.inside || 0, veh: l.veh || 0, slot: l.slot || 0 });
    if (!l.fire) c.fire = 0; else if (!c.fire) c.fire = 60;
    if (l.hk && l.hk.st === 2) { const len = Math.hypot(c.x - l.hk.x, c.y - 7 - l.hk.y); c.hk = { st: 2, x: l.hk.x, y: l.hk.y, len: Math.max(8, Math.min(HOOK_MAX, len)) }; } else c.hk = null;
    if (l.bl) c.bl = c.bl && c.bl.gas !== undefined ? c.bl : { gas: l.bl.gas ? 600 : 0 }; else c.bl = null;
    if (c.act === 'rope' && !c.hk) c.act = 'jump'; if (c.act === 'float' && !c.bl) c.act = 'jump';
    if (c.act === 'fight') c.act = 'walk';
    c.ai = null; c.aiKeys = { ...NOKEYS };
    return c;
  });
  w.items = L.items.map(l => { seen(l); const o = mi.get(l.id) || { armed: false, owner: 0, age: 30, pickCd: 20, chain: 0, shot: 0 }; return Object.assign(o, { id: l.id, type: l.type, x: l.x, y: l.y, vx: l.vx || 0, vy: l.vy || 0, fuse: l.fuse || 0, stuck: !!l.stuck, landed: !!l.landed }); });
  w.monsters = L.monsters.map(l => { seen(l); const o = mm.get(l.id) || { vx: 0, vy: 0, act: 'walk', cd: 0, think: 0, fire: 0 }; return Object.assign(o, { id: l.id, x: l.x, y: l.y, dir: l.dir, hp: l.hp, anim: l.anim || 0 }); });
  w.animals = L.animals.map(l => { seen(l); const o = ma.get(l.id) || { vx: 0, vy: 0, hp: (ANIMAL[l.k] || ANIMAL.wipf).hp, t: 0, think: 0, flee: 0, cd: 0, bite: 0, flop: 0, air: 1, perch: 0 }; return Object.assign(o, { id: l.id, k: l.k, x: l.x, y: l.y, dir: l.dir, anim: l.anim || 0 }); });
  w.structs = L.structs.map(l => { seen(l); const o = ms.get(l.id) || {}; return Object.assign(o, { id: l.id, type: l.type, x: l.x, y: l.y, team: l.team, prog: l.prog, hp: l.hp, fire: l.fire ? (o.fire || 200) : 0, lv: l.lv || 0, w: BUILD[l.type].w, h: BUILD[l.type].h, lvD: o.lvD || 0, lvN: o.lvN || 0 }); });
  w.vehicles = L.vehicles.map(l => { seen(l); const o = mv.get(l.id) || { vx: 0, vy: 0 }; return Object.assign(o, { id: l.id, type: l.type, x: l.x, y: l.y, dir: l.dir, team: l.team, hp: l.hp, ang: l.ang, inv: (l.inv || []).slice(), fire: l.fire ? (o.fire || 200) : 0, pusher: l.pusher || 0, cd: l.cd || 0 }); });
  L.teams.forEach((l, i) => { const t = w.teams[i]; if (!t) return; Object.assign(t, { money: l.money, sel: l.sel, elim: !!l.elim, res: Object.assign({}, l.res), rq: l.rq || '', rp: l.rp || 0, ai: !!l.ai, diff: l.diff || t.diff, stat: l.stat || '', helper: !!l.helper }); t.brain = null; t.keys = { ...NOKEYS }; });
  w.fires = L.fires.map(f => ({ x: f.x, y: f.y, k: f.k, t: f.k ? 150 : 60 }));
  w.fireSet = new Set(w.fires.map(f => (f.y >> 1) * 4096 + (f.x >> 1)));
  w.tick = Math.max(w.tick, L.tick); w.state = L.state; w.winner = L.winner; w.nextId = maxId + 5;
  return w;
}

// ---------- Speicherstände ----------
function saveKey(n) { return 'br_save_' + n; }
function saveMeta(n) { try { const s = localStorage.getItem(saveKey(n)); if (!s) return null; const o = JSON.parse(s); return o && o.v ? o : null; } catch (e) { return null; } }
function fmtTime(ticks) { const s = Math.floor(ticks / 60); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function modeName(m) { return m === 'settle' ? 'Goldrausch' : m === 'melee3' ? 'Melee · 2 KI' : 'Melee · 1 KI'; }
async function saveGame(n) {
  const w = G.world; if (!w || G.role !== 'single') { toast('Speichern geht nur im Einzelspieler.', 'warn'); return false; }
  if (w.state !== 'run') { toast('Das Spiel ist schon vorbei.', 'warn'); return false; }
  const S = serializeWorld(w, true), raw = JSON.stringify(S);
  let body;
  try { body = typeof CompressionStream !== 'undefined' ? { z: await deflateB64(raw) } : { raw }; } catch (e) { body = { raw }; }
  const me = w.teams[G.myTeam] || w.teams[0];
  const rec = Object.assign({ v: SAVE_VER, t: Date.now(), mode: G.spMode || w.mode, size: w.cfg.size || '', tick: w.tick, money: me ? me.money : 0, clonks: w.clonks.filter(c => c.team === G.myTeam && c.act !== 'dead').length, my: G.myTeam }, body);
  try { localStorage.setItem(saveKey(n), JSON.stringify(rec)); }
  catch (e) { toast('Speichern fehlgeschlagen: Browser-Speicher voll. Einen anderen Spielstand löschen.', 'warn'); return false; }
  toast('Gespeichert in Platz ' + n + '.', 'good'); return true;
}
async function loadGame(n) {
  const rec = saveMeta(n); if (!rec) { toast('Platz ' + n + ' ist leer.', 'warn'); return false; }
  let S;
  try { S = JSON.parse(rec.z ? await inflateB64(rec.z) : rec.raw); } catch (e) { toast('Spielstand beschädigt – konnte nicht geladen werden.', 'warn'); return false; }
  if (!S || !(S.v === 1 || S.v === SAVE_VER) || !S.cfg) { toast('Spielstand ist nicht kompatibel.', 'warn'); return false; }
  if (S.v === 1) upgradeSaveV1(S);
  p2pClose(); net.link = null; net.code = null;
  const w = deserializeWorld(S);
  G.role = 'single'; G.myTeam = rec.my || 0; G.spectate = false; G.spMode = rec.mode || 'melee';
  launchWorld(S.cfg, false, null, w);
  toast('Spielstand ' + n + ' geladen (' + modeName(G.spMode) + ', ' + fmtTime(w.tick) + ').', 'good');
  return true;
}
function deleteSave(n) { try { localStorage.removeItem(saveKey(n)); } catch (e) { } }
function renderSaves() {
  const inGame = G.world && G.role === 'single' && G.world.state === 'run';
  let h = head('Spielstände', inGame ? 'Speichern oder einen Stand laden (nur Einzelspieler, im Browser gespeichert)' : 'Einen gespeicherten Einzelspieler-Stand laden') + '<div class="slots">';
  for (let n = 1; n <= SAVE_SLOTS; n++) {
    const m = saveMeta(n);
    const info = m ? '<b>' + modeName(m.mode) + '</b>' + (m.size && MAP_SIZES[m.size] ? ' · ' + MAP_SIZES[m.size].n : '') + ' · Spielzeit ' + fmtTime(m.tick) + '<div class="muted small">' + new Date(m.t).toLocaleString('de-AT', { dateStyle: 'short', timeStyle: 'short' }) + ' · Geld ' + m.money + ' · ' + m.clonks + ' Buddler · ' + Math.round(((m.z || m.raw || '').length) / 1024) + ' KB</div>' : '<span class="muted">leer</span>';
    h += '<div class="slot-row"><span class="slotnum">' + n + '</span><div class="slotinfo">' + info + '</div><div class="slotbtns">' +
      (inGame ? '<button class="btn sm primary opt" data-save="' + n + '">Speichern</button>' : '') +
      (m ? '<button class="btn sm opt" data-load="' + n + '">Laden</button><button class="btn sm ghost opt" data-del="' + n + '" title="Löschen">✕</button>' : '') + '</div></div>';
  }
  h += '</div>';
  $('saves').innerHTML = h;
  for (const b of $('saves').querySelectorAll('[data-save]')) b.onclick = async () => { const n = +b.dataset.save; if (saveMeta(n) && !b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Überschreiben?'; return; } uiSnd(); b.textContent = '…'; await saveGame(n); if (G.menu === 'saves') renderSaves(); };
  for (const b of $('saves').querySelectorAll('[data-load]')) b.onclick = async () => { uiSnd(); b.textContent = '…'; const ok = await loadGame(+b.dataset.load); if (!ok && G.menu === 'saves') renderSaves(); };
  for (const b of $('saves').querySelectorAll('[data-del]')) b.onclick = () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Löschen?'; return; } uiSnd(); deleteSave(+b.dataset.del); renderSaves(); };
  menuHL();
}
