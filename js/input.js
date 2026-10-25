// BuddelRage – Eingabe: Tastatur + Maus (frei belegbar), Gamepad (Twin-Stick), Touch (virtueller Stick + Knöpfe)
'use strict';
const ACTIONS = [
  { k: 'left', n: 'Nach links laufen', g: 'Bewegung', def: ['KeyA', 'ArrowLeft'] },
  { k: 'right', n: 'Nach rechts laufen', g: 'Bewegung', def: ['KeyD', 'ArrowRight'] },
  { k: 'up', n: 'Hoch: Klettern, Hangeln, Schwimmen', g: 'Bewegung', def: ['KeyW', 'ArrowUp'] },
  { k: 'down', n: 'Runter / Loslassen (2× = senkrecht graben)', g: 'Bewegung', def: ['KeyS', 'ArrowDown'] },
  { k: 'jump', n: 'Springen (an Wänden halten = klettern)', g: 'Bewegung', def: ['Space'] },
  { k: 'sprint', n: 'Sprinten (halten)', g: 'Bewegung', def: ['ShiftLeft', 'ShiftRight'] },
  { k: 'primary', n: 'Aktion: Werfen / Schlagen / Schießen / Feuern (zum Mauszeiger)', g: 'Aktionen', def: ['Mouse0'] },
  { k: 'secondary', n: 'Graben halten (zum Mauszeiger) · mit Schwert/Schild: Blocken', g: 'Aktionen', def: ['Mouse2'] },
  { k: 'interact', n: 'Benutzen: Fahrzeug, Tür, Gebäude, Aufheben', g: 'Aktionen', def: ['KeyE'] },
  { k: 'drop', n: 'Ablegen · Lore ausladen', g: 'Aktionen', def: ['KeyQ'] },
  { k: 'attack', n: 'Nahkampf (Schwert / Faust)', g: 'Aktionen', def: ['KeyF'] },
  { k: 'dig', n: 'Graben an/aus (ohne Maus)', g: 'Aktionen', def: ['KeyX'] },
  { k: 'slot1', n: 'Inventarplatz 1', g: 'Inventar', def: ['Digit1'] },
  { k: 'slot2', n: 'Inventarplatz 2', g: 'Inventar', def: ['Digit2'] },
  { k: 'slot3', n: 'Inventarplatz 3', g: 'Inventar', def: ['Digit3'] },
  { k: 'nextclonk', n: 'Nächster Buddler', g: 'Inventar', def: ['Tab'] },
  { k: 'shop', n: 'Laden (Kaufen)', g: 'Menüs', def: ['KeyB'] },
  { k: 'sell', n: 'Verkaufen (an Hütte/Burg)', g: 'Menüs', def: ['KeyV'] },
  { k: 'build', n: 'Bauen', g: 'Menüs', def: ['KeyC'] },
  { k: 'research', n: 'Forschung', g: 'Menüs', def: ['KeyT'] },
  { k: 'help', n: 'Hilfe / Steuerung', g: 'Menüs', def: ['KeyH', 'F1'] },
  { k: 'settings', n: 'Einstellungen', g: 'Menüs', def: ['KeyO'] },
  { k: 'mute', n: 'Ton an/aus', g: 'Menüs', def: ['KeyM'] },
];
const ACT_BY = Object.fromEntries(ACTIONS.map(a => [a.k, a]));
let binds = {};
function loadBinds() {
  let saved = {}; try { saved = JSON.parse(localStorage.getItem('br_binds') || '{}'); } catch (e) { }
  binds = {}; for (const a of ACTIONS) binds[a.k] = Array.isArray(saved[a.k]) ? saved[a.k].slice(0, 2) : a.def.slice();
}
function saveBinds() { try { localStorage.setItem('br_binds', JSON.stringify(binds)); } catch (e) { } }
function resetBinds() { localStorage.removeItem('br_binds'); loadBinds(); }
function actionsFor(code) { const r = []; for (const a of ACTIONS) if (binds[a.k].includes(code)) r.push(a.k); return r; }
loadBinds();

