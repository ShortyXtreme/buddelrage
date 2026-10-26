// BuddelRage – Hauptprogramm: Spielablauf, Netzwerk-Nachrichten, Hintergrund-Demo, Hauptschleife
'use strict';
const $ = id => document.getElementById(id);
const cv = $('game'); const R = new Renderer(cv);
const G = { world: null, demo: null, role: 'none', myTeam: 0, paused: false, menu: null, cfg: null, acc: 0, last: 0, msgs: [], pendingEv: [], spectate: false };
const net = { id: null, host: false, code: null, players: [], hostId: null, link: null };

// ---------- Texturen ----------
const TEX_MAP = { earth: MAT.EARTH, rock: MAT.ROCK, sand: MAT.SAND, gold: MAT.GOLD, granite: MAT.GRANITE, water: MAT.WATER, tunnel: MAT.TUNNEL, brick: MAT.WOOD };
function loadTextures() {
  const data = window.TEXTURE_DATA || {};
  return Promise.all(Object.keys(TEX_MAP).map(k => new Promise(res => {
    if (!data[k]) return res();
    const im = new Image();
    im.onload = () => { try { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); TEX[TEX_MAP[k]] = { d: g.getImageData(0, 0, im.width, im.height).data, s: im.width }; } catch (e) { console.warn('Textur', k, e); } res(); };
    im.onerror = () => res(); im.src = data[k];
  })));
}

// ---------- Ereignisse ----------
function handleEvents(evs) {
  for (const e of evs) {
    if (e.e === 'snd') { if (e.team === undefined || e.team === G.myTeam) playSnd(e.n, e.x, e.y); }
    else if (e.e === 'muzzle') {
      const w = G.world;
      for (let k = 0; k < (e.big ? 14 : 6); k++) w.particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 0.8, vy: -Math.random() * 0.6, l: 25 + Math.random() * 25, c: k % 3 ? '#9a9a9a' : '#ffd070', s: 1 + (k % 2), g: 0 });
      if (e.big) w.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, l: 10, c: 'rgba(0,0,0,0)', s: 0, g: 0, light: 40 });
    }
    else if (e.e === 'msg') { if (e.team === -1 || e.team === G.myTeam) addMsg(e.s); }
    else if (e.e === 'poof') {
      const w = G.world, esc = e.k === 'esc', cols = esc ? ['#bfe8ff', '#ffffff', '#8fd0ff'] : e.k === 'fish' || e.k === 'shark' ? ['#cfe6ff', '#9cc8f0', '#ffffff'] : ['#e8e2d8', '#ffffff', '#c9c0b4'];
      for (let k = 0; k < (esc ? 22 : 10); k++) { const a = Math.random() * 6.28, s = Math.random() * (esc ? 1.6 : 0.9); w.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.4, l: 22 + Math.random() * 20, c: cols[k % 3], s: 1 + (k % 2), g: 0 }); }
      if (esc) w.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, l: 18, c: 'rgba(0,0,0,0)', s: 0, g: 0, light: 60 });
    }
    else if (e.e === 'pop') {
      const w = G.world; playSnd('pop', e.x, e.y);
      for (let k = 0; k < 14; k++) { const a = Math.random() * 6.28, s = 0.6 + Math.random() * 1.4; w.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 16 + Math.random() * 18, c: k % 3 ? (e.col || '#e33') : '#fff', s: 1 + (k % 2) }); }
    }
    else if (e.e === 'away') { const w = G.world; for (let k = 0; k < 6; k++) w.particles.push({ x: e.x + (Math.random() - 0.5) * 6, y: e.y, vx: (Math.random() - 0.5) * 0.3, vy: -0.6 - Math.random() * 0.5, l: 60 + k * 8, c: k % 2 ? (e.col || '#e33') : '#fff', s: 2, g: 0 }); }
    else if (e.e === 'boom') {
      const w = G.world;
      for (let k = 0; k < e.r * 4; k++) { const a = Math.random() * 6.28, s = Math.random() * e.r / 6; w.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, l: 30 + Math.random() * 30, c: ['#fff3a0', '#ffb030', '#ff6a10', '#6b4a2a', '#888'][k % 5], s: 1 + (k % 3 === 0) }); }
      w.particles.push({ x: e.x - e.r / 2, y: e.y - e.r / 2, vx: 0, vy: 0, l: 6, c: '#fff8d0', s: e.r, g: 0 });
      w.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, l: 22, c: 'rgba(0,0,0,0)', s: 0, g: 0, light: e.r * 4 });
      const S = R.scale, cx = R.cam.x + cv.width / S / 2, cy = R.cam.y + cv.height / S / 2;
      if (Math.hypot(e.x - cx, e.y - cy) < 300) R.shake = Math.min(12, e.r / 2);
    }
  }
}

