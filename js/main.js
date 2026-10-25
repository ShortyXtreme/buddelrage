// BuddelRage – Hauptprogramm: Menüs, Eingabe, Ton, Netzwerk, HUD
'use strict';
const $ = id => document.getElementById(id);
const cv = $('game'); const R = new Renderer(cv);
const G = { world: null, role: 'none', myTeam: 0, paused: false, menu: null, cfg: null, acc: 0, last: 0, msgs: [], pendingEv: [], helpShown: false, spectate: false };
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

// ---------- Ton (OpenClonk-Sounds, CC-BY) ----------
const SFX = { blast: [3, 0.9], throw: [3, 0.5], punch: [3, 0.6], hurt: [3, 0.7], die: [3, 0.8], splash: [3, 0.6], rock: [3, 0.3], growl: [3, 0.7], dig: [5, 0.35], cash: [1, 0.8], uncash: [1, 0.7], fuse: [1, 0.5], click: [1, 0.6], fanfare: [1, 0.8], error: [1, 0.5], grab: [1, 0.5], build: [1, 0.7], hitliving: [1, 0.6], inflame: [1, 0.5], sizzle: [1, 0.6], swing: [3, 0.6], bow: [3, 0.6], shield: [1, 0.7], arrowhit: [1, 0.4], cannon: [1, 0.9], catapult: [1, 0.8], dump: [1, 0.7], door: [1, 0.5], ding: [1, 0.7], metalhit: [1, 0.6] };
const audio = { muted: localStorage.getItem('br_muted') === '1', pool: {} };
for (const [n, [cnt]] of Object.entries(SFX)) { audio.pool[n] = []; for (let i = 1; i <= cnt; i++) { const a = new Audio('assets/sounds/' + n + (cnt > 1 ? i : '') + '.ogg'); a.preload = 'auto'; audio.pool[n].push(a); } }
function playSnd(n, x, y) {
  if (audio.muted || !audio.pool[n]) return;
  let vol = SFX[n][1];
  if (G.world && (x || y)) { const S = R.scale, cx = R.cam.x + cv.width / S / 2, cy = R.cam.y + cv.height / S / 2; const d = Math.hypot(x - cx, y - cy); vol *= Math.max(0, 1 - d / 450); }
  if (vol < 0.03) return;
  const list = audio.pool[n]; const a = list[Math.floor(Math.random() * list.length)].cloneNode();
  a.volume = Math.min(1, vol); a.play().catch(() => { });
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
function addMsg(s) { G.msgs.push({ s, t: performance.now() }); if (G.msgs.length > 6) G.msgs.shift(); }

// ---------- Spielstart ----------
function newSeed() { return (Math.random() * 1e9) | 0; }
function startSingle(mode) {
  const cfg = mode === 'settle'
    ? { mode, W: 1800, H: 640, seed: newSeed(), teams: [{ name: 'Siedler' }], clonks: 3, money: 40, goal: 300, monsters: true, monsterCount: 4 }
    : { mode: 'melee', W: 1700, H: 620, seed: newSeed(), teams: [{ name: 'Du' }, { name: 'KI Rot', ai: true }], clonks: 3, money: 40, monsters: false };
  if (mode === 'melee3') { cfg.teams.push({ name: 'KI Grün', ai: true }); cfg.W = 2300; }
  cfg.allResearch = $('optallres').checked; cfg.daynight = $('optday').checked; cfg.lava = true;
  if (mode !== 'settle') cfg.money = cfg.allResearch ? 120 : 60;
  G.role = 'single'; G.myTeam = 0; G.spectate = false;
  launchWorld(cfg, false);
}
function launchWorld(cfg, remote, map) {
  G.cfg = cfg; G.msgs = [];
  const w = new World(cfg, remote);
  if (!remote) w.setup();
  else { w.teams = cfg.teams.map((tc, i) => ({ id: i, name: tc.name, color: tc.color || TEAM_COLORS[i % 6], ai: !!tc.ai, money: 0, sel: -1, elim: false, keys: {}, res: {}, rq: '', rp: 0 })); if (map) w.loadMap(map); }
  G.world = w; R.attach(w); R.resize();
  const me = w.teams[G.myTeam]; const f = w.clonks.find(c => me && c.id === me.sel) || w.clonks[0];
  if (f) { R.cam.x = f.x - cv.width / R.scale / 2; R.cam.y = f.y - cv.height / R.scale / 2; }
  G.paused = false; closeAllMenus(); hideAll(); $('hud').style.display = 'block';
  addMsg(cfg.mode === 'settle' ? 'Goldrausch: Verdiene ' + cfg.goal + ' Geld! Grabe Gold und verkaufe es an der Hütte.' : 'Melee: Das letzte überlebende Team gewinnt!');
  addMsg('H = Hilfe / Steuerung');
  G.lastSent = '';
}
function toMenu() { G.world = null; G.role = 'none'; p2pClose(); net.link = null; net.code = null; if (location.hash) history.replaceState(null, '', location.href.split('#')[0]); closeAllMenus(); hideAll(); $('hud').style.display = 'none'; $('mainmenu').style.display = 'flex'; }
function hideAll() { for (const id of ['mainmenu', 'mpmenu', 'lobby', 'gameover', 'loading']) $(id).style.display = 'none'; }
function closeAllMenus() { for (const id of ['shop', 'buildmenu', 'pausemenu', 'help', 'research']) $(id).style.display = 'none'; G.menu = null; if (G.role === 'single') G.paused = false; }
function openMenu(id) {
  closeAllMenus(); $(id).style.display = 'block'; G.menu = id; G.menuSel = 0;
  if ((id === 'pausemenu' || id === 'help') && G.role === 'single') G.paused = true;
  if (id === 'shop') renderShop(); else if (id === 'research') renderResearch(); else if (id === 'buildmenu') renderBuild(); else menuHL();
}
// Menü-Navigation (Tastatur ↑↓ + Enter, Gamepad Steuerkreuz + A)
function menuOpts() { return G.menu ? Array.from($(G.menu).querySelectorAll('.opt')) : []; }
function menuHL() { const o = menuOpts(); if (G.menuSel >= o.length) G.menuSel = Math.max(0, o.length - 1); o.forEach((e, i) => e.classList.toggle('hl', i === G.menuSel)); }
function menuMove(d) { const o = menuOpts(); if (!o.length) return; G.menuSel = (G.menuSel + d + o.length) % o.length; menuHL(); }
function menuPick() { const o = menuOpts()[G.menuSel]; if (o) o.click(); }

// ---------- Aktionen ----------
function act(a, arg) {
  if (!G.world || G.spectate) return;
  if (G.role === 'client') netSend({ t: 'in', a, arg });
  else G.world.action(G.myTeam, a, arg);
}
const keys = { l: 0, r: 0, u: 0, d: 0, b: 0 };
function pushKeys() {
  if (!G.world || G.spectate) return;
  const k = {}; for (const n of ['l', 'r', 'u', 'd', 'b']) k[n] = (keys[n] | pad.keys[n]) ? 1 : 0;
  const s = '' + k.l + k.r + k.u + k.d + k.b;
  if (s === G.lastSent) return; G.lastSent = s;
  if (G.role === 'client') netSend({ t: 'in', k }); else G.world.setKeys(G.myTeam, k);
}
let lastDown = 0;
const KEYMAP = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ShiftLeft: 'b', ShiftRight: 'b' };
const MENU_KEYS = { shop: 'KeyB', buildmenu: 'KeyC', research: 'KeyT' };
addEventListener('keydown', e => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (!G.world) return;
  const k = KEYMAP[e.code];
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1'].includes(e.code)) e.preventDefault();
  if (G.world.state === 'over') return;
  if (G.menu) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { menuMove(-1); return; }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { menuMove(1); return; }
    if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); menuPick(); return; }
  }
  if (G.menu === 'shop' || G.menu === 'buildmenu' || G.menu === 'research') {
    let n = parseInt(e.key); if (n === 0) n = 10;
    const o = menuOpts();
    if (n >= 1 && n <= o.length) { o[n - 1].click(); return; }
    if (G.menu === 'shop' && e.code === 'KeyV') { act('sell'); setTimeout(renderShop, 120); return; }
    if (e.code === 'Escape' || e.code === MENU_KEYS[G.menu]) { closeAllMenus(); return; }
    return;
  }
  if (G.menu === 'pausemenu' || G.menu === 'help') { if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'KeyH' || e.code === 'F1') closeAllMenus(); return; }
  if (k) {
    if (!e.repeat) {
      if (k === 'u') act('jump');
      if (k === 'd') { const now = performance.now(); if (now - lastDown < 280) act('digdown'); lastDown = now; }
    }
    keys[k] = 1; pushKeys(); return;
  }
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyX': act('dig'); break;
    case 'Space': act('throw'); break;
    case 'KeyF': act('attack'); break;
    case 'KeyR': case 'KeyG': act('use'); break;
    case 'KeyT': openMenu('research'); break;
    case 'KeyE': act('drop'); break;
    case 'KeyQ': act('inv'); break;
    case 'Tab': act('next'); break;
    case 'KeyB': openMenu('shop'); break;
    case 'KeyC': openMenu('buildmenu'); break;
    case 'KeyV': act('sell'); break;
    case 'KeyM': audio.muted = !audio.muted; localStorage.setItem('br_muted', audio.muted ? '1' : '0'); addMsg(audio.muted ? 'Ton aus' : 'Ton an'); break;
    case 'KeyH': case 'F1': openMenu('help'); break;
    case 'Escape': case 'KeyP': openMenu('pausemenu'); break;
    default: if (/^Digit[1-9]$/.test(e.code)) act('sel', +e.code.slice(5) - 1);
  }
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) { keys[k] = 0; pushKeys(); } });
addEventListener('blur', () => { keys.l = keys.r = keys.u = keys.d = keys.b = 0; pushKeys(); });
addEventListener('resize', () => R.resize());

