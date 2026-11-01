// BuddelRage – große Karte als Vollbild-Overlay (Taste M, Gamepad LB+RB, Touch „Karte“). Das Spiel läuft weiter (keine Pause).
// Weltbild wird vorgerendert und gecacht (nur bei Geländeänderungen, höchstens 1× pro Sekunde neu), Einheiten/Rahmen werden darüber gezeichnet.
'use strict';
const BM = { open: false, cv: null, base: null, builds: 0, dirty: 0, lastBuild: -1e9, key: '', s: 1, ox: 0, oy: 0, look: null, padPrev: false, frames: 0, shown: null };
const BM_REBUILD_MS = 1000;
// Sichtbarkeit fremder Buddler: dieselbe Regel wie die Minikarte (render.js drawMinimap: lebend und nicht in einem Gebäude)
// plus Nebel des Krieges (fog.js): Gegner nur in Sichtweite – gilt für Minikarte und große Karte gleich
function mapShowsClonk(c) { return c.act !== 'dead' && !c.inside && (typeof fogClonk !== 'function' || fogClonk(c)); }
function bmEnsure() {
  if (BM.cv) return BM.cv;
  const cv = document.createElement('canvas'); cv.id = 'bigmap';
  Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh', zIndex: 40, display: 'none', cursor: 'crosshair', touchAction: 'none' });
  document.body.appendChild(cv);
  cv.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); bmClick(e.clientX, e.clientY); });
  BM.cv = cv; return cv;
}
function bmToggle(on) {
  const w = G.world; if (on === undefined) on = !BM.open;
  if (on && (!w || G.menu)) return false;
  BM.open = !!on; const cv = bmEnsure(); cv.style.display = BM.open ? 'block' : 'none';
  if (BM.open) { BM.dirty = 1; BM.lastBuild = -1e9; bmDraw(); }
  const tb = document.getElementById('tmap'); if (tb) tb.classList.toggle('on', BM.open);
  return true;
}
// Weltbild (Materialfarben + hervorgehobenes Gold) in Kartengröße
function bmBuild(w, cw, ch) {
  const t0 = performance.now();
  const pad = 24, legend = 46, s = Math.min((cw - pad * 2) / w.W, (ch - pad * 2 - legend) / w.H);
  const bw = Math.max(1, Math.round(w.W * s)), bh = Math.max(1, Math.round(w.H * s));
  BM.s = s; BM.ox = Math.round((cw - bw) / 2); BM.oy = Math.round(pad + (ch - pad * 2 - legend - bh) / 2);
  const b = BM.base && BM.base.width === bw && BM.base.height === bh ? BM.base : document.createElement('canvas'); b.width = bw; b.height = bh;
  const g = b.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, bh); gr.addColorStop(0, '#5f93cf'); gr.addColorStop(1, '#a9cbe8'); g.fillStyle = gr; g.fillRect(0, 0, bw, bh);
  g.imageSmoothingEnabled = true; if (R.tc) g.drawImage(R.tc, 0, 0, w.W, w.H, 0, 0, bw, bh);
  // Gold: jedes Kartenpixel mit Gold im Block bekommt einen kräftigen Goldpunkt (Stichprobe jedes 2. Weltpixels)
  const k = Math.max(1, Math.ceil(1 / s)), mat = w.mat, W = w.W, GOLD = MAT.GOLD, st = k > 2 ? 2 : 1;
  const cells = [], cz = Math.max(1, Math.ceil(k * s));
  for (let by = 0; by * k < w.H; by++) for (let bx = 0; bx * k < W; bx++) {
    let hit = false; const x0 = bx * k, y0 = by * k;
    for (let y = y0; y < Math.min(w.H, y0 + k) && !hit; y += st) { const row = y * W; for (let x = x0; x < Math.min(W, x0 + k); x += st) if (mat[row + x] === GOLD) { hit = true; break; } }
    if (hit) cells.push(Math.floor(x0 * s), Math.floor(y0 * s));
  }
  g.fillStyle = 'rgba(70,40,0,0.85)'; for (let i = 0; i < cells.length; i += 2) g.fillRect(cells[i] - 1, cells[i + 1] - 1, cz + 2, cz + 2); // dunkler Rand für Kontrast
  g.fillStyle = '#ffd21f'; for (let i = 0; i < cells.length; i += 2) g.fillRect(cells[i], cells[i + 1], cz, cz);
  BM.goldCells = cells.length / 2;
  BM.base = b; BM.builds++; BM.buildMs = Math.round(performance.now() - t0); BM.dirty = 0; BM.lastBuild = performance.now(); BM.key = w.W + 'x' + w.H + '@' + cw + 'x' + ch;
}
function bmDraw() {
  const w = G.world; if (!BM.open || !w) return;
  if (G.menu) { bmToggle(false); return; }
  const cv = BM.cv, dpr = 1, cw = innerWidth, ch = innerHeight;
  if (cv.width !== cw * dpr || cv.height !== ch * dpr) { cv.width = cw * dpr; cv.height = ch * dpr; }
  const key = w.W + 'x' + w.H + '@' + cw + 'x' + ch, now = performance.now();
  if (!BM.base || BM.key !== key || BM.world !== w || (BM.dirty && now - BM.lastBuild >= BM_REBUILD_MS)) { BM.world = w; bmBuild(w, cw, ch); }
  BM.frames++;
  const g = cv.getContext('2d'), s = BM.s, ox = BM.ox, oy = BM.oy, bw = BM.base.width, bh = BM.base.height;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(8,12,20,0.86)'; g.fillRect(0, 0, cw, ch);
  g.drawImage(BM.base, ox, oy);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.strokeRect(ox - 0.5, oy - 0.5, bw + 1, bh + 1);
  const P = (x, y) => [ox + x * s, oy + y * s], me = G.myTeam, shown = { own: 0, foe: 0, spec: 0, structs: 0, ids: [] };
  const big = 6;
  for (const v of w.vehicles) { if (typeof fogVehicle === 'function' && !fogVehicle(v)) continue; const [x, y] = P(v.x, v.y); g.fillStyle = '#ddd'; g.fillRect(x - 2, y - 2, 4, 3); }
  for (const st of (typeof fogStructs === 'function' ? fogStructs(w) : w.structs)) {
    if (st.remove) continue; const t = w.teams[st.team], col = t ? t.color : '#aaa', [x, y] = P(st.x, st.y), hw = Math.max(3, st.w * s / 2 + 1), hh = Math.max(4, st.h * s + 1);
    g.globalAlpha = st.prog >= 1 ? 1 : 0.5; g.fillStyle = '#000'; g.fillRect(x - hw - 1, y - hh - 1, hw * 2 + 2, hh + 2); g.fillStyle = col; g.fillRect(x - hw, y - hh, hw * 2, hh);
    if (st.type === 'castle' || st.type === 'tower') { g.fillStyle = '#fff'; g.fillRect(x - 1, y - hh - 4, 1, 4); g.fillStyle = col; g.fillRect(x, y - hh - 4, 3, 2); }
    if ((BUILD[st.type] || {}).base) { g.strokeStyle = '#fff'; g.strokeRect(x - hw - 1.5, y - hh - 1.5, hw * 2 + 3, hh + 3); }
    g.globalAlpha = 1; shown.structs++;
  }
  for (const c of w.clonks) {
    if (!mapShowsClonk(c)) continue; const t = w.teams[c.team]; if (!t) continue;
    const [x, y] = P(c.x, c.y - 5), own = c.team === me; shown.ids.push(c.id);
    if (own) {
      shown.own++; g.fillStyle = '#000'; g.fillRect(x - big / 2 - 1, y - big / 2 - 1, big + 2, big + 2); g.fillStyle = t.color; g.fillRect(x - big / 2, y - big / 2, big, big);
      g.strokeStyle = t.sel === c.id ? '#fff' : 'rgba(255,255,255,0.6)'; g.lineWidth = t.sel === c.id ? 2 : 1; g.strokeRect(x - big / 2 - 2.5, y - big / 2 - 2.5, big + 5, big + 5);
      if (c.spec) { shown.spec++; g.fillStyle = c.spec === 'zeug' ? '#c8843a' : c.spec === 'medic' ? '#ff4040' : '#ffd21f'; g.beginPath(); g.arc(x, y - big / 2 - 5, 3, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke(); }
    } else { shown.foe++; g.fillStyle = '#000'; g.fillRect(x - 3, y - 3, 6, 6); g.fillStyle = t.color; g.fillRect(x - 2, y - 2, 4, 4); }
  }
  for (const m of w.monsters) { const [x, y] = P(m.x, m.y); g.fillStyle = '#a87850'; g.fillRect(x - 1, y - 1, 3, 3); }
  // Kamera-Ausschnitt
  const V = R.view, vw = cv && R.cv ? R.cv.width / R.scale : 0, vh = R.cv ? R.cv.height / R.scale : 0;
  if (V) { const [x, y] = P(V.cx, V.cy); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(x, y, vw * s, vh * s); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1; g.strokeRect(x - 1.5, y - 1.5, vw * s + 3, vh * s + 3); }
  // Legende
  const ly = oy + bh + 22; g.font = '13px Inter, sans-serif'; g.textBaseline = 'middle'; let lx = ox;
  const item = (draw, txt) => { draw(lx, ly); lx += 18; g.fillStyle = '#e8eef6'; g.fillText(txt, lx, ly); lx += g.measureText(txt).width + 22; };
  const mt = me >= 0 && w.teams[me] ? w.teams[me].color : '#2f5fe0';
  item((x, y) => { g.fillStyle = mt; g.fillRect(x, y - 5, 10, 10); g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(x - 1.5, y - 6.5, 13, 13); }, 'Eigene Buddler');
  item((x, y) => { for (const [i, c] of [['zeug', '#c8843a'], ['medic', '#ff4040'], ['gold', '#ffd21f']].entries()) { g.fillStyle = c[1]; g.beginPath(); g.arc(x + i * 5 + 2, y, 3, 0, 7); g.fill(); } lx += 6; }, 'Spezialisten (Zeugmeister · Sanitäter · Goldgräber)');
  item((x, y) => { g.fillStyle = '#000'; g.fillRect(x + 1, y - 3, 6, 6); g.fillStyle = '#e03030'; g.fillRect(x + 2, y - 2, 4, 4); }, 'Gegner (nur in Sichtweite)');
  item((x, y) => { g.fillStyle = mt; g.fillRect(x, y - 6, 10, 10); g.fillStyle = '#fff'; g.fillRect(x + 4, y - 9, 1, 3); }, 'Hütte · Turm · Burg (Teamfarbe, Gegner: zuletzt gesehen)');
  item((x, y) => { g.fillStyle = '#ffd21f'; g.fillRect(x, y - 3, 6, 6); g.fillRect(x + 4, y - 1, 5, 4); }, 'Gold');
  item((x, y) => { g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(x, y - 5, 12, 9); lx += 2; }, 'Ansicht');
  g.fillStyle = 'rgba(232,238,246,0.8)'; g.textAlign = 'right'; g.fillText('Klick/Tippen: Kamera dorthin · ' + codeLabel((binds.map || [])[0]) + ' / Esc: schließen · Spiel läuft weiter', ox + bw, oy - 12); g.textAlign = 'left';
  g.font = 'bold 15px Inter, sans-serif'; g.fillStyle = '#fff'; g.fillText('Karte', ox, oy - 12);
  BM.shown = shown;
}
// Klick/Tippen: Kamera springt dorthin (bis du dich bewegst oder 10 s vergehen); Klick neben die Karte schließt
function bmClick(sx, sy) {
  const w = G.world; if (!w || !BM.base) return;
  const x = (sx - BM.ox) / BM.s, y = (sy - BM.oy) / BM.s;
  if (x < 0 || y < 0 || x > w.W || y > w.H) { bmToggle(false); return; }
  BM.look = { x, y, t: performance.now() };
  const vw = R.cv.width / R.scale, vh = R.cv.height / R.scale; R.cam.x = x - vw / 2; R.cam.y = y - vh / 2;
  bmToggle(false);
}
function bmMoving() {
  const K = input.kb, P = pad.keys, T = input.touch.keys;
  return !!(K.l || K.r || K.u || K.d || K.g || P.l || P.r || P.u || P.d || P.g || T.l || T.r || T.u || T.d || T.g);
}
// Kamera-Ziel und Overlay im Zeichentakt (R.draw wird umhüllt; main.js bleibt unverändert)
{
  const _draw = R.draw.bind(R);
  R.draw = function (world, focus, myTeam, dt) {
    if (BM.look) { if (bmMoving() || performance.now() - BM.look.t > 10000 || world !== G.world) BM.look = null; else focus = { x: BM.look.x, y: BM.look.y + 8 }; }
    _draw(BM.look && typeof fogWorld === 'function' ? fogWorld(world) : world, focus, myTeam, dt); // freie Kamera: Gegner auch im Bild nur in Sichtweite
    if (world === G.world) { bmPad(); if (BM.open) bmDraw(); }
  };
  const _flush = R.flush.bind(R);
  R.flush = function (world) { if (world.renderDirty && world.renderDirty.size) BM.dirty += world.renderDirty.size; return _flush(world); };
}
// Gamepad: LB + RB gleichzeitig = Karte (die beiden Platzwechsel heben sich auf)
function bmPad() {
  const list = navigator.getGamepads ? navigator.getGamepads() : []; let gp = null; for (const q of list || []) if (q && q.buttons && q.buttons.length > 5) { gp = q; break; }
  const on = !!gp && gp.buttons[4].pressed && gp.buttons[5].pressed;
  if (on && !BM.padPrev && !G.menu) bmToggle();
  BM.padPrev = on;
}
// Tastatur: vor input.js (Capture-Phase), damit Esc bei offener Karte nur die Karte schließt
addEventListener('keydown', e => {
  if (input.listen) return;
  const ae = document.activeElement, tag = ae && ae.tagName, typing = tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !/^(checkbox|radio|range|button)$/.test(ae.type));
  if (typing || (typeof CHAT !== 'undefined' && CHAT.wheel)) return;
  const isMap = binds.map && binds.map.includes(e.code);
  if (BM.open && (e.code === 'Escape' || isMap)) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) bmToggle(false); return; }
  if (!BM.open && isMap && !e.repeat && G.world && !G.menu && G.world.state === 'run') { e.preventDefault(); e.stopImmediatePropagation(); bmToggle(true); }
}, true);
// Touch-Knopf oben neben „Laden“
{
  const top = document.getElementById('ttop');
  if (top) { const b = document.createElement('button'); b.className = 'tb sm'; b.id = 'tmap'; b.textContent = 'Karte'; b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); bmToggle(); }); top.insertBefore(b, top.lastElementChild); }
}