// ---------- Spielstart ----------
// Kartengröße anwenden: Breite skaliert, Höhe je Stufe; Anzahl Wildschweine wächst mit
function applySize(cfg, size) { const d = mapDims(cfg.W, size); cfg.W = d.W; cfg.H = d.H; cfg.size = d.size; if (cfg.monsterCount) cfg.monsterCount = Math.max(1, Math.round(cfg.monsterCount * MAP_SIZES[d.size].f)); return cfg; }
// Karten-Übertragung: RLE + Deflate (CompressionStream), Fallback unkomprimiert; Versand in 16-KB-Stücken (net.js)
async function deflateB64(str) {
  const cs = new CompressionStream('deflate-raw'); const w = cs.writable.getWriter(); w.write(new TextEncoder().encode(str)); w.close();
  const buf = new Uint8Array(await new Response(cs.readable).arrayBuffer()); let s = ''; for (let k = 0; k < buf.length; k += 8192) s += String.fromCharCode.apply(null, buf.subarray(k, k + 8192)); return btoa(s);
}
async function inflateB64(b64) {
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(u); w.close();
  return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer());
}
function sendMap(to) {
  const m = G.world.fullMap(), raw = JSON.stringify(m); G.mapBytes = raw.length;
  if (typeof CompressionStream === 'undefined') { netSend(to ? { t: 'map', m, to } : { t: 'map', m }); return; }
  G.mapPending = (G.mapPending || 0) + 1; const done = () => { G.mapPending--; };
  deflateB64(raw).then(z => { G.mapBytesZ = z.length; netSend(to ? { t: 'map', z, to } : { t: 'map', z }); done(); }).catch(() => { netSend(to ? { t: 'map', m, to } : { t: 'map', m }); done(); });
}
function newSeed() { return (Math.random() * 1e9) | 0; }
function startSingle(mode) {
  const cfg = mode === 'settle'
    ? { mode, W: 1800, H: 640, seed: newSeed(), teams: [{ name: 'Siedler' }], clonks: 1, money: 40, goal: spGoal(), monsters: $('optmon1').checked, monsterCount: 2 }
    : { mode: 'melee', W: 1700, H: 620, seed: newSeed(), teams: [{ name: 'Du' }, { name: 'KI Rot', ai: true, diff: $('spdiff1').value }], clonks: 1, money: 40, monsters: false };
  if (mode === 'melee3') { cfg.teams.push({ name: 'KI Grün', ai: true, diff: $('spdiff2').value }); cfg.W = 2300; }
  applySize(cfg, $('spsize').value);
  const cn = cleanName($('spcname').value, ''); $('spcname').value = cn; try { localStorage.setItem('br_cname', cn); } catch (e) {}
  cfg.teams[0].cname = cn; const hv = $('opthelper').value; cfg.teams[0].helper = hv !== 'off'; cfg.teams[0].hdiff = hv !== 'off' ? hv : 'normal';
  cfg.allResearch = $('optallres').checked; cfg.daynight = $('optday').checked; cfg.lava = true; cfg.animals = $('optanimals').checked;
  if (mode !== 'settle') cfg.money = cfg.allResearch ? 120 : 60;
  G.role = 'single'; G.myTeam = 0; G.spectate = false; G.spMode = mode;
  launchWorld(cfg, false);
  tutStart();
}
function launchWorld(cfg, remote, map, prebuilt) {
  G.cfg = cfg; G.msgs = []; G.demo = null; G.acc = 0;
  const w = prebuilt || new World(cfg, remote);
  if (prebuilt) { }
  else if (!remote) w.setup();
  else { w.teams = cfg.teams.map((tc, i) => ({ id: i, side: Number.isInteger(tc.side) ? tc.side : i, hdiff: AI_DIFF[tc.hdiff] ? tc.hdiff : 'normal', name: cleanName(tc.name, 'Team'), color: tc.color || TEAM_COLORS[i % 6], ai: !!tc.ai, diff: AI_DIFF[tc.diff] ? tc.diff : 'normal', helper: !tc.ai && !!tc.helper, stat: '', money: 0, sel: -1, elim: false, keys: {}, res: {}, rq: '', rp: 0 })); w.setupPools(false); if (map) w.loadMap(map); }
  G.world = w; R.attach(w); R.miniDom = $('minimap'); R.resize();
  const me = w.teams[G.myTeam]; const f = w.clonks.find(c => me && c.id === me.sel) || w.clonks[0];
  if (f) { R.cam.x = f.x - cv.width / R.scale / 2; R.cam.y = f.y - cv.height / R.scale / 2; }
  G.paused = false; closeAllMenus(); hideAll(); $('hud').style.display = 'block'; $('menubg').style.display = 'none'; $('toasts').innerHTML = '';
  if ($('tchat')) $('tchat').style.display = G.role === 'single' ? 'none' : '';
  if (G.rejoinToast) { toast(G.rejoinToast, 'good'); G.rejoinToast = null; }
  HUD.sig = {}; HUD.money = null; $('hud-teams').style.display = ''; cv.classList.add('ingame'); updateTouchUI();
  if (typeof chatClose === 'function' && CHAT.open) chatClose();
  if (!prebuilt) { CHAT.log = []; CHAT.bubbles = {}; if (typeof renderChatLog === 'function') renderChatLog(); }
  if (prebuilt) { if (G.role !== 'single') addMsg('Spiel geht weiter.'); }
  else {
    if (cfg.size && MAP_SIZES[cfg.size]) addMsg('Karte: ' + MAP_SIZES[cfg.size].n + ' (' + cfg.W + ' × ' + cfg.H + ')');
    addMsg(cfg.mode === 'settle' ? 'Goldrausch: Verdiene ' + cfg.goal + ' Geld! Grabe Gold und verkaufe es an der Hütte.' : 'Melee: Das letzte überlebende Team gewinnt!');
  }
  input.lastSent = ''; pushKeys(true);
}
function toMenu() {
  G.world = null; G.role = 'none'; p2pClose(); net.link = null; net.code = null; tut.on = false; $('tutorial').style.display = 'none';
  G.mig = null; G.migrating = null; migBanner(''); MIGKEY.secret = MIGKEY.key = MIGKEY.pw = null;
  if (typeof chatClose === 'function') { chatClose(); wheelClose(false); CHAT.log = []; CHAT.bubbles = {}; renderChatLog(); }
  if (location.hash) history.replaceState(null, '', location.href.split('#')[0]);
  closeAllMenus(); hideAll(); $('hud').style.display = 'none'; $('mainmenu').style.display = 'flex'; cv.classList.remove('ingame'); startDemo();
}
function hideAll() { for (const id of ['mainmenu', 'spmenu', 'mpmenu', 'lobby', 'gameover', 'loading']) $(id).style.display = 'none'; }
function showScreen(id) { hideAll(); $(id).style.display = 'flex'; pad.sel = 0; if (!G.world) $('menubg').style.display = 'block'; }
function menuBack() { if (G.menu) { closeAllMenus(); return; } if ($('lobby').style.display === 'flex') { toMenu(); return; } if ($('mainmenu').style.display !== 'flex') { hideAll(); $('mainmenu').style.display = 'flex'; } }

