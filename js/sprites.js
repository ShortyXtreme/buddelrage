// BuddelRage – vorgerenderte Pixel-Sprites (eigene, per Code erzeugte Grafik, ISC wie der übrige Code):
// Gebäude (Hütte, Wachturm, Burg) mit Ausbaustufen, Baufortschritt und Schadensstufen, Mauern, Fahrzeuge, Ballon, Brücke, Gegenstände.
// Jedes Sprite wird beim ersten Gebrauch einmal auf ein Offscreen-Canvas gemalt und danach nur noch per drawImage kopiert
// (Teamfarben: je Farbe eine gecachte Variante). Kein Pixel wird pro Frame neu berechnet.
'use strict';
const SPR = { cache: new Map(), made: 0 };
function sprHash(x, y, s) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function sprRGB(c) { if (c[0] === '#') { let h = c.slice(1); if (h.length === 3) h = h.split('').map(q => q + q).join(''); const n = parseInt(h, 16); return [n >> 16, (n >> 8) & 255, n & 255]; } const m = String(c).match(/\d+/g); return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128]; }
function sprCol(c, f) { const [r, g, b] = sprRGB(c), k = v => Math.max(0, Math.min(255, v * f | 0)); return 'rgb(' + k(r) + ',' + k(g) + ',' + k(b) + ')'; }
// Malwerkzeuge für ein Offscreen-Canvas (lokale Koordinaten)
function sprPainter(g) {
  const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const T = (c, x, y, w, h, amp, seed) => { const b = sprRGB(c); amp = amp === undefined ? 0.18 : amp; for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const f = 1 + (sprHash(xx, yy, seed || 1) - 0.5) * amp; g.fillStyle = 'rgb(' + Math.min(255, b[0] * f | 0) + ',' + Math.min(255, b[1] * f | 0) + ',' + Math.min(255, b[2] * f | 0) + ')'; g.fillRect(xx, yy, 1, 1); } };
  // Mauerwerk: Steinreihen mit Fugen, Kanten hell, versetzte Stoßfugen
  const BR = (c, x, y, w, h, bw, bh, seed) => {
    T(c, x, y, w, h, 0.24, seed); const m = sprCol(c, 0.6), hi = sprCol(c, 1.16);
    for (let r = 0, yy = y; yy < y + h; yy += bh, r++) {
      R(hi, x, yy, w, 1); if (yy + bh - 1 < y + h) R(m, x, yy + bh - 1, w, 1);
      for (let xx = x + ((r % 2) ? (bw >> 1) : 0) + bw - 1; xx < x + w - 1; xx += bw) R(m, xx, yy, 1, Math.min(bh - 1, y + h - yy));
    }
  };
  // Holzplanken (waagerecht) mit Maserung
  const PL = (c, x, y, w, h, ph, seed) => {
    T(c, x, y, w, h, 0.16, seed); const d = sprCol(c, 0.62), hi = sprCol(c, 1.2);
    for (let yy = y; yy < y + h; yy += ph) { R(hi, x, yy, w, 1); if (yy + ph - 1 < y + h) R(d, x, yy + ph - 1, w, 1); }
    for (let k = 0; k < (w * h) / 22; k++) { const xx = x + (sprHash(k, 3, seed) * (w - 3) | 0), yy = y + (sprHash(k, 7, seed) * h | 0); R(d, xx, yy, 2 + (k % 2), 1); }
  };
  // Holzbretter (senkrecht)
  const PV = (c, x, y, w, h, pw, seed) => {
    T(c, x, y, w, h, 0.16, seed); const d = sprCol(c, 0.62), hi = sprCol(c, 1.18);
    for (let xx = x; xx < x + w; xx += pw) { R(hi, xx, y, 1, h); if (xx + pw - 1 < x + w) R(d, xx + pw - 1, y, 1, h); }
    for (let k = 0; k < (w * h) / 26; k++) { const xx = x + (sprHash(k, 5, seed) * w | 0), yy = y + (sprHash(k, 9, seed) * (h - 3) | 0); R(d, xx, yy, 1, 2 + (k % 2)); }
  };
  // Pixel-Array: Zeichen → Farbe aus der Palette ('.' = durchsichtig)
  const pix = (rows, pal, x0, y0) => { rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) R(c, x0 + i, y0 + j, 1, 1); } }); };
  const line = (c, x0, y0, x1, y1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) R(c, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1); };
  return { g, R, T, BR, PL, PV, pix, line };
}
// dunkle Kontur um alle sichtbaren Pixel (unten = Boden, dort keine Kontur)
function sprOutline(cv, f) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, im = g.getImageData(0, 0, W, H), d = im.data, a = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) a[i] = d[i * 4 + 3] > 100 ? 1 : 0;
  const op = (x, y) => y >= H ? 1 : (x < 0 || x >= W || y < 0) ? 0 : a[y * W + x];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!a[i]) continue; if (op(x - 1, y) && op(x + 1, y) && op(x, y - 1) && op(x, y + 1)) continue; d[i * 4] *= f; d[i * 4 + 1] *= f; d[i * 4 + 2] *= f; }
  g.putImageData(im, 0, 0);
}
// Sprite erzeugen/holen: Begrenzungsrahmen in lokalen Koordinaten (Anker = 0,0, meist Bodenmitte)
function sprMake(key, x0, y0, x1, y1, fn, outline) {
  let s = SPR.cache.get(key); if (s) return s;
  const cv = document.createElement('canvas'); cv.width = x1 - x0; cv.height = y1 - y0;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.translate(-x0, -y0);
  fn(sprPainter(g), g);
  if (outline) sprOutline(cv, outline);
  s = { cv, ox: -x0, oy: -y0, w: cv.width, h: cv.height, key }; SPR.cache.set(key, s); SPR.made++; return s;
}
function sprDraw(g, s, x, y, flip) {
  x = Math.round(x); y = Math.round(y);
  if (flip) { g.save(); g.translate(x, y); g.scale(-1, 1); g.drawImage(s.cv, -s.ox, -s.oy); g.restore(); }
  else g.drawImage(s.cv, x - s.ox, y - s.oy);
}
// Schadensvariante: Risse, Ruß und (Stufe 3) ausgebrochene Kanten – einmal je Stufe gecacht
function sprDamaged(base, stage, seed) {
  if (!stage) return base;
  return sprMake(base.key + '|dmg' + stage, -base.ox, -base.oy, base.w - base.ox, base.h - base.oy, (P, g) => {
    g.drawImage(base.cv, -base.ox, -base.oy);
    g.globalCompositeOperation = 'source-atop';
    const W = base.w, H = base.h, x0 = -base.ox, y0 = -base.oy;
    for (let k = 0; k < stage * 2; k++) { const cx = x0 + 3 + sprHash(k, 11, seed) * (W - 6), cy = y0 + 4 + sprHash(k, 13, seed) * (H - 8), r = 3 + stage * 2 + sprHash(k, 17, seed) * 4; g.fillStyle = 'rgba(20,14,10,' + (0.12 + 0.07 * stage) + ')'; g.fillRect(Math.round(cx - r), Math.round(cy - r * 0.6), Math.round(r * 2), Math.round(r * 1.2)); }
    for (let k = 0; k < stage * 3; k++) {
      let x = Math.round(x0 + 2 + sprHash(k, 1, seed) * (W - 4)), y = Math.round(y0 + 2 + sprHash(k, 2, seed) * (H * 0.7));
      const n = 4 + stage * 3;
      for (let i = 0; i < n; i++) { P.R('#1c1814', x, y, 1, 1); P.R('rgba(255,255,255,.18)', x + 1, y, 1, 1); y += 1; x += sprHash(k * 31 + i, 5, seed) < 0.5 ? -1 : 1; if (sprHash(k, i, seed) < 0.15) { P.R('#1c1814', x + 1, y, 1, 1); } }
    }
    if (stage >= 3) { g.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 6; k++) { const x = Math.round(x0 + sprHash(k, 21, seed) * W), y = Math.round(y0 + sprHash(k, 23, seed) * H * 0.5); g.fillRect(x, y, 2 + (k % 3), 2 + (k % 2)); } }
    g.globalCompositeOperation = 'source-over';
  });
}
function structDmgStage(s) { const f = s.hp / structMax(s); return f > 0.7 ? 0 : f > 0.45 ? 1 : f > 0.2 ? 2 : 3; }
// ---------- Fahnen (2 Wehe-Phasen je Teamfarbe) ----------
function sprFlag(col, w, h, fr) {
  return sprMake('flag:' + col + ':' + w + 'x' + h + ':' + fr, 0, 0, w, h + 2, P => {
    const d = sprCol(col, 0.68), l = sprCol(col, 1.3);
    for (let i = 0; i < w; i++) { const dy = i < 2 ? 0 : ((i + fr * 2) % 4 < 2 ? 0 : 1); P.R(col, i, dy, 1, h); P.R(d, i, dy + h - 1, 1, 1); if (i % 3 === 1) P.R(l, i, dy, 1, 1); }
    P.R('rgba(255,255,255,.85)', (w >> 1) - 1, (h >> 1) - 1 + (fr ? 0 : 1), 2, 2); // Wappenpunkt
  });
}
function flagFrame(id) { return ((performance.now() / 420 + (id || 0) * 0.37) | 0) % 2; }
// ---------- Gebäude ----------
const STONE = '#8d8a84', STONE_D = '#6e6a63', WOOD = '#6e4626', WOOD_L = '#8a5a30', ROOF = '#a8382a', IRON = '#3c3e44', LIT = '#ffd060', GLASS = '#2a2a40';
function sprHut(col) {
  return sprMake('hut:' + col, -18, -42, 20, 0, P => {
    const { R, T, BR, PL, PV, line } = P;
    R('#555', 10, -40, 1, 22); // Fahnenmast (Tuch separat, weht)
    BR('#7d7870', -15, -3, 30, 3, 5, 3, 4); // Steinsockel
    PL(WOOD, -14, -17, 28, 14, 3, 7);
    for (let y = -17; y < -3; y += 3) { R(WOOD_L, -15, y, 2, 2); R('#4a2c14', -15, y + 1, 1, 1); R(WOOD_L, 13, y, 2, 2); R('#4a2c14', 14, y + 1, 1, 1); } // Balkenköpfe
    PV('#4a2c16', -3, -12, 6, 9, 3, 9); R('#2a180a', -4, -13, 8, 1); R('#2a180a', -4, -12, 1, 9); R('#2a180a', 3, -12, 1, 9); R('#c09040', 1, -8, 1, 1); // Tür
    R(col, -2, -16, 4, 2); R(sprCol(col, 0.7), -2, -15, 4, 1); // Teamschild über der Tür
    for (const wx of [-11, 7]) { R('#3a2210', wx - 1, -14, 6, 6); R(GLASS, wx, -13, 4, 4); R(LIT, wx, -13, 4, 4); R('#ffeaa0', wx, -13, 1, 1); R('#3a2210', wx + 2, -13, 1, 4); R('#3a2210', wx, -11, 4, 1); R(sprCol(col, 0.85), wx - 2, -14, 1, 6); } // Fenster mit Läden
    for (let k = 0; k < 10; k++) { const x0 = -17 + k, w = 34 - 2 * k, y = -18 - k; T(k % 2 ? '#8a2a1a' : ROOF, x0, y, w, 1, 0.2, 30 + k); for (let x = x0 + (k % 2 ? 1 : 3); x < x0 + w - 1; x += 4) R('#6a1e12', x, y, 1, 1); }
    R('#6a1e12', -17, -18, 34, 1); R('#c85040', -1, -27, 2, 1);
    BR('#7d7870', 5, -27, 4, 6, 4, 3, 8); R('#2a2622', 5, -28, 4, 1); // Schornstein
  }, 0.55);
}
function sprTowerBase(col, stone) {
  return sprMake('tower:' + col + ':' + stone, -13, -66, 18, 0, P => {
    const { R, T, BR, PL, PV, line } = P;
    R('#555', 9, -64, 1, 18);
    PV('#6a4424', -8, -42, 16, 42, 4, 3);
    R('#4a2e14', -8, -42, 2, 42); R('#4a2e14', 6, -42, 2, 42); // Eckpfosten
    for (let y0 = -40; y0 < -4; y0 += 12) { line('#4a2e14', -6, y0, 5, y0 + 10); line('#4a2e14', 5, y0, -6, y0 + 10); R('#3a2410', -8, y0 + 11, 16, 1); }
    if (stone) { BR(STONE, -9, -16, 18, 16, 6, 4, 12); for (const y of [-24, -34]) { R(IRON, -8, y, 16, 1); for (let x = -7; x < 8; x += 4) R('#9aa0a8', x, y, 1, 1); } }
    R('#2a180a', -4, -11, 8, 11); PV('#4a2c16', -3, -10, 6, 10, 3, 6); R('#c09040', 1, -5, 1, 1); if (stone) { R(STONE_D, -4, -12, 8, 1); }
    R('#3a2210', -3, -31, 6, 7); R(GLASS, -2, -30, 4, 5); R(LIT, -2, -30, 4, 5); R('#3a2210', -1, -30, 1, 5); R('#ffeaa0', -2, -30, 1, 1);
    PL('#5a3a1c', -11, -46, 22, 4, 2, 5); R('#3a2410', -11, -42, 22, 1); // Plattform
    if (stone) { for (let k = -11; k < 11; k += 5) BR('#9a968e', k, -52, 3, 6, 3, 3, 40 + k); R(STONE_D, -11, -47, 22, 1); }
    else { for (let k = -11; k < 11; k += 3) { T('#6a4422', k, -50, 2, 4, 0.2, 50 + k); R('#8a5a2e', k, -51, 1, 1); } }
    R(col, -8, -40, 3, 5); R(col, 5, -40, 3, 5); R(sprCol(col, 0.65), -8, -36, 3, 1); R(sprCol(col, 0.65), 5, -36, 3, 1); // Teamwimpel
  }, 0.55);
}
function sprCastleBase(col) {
  return sprMake('castle:' + col, -34, -64, 34, 0, P => {
    const { R, T, BR, PL, PV } = P, hi = '#b4b0a8';
    R('#555', -1, -62, 1, 28);
    BR(STONE, -24, -30, 48, 30, 8, 5, 21);
    for (let k = -24; k < 24; k += 6) BR('#97938c', k, -34, 4, 4, 4, 4, 60 + k);
    for (const tx of [-32, 20]) {
      BR('#858279', tx, -44, 12, 44, 6, 4, 70 + tx); R(hi, tx, -44, 12, 1); R(sprCol('#858279', 0.75), tx + 11, -44, 1, 44);
      for (let k = 0; k < 3; k++) BR('#97938c', tx + Math.round(k * 4.5), -48, 3, 4, 3, 4, 80 + tx + k);
      R('#1e1a16', tx + 5, -38, 2, 5); R(LIT, tx + 5, -37, 2, 3); // Schießscharte mit Licht
      R(col, tx + 3, -30, 6, 10); R(sprCol(col, 0.7), tx + 3, -21, 6, 1); R(sprCol(col, 1.3), tx + 3, -30, 1, 9); R(col, tx + 4, -20, 4, 1); R(col, tx + 5, -19, 2, 1); // Banner
      R('rgba(255,255,255,.75)', tx + 5, -27, 2, 2);
    }
    R('#7a766e', -9, -20, 18, 2); R('#a8a49c', -8, -21, 16, 1); // Torbogen
    R('#1e140c', -7, -18, 14, 18); PV('#5a3a1c', -6, -16, 5, 16, 2, 2); PV('#5a3a1c', 1, -16, 5, 16, 2, 3); R(IRON, -6, -12, 12, 1); R(IRON, -6, -6, 12, 1); R('#c09040', -2, -8, 1, 1); R('#c09040', 1, -8, 1, 1);
    for (const wx of [-15, 11]) { R('#5e5a54', wx - 1, -25, 6, 7); R(GLASS, wx, -24, 4, 5); R(LIT, wx, -24, 4, 5); R('#5e5a54', wx + 1, -24, 1, 5); R('#5e5a54', wx, -22, 4, 1); R('#fff0b0', wx, -24, 1, 1); }
  }, 0.55);
}
function sprWall(col, stage) {
  const base = sprMake('wall:' + col, -5, -WALL_H - 4, 5, 1, P => {
    P.BR(STONE, -3, -WALL_H, 6, WALL_H + 1, 6, 5, 91); P.R('#a8a59e', -3, -WALL_H, 6, 1);
    P.BR('#97938c', -4, -WALL_H - 3, 2, 3, 2, 3, 92); P.BR('#97938c', 2, -WALL_H - 3, 2, 3, 2, 3, 93); P.R(col, -1, -WALL_H - 2, 2, 2);
    P.R(col, -2, -WALL_H + 3, 4, 5); P.R(sprCol(col, 0.7), -2, -WALL_H + 8, 4, 1); P.R(sprCol(col, 1.3), -1, -WALL_H + 5, 2, 1); // Wappen
  }, 0.55);
  return sprDamaged(base, stage, 7);
}
function sprWallBroken() { return sprMake('wallbr', -6, -9, 6, 1, P => { P.T('#6e6b66', -5, -5, 10, 6, 0.3, 3); P.BR('#8d8a84', -3, -8, 4, 3, 2, 3, 4); P.R('#5e5b56', 1, -6, 3, 1); P.R('#8d8a84', 2, -9, 2, 2); P.R('#a8a59e', -4, -6, 2, 1); }, 0.55); }
// Bogenschütze (Burg und Turm), Blickrichtung rechts; flip = links
function sprArcher() {
  return sprMake('archer', -3, -9, 4, 0, P => P.pix([
    '..hh...', '.hsS...', '..ss.b.', '.ggg.bW', 'gGggggW', '.ggg.bW', '.g.g.b.', '.d.d...', '.d.d...',
  ], { h: '#3d6b32', s: '#e8c8a0', S: '#000', g: '#2f5a2a', G: '#e8c8a0', b: '#8a5a26', W: '#eee', d: '#3a2a1a' }, -3, -9), 0.7);
}
function sprBallista(loaded) {
  return sprMake('ballista:' + (loaded ? 1 : 0), -8, -9, 8, 0, P => {
    const { R, T, line } = P;
    T('#6a4a26', -5, -3, 10, 3, 0.2, 5); R('#4a3016', -4, -1, 2, 1); R('#4a3016', 2, -1, 2, 1); R('#6a4a26', -1, -6, 2, 3); // Gestell
    T('#8a6a3a', -6, -7, 12, 1, 0.2, 6); R('#5a3a16', 4, -9, 2, 5); line('#ddd', 5, -9, -2, -7); line('#ddd', 5, -4, -2, -6); // Bogenarme + Sehne
    if (loaded) { R('#d0d4da', -3, -7, 10, 1); R('#9aa0a8', 7, -7, 1, 1); }
  }, 0.6);
}
function sprCauldron(full) {
  return sprMake('cauldron:' + (full ? 1 : 0), -2, -8, 9, 0, P => {
    const { R, T } = P;
    T('#5a3a1c', -2, -8, 11, 2, 0.2, 8); R('#3a2410', -2, -6, 1, 3); // Ausleger
    R('#777', 5, -6, 1, 2); // Kette
    R('#1e1e22', 2, -4, 7, 3); R('#3a3a40', 3, -4, 5, 1); R('#1e1e22', 3, -1, 5, 1); // Kessel
    if (full) { R('#ff8a20', 3, -4, 5, 1); R('#ffd060', 4, -4, 2, 1); }
  }, 0);
}
function sprScaffold(type) {
  const B = BUILD[type], hw = (B.w >> 1) + 2, top = type === 'castle' ? 50 : type === 'tower' ? 54 : 30;
  return sprMake('scaf:' + type, -hw - 1, -top - 1, hw + 2, 0, P => {
    const { R, line } = P, pole = '#9a7040', plank = '#c09060';
    for (let x = -hw; x <= hw; x += Math.max(8, Math.round(hw / 3))) R(pole, x, -top, 1, top);
    R(pole, hw, -top, 1, top);
    for (let y = -top + 2; y < 0; y += 9) { R(plank, -hw, y, hw * 2 + 1, 1); R('#7a5428', -hw, y + 1, hw * 2 + 1, 1); }
    for (let y = -top + 2; y < -9; y += 18) line('#8a6234', -hw, y, -hw + 8, y + 9);
  }, 0);
}
function structSprite(s, col) { return s.type === 'castle' ? sprCastleBase(col) : s.type === 'tower' ? sprTowerBase(col, towerLevel(s) >= 1 ? 1 : 0) : sprHut(col); }
function flagSpot(s) { return s.type === 'castle' ? [0, -62, 11, 6] : s.type === 'tower' ? [10, -64, 8, 5] : [11, -40, 9, 6]; }
// Rauch bei schweren Schäden (wenige halbtransparente Rechtecke pro Frame)
function drawSmoke(g, s, stage) {
  const t0 = performance.now() / 45;
  for (let k = 0; k < stage + 1; k++) {
    const t = (t0 + k * 23 + s.id * 7) % 60, x = s.x + ((k * 13 + s.id * 5) % s.w) - s.w / 2 + Math.sin(t * 0.12 + k) * 2, y = s.y - s.h * 0.75 - t * 0.55, a = 0.42 * (1 - t / 60), r = 2 + t / 18;
    g.fillStyle = 'rgba(60,56,52,' + a.toFixed(3) + ')'; g.fillRect(Math.round(x - r), Math.round(y - r), Math.round(r * 2), Math.round(r * 2));
  }
}
function drawStruct(g, s, col) {
  if (s.prog < 1) drawSite(g, s, col);
  else {
    const st = structDmgStage(s), spr = sprDamaged(structSprite(s, col), st, s.type.length * 7 + 3);
    sprDraw(g, spr, s.x, s.y);
    const F = flagSpot(s); sprDraw(g, sprFlag(col, F[2], F[3], flagFrame(s.id)), s.x + F[0], s.y + F[1]);
    if (s.type === 'castle' && s.up > 0) drawCastleUp(g, s, col);
    if (s.type === 'tower' && s.up > 0) drawTowerUp(g, s, col);
    if (st >= 2 && !s.fire) drawSmoke(g, s, st);
  }
  if (s.fire > 0) for (let k = 0; k < 4; k++) drawFlame(g, s.x + (k - 1.5) * s.w / 4, s.y - s.h * (0.3 + 0.5 * ((k * 7) % 3) / 3), 6, s.id + k);
  if (s.prog >= 1 && s.hp < structMax(s)) { const x = Math.round(s.x - s.w / 2), y = Math.round(s.y - s.h - 6); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x, y, s.w, 2); g.fillStyle = '#e44'; g.fillRect(x, y, Math.max(0, s.w * s.hp / structMax(s)), 2); }
}
// Baustelle: Planieren (Pflöcke) bzw. Gebäude wächst von unten, Rest als Bauplan-Schatten, davor das Gerüst
function drawSite(g, s, col) {
  const x = Math.round(s.x), y = Math.round(s.y), hw = s.w >> 1;
  const R = (cl, xx, yy, w, hh) => { g.fillStyle = cl; g.fillRect(x + xx, y + yy, w, hh); };
  if (s.lv) {
    const T = (performance.now() / 120) | 0;
    for (let k = -hw; k < hw; k += 4) if (((k >> 2) + T) % 2) { R('rgba(255,200,60,.85)', k, -s.h, 2, 1); R('rgba(255,200,60,.85)', k, 0, 2, 1); }
    R('#c8a050', -hw, -10, 1, 10); R('#c8a050', hw, -10, 1, 10); R('#e33', -hw, -10, 2, 2); R('#e33', hw - 1, -10, 2, 2);
    R('#222', -12, -s.h - 4, 24, 3); R('#fb3', -12 + (T % 20), -s.h - 4, 4, 3);
    return;
  }
  const spr = structSprite(s, col || '#888'), p = Math.max(0, Math.min(1, s.prog));
  g.globalAlpha = 0.16; sprDraw(g, spr, x, y); g.globalAlpha = 1; // Bauplan
  const vis = Math.max(1, Math.round(spr.oy * p)); // sichtbare Höhe ab Boden
  g.drawImage(spr.cv, 0, spr.oy - vis, spr.w, vis, x - spr.ox, y - vis, spr.w, vis);
  sprDraw(g, sprScaffold(s.type), x, y);
  R('#222', -12, -s.h - 4, 24, 3); R('#5c5', -12, -s.h - 4, 24 * p, 3);
}
// Burg-Ausbau: Mauern, Wehrgänge/Fallgitter, Schützen, Balliste, Gerüst während des Ausbaus
function drawCastleUp(g, s, col) {
  const x = Math.round(s.x), y = Math.round(s.y), L = castleLevel(s);
  const R = (cl, xx, yy, w, h) => { g.fillStyle = cl; g.fillRect(x + xx, y + yy, w, h); };
  if (L >= 1) {
    sprDraw(g, sprMake('castle_up1', -34, -50, 34, 0, P => {
      for (const tx of [-33, 19]) { P.PL('#6a4a2a', tx, -46, 14, 3, 3, tx + 99); P.R('#4a3018', tx, -43, 14, 1); for (let k = 0; k < 14; k += 3) P.R('#3a2410', tx + k, -45, 1, 2); P.R('#8a2a1a', tx + 1, -47, 12, 1); P.R('#a8382a', tx + 2, -48, 10, 1); }
      P.T('#6a5a3a', -25, -31, 50, 1, 0.25, 4);
      P.R('#2a2a2a', -7, -18, 14, 1); for (let k = -6; k < 7; k += 3) P.R('#7a7a80', k, -17, 1, 6); P.R('#5a5a60', -6, -13, 13, 1);
    }, 0), x, y);
    for (const wl of s.walls || []) {
      if (wl.br) { sprDraw(g, sprWallBroken(), wl.x, wl.y); continue; }
      const f = wl.hp / WALL_HP; sprDraw(g, sprWall(col, f > 0.66 ? 0 : f > 0.33 ? 1 : 2), wl.x, wl.y);
      if (wl.hp < WALL_HP) { const wx = Math.round(wl.x), wy = Math.round(wl.y); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(wx - 5, wy - WALL_H - 7, 10, 1); g.fillStyle = '#e44'; g.fillRect(wx - 5, wy - WALL_H - 7, Math.max(0, 10 * wl.hp / WALL_HP), 1); }
    }
  }
  if (L >= 2) for (const ox of [-26, 26]) { sprDraw(g, sprArcher(), x + ox, y - 48, ox < 0); if (!(s.arrows > 0)) R('#e44', ox, -61, 1, 3); }
  if (L >= 3) { const d = s.bDir || 1; sprDraw(g, sprBallista(s.bolts > 0), x, y - 34, d < 0); }
  if (s.upT > 0) sprDraw(g, sprScaffold('castle'), x, y);
}
// Wachturm-Ausbau: Stufe 1 im Grundsprite (Stein/Zinnen), Stufe 2 Schütze, Stufe 3 Pechkessel, Gerüst während des Ausbaus
function drawTowerUp(g, s, col) {
  const x = Math.round(s.x), y = Math.round(s.y), L = towerLevel(s);
  const R = (cl, xx, yy, w, h) => { g.fillStyle = cl; g.fillRect(x + xx, y + yy, w, h); };
  if (L >= 2) { const d = s.bDir || 1; sprDraw(g, sprArcher(), x, y - 46, d < 0); if (!(s.arrows > 0)) R('#e44', 0, -58, 1, 3); }
  if (L >= 3) {
    const d = s.pDir || 1; sprDraw(g, sprCauldron(s.pitch > 0), x + d * 10, y - 41, d < 0);
    if (!(s.pitch > 0)) R('#e44', d * 16, -50, 1, 3);
    if (s.pT > 0) { const t = performance.now() / 50; for (let k = 0; k < 8; k++) { const yy = -40 + ((k * 5 + t) % 40); R(k % 2 ? '#2a1a0a' : '#ff8a20', d * 16 + ((k * 3) % 3) - 1, yy | 0, 2, 3); } }
  }
  if (s.upT > 0) sprDraw(g, sprScaffold('tower'), x, y);
}
function drawHut(g, s, col) { drawStruct(g, Object.assign({}, s, { type: 'hut' }), col); }
function drawTower(g, s, col) { drawStruct(g, Object.assign({}, s, { type: 'tower' }), col); }
function drawCastle(g, s, col) { drawStruct(g, Object.assign({}, s, { type: 'castle' }), col); }
// ---------- Fahrzeuge ----------
function sprWheel(fr) {
  return sprMake('wheel:' + fr, -3, -6, 3, 0, P => {
    P.pix(['.kkk.', 'kwwwk', 'kwHwk', 'kwwwk', '.kkk.'], { k: '#2a2420', w: '#6a5a4a', H: '#b0a090' }, -2, -5);
    if (fr) { P.R('#8a7a68', -1, -4, 1, 1); P.R('#8a7a68', 1, -2, 1, 1); } else { P.R('#8a7a68', 1, -4, 1, 1); P.R('#8a7a68', -1, -2, 1, 1); }
  }, 0);
}
function sprLorry(col, fill) {
  return sprMake('lorry:' + col + ':' + fill, -9, -13, 9, 0, P => {
    const { R, T, pix } = P;
    T('#5f656c', -7, -9, 14, 6, 0.16, 3); R('#8a9098', -8, -10, 16, 1); R('#3c4046', -7, -4, 14, 1); R('#8a9098', -8, -9, 1, 5); R('#8a9098', 7, -9, 1, 5);
    for (let k = -6; k < 7; k += 3) { R('#a8aeb6', k, -8, 1, 1); R('#a8aeb6', k, -5, 1, 1); }
    R(col, -4, -7, 8, 1); R(sprCol(col, 0.7), -4, -6, 8, 1);
    if (fill >= 1) { T('#9a7010', -7, -11, 14, 1, 0.3, 9); }
    if (fill >= 2) { T('#d8a820', -5, -12, 10, 1, 0.3, 10); R('#fff3a0', -2, -12, 1, 1); }
    if (fill >= 3) { T('#f5c823', -3, -13, 6, 1, 0.3, 11); R('#fff3a0', 1, -13, 1, 1); }
  }, 0.55);
}
function sprCatapult(col) {
  return sprMake('catapult:' + col, -10, -13, 10, -1, P => {
    const { R, T, PL, line } = P;
    PL('#6a4422', -9, -6, 18, 3, 3, 4); R('#8a5a2e', -9, -6, 18, 1);
    T('#6a4422', -4, -12, 2, 6, 0.2, 5); T('#6a4422', 2, -12, 2, 6, 0.2, 6); R('#8a5a2e', -4, -12, 6, 1); // Ständer
    line('#4a2e14', -8, -4, -3, -11); line('#4a2e14', 8, -4, 3, -11);
    R(col, -8, -5, 3, 1); R(col, 5, -5, 3, 1); R('#5a5a60', -1, -11, 2, 2); R('#3a2a1a', -9, -13, 1, 7); R(col, -8, -13, 3, 2); R(sprCol(col, 0.7), -8, -11, 2, 1); // Wimpel
  }, 0.55);
}
function sprCatArm() { return sprMake('catarm', 0, -2, 14, 2, P => { P.T('#9a6a36', 0, -1, 11, 2, 0.2, 7); P.R('#6a4a26', 0, 0, 11, 1); P.pix(['k..k', 'kssk', '.kk.'], { k: '#3a2410', s: '#6a6a6a' }, 10, -2); }, 0); }
function sprCannon(col) {
  return sprMake('cannon:' + col, -9, -8, 9, -1, P => {
    const { R, T, PL } = P;
    PL('#6a4422', -7, -6, 14, 4, 2, 8); R('#3c3e44', -7, -5, 14, 1); R('#3c3e44', -7, -3, 14, 1); R(col, -6, -4, 3, 1); R(sprCol(col, 1.3), -6, -4, 1, 1); R(col, 3, -4, 3, 1); R('#3a2a1a', -8, -8, 1, 4); R(col, -7, -8, 3, 2); // Wimpel
  }, 0.55);
}
function sprBarrel() {
  return sprMake('barrel', -5, -3, 12, 3, P => {
    const { R, T } = P;
    T('#2e3236', -4, -2, 14, 4, 0.18, 12); R('#5a6066', -4, -2, 14, 1); R('#1a1c1e', -4, 1, 14, 1);
    R('#4a4e54', 0, -2, 1, 4); R('#4a4e54', 5, -2, 1, 4); R('#1a1c1e', 9, -3, 2, 6); R('#0a0a0a', 10, -1, 1, 2); R('#3a3e44', -5, -1, 1, 2);
  }, 0);
}
function drawVehicle(g, v, col, x, y) {
  x = Math.round(x); y = Math.round(y); const fr = (Math.round(x / 2) & 1);
  if (v.type === 'lorry') {
    const n = (v.inv || []).length; sprDraw(g, sprLorry(col, n === 0 ? 0 : n <= 4 ? 1 : n <= 12 ? 2 : 3), x, y);
    sprDraw(g, sprWheel(fr), x - 4, y); sprDraw(g, sprWheel(fr), x + 4, y);
  } else if (v.type === 'catapult') {
    const f = v.dir < 0; sprDraw(g, sprCatapult(col), x, y, f);
    const ready = !v.cd || v.cd < 10;
    g.save(); g.translate(x, y - 10); if (f) g.scale(-1, 1); g.rotate(ready ? Math.PI + 0.15 : -0.4 - v.ang); const A = sprCatArm(); g.drawImage(A.cv, -A.ox, -A.oy); g.restore();
    sprDraw(g, sprWheel(fr), x - 6, y); sprDraw(g, sprWheel(fr), x + 6, y);
  } else {
    g.save(); g.translate(x, y - 5); if (v.dir < 0) g.scale(-1, 1); g.rotate(-v.ang); const Bq = sprBarrel(); g.drawImage(Bq.cv, -Bq.ox, -Bq.oy); g.restore();
    sprDraw(g, sprCannon(col), x, y, v.dir < 0); sprDraw(g, sprWheel(fr), x - 4, y); sprDraw(g, sprWheel(fr), x + 4, y);
  }
  if (v.fire > 0) drawFlame(g, x, y - 6, 5, v.id);
  if (v.hp < VEH[v.type].hp) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x - 6, y - 15, 12, 1); g.fillStyle = '#e83'; g.fillRect(x - 6, y - 15, Math.max(0, 12 * v.hp / VEH[v.type].hp), 1); }
}
// Ballon über dem Buddler (aufgeblasen / schlaff), je Teamfarbe
function sprBalloon(col, empty) {
  const w = empty ? 5 : 7, h = empty ? 6 : 9;
  return sprMake('balloon:' + col + ':' + (empty ? 1 : 0), -4, -5, 5, 6, P => {
    const d = sprCol(col, 0.68), l = sprCol(col, 1.35);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const dx = (xx + 0.5 - w / 2) / (w / 2), dy = (yy + 0.5 - h / 2) / (h / 2); if (dx * dx + dy * dy > 1.05) continue; const px = xx - (w >> 1), py = yy - (h >> 1); P.R(dx > 0.35 || dy > 0.55 ? d : col, px, py, 1, 1); if (xx === (w >> 1)) P.R(sprCol(col, 0.85), px, py, 1, 1); }
    P.R(l, -(w >> 1) + 1, -(h >> 1) + 1, 1, 2); P.R('rgba(255,255,255,.6)', -(w >> 1) + 1, -(h >> 1) + 1, 1, 1);
    P.R(d, -1, (h >> 1), 2, 1); P.R('#8a6a3a', 0, (h >> 1) + 1, 1, 1);
    if (empty) P.R(sprCol(col, 0.5), -1, 0, 3, 1);
  }, 0.6);
}
function drawBalloon(g, c, col, x, y, bl) {
  const t = performance.now() / 400 + (c.id || 0), bx = Math.round(x + Math.sin(t) * 1.2), by = Math.round(y - 25), empty = bl && !bl.gas;
  g.strokeStyle = 'rgba(230,230,230,.9)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x + c.dir, y - 8); g.lineTo(bx, by + 5); g.stroke();
  sprDraw(g, sprBalloon(col && col[0] === '#' ? col : '#d83a3a', empty), bx, by);
}
// Holzbrücke (Ladensymbol; die gebaute Brücke selbst ist Holz-Material der Welt)
function sprBridge() {
  return sprMake('bridge', 0, 0, 30, 10, P => {
    P.R('#5a3a1a', 1, 1, 1, 6); P.R('#5a3a1a', 28, 1, 1, 6); P.line('#c8a870', 1, 1, 15, 3); P.line('#c8a870', 15, 3, 28, 1);
    for (let x = 4; x < 28; x += 4) P.R('#b09060', x, Math.round(2 + Math.sin((x / 28) * Math.PI) * 1.5), 1, 3);
    P.PV('#8a6038', 1, 5, 28, 3, 3, 13); P.R('#5a3a1a', 1, 8, 28, 1);
  }, 0.6);
}
// ---------- Gegenstände (Pixel-Arrays, Anker = Bodenmitte) ----------
const ITEM_PIX = {
  rock: [['.kkkk.', 'kgGGgk', 'kgggdk', '.kddk.'], { k: '#3a3632', g: '#8a867e', G: '#b4b0a6', d: '#5e5a54' }],
  flint: [['..kk..', '.krRk.', 'kgrOrk', 'kggrgk', '.kkkk.'], { k: '#2a2624', g: '#6a6460', r: '#c23a1a', R: '#ff6a2a', O: '#ffd070' }],
  superflint: [['..kk..', '.kYYk.', 'kyYWyk', 'kyyYyk', 'kdyydk', '.kkkk.'], { k: '#4a3a08', y: '#e0a820', Y: '#ffd84a', W: '#fff6c0', d: '#8a6a10' }],
  tnt: [['..f..', '..f..', 'krrRk', 'krrRk', 'kLLLk', 'krrRk', 'krrRk', 'kkkkk'], { k: '#4a0a0a', f: '#3a3a3a', r: '#b01818', R: '#e04a3a', L: '#e8d8b0' }],
  gold: [['.kkkk.', 'kYWYyk', 'kyYyyk', '.kddk.'], { k: '#5a400a', y: '#e0b020', Y: '#f5c823', W: '#fff3a0', d: '#9a7010' }],
  sword: [['......h..', 'SSSSSShbH', 'ssssssh..', '......h..'], { S: '#e4e8ee', s: '#9aa2ac', h: '#8a6a2a', b: '#5a3a1a', H: '#c8a040' }],
  shield: [['.kkkk.', 'kmwwmk', 'kwBBwk', 'kwBBwk', '.kwwk.', '..kk..'], { k: '#3a2410', m: '#c0c4c8', w: '#8a4a20', B: '#c8ccd2' }],
  bow: [['.b.s', 'b..s', 'b..s', 'b..s', 'b..s', 'b..s', '.b.s'], { b: '#8a5a26', s: '#eeeeee' }],
  arrows: [['f.f.f', 's.s.s', 'kqqqk', 'kQqqk', 'kQqqk', 'kqqqk', '.kkk.'], { f: '#d03030', s: '#dddddd', k: '#3a2410', q: '#7a5228', Q: '#9a6a38' }],
  earth: [['..kkk..', '.keEek.', 'keEeeek', 'keeeddk', '.kkkkk.'], { k: '#3e2614', e: '#7a5230', E: '#9c6c40', d: '#5a3a20' }],
  armor: [['kk..kk', 'kAmmAk', 'kmAAmk', 'kmmmmk', 'kmddmk', '.kkkk.'], { k: '#3a3e44', m: '#a8aeb6', A: '#d4d8de', d: '#6a7078' }],
  hook: [['m.m.m', 'm.m.m', '.mmm.', '..m..', '.rRr.', 'rr.rr'], { m: '#c8ccd2', r: '#b08850', R: '#d8c08a' }],
  balloon: [['.kkk.', 'krRrk', 'krrrk', 'krrrk', '.krk.', '..k..', '..s..', '..s..'], { k: '#6a1010', r: '#d83a3a', R: '#ff8a8a', s: '#dddddd' }],
};
function sprItem(type, lit) {
  const D = ITEM_PIX[type]; const rows = D[0], w = rows[0].length, h = rows.length, x0 = -(w >> 1);
  return sprMake('it:' + type + (lit ? ':lit' : ''), x0, -h - 1, x0 + w, 0, P => { P.pix(rows, D[1], x0, -h); if (lit) P.R('#ffee55', 0, -h - 1, 1, 1); }, 0);
}
function sprArrow() { return sprMake('it:arrow', -6, -2, 5, 2, P => { P.R('#7a5a30', -4, 0, 7, 1); P.R('#cccccc', 3, 0, 1, 1); P.R('#9aa0a8', 4, 0, 1, 1); P.R('#e44', -5, -1, 1, 1); P.R('#e44', -5, 1, 1, 1); P.R('#e44', -4, -1, 1, 1); P.R('#e44', -4, 1, 1, 1); }, 0); }
const ITEM_DRAW = {};
for (const k in ITEM_PIX) ITEM_DRAW[k] = (g, x, y, it) => sprDraw(g, sprItem(k, k === 'tnt' && it && it.fuse > 0 && (it.fuse >> 2) % 2), x, y);
ITEM_DRAW.wipf = (g, x, y) => drawWipf(g, { dir: 1, anim: 0 }, x, y + 1);
ITEM_DRAW.arrow = (g, x, y, it) => { const a = it && it.ang !== undefined ? it.ang : 0, S = sprArrow(); g.save(); g.translate(x, y - 1); g.rotate(a); g.drawImage(S.cv, -S.ox, -S.oy); g.restore(); };
// ---------- Spezialisten-Buddler (helpers.js): Hut/Helm + Abzeichen über der normalen Figur, je Teamfarbe gecacht ----------
// Lokale Koordinaten wie drawClonk (Blick nach rechts, Füße bei y = 0, Kopf y -11..-8)
function sprSpec(kind, col) {
  return sprMake('spec:' + kind + ':' + col, -6, -15, 6, 0, P => {
    const { R, line } = P, dk = sprCol(col, 0.65), lt = sprCol(col, 1.35);
    if (kind === 'zeug') { // Zeugmeister: Lederkappe mit Teamband, Hammer auf dem Rücken, Werkzeuggürtel
      R('#5a3416', -2, -13, 4, 1); R('#7a4a22', -3, -12, 5, 1); R(col, -3, -11, 5, 1); R(lt, -3, -11, 1, 1); R('#5a3416', 2, -11, 2, 1);
      R('#6b4a22', -4, -9, 1, 6); R('#9aa0a8', -5, -10, 3, 2); R('#c8ccd2', -5, -10, 3, 1);
      R('#3a2a1a', -2, -4, 4, 1); R('#d8b040', 0, -4, 1, 1);
    } else if (kind === 'medic') { // Sanitäter: weiße Kappe mit rotem Kreuz, Teamband, Sanitätstasche
      R('#f4f4f4', -2, -14, 4, 1); R('#f4f4f4', -3, -13, 5, 2); R('#d02020', -1, -14, 1, 3); R('#d02020', -2, -13, 3, 1); R(col, -3, -11, 5, 1); R(dk, 1, -11, 1, 1);
      R('#f0f0f0', -6, -9, 4, 5); R('#c8c8c8', -6, -5, 4, 1); R('#d02020', -5, -8, 2, 3); R('#d02020', -6, -7, 4, 1);
      R('#ffffff', -2, -6, 4, 1); R('#d02020', -1, -6, 1, 1);
    } else { // Goldgräber: gelber Grubenhelm mit Lampe und Teamstreifen, Spitzhacke und Goldbeutel
      R('#e8b830', -2, -13, 4, 1); R('#e8b830', -3, -12, 5, 1); R(col, -2, -12, 3, 1); R('#b08820', -3, -11, 7, 1); R('#fff6a0', 2, -13, 2, 2); R('#ffffff', 3, -13, 1, 1);
      line('#6b4a22', -4, -3, -3, -10); R('#9aa0a8', -6, -11, 5, 1); R('#9aa0a8', -6, -10, 1, 1); R('#9aa0a8', -2, -10, 1, 1);
      R('#c89a30', -4, -6, 2, 2); R('#ffe070', -4, -6, 1, 1);
    }
  }, 0);
}
function drawSpec(g, c, col, x, y) {
  if (!c.spec || c.act === 'dead' || c.act === 'swim' || c.act === 'tumble' || !SPEC_KIND_OK(c.spec)) return;
  const bob = c.act === 'dig' ? Math.floor(c.anim) % 4 % 2 : 0;
  sprDraw(g, sprSpec(c.spec, col), x, Math.round(y) + bob, c.dir < 0);
  if (c.healT && Math.floor(performance.now() / 300) % 2) { const X = Math.round(x), Y = Math.round(y) - 19; g.fillStyle = '#3ad060'; g.fillRect(X - 1, Y, 3, 1); g.fillRect(X, Y - 1, 1, 3); }
}
function SPEC_KIND_OK(k) { return k === 'zeug' || k === 'medic' || k === 'gold'; }