// ---------- Tasten-Symbole ----------
const CODE_LABEL = { Space: 'Leertaste', ShiftLeft: 'Shift', ShiftRight: 'Shift ⇧', ControlLeft: 'Strg', ControlRight: 'Strg ⇨', AltLeft: 'Alt', AltRight: 'AltGr', Tab: 'Tab', Enter: 'Enter', Escape: 'Esc', Backspace: '⌫', CapsLock: 'Feststell', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Mouse0: 'Linksklick', Mouse1: 'Mittelklick', Mouse2: 'Rechtsklick', Mouse3: 'Maus 4', Mouse4: 'Maus 5', WheelUp: 'Rad ↑', WheelDown: 'Rad ↓', Backquote: '^', Minus: 'ß', Equal: '´', BracketLeft: 'Ü', BracketRight: '+', Semicolon: 'Ö', Quote: 'Ä', Backslash: '#', Comma: ',', Period: '.', Slash: '-', IntlBackslash: '<' };
function codeLabel(code) {
  if (!code) return '–';
  if (CODE_LABEL[code]) return CODE_LABEL[code];
  if (/^Key[A-Z]$/.test(code)) { const c = code.slice(3); return c === 'Y' ? 'Z' : c === 'Z' ? 'Y' : c; } // deutsches QWERTZ
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return 'Num ' + code.slice(6);
  return code;
}
const MOUSE_SVG = b => '<svg class="msvg" viewBox="0 0 16 22" aria-hidden="true"><rect x="1" y="1" width="14" height="20" rx="7" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="8" y1="1.5" x2="8" y2="9" stroke="currentColor" stroke-width="1.3"/>' +
  (b === 0 ? '<path d="M8 1.6 A6.4 6.4 0 0 0 1.8 8 L1.8 9 L8 9Z" fill="#ffcf5a"/>' : b === 2 ? '<path d="M8 1.6 A6.4 6.4 0 0 1 14.2 8 L14.2 9 L8 9Z" fill="#ffcf5a"/>' : '<rect x="6.6" y="4" width="2.8" height="4" rx="1.4" fill="#ffcf5a"/>') + '</svg>';
function keyCap(code, extra) {
  if (!code) return '<kbd class="k none">–</kbd>';
  const m = /^Mouse(\d)$/.exec(code);
  if (m) { const b = +m[1]; return '<kbd class="k mouse">' + MOUSE_SVG(b) + (extra === 'short' ? '' : '<span>' + (b === 0 ? 'LMT' : b === 2 ? 'RMT' : codeLabel(code)) + '</span>') + '</kbd>'; }
  const l = codeLabel(code); return '<kbd class="k' + (l.length > 3 ? ' wide' : '') + '">' + l + '</kbd>';
}
function bindCap(action, both) { const b = binds[action] || []; if (!b.length) return keyCap(null); return both && b[1] ? keyCap(b[0]) + '<i class="or">/</i>' + keyCap(b[1]) : keyCap(b[0]); }
function bindLabel(action) { const b = binds[action] || []; return b.length ? codeLabel(b[0]) : '–'; }
const PAD_GLYPH = { A: ['A', '#3fbf5f'], B: ['B', '#e04b4b'], X: ['X', '#3f8fe0'], Y: ['Y', '#e0c03f'], LB: ['LB'], RB: ['RB'], LT: ['LT'], RT: ['RT'], LS: ['L-Stick'], RS: ['R-Stick'], L3: ['L3'], R3: ['R3'], Select: ['Select'], Start: ['Start'], DP: ['Steuerkreuz'] };
function padCap(b) { const g = PAD_GLYPH[b] || [b]; return g[1] ? '<kbd class="k pad round" style="--pc:' + g[1] + '">' + g[0] + '</kbd>' : '<kbd class="k pad' + (g[0].length > 3 ? ' wide' : '') + '">' + g[0] + '</kbd>'; }