// ---------- Hintergrund-Demo im Hauptmenü (KI gegen KI) ----------
function startDemo() {
  try {
    const cfg = { mode: 'melee', W: 1500, H: 560, seed: newSeed(), teams: [{ name: 'A', ai: true, diff: 'hard' }, { name: 'B', ai: true, diff: 'normal' }], clonks: 3, money: 80, monsters: false, allResearch: true, daynight: true, lava: true, dayStart: 0.32 };
    const w = new World(cfg, false); w.setup(); w.goal = 1e9; G.demo = w; G.demoT = 0; R.attach(w); R.miniDom = null; R.resize();
    R.cam.x = 200; R.cam.y = w.surf[700] - 160;
  } catch (e) { G.demo = null; console.warn('Demo', e); }
  $('menubg').style.display = 'block';
}
function demoFrame(dt) {
  const w = G.demo; if (!w) return;
  G.demoT += dt;
  G.acc += dt; let n = 0; while (G.acc >= STEP && n++ < 3) { w.update(); G.acc -= STEP; } if (G.acc > STEP * 3) G.acc = 0;
  w.events.length = 0; w.netDirty.clear(); if (w.burntNew) w.burntNew.length = 0;
  if (w.state !== 'run' || G.demoT > 150000) { startDemo(); return; }
  for (const p of w.particles) { p.x += p.vx; p.y += p.vy; if (p.g !== 0) p.vy += 0.08; p.l--; }
  w.particles = w.particles.filter(p => p.l > 0);
  const vw = cv.width / R.scale, span = Math.max(0, w.W - vw), x = vw / 2 + span * (0.5 + 0.5 * Math.sin(G.demoT / 26000));
  const sx = Math.max(0, Math.min(w.W - 1, x | 0));
  R.draw(w, { x, y: w.surf[sx] + 20 }, -1, dt);
}