function myClonk() { const w = G.world; if (!w || G.myTeam < 0) return null; const t = w.teams[G.myTeam]; return w.clonks.find(o => o.id === t.sel && o.act !== 'dead'); }
function renderShop() {
  const w = G.world; if (!w || G.myTeam < 0) return;
  const t = w.teams[G.myTeam]; const c = myClonk();
  const near = c && w.nearBase(c);
  const v = c && c.act === 'push' ? w.vehicles.find(o => o.id === c.veh && o.type === 'lorry') : null;
  const inv = c ? c.inv.concat(v ? v.inv : []) : [];
  let h = '<h2>Heimatbasis – Laden</h2><div class="money">Geld: <b>' + t.money + '</b></div><table>';
  shopList(t).forEach((e, i) => { const p = shopPrice(e.k); h += '<tr class="opt ' + (t.money >= p ? '' : 'dis') + '" onclick="act(\'buy\',\'' + e.k + '\');setTimeout(renderShop,120)"><td class="key">' + (i < 9 ? i + 1 : i === 9 ? 0 : '·') + '</td><td>' + shopName(e.k) + '</td><td class="pr">' + p + '</td></tr>'; });
  const locked = SHOP_ALL.filter(e => e.res && !t.res[e.res]).length;
  h += '</table>' + (locked ? '<div class="hint">' + locked + ' weitere Waren über die Forschung [T] freischalten.</div>' : '');
  h += '<div class="sell opt ' + (near ? '' : 'dis') + '" onclick="act(\'sell\');setTimeout(renderShop,120)"><span class="key">V</span> Inventar' + (v ? ' + Lore' : '') + ' verkaufen' + (inv.length ? ' (' + inv.length + ' Objekte = ' + inv.reduce((s, x) => s + ITEMS[x].sell, 0) + ')' : '') + (near ? '' : ' – nur an Hütte/Burg!') + '</div><div class="hint">Waren landen im Inventar oder vor der Hütte, Fahrzeuge neben der Basis. ↑↓ + Enter wählen, B/Esc schließt.</div>';
  $('shop').innerHTML = h; menuHL();
}
function renderResearch() {
  const w = G.world; if (!w || G.myTeam < 0) return;
  const t = w.teams[G.myTeam];
  let h = '<h2>Forschung</h2><div class="money">Geld: <b>' + t.money + '</b>' + (t.rq ? ' · Aktuell: <b>' + RES_BY[t.rq].name + '</b> ' + Math.floor(t.rp * 100) + '%' : '') + '</div><table>';
  RESEARCH.forEach((r, i) => {
    const done = t.res[r.k], cur = t.rq === r.k, reqOk = !r.req || r.req.every(q => t.res[q]);
    const st = done ? '<span class="ok">✔ erforscht</span>' : cur ? '<span class="run">läuft ' + Math.floor(t.rp * 100) + '%</span>' : !reqOk ? '<span class="lock">benötigt ' + r.req.filter(q => !t.res[q]).map(q => RES_BY[q].name).join(', ') + '</span>' : r.cost + ' Geld · ' + r.time + ' s';
    h += '<tr class="opt ' + (done || !reqOk || (t.rq && !cur) || t.money < r.cost && !cur ? 'dis' : '') + '" onclick="act(\'research\',\'' + r.k + '\');setTimeout(renderResearch,120)"><td class="key">' + (i + 1) + '</td><td><b>' + r.name + '</b><br><small>' + r.desc + '</small></td><td class="pr">' + st + '</td></tr>';
  });
  h += '</table><div class="hint">Forschung kostet Geld und Zeit (nur mit Hütte/Burg). Immer nur ein Projekt gleichzeitig. T/Esc schließt.</div>';
  $('research').innerHTML = h; menuHL();
}
function renderBuild() {
  const w = G.world; if (!w || G.myTeam < 0) return;
  const t = w.teams[G.myTeam];
  const rows = [['hut', 'Hütte', BUILD.hut.price, 'Heimatbasis: Kaufen, Verkaufen, Forschen'], ['bridge', 'Holzbrücke', PRICE_BRIDGE, '40 Pixel in Blickrichtung (brennbar!)'], ['tower', 'Wachturm', BUILD.tower.price, 'betretbar; von oben werfen/schießen, Heilung'], ['castle', 'Burg', BUILD.castle.price, 'Stein-Basis mit Laden, Rüstung beim Betreten, schnelle Heilung']];
  let h = '<h2>Bauen</h2>';
  rows.forEach(([k, n, p, d], i) => { const B = BUILD[k], lock = B && B.res && !t.res[B.res]; h += '<div class="sell opt ' + (lock || t.money < p ? 'dis' : '') + '" onclick="act(\'build\',\'' + k + '\');closeAllMenus()"><span class="key">' + (i + 1) + '</span> ' + n + ' – ' + p + ' Geld <small>(' + (lock ? 'erst erforschen: ' + RES_BY[B.res].name : d) + ')</small></div>'; });
  h += '<div class="hint">Gebäude werden als Baustelle errichtet; Buddler in der Nähe bauen sie auf. C/Esc schließt.</div>';
  $('buildmenu').innerHTML = h; menuHL();
}