// ---------- Zustand ----------
const input = { kb: { l: 0, r: 0, u: 0, d: 0, s: 0, g: 0 }, mouse: { x: 0, y: 0, in: false, moved: false }, mode: 'mouse', listen: null, lastDown: 0, wheelT: 0, lastSent: '', lastAimT: 0, sentAx: 0, sentAy: 0, touch: { keys: { l: 0, r: 0, u: 0, d: 0, g: 0 }, aim: null, on: false } };
const keys = input.kb; // Kompatibilität
const pad = { prev: [], had: false, pu: 0, pd: 0, lastDown: 0, keys: { l: 0, r: 0, u: 0, d: 0, b: 0, s: 0, g: 0 }, sel: 0, aim: null };

function screenToWorld(sx, sy) { const v = R.view || { cx: R.cam.x, cy: R.cam.y, S: R.scale }; return [v.cx + sx / v.S, v.cy + sy / v.S]; }
function aimPoint() {
  const c = myClonk(); if (!c) return null;
  if (input.mode === 'touch' && input.touch.aim) return input.touch.aim;
  if (input.mode === 'pad') { if (!pad.aim) return null; const ox = c.rx !== undefined && G.world.remote ? c.rx : c.x, oy = c.ry !== undefined && G.world.remote ? c.ry : c.y; return [ox + pad.aim[0] * 90, oy - 6 + pad.aim[1] * 90]; }
  if (input.mode === 'mouse' && input.mouse.moved) return screenToWorld(input.mouse.x, input.mouse.y);
  return null;
}
function aimArg() { const a = aimPoint(); return a ? [Math.round(a[0]), Math.round(a[1])] : null; }
function canPlay() { return G.world && !G.spectate && G.world.state === 'run' && !G.menu; }

// ---------- Aktionen senden ----------
function act(a, arg) {
  if (!G.world || G.spectate) return;
  if (typeof tutNote === 'function') tutNote(a);
  if (G.role === 'client') netSend({ t: 'in', a, arg });
  else G.world.action(G.myTeam, a, arg);
}
function pushKeys(force) {
  if (!G.world || G.spectate) return;
  const T = input.touch.keys, P = pad.keys, K = input.kb, off = !!G.menu;
  const k = {}; for (const n of ['l', 'r', 'u', 'd', 's', 'g']) k[n] = off ? 0 : ((K[n] | P[n] | (T[n] || 0)) ? 1 : 0);
  k.b = 0;
  const a = aimPoint(); k.am = a ? 1 : 0; k.ax = a ? Math.round(a[0]) : 0; k.ay = a ? Math.round(a[1]) : 0;
  const s = '' + k.l + k.r + k.u + k.d + k.s + k.g + k.am;
  const now = performance.now();
  const aimMoved = k.am && (Math.abs(k.ax - input.sentAx) > 2 || Math.abs(k.ay - input.sentAy) > 2);
  if (G.role === 'client') {
    if (!force && s === input.lastSent && !(aimMoved && now - input.lastAimT > 60 && (k.g || myPushingGun()))) return;
    input.lastSent = s; input.lastAimT = now; input.sentAx = k.ax; input.sentAy = k.ay; netSend({ t: 'in', k });
  } else { input.lastSent = s; G.world.setKeys(G.myTeam, k); }
}
function myPushingGun() { const c = myClonk(); if (!c || c.act !== 'push') return false; const v = G.world.vehicles.find(o => o.id === c.veh); return v && VEH[v.type].gun; }
function releaseAll() { for (const n in input.kb) input.kb[n] = 0; pushKeys(true); }