// ---------- Netzwerk ----------
function netSend(o) { p2pSend(o); }
function mpErr(t) { $('mperr').textContent = t; $('mpbusy').style.display = 'none'; if ($('lobby').style.display === 'flex' && G.role !== 'host') { hideAll(); $('mpmenu').style.display = 'flex'; } }
function onNet(m) {
  switch (m.t) {
    case 'err': $('mperr').textContent = m.s; break;
    case 'joined': net.id = m.id; net.code = m.code; net.host = m.host; net.players = m.players; net.hostId = m.hostId; net.link = m.link || null; $('mpbusy').style.display = 'none'; $('mperr').textContent = '';
      if (G.migrating && G.world) { G.migrating.joined = true; migBanner('Verbunden – Spielstand wird übertragen…'); break; }
      if (net.host) { LB = lbDefault(); net.lobby = null; } else net.lobby = null;
      showLobby(); break;
    case 'players': net.players = m.players; net.hostId = m.hostId; if (!G.world && !G.migrating) showLobby(); break;
    case 'lobby': if (!net.host && m.L && Array.isArray(m.L.teams)) { net.lobby = m.L; if (!G.world && $('lobby').style.display === 'flex') renderLobbyTeams(); } break;
    case 'lteamin': lobbyJoinIn(m.from, m.team); break;
    case 'chat': if (G.role === 'client') chatDeliver(m); break;
    case 'chatin': if (G.role === 'host') hostChatIn(m.from, m.s, m.e); break;
    case 'mig': if (G.role === 'client' && m.st && Array.isArray(m.order)) G.mig = { st: m.st, order: m.order, hostId: m.hostId, at: Date.now() }; break;
    case 'start':
      if (net.host) return;
      if (G.migrating) { G.migrating = null; migBanner(''); G.rejoinToast = 'Wieder verbunden – das Spiel geht weiter.'; }
      G.role = 'client'; G.myTeam = m.cfg.teams.findIndex(t => t.pid === net.id); G.spectate = G.myTeam < 0;
      G.pendingCfg = m.cfg; G.world = null; G.chunkBuf = []; hideAll(); $('loading').style.display = 'flex'; break;
    case 'map':
      if (net.host || !G.pendingCfg) return;
      if (m.z) { const cfg = G.pendingCfg; inflateB64(m.z).then(str => { if (G.pendingCfg !== cfg) return; launchWorld(cfg, true, JSON.parse(str)); for (const [ci, d] of (G.chunkBuf || [])) G.world.applyChunk(ci, d); G.chunkBuf = null; if (G.spectate) addMsg('Du schaust zu (Spiel lief bereits).'); }).catch(e => { console.warn('Karte', e); $('mperr').textContent = 'Karte konnte nicht entpackt werden.'; }); break; }
      launchWorld(G.pendingCfg, true, m.m); for (const [ci, d] of (G.chunkBuf || [])) G.world.applyChunk(ci, d); G.chunkBuf = null; if (G.spectate) addMsg('Du schaust zu (Spiel lief bereits).'); break;
    case 'snap': if (G.world && G.role === 'client') { G.world.applySnap(m.d); handleEvents(m.ev || []); } break;
    case 'chunks': if (G.world && G.role === 'client') for (const [ci, d] of m.c) G.world.applyChunk(ci, d); else if (G.chunkBuf && G.role === 'client') G.chunkBuf.push(...m.c); break;
    case 'in': if (G.role === 'host' && G.world) { const ti = G.world.teams.findIndex(t => t.pid === m.from); if (ti < 0) return; if (m.k) G.world.setKeys(ti, m.k); if (m.a) G.world.action(ti, m.a, m.arg); } break;
    case 'late': if (G.role === 'host' && G.world) {
      netSend({ t: 'start', cfg: G.cfg, to: m.id }); sendMap(m.id);
      G.migSoon = G.world.tick + 90;
      const t = G.world.teams.find(t => t.pid === m.id);
      if (t && !t.elim) { if (t.wasHuman) restoreHuman(t); addMsg(t.name + ' ist wieder verbunden.'); }
      else addMsg(m.name + ' schaut zu.');
    } break;
    case 'left': if (G.role === 'host' && G.world) { const t = G.world.teams.find(t => t.pid === m.id); if (t && !t.ai) { t.awaitUntil = 0; humanToAi(t); addMsg(t.name + ' hat das Spiel verlassen – KI (' + aiDiffName(t.diff) + ') übernimmt.'); } } break;
    case 'hostleft': onHostLeft(); break;
  }
}
function showLobby() {
  showScreen('lobby');
  $('invitebox').style.display = net.host ? 'block' : 'none'; $('clientinfo').style.display = net.host ? 'none' : 'block';
  if (net.host) $('invitelink').value = net.link || '';
  $('hostopts').style.display = net.host ? 'block' : 'none';
  if (net.host) lobbySync(); else renderLobbyTeams();
  $('waithost').style.display = net.host ? 'none' : 'block';
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
// ---------- Host-Wechsel (best effort) ----------
function humanToAi(t) { if (!t.wasHuman) { t.wasHuman = true; t.helperWas = !!t.helper; } G.world.aiTakeover(t, G.cfg.takeover || 'normal'); }
function restoreHuman(t) {
  t.ai = false; t.helper = !!t.helperWas; t.brain = null; t.stat = ''; t.keys = { ...NOKEYS }; t.awaitUntil = 0;
  const tc = G.cfg.teams[t.id]; if (tc) { tc.ai = false; }
  for (const c of G.world.clonks) if (c.team === t.id) { c.ai = null; c.aiKeys = { ...NOKEYS }; }
}
function migOrder() {
  const ids = [...P2P.conns.values()].filter(c => c.auth).map(c => c.id), hasTeam = id => G.cfg.teams.some(t => t.pid === id);
  return ids.filter(hasTeam).concat(ids.filter(id => !hasTeam(id)));
}
function migBanner(s) { const b = $('migbanner'); if (!b) return; b.textContent = s; b.style.display = s ? 'block' : 'none'; }
function migFail(why) { console.warn('Host-Wechsel', why); toMenu(); toast('Der Host hat das Spiel verlassen' + (why ? ' – Übernahme fehlgeschlagen.' : '.'), 'warn'); }
function onHostLeft() {
  const w = G.world;
  if (!w || G.role !== 'client' || w.state !== 'run' || !G.mig || Date.now() - G.mig.at > 20000 || !MIGKEY.key) { migFail(''); return; }
  const oldHost = net.hostId, order = G.mig.order.filter(id => id !== oldHost && id !== G.mig.hostId), succ = order[0];
  if (!succ) { migFail(''); return; }
  releaseAll(); if (typeof chatClose === 'function') chatClose();
  G.migrating = { t0: Date.now(), tc: Date.now(), succ, oldHost, cands: order, idx: 0 };
  // Nachfolger: erst kurz prüfen, ob der Host noch da ist (vielleicht war nur die eigene Verbindung weg), sonst übernehmen
  if (succ === net.id) { migBanner('Verbindung zum Host verloren – prüfe…'); G.migrating.probe = true; setTimeout(migRejoin, 300); }
  else { migBanner('Der Host ist weg – warte auf neuen Host…'); setTimeout(migRejoin, 2500); }
}
function migPromote() {
  const M = G.migrating, live = G.world, mig = G.mig; M.promoting = true;
  p2pPromote(net.id, Math.max(10, ...mig.order) + 1, () => {
    if (G.migrating !== M) return;
    let w;
    try { w = deserializeWorld(mig.st, live.mat); mergeLive(w, live); }
    catch (e) { console.warn('Host-Wechsel', e); p2pClose(); migFail('state'); return; }
    G.migrating = null; migBanner('');
    G.role = 'host'; net.host = true; net.hostId = net.id; net.players = hostPlayers();
    G.myTeam = w.teams.findIndex((t, i) => w.cfg.teams[i] && w.cfg.teams[i].pid === net.id); G.spectate = G.myTeam < 0;
    G.pendingEv = []; G.mapPending = 0;
    launchWorld(w.cfg, false, null, w);
    w.netDirty.clear(); G.chunkSent = new Map(); G.migSoon = w.tick + 60;
    const now = Date.now();
    w.teams.forEach((t, i) => {
      const tc = w.cfg.teams[i]; if (!tc || tc.ai || t.elim || t.ai) return;
      if (tc.pid === M.oldHost) { humanToAi(t); addMsg(t.name + ' (alter Host) ist weg – KI (' + aiDiffName(t.diff) + ') übernimmt.'); }
      else if (tc.pid !== net.id) { t.wasHuman = true; t.helperWas = !!t.helper; t.awaitUntil = now + 20000; }
    });
    addMsg('Du bist jetzt der Host. Die anderen verbinden sich neu…');
    toast('Host-Wechsel: Du bist jetzt der Host.', 'good');
  }, err => { if (G.migrating !== M) return; migFail(err || 'claim'); }, 40000);
}
function migRejoin() {
  const M = G.migrating; if (!M || !G.world || M.promoting) return;
  // Nachfolger meldet sich nicht → nächster Kandidat (ggf. man selbst) übernimmt
  if (!M.joined && Date.now() - M.tc > 15000) {
    M.idx++; M.tc = Date.now(); const nx = M.cands[M.idx];
    if (nx === undefined) { migFail('timeout'); return; }
    if (nx === net.id) { p2pClose(); migBanner('Der Host ist weg – du übernimmst das Spiel…'); migPromote(); return; }
  }
  if (Date.now() - M.t0 > 70000) { migFail('timeout'); return; }
  let failed = false;
  p2pJoin(MIGKEY.secret, MIGKEY.name, MIGKEY.pw, err => {
    if (failed || G.migrating !== M || M.joined) return; failed = true;
    if (M.probe) { M.probe = false; migBanner('Der Host ist weg – du übernimmst das Spiel…'); migPromote(); return; }
    if (/Passwort|voll/.test(String(err))) { migFail(err); return; }
    setTimeout(migRejoin, 2000);
  }, MIGKEY.cname, net.id);
}
function hostSync() {
  const w = G.world;
  if ((w.tick % 300 === 150 || w.tick === G.migSoon) && P2P.conns.size && w.state === 'run') { try { netSend({ t: 'mig', st: serializeWorld(w, false), order: migOrder(), hostId: P2P.myId }); } catch (e) { console.warn('mig', e); } }
  if (w.tick % 60 === 30) { const now = Date.now(); for (const t of w.teams) if (t.awaitUntil && now > t.awaitUntil && !t.ai) { t.awaitUntil = 0; humanToAi(t); addMsg(t.name + ' ist nicht zurückgekommen – KI (' + aiDiffName(t.diff) + ') übernimmt.'); } }
  if (w.tick % 3 === 0) { netSend({ t: 'snap', d: w.snap(), ev: G.pendingEv }); G.pendingEv = []; }
  if (w.tick % 3 === 1 && w.netDirty.size && !G.mapPending) {
    const arr = []; const ls = G.chunkSent || (G.chunkSent = new Map()); const now = w.tick;
    for (const ci of w.netDirty) { if (now - (ls.get(ci) || -99) < 15) continue; arr.push(w.encodeChunk(ci)); w.netDirty.delete(ci); ls.set(ci, now); if (arr.length >= 60) break; }
    if (arr.length) netSend({ t: 'chunks', c: arr });
  }
}

function checkOver() {
  const w = G.world; if (w.state !== 'over' || $('gameover').style.display === 'flex') return;
  let txt, win;
  if (w.mode === 'settle') { win = w.winner === 0; txt = win ? 'Gewonnen! Du hast ' + w.goal + ' Geld verdient.' : 'Verloren! Alle Buddler sind tot.'; }
  else { win = w.winner >= 0 && G.myTeam >= 0 && w.ally(w.winner, G.myTeam); const multi = w.teams.some(t => t.id !== G.myTeam && G.myTeam >= 0 && w.ally(t.id, G.myTeam)); txt = w.winner < 0 ? 'Unentschieden!' : (win ? (multi ? 'Sieg! Euer ' + w.sideTitle(G.myTeam) + ' hat gewonnen!' : 'Sieg! Dein Team hat überlebt!') : w.sideTitle(w.winner) + ' gewinnt!'); }
  closeAllMenus(); releaseAll();
  $('goicon').innerHTML = ICONS[win ? 'trophy' : 'skull']; $('goicon').style.color = win ? 'var(--acc)' : 'var(--bad)';
  $('gameovertext').textContent = txt;
  const s = Math.floor(w.tick / 60); $('gostats').textContent = 'Spielzeit ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + (G.myTeam >= 0 && w.teams[G.myTeam] ? ' · Geld ' + w.teams[G.myTeam].money : '');
  showScreen('gameover'); $('menubg').style.display = 'none'; cv.classList.remove('ingame');
  $('againbtn').style.display = G.role === 'single' ? 'block' : 'none';
}
// ---------- Hauptschleife ----------
const STEP = 1000 / 60;
function frame(ts) {
  requestAnimationFrame(frame);
  try { pollPad(); } catch (e) { }
  const dt = Math.min(250, ts - (G.last || ts)); G.last = ts;
  const w = G.world;
  if (!w) { demoFrame(dt); return; }
  if (G.role !== 'client' && !G.paused) {
    G.acc += dt;
    while (G.acc >= STEP) { w.update(); G.acc -= STEP; if (G.role === 'host') hostSync(); }
    const evs = w.events.splice(0); handleEvents(evs); if (G.role === 'host') G.pendingEv.push(...evs);
    if (G.role === 'single') { w.netDirty.clear(); if (w.burntNew) w.burntNew.length = 0; }
  }
  for (const p of w.particles) { p.x += p.vx; p.y += p.vy; if (p.g !== 0) p.vy += 0.08; p.l--; }
  w.particles = w.particles.filter(p => p.l > 0);
  const me = G.myTeam >= 0 ? w.teams[G.myTeam] : null;
  let focus = me && w.clonks.find(c => c.id === me.sel);
  if (!focus) focus = w.clonks.find(c => c.act !== 'dead');
  if (focus && w.remote) focus = { x: focus.rx !== undefined ? focus.rx : focus.x, y: focus.ry !== undefined ? focus.ry : focus.y };
  R.draw(w, focus, G.myTeam, dt);
  drawAimOverlay(); drawBubbles(); G.rescueP = rescueTick();
  if (input.mouse.moved && (input.kb.g || pad.keys.g || input.touch.keys.g || myPushingGun())) pushKeys();
  updateHUD(); tutTick();
  checkOver();
  if (w.tick % 30 === 0 && w.tick !== G.lastMenuTick) { G.lastMenuTick = w.tick; if (G.menu === 'shop') renderShop(); else if (G.menu === 'research') renderResearch(); else if (G.menu === 'buildmenu') renderBuild(); }
}
