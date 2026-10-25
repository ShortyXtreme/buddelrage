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
function newSeed() { return (Math.random() * 1e9) | 0; }
function startSingle(mode) {
  const cfg = mode === 'settle'
    ? { mode, W: 1800, H: 640, seed: newSeed(), teams: [{ name: 'Siedler' }], clonks: 1, money: 40, goal: 300, monsters: true, monsterCount: 4 }
    : { mode: 'melee', W: 1700, H: 620, seed: newSeed(), teams: [{ name: 'Du' }, { name: 'KI Rot', ai: true, diff: $('spdiff1').value }], clonks: 1, money: 40, monsters: false };
  if (mode === 'melee3') { cfg.teams.push({ name: 'KI Grün', ai: true, diff: $('spdiff2').value }); cfg.W = 2300; }
  const cn = cleanName($('spcname').value, ''); $('spcname').value = cn; try { localStorage.setItem('br_cname', cn); } catch (e) {}
  cfg.teams[0].cname = cn; cfg.teams[0].helper = $('opthelper').checked;
  cfg.allResearch = $('optallres').checked; cfg.daynight = $('optday').checked; cfg.lava = true;
  if (mode !== 'settle') cfg.money = cfg.allResearch ? 120 : 60;
  G.role = 'single'; G.myTeam = 0; G.spectate = false; G.spMode = mode;
  launchWorld(cfg, false);
  tutStart();
}
function launchWorld(cfg, remote, map) {
  G.cfg = cfg; G.msgs = []; G.demo = null; G.acc = 0;
  const w = new World(cfg, remote);
  if (!remote) w.setup();
  else { w.teams = cfg.teams.map((tc, i) => ({ id: i, name: cleanName(tc.name, 'Team'), color: tc.color || TEAM_COLORS[i % 6], ai: !!tc.ai, diff: AI_DIFF[tc.diff] ? tc.diff : 'normal', helper: !tc.ai && !!tc.helper, stat: '', money: 0, sel: -1, elim: false, keys: {}, res: {}, rq: '', rp: 0 })); if (map) w.loadMap(map); }
  G.world = w; R.attach(w); R.miniDom = $('minimap'); R.resize();
  const me = w.teams[G.myTeam]; const f = w.clonks.find(c => me && c.id === me.sel) || w.clonks[0];
  if (f) { R.cam.x = f.x - cv.width / R.scale / 2; R.cam.y = f.y - cv.height / R.scale / 2; }
  G.paused = false; closeAllMenus(); hideAll(); $('hud').style.display = 'block'; $('menubg').style.display = 'none'; $('toasts').innerHTML = '';
  HUD.sig = {}; HUD.money = null; $('hud-teams').style.display = ''; cv.classList.add('ingame'); updateTouchUI();
  addMsg(cfg.mode === 'settle' ? 'Goldrausch: Verdiene ' + cfg.goal + ' Geld! Grabe Gold und verkaufe es an der Hütte.' : 'Melee: Das letzte überlebende Team gewinnt!');
  input.lastSent = ''; pushKeys(true);
}
function toMenu() {
  G.world = null; G.role = 'none'; p2pClose(); net.link = null; net.code = null; tut.on = false; $('tutorial').style.display = 'none';
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
    case 'joined': net.id = m.id; net.code = m.code; net.host = m.host; net.players = m.players; net.hostId = m.hostId; net.link = m.link || null; $('mpbusy').style.display = 'none'; $('mperr').textContent = ''; showLobby(); break;
    case 'players': net.players = m.players; net.hostId = m.hostId; showLobby(); break;
    case 'start':
      if (net.host) return;
      G.role = 'client'; G.myTeam = m.cfg.teams.findIndex(t => t.pid === net.id); G.spectate = G.myTeam < 0;
      G.pendingCfg = m.cfg; hideAll(); $('loading').style.display = 'flex'; break;
    case 'map':
      if (net.host || !G.pendingCfg) return;
      launchWorld(G.pendingCfg, true, m.m); if (G.spectate) addMsg('Du schaust zu (Spiel lief bereits).'); break;
    case 'snap': if (G.world && G.role === 'client') { G.world.applySnap(m.d); handleEvents(m.ev || []); } break;
    case 'chunks': if (G.world && G.role === 'client') for (const [ci, d] of m.c) G.world.applyChunk(ci, d); break;
    case 'in': if (G.role === 'host' && G.world) { const ti = G.world.teams.findIndex(t => t.pid === m.from); if (ti < 0) return; if (m.k) G.world.setKeys(ti, m.k); if (m.a) G.world.action(ti, m.a, m.arg); } break;
    case 'late': if (G.role === 'host' && G.world) { netSend({ t: 'start', cfg: G.cfg, to: m.id }); netSend({ t: 'map', m: G.world.fullMap(), to: m.id }); addMsg(m.name + ' schaut zu.'); } break;
    case 'left': if (G.role === 'host' && G.world) { const t = G.world.teams.find(t => t.pid === m.id); if (t && !t.ai) { G.world.aiTakeover(t, G.cfg.takeover || 'normal'); addMsg(t.name + ' hat das Spiel verlassen – KI (' + aiDiffName(t.diff) + ') übernimmt.'); } } break;
    case 'hostleft': toMenu(); toast('Der Host hat das Spiel verlassen.', 'warn'); break;
  }
}
function showLobby() {
  showScreen('lobby');
  $('invitebox').style.display = net.host ? 'block' : 'none'; $('clientinfo').style.display = net.host ? 'none' : 'block';
  if (net.host) $('invitelink').value = net.link || '';
  $('lobbyplayers').innerHTML = net.players.map((p, i) => '<li><i style="background:' + TEAM_COLORS[i % 6] + '"></i>' + escapeHtml(p.name) + (p.cname ? ' <span class="muted">· Buddler „' + escapeHtml(p.cname) + '“</span>' : '') + '<small>' + (p.id === net.hostId ? 'Host' : '') + (p.id === net.id ? (p.id === net.hostId ? ' · ' : '') + 'du' : '') + '</small></li>').join('');
  $('hostopts').style.display = net.host ? 'block' : 'none'; renderAiDiffs();
  $('waithost').style.display = net.host ? 'none' : 'block';
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
// Lobby: pro KI-Gegner eine Schwierigkeitsauswahl
function renderAiDiffs() {
  const box = $('aidiffs'); if (!box) return; const n = +$('optai').value;
  const old = [...box.querySelectorAll('select')].map(s => s.value);
  let saved = []; try { saved = JSON.parse(localStorage.getItem('br_lobbydiffs') || '[]'); } catch (e) {}
  box.innerHTML = Array.from({ length: n }, (_, k) => '<label class="field inline">KI ' + (k + 1) + ' <select data-k="' + k + '">' + AI_LEVELS.map(l => '<option value="' + l + '">' + aiDiffName(l) + '</option>').join('') + '</select></label>').join('');
  box.querySelectorAll('select').forEach((s, k) => { s.value = old[k] || saved[k] || 'normal'; s.onchange = () => { try { localStorage.setItem('br_lobbydiffs', JSON.stringify([...box.querySelectorAll('select')].map(x => x.value))); } catch (e) {} }; });
}
function hostStart() {
  const ai = +$('optai').value, cl = +$('optclonks').value, mon = $('optmon').checked;
  const diffs = [...$('aidiffs').querySelectorAll('select')].map(s => s.value), helper = $('opthelper2').checked;
  const teams = net.players.map((p, i) => ({ name: p.name, pid: p.id, color: TEAM_COLORS[i % 6], cname: p.cname || '', helper }));
  for (let k = 0; k < ai; k++) teams.push({ name: 'KI ' + (k + 1), ai: true, diff: diffs[k] || 'normal', color: TEAM_COLORS[teams.length % 6] });
  if (teams.length < 2) { alert('Mindestens 2 Teams nötig (KI-Gegner hinzufügen oder auf Mitspieler warten).'); return; }
  const allRes = $('optallres2').checked;
  const cfg = { mode: 'melee', W: Math.min(3000, 1100 + teams.length * 380), H: 620, seed: newSeed(), teams, clonks: cl, money: allRes ? 120 : 60, monsters: mon, monsterCount: 3, allResearch: allRes, daynight: $('optday2').checked, lava: true, takeover: $('opttakeover').value };
  G.role = 'host'; G.myTeam = teams.findIndex(t => t.pid === net.id); G.spectate = false;
  launchWorld(cfg, false);
  netSend({ t: 'start', cfg }); netSend({ t: 'map', m: G.world.fullMap() });
  G.world.netDirty.clear(); G.chunkSent = new Map();
}
function hostSync() {
  const w = G.world;
  if (w.tick % 3 === 0) { netSend({ t: 'snap', d: w.snap(), ev: G.pendingEv }); G.pendingEv = []; }
  if (w.tick % 3 === 1 && w.netDirty.size) {
    const arr = []; const ls = G.chunkSent || (G.chunkSent = new Map()); const now = w.tick;
    for (const ci of w.netDirty) { if (now - (ls.get(ci) || -99) < 15) continue; arr.push(w.encodeChunk(ci)); w.netDirty.delete(ci); ls.set(ci, now); if (arr.length >= 60) break; }
    if (arr.length) netSend({ t: 'chunks', c: arr });
  }
}

function checkOver() {
  const w = G.world; if (w.state !== 'over' || $('gameover').style.display === 'flex') return;
  let txt, win;
  if (w.mode === 'settle') { win = w.winner === 0; txt = win ? 'Gewonnen! Du hast ' + w.goal + ' Geld verdient.' : 'Verloren! Alle Buddler sind tot.'; }
  else { win = w.winner === G.myTeam; txt = w.winner < 0 ? 'Unentschieden!' : (win ? 'Sieg! Dein Team hat überlebt!' : 'Team ' + w.teams[w.winner].name + ' gewinnt!'); }
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
  drawAimOverlay();
  if (input.mouse.moved && (input.kb.g || pad.keys.g || input.touch.keys.g || myPushingGun())) pushKeys();
  updateHUD(); tutTick();
  checkOver();
  if (w.tick % 30 === 0 && w.tick !== G.lastMenuTick) { G.lastMenuTick = w.tick; if (G.menu === 'shop') renderShop(); else if (G.menu === 'research') renderResearch(); }
}