// ---------- Drücken / Loslassen (Tastatur & Maus gemeinsam) ----------
const HOLD = { left: 'l', right: 'r', up: 'u', down: 'd', jump: 'u', sprint: 's', secondary: 'g' };
function toggleMenu(id) { if (G.menu === id) closeAllMenus(); else openMenu(id); }
function press(code, repeat) {
  const list = actionsFor(code); if (!list.length) return false;
  let used = false;
  for (const a of list) {
    if (HOLD[a]) {
      if (!canPlay()) continue;
      if (!repeat) {
        if (a === 'jump' || a === 'up') act('jump');
        if (a === 'down') { const now = performance.now(); if (now - input.lastDown < 280) act('digdown'); input.lastDown = now; }
      }
      input.kb[HOLD[a]] = 1; used = true; continue;
    }
    if (repeat) { used = true; continue; }
    used = true;
    switch (a) {
      case 'primary': if (canPlay()) act('primary', aimArg()); break;
      case 'interact': if (canPlay()) act('interact'); break;
      case 'drop': if (canPlay()) act('drop'); break;
      case 'attack': if (canPlay()) act('attack'); break;
      case 'dig': if (canPlay()) act('dig'); break;
      case 'slot1': case 'slot2': case 'slot3': if (canPlay()) act('slot', +a.slice(4) - 1); break;
      case 'nextclonk': if (canPlay()) act('next'); break;
      case 'shop': if (G.world && G.world.state === 'run') toggleMenu('shop'); break;
      case 'build': if (G.world && G.world.state === 'run') toggleMenu('buildmenu'); break;
      case 'research': if (G.world && G.world.state === 'run') toggleMenu('research'); break;
      case 'sell': if (G.world && G.world.state === 'run') { act('sell'); if (G.menu === 'shop') setTimeout(renderShop, 120); } break;
      case 'help': toggleMenu('help'); break;
      case 'settings': toggleMenu('settings'); break;
      case 'mute': audio.muted = !audio.muted; toast(audio.muted ? 'Ton aus' : 'Ton an', 'info'); break;
    }
  }
  pushKeys();
  return used;
}
function release(code) {
  if (!actionsFor(code).some(a => HOLD[a])) return;
  const nk = { l: 0, r: 0, u: 0, d: 0, s: 0, g: 0 };
  for (const a in HOLD) if (binds[a] && binds[a].some(c => heldCodes.has(c))) nk[HOLD[a]] = 1;
  for (const n in nk) input.kb[n] = nk[n] && canPlay() ? 1 : 0;
  pushKeys();
}
const heldCodes = new Set();

// ---------- Tastatur ----------
addEventListener('keydown', e => {
  if (input.listen) { e.preventDefault(); finishListen(e.code); return; }
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') { if (e.code === 'Escape') document.activeElement.blur(); return; }
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1'].includes(e.code)) e.preventDefault();
  if (input.mode !== 'mouse' && input.mode !== 'touch') input.mode = 'mouse';
  heldCodes.add(e.code);
  if (G.menu) { if (menuKey(e)) return; }
  if (!G.world) { if (e.code === 'Escape') menuBack(); return; }
  if (e.code === 'Escape') { if (G.world.state === 'run') openMenu('pausemenu'); return; }
  if (G.world.state === 'over') return;
  press(e.code, e.repeat);
});
addEventListener('keyup', e => { heldCodes.delete(e.code); release(e.code); });
addEventListener('blur', () => { heldCodes.clear(); releaseAll(); });
function menuKey(e) { // Tasten in Menüs
  const id = G.menu, c = e.code;
  if (c === 'Escape') { closeAllMenus(); return true; }
  if (c === 'ArrowUp' || (c === 'KeyW' && !e.repeat)) { menuMove(-1); return true; }
  if (c === 'ArrowDown' || (c === 'KeyS' && !e.repeat)) { menuMove(1); return true; }
  if (c === 'ArrowLeft') { menuMove(-1); return true; }
  if (c === 'ArrowRight') { menuMove(1); return true; }
  if (c === 'Enter' || c === 'Space') { e.preventDefault(); menuPick(); return true; }
  if (id === 'shop' || id === 'buildmenu' || id === 'research') {
    let n = /^Digit\d$/.test(c) ? +c.slice(5) : NaN; if (n === 0) n = 10;
    const o = menuOpts();
    if (n >= 1 && n <= o.length) { o[n - 1].click(); return true; }
  }
  const own = { shop: 'shop', buildmenu: 'build', research: 'research', help: 'help', settings: 'settings' }[id];
  if (own && binds[own].includes(c)) { closeAllMenus(); return true; }
  if (id === 'shop' && binds.sell.includes(c)) { act('sell'); setTimeout(renderShop, 120); return true; }
  if (id === 'pausemenu' && c === 'KeyP') { closeAllMenus(); return true; }
  return true; // Menü schluckt sonstige Tasten
}