// ---------- Gamepad (Gamepad-API, Standard-Belegung) ----------
const pad = { prev: [], had: false, pu: 0, pd: 0, lastDown: 0, keys: { l: 0, r: 0, u: 0, d: 0, b: 0 }, sel: 0 };
function pollPad() {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null; for (const g of list || []) if (g && g.connected !== false && g.buttons && g.buttons.length) { gp = g; break; }
  if (!gp) { if (pad.had) { pad.had = false; pad.keys = { l: 0, r: 0, u: 0, d: 0, b: 0 }; pushKeys(); } return; }
  if (!pad.had) { pad.had = true; addMsg('Gamepad verbunden – Belegung: H (Hilfe)'); }
  const B = i => { const b = gp.buttons[i]; return !!b && (b.pressed || b.value > 0.5); };
  const ax = gp.axes || [];
  const st = { l: (ax[0] || 0) < -0.45 || B(14), r: (ax[0] || 0) > 0.45 || B(15), u: (ax[1] || 0) < -0.6 || B(12) || B(0), d: (ax[1] || 0) > 0.6 || B(13), b: B(6) };
  const edge = i => B(i) && !pad.prev[i];
  const upE = st.u && !pad.pu, downE = st.d && !pad.pd;
  const w = G.world;
  if (!w) { // Hauptmenü / Lobby
    const btns = Array.from(document.querySelectorAll('.screen')).filter(s => s.style.display === 'flex').flatMap(s => Array.from(s.querySelectorAll('button'))).filter(b => b.offsetParent);
    if (btns.length) { if (upE) pad.sel--; if (downE) pad.sel++; pad.sel = (pad.sel + btns.length) % btns.length; btns.forEach((b, i) => b.classList.toggle('hl', i === pad.sel)); if (edge(0)) btns[pad.sel].click(); }
  } else if (G.menu) {
    if (upE) menuMove(-1); if (downE) menuMove(1);
    if (edge(0)) menuPick();
    if (edge(1) || edge(9) || (edge(8) && G.menu === 'shop') || (edge(11) && G.menu === 'research')) closeAllMenus();
    pad.keys = { l: 0, r: 0, u: 0, d: 0, b: 0 }; pushKeys();
  } else if ($('gameover').style.display === 'flex') {
    if (edge(0)) $(G.role === 'single' ? 'againbtn' : 'menubtn').click();
  } else {
    pad.keys = { l: +st.l, r: +st.r, u: +st.u, d: +st.d, b: +st.b }; pushKeys();
    if (upE) act('jump');
    if (downE) { const now = performance.now(); if (now - pad.lastDown < 280) act('digdown'); pad.lastDown = now; }
    if (edge(1)) act('dig'); if (edge(2)) act('throw'); if (edge(3)) act('attack');
    if (edge(4)) act('inv'); if (edge(5)) act('next'); if (edge(7)) act('use'); if (edge(10)) act('drop');
    if (edge(8)) openMenu('shop'); if (edge(9)) openMenu('pausemenu'); if (edge(11)) openMenu('research');
  }
  pad.prev = gp.buttons.map((b, i) => B(i)); pad.pu = st.u; pad.pd = st.d;
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
    case 'left': if (G.role === 'host' && G.world) { const t = G.world.teams.find(t => t.pid === m.id); if (t) { t.ai = true; addMsg(t.name + ' hat das Spiel verlassen – KI übernimmt.'); } } break;
    case 'hostleft': alert('Der Host hat das Spiel verlassen.'); toMenu(); break;
  }
}
function showLobby() {
  hideAll(); $('lobby').style.display = 'flex';
  $('invitebox').style.display = net.host ? 'block' : 'none'; $('clientinfo').style.display = net.host ? 'none' : 'block';
  if (net.host) $('invitelink').value = net.link || '';
  $('lobbyplayers').innerHTML = net.players.map((p, i) => '<li style="color:' + TEAM_COLORS[i % 6] + '">' + escapeHtml(p.name) + (p.id === net.hostId ? ' (Host)' : '') + (p.id === net.id ? ' – du' : '') + '</li>').join('');
  $('hostopts').style.display = net.host ? 'block' : 'none';
  $('waithost').style.display = net.host ? 'none' : 'block';
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function hostStart() {
  const ai = +$('optai').value, cl = +$('optclonks').value, mon = $('optmon').checked;
  const teams = net.players.map((p, i) => ({ name: p.name, pid: p.id, color: TEAM_COLORS[i % 6] }));
  for (let k = 0; k < ai; k++) teams.push({ name: 'KI ' + (k + 1), ai: true, color: TEAM_COLORS[teams.length % 6] });
  if (teams.length < 2) { alert('Mindestens 2 Teams nötig (KI-Gegner hinzufügen oder auf Mitspieler warten).'); return; }
  const allRes = $('optallres2').checked;
  const cfg = { mode: 'melee', W: Math.min(3000, 1100 + teams.length * 380), H: 620, seed: newSeed(), teams, clonks: cl, money: allRes ? 120 : 60, monsters: mon, monsterCount: 3, allResearch: allRes, daynight: $('optday2').checked, lava: true };
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

// ---------- HUD ----------
const ACT_DE = { walk: 'Läuft', jump: 'Springt', climb: 'Klettert', hangle: 'Hangelt', dig: 'Gräbt', swim: 'Schwimmt', fight: 'Kämpft', tumble: 'Taumelt', dead: 'Tot', push: 'Schiebt' };
function panel(g, x, y, w, h) { g.fillStyle = 'rgba(20,16,10,0.72)'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(230,200,140,0.6)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
function drawHUD() {
  const g = cv.getContext('2d'), w = G.world, W = cv.width, H = cv.height;
  g.font = 'bold 14px "Trebuchet MS", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
  const me = G.myTeam >= 0 ? w.teams[G.myTeam] : null;
  if (me) {
    const own = w.clonks.filter(c => c.team === me.id && c.act !== 'dead');
    panel(g, 10, 10, 230, 50 + own.length * 20);
    g.fillStyle = me.color; g.fillRect(16, 16, 10, 10);
    g.fillStyle = '#fff'; g.fillText(me.name, 32, 22);
    g.fillStyle = '#f5c823'; g.beginPath(); g.arc(22, 42, 6, 0, 7); g.fill(); g.fillStyle = '#ffe680';
    g.fillText(me.money + (w.mode === 'settle' ? ' / ' + w.goal + ' Geld (Ziel)' : ' Geld'), 32, 42);
    own.forEach((c, i) => {
      const y = 62 + i * 20; const sel = c.id === me.sel;
      if (sel) { g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(12, y - 9, 226, 18); }
      g.fillStyle = sel ? '#fff' : '#bbb'; g.font = (sel ? 'bold ' : '') + '13px "Trebuchet MS", sans-serif';
      g.fillText((i + 1) + ' ' + c.name, 18, y);
      g.fillStyle = '#300'; g.fillRect(110, y - 4, 70, 8); g.fillStyle = c.hp > 50 ? '#4c4' : c.hp > 25 ? '#ec3' : '#e33'; g.fillRect(110, y - 4, 70 * c.hp / 100, 8);
      g.fillStyle = c.fire ? '#f84' : '#ccc'; g.font = '11px sans-serif'; g.fillText(c.fire ? 'Brennt!' : c.inside ? 'Drinnen' : c.block ? 'Blockt' : (ACT_DE[c.act] || ''), 186, y);
      if (c.knight || c.armor) { g.fillStyle = '#c8ccd2'; g.fillRect(100, y - 4, 6, 7); g.fillStyle = '#7a8088'; g.fillRect(100, y - 4, 6, 2); }
    });
    // Forschung
    let ry = 62 + own.length * 20;
    if (me.rq) { panel(g, 10, ry, 230, 26); g.fillStyle = '#cdf'; g.font = '12px sans-serif'; g.fillText('Forschung: ' + RES_BY[me.rq].name, 18, ry + 9); g.fillStyle = '#123'; g.fillRect(18, ry + 16, 214, 5); g.fillStyle = '#6af'; g.fillRect(18, ry + 16, 214 * me.rp, 5); }
    const c = w.clonks.find(o => o.id === me.sel && o.act !== 'dead');
    if (c) {
      panel(g, 10, H - 70, 200, 60);
      for (let s = 0; s < INV_MAX; s++) {
        const x = 18 + s * 46, y = H - 62;
        g.fillStyle = s === 0 ? 'rgba(255,220,120,0.25)' : 'rgba(255,255,255,0.08)'; g.fillRect(x, y, 40, 40); g.strokeStyle = s === 0 ? '#fc6' : '#665'; g.strokeRect(x + 0.5, y + 0.5, 39, 39);
        const it = c.inv[s]; if (it) { g.save(); g.translate(x + 20, y + 28); g.scale(5, 5); ITEM_DRAW[it](g, 0, 0, null); g.restore(); }
      }
      g.fillStyle = '#eee'; g.font = '12px sans-serif';
      const extra = (c.armor ? ' · Rüstung' : '') + (c.inv.includes('bow') || c.arrows ? ' · Pfeile: ' + c.arrows : '');
      panel(g, 214, H - 70, 260, 60); g.fillStyle = '#eee'; g.font = '12px sans-serif';
      g.fillText(c.inv[0] ? 'Wurf: ' + ITEMS[c.inv[0]].name : 'Hände leer', 222, H - 58);
      g.fillText('Waffe [F]: ' + (c.inv.includes('sword') ? 'Schwert' : '') + (c.inv.includes('sword') && c.inv.includes('bow') ? ' / ' : '') + (c.inv.includes('bow') ? 'Bogen' : '') + (!c.inv.includes('sword') && !c.inv.includes('bow') ? 'Faust' : ''), 222, H - 40);
      g.fillText((c.inv.includes('shield') ? 'Schild [Shift]' : '') + extra, 222, H - 22);
      const near = w.nearBase(c);
      let hint = '';
      if (c.inside) { const s = w.structs.find(o => o.id === c.inside); hint = 'In: ' + (s ? BUILD[s.type].name : '?') + ' – [R] verlassen · [Leertaste]/[F] von oben werfen/schießen' + (s && BUILD[s.type].base ? ' · [B] Laden' : ''); }
      else if (c.act === 'push') { const v = w.vehicles.find(o => o.id === c.veh); if (v) hint = VEH[v.type].name + (v.type === 'lorry' ? ' (' + v.inv.length + '/' + VEH.lorry.cap + '): [Leertaste] einladen · [E] ausladen · [V] an Basis verkaufen' : ': [Leertaste] feuern · [↑↓] Winkel ' + Math.round(v.ang * 57) + '°' + (v.inv.length ? ' · Munition: ' + v.inv.length : '')) + ' · [R] loslassen'; }
      else if (near) hint = BUILD[near.type].name + ': [B] Kaufen · [V] Verkaufen · [T] Forschung · [R] Betreten';
      else { const v = w.vehicles.find(o => !o.pusher && Math.abs(o.x - c.x) < VEH[o.type].w / 2 + 5 && Math.abs(o.y - c.y) < 8); const s = w.structs.find(o => o.team === me.id && o.prog >= 1 && Math.abs(c.x - o.x) < Math.min(14, o.w / 2) && c.y > o.y - 10 && c.y < o.y + 5); if (v && !(s && Math.abs(s.x - c.x) < Math.abs(v.x - c.x))) hint = '[R] ' + VEH[v.type].name + ' anfassen'; else if (s) hint = '[R] ' + BUILD[s.type].name + ' betreten'; }
      if (hint) { g.textAlign = 'center'; g.font = 'bold 13px sans-serif'; const tw = g.measureText(hint).width + 24; panel(g, W / 2 - tw / 2, H - 104, tw, 26); g.fillStyle = '#ffe680'; g.fillText(hint, W / 2, H - 91); g.textAlign = 'left'; }
      if (c.act === 'dig') { g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText('Graben: ←→ Richtung, ↑↓ Winkel, X stoppt', W / 2, H - 60); g.textAlign = 'left'; }
    } else if (!w.clonks.some(o => o.team === me.id && o.act !== 'dead') && w.state === 'run') {
      g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = 'bold 18px sans-serif'; g.fillText(me.money >= PRICE_CLONK ? 'Alle Buddler tot – [B] neuen Buddler kaufen!' : 'Alle Buddler tot!', W / 2, H / 2); g.textAlign = 'left';
    }
  } else if (G.spectate) { g.fillStyle = '#fff'; g.fillText('Zuschauer-Modus', 16, 22); }
  // andere Teams
  if (w.teams.length > 1) {
    const x0 = W - 190, y0 = R.mini.height + 24;
    panel(g, x0, y0, 180, 10 + w.teams.length * 18);
    w.teams.forEach((t, i) => { const alive = w.clonks.filter(c => c.team === t.id && c.act !== 'dead').length; g.fillStyle = t.color; g.fillRect(x0 + 8, y0 + 10 + i * 18, 8, 8); g.fillStyle = t.elim ? '#777' : '#fff'; g.font = '12px sans-serif'; g.fillText(t.name.slice(0, 14) + (t.elim ? ' ✝' : '  ♟' + alive), x0 + 22, y0 + 14 + i * 18); });
  }
  // Tageszeit
  { const p = w.dayPhase(), hh = Math.floor(p * 24), mm = Math.floor((p * 24 - hh) * 60), day = w.daylight() > 0.5;
    if (w.cfg.daynight !== false) { g.textAlign = 'center'; panel(g, W / 2 - 52, 8, 104, 22); g.fillStyle = day ? '#ffe680' : '#bcd'; g.font = 'bold 12px sans-serif'; g.fillText((day ? '☀ Tag ' : '☾ Nacht ') + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'), W / 2, 19); g.textAlign = 'left'; } }
  if (pad.had) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = '11px sans-serif'; g.textAlign = 'right'; g.fillText('🎮 Gamepad', W - 10, H - 24); g.textAlign = 'left'; }
  if (net.code && G.role !== 'single') { g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = '11px monospace'; g.textAlign = 'right'; g.fillText(net.code + (G.role === 'host' ? ' (Host)' : ''), W - 10, H - 10); g.textAlign = 'left'; }
  // Nachrichten
  const now = performance.now(); G.msgs = G.msgs.filter(m => now - m.t < 6000);
  g.textAlign = 'center'; g.font = 'bold 15px "Trebuchet MS", sans-serif';
  G.msgs.forEach((m, i) => { const a = Math.min(1, (6000 - (now - m.t)) / 800); g.globalAlpha = a; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(m.s, W / 2 + 1, 81 + i * 20); g.fillStyle = '#fff6d0'; g.fillText(m.s, W / 2, 80 + i * 20); });
  g.globalAlpha = 1; g.textAlign = 'left';
  if (G.paused && G.menu === 'pausemenu') { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 0, W, H); }
}
function checkOver() {
  const w = G.world; if (w.state !== 'over' || $('gameover').style.display === 'flex') return;
  let txt;
  if (w.mode === 'settle') txt = w.winner === 0 ? 'Gewonnen! Du hast ' + w.goal + ' Geld verdient.' : 'Verloren! Alle Buddler sind tot.';
  else txt = w.winner < 0 ? 'Unentschieden!' : (w.winner === G.myTeam ? 'Sieg! Dein Team hat überlebt!' : 'Team ' + w.teams[w.winner].name + ' gewinnt!');
  $('gameovertext').textContent = txt; $('gameover').style.display = 'flex';
  $('againbtn').style.display = G.role === 'single' ? 'inline-block' : 'none';
}

// ---------- Hauptschleife ----------
const STEP = 1000 / 60;
function frame(ts) {
  requestAnimationFrame(frame);
  try { pollPad(); } catch (e) { }
  const w = G.world; if (!w) return;
  const dt = Math.min(250, ts - (G.last || ts)); G.last = ts;
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
  drawHUD();
  checkOver();
  if (w.tick % 30 === 0 && w.tick !== G.lastMenuTick) { G.lastMenuTick = w.tick; if (G.menu === 'shop') renderShop(); else if (G.menu === 'research') renderResearch(); }
}

// ---------- Menü-Buttons ----------
$('btnsettle').onclick = () => startSingle('settle');
$('btnmelee').onclick = () => startSingle('melee');
$('btnmelee3').onclick = () => startSingle('melee3');
function openMp() { hideAll(); $('mpmenu').style.display = 'flex'; $('mpbusy').style.display = 'none'; const r = roomFromHash(); if (r) $('mplink').value = inviteLink(r); $('mperr').textContent = typeof Peer === 'undefined' ? 'PeerJS konnte nicht geladen werden.' : (location.protocol === 'file:' ? 'Hinweis: Per Doppelklick (file://) klappt WebRTC evtl. nicht – besser über https:// (GitHub Pages) öffnen.' : ''); if (r) $('mpjoinpw').focus(); }
$('btnmp').onclick = openMp;
$('btnback').onclick = () => toMenu();
function mpName() { const name = ($('mpname').value.trim() || 'Spieler').slice(0, 16); localStorage.setItem('br_name', name); return name; }
$('btncreate').onclick = () => {
  const pw = $('mppw').value; if (pw.length < 4) { $('mperr').textContent = 'Bitte ein Raumpasswort mit mindestens 4 Zeichen festlegen.'; $('mppw').focus(); return; }
  $('mperr').textContent = ''; $('mpbusy').textContent = 'Raum wird erstellt…'; $('mpbusy').style.display = 'block';
  p2pCreate(mpName(), pw, mpErr).catch(e => mpErr('Fehler: ' + e));
};
$('btnjoin').onclick = () => {
  const v = $('mplink').value.trim(); const mm = /raum=([A-Za-z0-9_-]{22,})/.exec(v) || /^([A-Za-z0-9_-]{22,})$/.exec(v);
  if (!mm) { $('mperr').textContent = 'Bitte den vollständigen Einladungslink einfügen.'; return; }
  const pw = $('mpjoinpw').value; if (!pw) { $('mperr').textContent = 'Bitte das Raumpasswort eingeben.'; $('mpjoinpw').focus(); return; }
  $('mperr').textContent = ''; $('mpbusy').textContent = 'Verbinde mit Host…'; $('mpbusy').style.display = 'block';
  p2pJoin(mm[1], mpName(), pw, mpErr).catch(e => mpErr('Fehler: ' + e));
};
$('mpjoinpw').onkeydown = e => { if (e.key === 'Enter') $('btnjoin').onclick(); };
$('mppw').onkeydown = e => { if (e.key === 'Enter') $('btncreate').onclick(); };
$('btncopy').onclick = () => { const i = $('invitelink'); const done = () => { $('btncopy').textContent = '✔ Kopiert'; setTimeout(() => $('btncopy').textContent = 'Link kopieren', 1800); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(i.value).then(done, () => { i.select(); document.execCommand('copy'); done(); }); else { i.select(); document.execCommand('copy'); done(); } };
$('btnstart').onclick = hostStart;
$('btnleave').onclick = () => toMenu();
$('btnresume').onclick = () => closeAllMenus();
$('btnhelp').onclick = () => openMenu('help');
$('btnbuildp').onclick = () => openMenu('buildmenu');
$('btnresp').onclick = () => openMenu('research');
$('btnshopp').onclick = () => openMenu('shop');
$('btnmute').onclick = () => { audio.muted = !audio.muted; localStorage.setItem('br_muted', audio.muted ? '1' : '0'); };
$('btnquit').onclick = () => toMenu();
$('btnrestart').onclick = () => { if (G.role === 'single') { const m = G.cfg.mode === 'settle' ? 'settle' : (G.cfg.teams.length > 2 ? 'melee3' : 'melee'); startSingle(m); } };
$('againbtn').onclick = () => $('btnrestart').onclick();
$('menubtn').onclick = () => toMenu();
$('mpname').value = localStorage.getItem('br_name') || ('Buddler' + ((Math.random() * 90 + 10) | 0));
$('mainmenu').style.display = 'none'; $('loading').style.display = 'flex';
loadTextures().then(() => { $('loading').style.display = 'none'; $('mainmenu').style.display = 'flex'; R.resize(); requestAnimationFrame(frame); if (roomFromHash()) openMp(); });
// für Tests
window.__G = G; window.__startSingle = startSingle; window.__pad = pad;