// ---------- Maus ----------
cv.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; const r = cv.getBoundingClientRect(); input.mouse.x = e.clientX - r.left; input.mouse.y = e.clientY - r.top; input.mouse.in = true; input.mouse.moved = true; if (input.mode !== 'mouse') input.mode = 'mouse'; });
document.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') input.mouse.in = false; });
cv.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') return touchCanvasDown(e);
  if (input.listen) return;
  input.mouse.x = e.offsetX; input.mouse.y = e.offsetY; input.mouse.moved = true; input.mode = 'mouse';
  const code = 'Mouse' + e.button; heldCodes.add(code);
  if (G.world && !G.menu) { e.preventDefault(); press(code, false); }
});
addEventListener('pointerup', e => { if (e.pointerType === 'touch') return; const code = 'Mouse' + e.button; if (heldCodes.has(code)) { heldCodes.delete(code); release(code); } });
addEventListener('pointerdown', e => { if (input.listen && e.pointerType !== 'touch') { e.preventDefault(); e.stopPropagation(); finishListen('Mouse' + e.button); } }, true);
cv.addEventListener('wheel', e => {
  e.preventDefault(); if (!canPlay()) return;
  const now = performance.now(); if (now - input.wheelT < 70) return; input.wheelT = now;
  act('slotd', e.deltaY > 0 ? 1 : -1);
}, { passive: false });

// ---------- Neu belegen ----------
function startListen(action, idx) { input.listen = { action, idx }; renderSettings(); }
function finishListen(code) {
  const L = input.listen; input.listen = null;
  if (code !== 'Escape' && L) {
    if (code === 'Backspace' || code === 'Delete') binds[L.action].splice(L.idx, 1);
    else {
      for (const a of ACTIONS) if (a.k !== L.action) { const i = binds[a.k].indexOf(code); if (i >= 0) { binds[a.k].splice(i, 1); toast(codeLabel(code) + ' war „' + a.n + '“ zugewiesen – dort entfernt.', 'warn'); } }
      const b = binds[L.action]; const j = b.indexOf(code); if (j >= 0) b.splice(j, 1);
      b[Math.min(L.idx, b.length)] = code; binds[L.action] = b.filter(Boolean).slice(0, 2);
    }
    saveBinds();
  }
  setTimeout(renderSettings, 0); refreshKeyTexts();
}

// ---------- Gamepad (Twin-Stick) ----------
function pollPad() {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null; for (const g of list || []) if (g && g.connected !== false && g.buttons && g.buttons.length) { gp = g; break; }
  if (!gp) { if (pad.had) { pad.had = false; pad.keys = { l: 0, r: 0, u: 0, d: 0, b: 0, s: 0, g: 0 }; pad.aim = null; pushKeys(); } return; }
  if (!pad.had) { pad.had = true; toast('Gamepad verbunden – Belegung unter Hilfe › Gamepad', 'info'); }
  const B = i => { const b = gp.buttons[i]; return !!b && (b.pressed || b.value > 0.5); };
  const ax = gp.axes || [];
  const lx = ax[0] || 0, ly = ax[1] || 0, rx = ax[2] || 0, ry = ax[3] || 0;
  const st = { l: lx < -0.45 || B(14), r: lx > 0.45 || B(15), u: ly < -0.6 || B(12) || B(0), d: ly > 0.6 || B(13), g: B(6), s: Math.abs(lx) > 0.93 };
  const edge = i => B(i) && !pad.prev[i];
  const upE = st.u && !pad.pu, downE = st.d && !pad.pd;
  const anyInput = gp.buttons.some((b, i) => B(i)) || Math.abs(lx) > 0.45 || Math.abs(ly) > 0.6 || Math.hypot(rx, ry) > 0.3;
  if (anyInput && input.mode !== 'pad') input.mode = 'pad';
  const rm = Math.hypot(rx, ry); pad.aim = rm > 0.3 ? [rx / Math.max(rm, 1), ry / Math.max(rm, 1)] : null;
  if (pad.aim && Math.abs(rx) < 0.3 && Math.abs(ry) < 0.3) pad.aim = null;
  const w = G.world;
  if (G.menu) {
    if (upE || (B(14) && !pad.prev[14])) menuMove(-1); if (downE || (B(15) && !pad.prev[15])) menuMove(1);
    if (edge(0)) menuPick();
    if (edge(1) || edge(9) || (edge(8) && G.menu === 'shop') || (edge(11) && G.menu === 'research')) closeAllMenus();
    pad.keys = { l: 0, r: 0, u: 0, d: 0, b: 0, s: 0, g: 0 }; if (w) pushKeys();
  } else if (!w || $('gameover').style.display === 'flex') { // Hauptmenü / Lobby / Spielende
    const btns = Array.from(document.querySelectorAll('.screen')).filter(s => s.style.display === 'flex').flatMap(s => Array.from(s.querySelectorAll('button, .card.opt'))).filter(b => b.offsetParent);
    if (btns.length) { if (upE) pad.sel--; if (downE) pad.sel++; pad.sel = (pad.sel + btns.length) % btns.length; btns.forEach((b, i) => b.classList.toggle('hl', i === pad.sel)); if (edge(0)) btns[pad.sel].click(); if (edge(1) && !w) menuBack(); }
  } else {
    pad.keys = { l: +st.l, r: +st.r, u: +st.u, d: +st.d, b: 0, s: +st.s, g: +st.g }; pushKeys();
    if (upE) act('jump');
    if (downE) { const now = performance.now(); if (now - pad.lastDown < 280) act('digdown'); pad.lastDown = now; }
    if (edge(7)) act('primary', aimArg());
    if (edge(1)) act('dig'); if (edge(2)) act('interact'); if (edge(3)) act('drop');
    if (edge(4)) act('slotd', -1); if (edge(5)) act('slotd', 1);
    if (edge(10)) act('next'); if (edge(11)) openMenu('research');
    if (edge(8)) openMenu('shop'); if (edge(9)) openMenu('pausemenu');
  }
  pad.prev = gp.buttons.map((b, i) => B(i)); pad.pu = st.u; pad.pd = st.d;
}

// ---------- Touch ----------
function touchWanted() { return settings.touch === 'on' || (settings.touch === 'auto' && (input.touch.seen || (window.matchMedia && matchMedia('(pointer: coarse)').matches))); }
addEventListener('touchstart', () => { if (!input.touch.seen) { input.touch.seen = true; updateTouchUI(); } }, { passive: true });
function updateTouchUI() { const el = $('touch'); if (el) el.style.display = (G.world && touchWanted()) ? 'block' : 'none'; }
const tstate = { joyId: null, jx: 0, jy: 0, canvasId: null, t0: 0, timer: null, digging: false, btn: {} };
function joyVec() { return [tstate.jx, tstate.jy]; }
function setupTouch() {
  const joy = $('tjoy'), knob = $('tknob'); if (!joy) return;
  const upd = e => { const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2); const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } tstate.jx = dx; tstate.jy = dy; knob.style.transform = 'translate(' + dx * 34 + 'px,' + dy * 34 + 'px)'; const T = input.touch.keys; const wasU = T.u; T.l = dx < -0.35 ? 1 : 0; T.r = dx > 0.35 ? 1 : 0; T.u = dy < -0.55 ? 1 : 0; T.d = dy > 0.6 ? 1 : 0; if (T.u && !wasU && canPlay()) act('jump'); input.mode = 'touch'; pushKeys(); };
  joy.addEventListener('pointerdown', e => { e.preventDefault(); tstate.joyId = e.pointerId; joy.setPointerCapture(e.pointerId); upd(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === tstate.joyId) upd(e); });
  const end = e => { if (e.pointerId !== tstate.joyId) return; tstate.joyId = null; tstate.jx = tstate.jy = 0; knob.style.transform = ''; const T = input.touch.keys; T.l = T.r = T.u = T.d = 0; pushKeys(); };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  for (const b of document.querySelectorAll('#touch [data-t]')) {
    const a = b.dataset.t;
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation(); input.mode = 'touch'; b.classList.add('on');
      if (a === 'jump') { act('jump'); input.touch.keys.u = 1; }
      else if (a === 'dig') { const c = myClonk(); if (c) { const [jx, jy] = joyVec(); const dx = Math.abs(jx) > 0.2 || Math.abs(jy) > 0.2 ? jx : c.dir * 0.8, dy = Math.abs(jx) > 0.2 || Math.abs(jy) > 0.2 ? jy : 0.35; input.touch.aim = [c.x + dx * 60, c.y - 5 + dy * 60]; } input.touch.keys.g = 1; }
      else if (a === 'act') act('primary', (() => { const c = myClonk(); if (!c) return null; const [jx, jy] = joyVec(); return Math.hypot(jx, jy) > 0.3 ? [Math.round(c.x + jx * 70), Math.round(c.y - 6 + jy * 70)] : null; })());
      else if (a === 'use') act('interact'); else if (a === 'drop') act('drop'); else if (a === 'slot') act('slotd', 1); else if (a === 'next') act('next');
      else if (a === 'menu') openMenu('pausemenu'); else if (a === 'shop') openMenu('shop');
      pushKeys();
    });
    const up = () => { b.classList.remove('on'); if (a === 'jump') input.touch.keys.u = 0; if (a === 'dig') { input.touch.keys.g = 0; input.touch.aim = null; } pushKeys(); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  }
}
function touchCanvasDown(e) { // Tippen = Aktion zum Punkt · lange halten = dorthin graben
  if (!canPlay()) return; e.preventDefault(); input.mode = 'touch';
  if (tstate.canvasId !== null) return; tstate.canvasId = e.pointerId; cv.setPointerCapture(e.pointerId);
  const pt = screenToWorld(e.offsetX, e.offsetY); input.touch.aim = pt; tstate.digging = false;
  tstate.timer = setTimeout(() => { tstate.digging = true; input.touch.keys.g = 1; pushKeys(true); }, 320);
}
cv.addEventListener('pointermove', e => { if (e.pointerType === 'touch' && e.pointerId === tstate.canvasId) { input.touch.aim = screenToWorld(e.offsetX, e.offsetY); pushKeys(); } });
const touchCanvasEnd = e => {
  if (e.pointerType !== 'touch' || e.pointerId !== tstate.canvasId) return;
  clearTimeout(tstate.timer); tstate.canvasId = null;
  if (!tstate.digging && canPlay()) act('primary', aimArg());
  input.touch.keys.g = 0; tstate.digging = false; setTimeout(() => { if (tstate.canvasId === null && !input.touch.keys.g) input.touch.aim = null; }, 50); pushKeys(true);
};
cv.addEventListener('pointerup', touchCanvasEnd); cv.addEventListener('pointercancel', touchCanvasEnd);
