// BuddelRage – Darstellung (prozedurale Pixel-Grafik)
'use strict';
const ITEM_DRAW = {
  rock(g, x, y) { g.fillStyle = '#7d7a74'; g.fillRect(x - 2, y - 3, 4, 3); g.fillStyle = '#a5a29b'; g.fillRect(x - 1, y - 3, 2, 1); g.fillStyle = '#55524d'; g.fillRect(x - 2, y - 1, 4, 1); },
  flint(g, x, y) { g.fillStyle = '#5a5654'; g.fillRect(x - 2, y - 3, 4, 3); g.fillStyle = '#c23a1a'; g.fillRect(x - 1, y - 3, 2, 2); g.fillStyle = '#ff9a40'; g.fillRect(x, y - 3, 1, 1); },
  superflint(g, x, y) { g.fillStyle = '#6a5a20'; g.fillRect(x - 2, y - 4, 4, 4); g.fillStyle = '#ffd030'; g.fillRect(x - 1, y - 4, 2, 3); g.fillStyle = '#fff6a0'; g.fillRect(x, y - 4, 1, 1); },
  tnt(g, x, y, it) { g.fillStyle = '#b01818'; g.fillRect(x - 2, y - 6, 4, 6); g.fillStyle = '#e8d8b0'; g.fillRect(x - 2, y - 4, 4, 1); g.fillStyle = '#333'; g.fillRect(x, y - 7, 1, 1); if (it && it.fuse > 0 && (it.fuse >> 2) % 2) { g.fillStyle = '#ffee55'; g.fillRect(x, y - 8, 1, 1); } },
  gold(g, x, y) { g.fillStyle = '#9a7010'; g.fillRect(x - 2, y - 3, 4, 3); g.fillStyle = '#f5c823'; g.fillRect(x - 2, y - 3, 3, 2); g.fillStyle = '#fff3a0'; g.fillRect(x - 1, y - 3, 1, 1); },
  sword(g, x, y) { g.fillStyle = '#d8dde4'; g.fillRect(x - 3, y - 2, 6, 1); g.fillStyle = '#8a6a2a'; g.fillRect(x + 2, y - 3, 1, 3); g.fillStyle = '#5a3a1a'; g.fillRect(x + 3, y - 2, 1, 1); },
  shield(g, x, y) { g.fillStyle = '#7a4a20'; g.fillRect(x - 2, y - 5, 4, 5); g.fillStyle = '#c0c4c8'; g.fillRect(x - 2, y - 5, 4, 1); g.fillRect(x - 1, y - 3, 2, 1); },
  bow(g, x, y) { g.fillStyle = '#8a5a26'; g.fillRect(x - 1, y - 5, 1, 1); g.fillRect(x, y - 4, 1, 3); g.fillRect(x - 1, y - 1, 1, 1); g.fillStyle = '#eee'; g.fillRect(x - 2, y - 5, 1, 5); },
  arrows(g, x, y) { g.fillStyle = '#6a4a22'; g.fillRect(x - 2, y - 4, 3, 4); g.fillStyle = '#ddd'; g.fillRect(x - 2, y - 6, 1, 2); g.fillRect(x, y - 6, 1, 2); g.fillStyle = '#c33'; g.fillRect(x - 1, y - 5, 1, 1); },
  armor(g, x, y) { g.fillStyle = '#9aa0a8'; g.fillRect(x - 2, y - 4, 4, 4); g.fillStyle = '#d0d4da'; g.fillRect(x - 2, y - 4, 1, 3); g.fillStyle = '#5a6068'; g.fillRect(x - 2, y - 1, 4, 1); },
  wipf(g, x, y) { drawWipf(g, { dir: 1, anim: 0 }, x, y + 1); },
  hook(g, x, y) { g.fillStyle = '#8a6a3a'; g.fillRect(x - 3, y - 2, 4, 1); g.fillStyle = '#c8ccd2'; g.fillRect(x + 1, y - 4, 1, 4); g.fillRect(x + 2, y - 4, 1, 1); g.fillRect(x, y - 4, 1, 1); g.fillRect(x + 2, y - 1, 1, 1); g.fillRect(x, y - 1, 1, 1); g.fillStyle = '#d8c08a'; g.fillRect(x - 4, y - 3, 1, 3); },
  balloon(g, x, y) { g.fillStyle = '#d83a3a'; g.fillRect(x - 2, y - 6, 4, 4); g.fillRect(x - 1, y - 7, 2, 6); g.fillStyle = '#ff8a8a'; g.fillRect(x - 1, y - 6, 1, 1); g.fillStyle = '#ddd'; g.fillRect(x, y - 1, 1, 2); },
  arrow(g, x, y, it) {
    const a = it && it.ang !== undefined ? it.ang : 0; g.save(); g.translate(x, y - 1); g.rotate(a);
    g.fillStyle = '#7a5a30'; g.fillRect(-4, 0, 7, 1); g.fillStyle = '#ccc'; g.fillRect(3, 0, 1, 1); g.fillStyle = '#e44'; g.fillRect(-5, -1, 1, 1); g.fillRect(-5, 1, 1, 1); g.restore();
  },
};
function drawVehicle(g, v, col, x, y) {
  x = Math.round(x); y = Math.round(y);
  const R = (cl, xx, yy, w, h) => { g.fillStyle = cl; g.fillRect(x + xx, y + yy, w, h); };
  const wheel = (xx) => { R('#2a2420', xx - 2, -4, 4, 4); R('#6a5a4a', xx - 1, -3, 2, 2); };
  if (v.type === 'lorry') {
    R('#5a5f66', -7, -8, 14, 5); R('#7d848c', -7, -8, 14, 1); R('#3c4046', -7, -4, 14, 1); R('#8a9098', -7, -8, 1, 5); R('#8a9098', 6, -8, 1, 5);
    const n = (v.inv || []).length; if (n) { R('#9a7010', -6, -9, 12, Math.min(1, n)); if (n > 4) R('#f5c823', -5, -10, 10, 1); if (n > 12) R('#c8a020', -3, -11, 6, 1); }
    R(col, -2, -6, 4, 1); wheel(-4); wheel(4);
  } else if (v.type === 'catapult') {
    g.save(); g.translate(x, y); if (v.dir < 0) g.scale(-1, 1);
    const Q = (cl, xx, yy, w, h) => { g.fillStyle = cl; g.fillRect(xx, yy, w, h); };
    Q('#6a4422', -9, -5, 18, 2); Q('#8a5a2e', -9, -5, 18, 1); Q('#6a4422', -3, -11, 2, 6); Q('#6a4422', 1, -11, 2, 6); Q(col, -8, -4, 3, 1);
    const ready = !v.cd || v.cd < 10; // Wurfarm
    g.save(); g.translate(0, -10); g.rotate(ready ? Math.PI + 0.15 : -0.4 - v.ang); Q('#9a6a36', 0, -1, 12, 2); Q('#4a2e14', 10, -2, 3, 3); g.restore();
    g.restore(); wheel(-6); wheel(6);
  } else {
    g.save(); g.translate(x, y - 5); if (v.dir < 0) g.scale(-1, 1); g.rotate(-v.ang);
    g.fillStyle = '#2e3236'; g.fillRect(-4, -2, 14, 4); g.fillStyle = '#50565c'; g.fillRect(-4, -2, 14, 1); g.fillStyle = '#1a1c1e'; g.fillRect(9, -2, 2, 4);
    g.restore();
    R('#6a4422', -7, -5, 14, 3); R(col, -6, -4, 3, 1); wheel(-4); wheel(4);
  }
  if (v.fire > 0) drawFlame(g, x, y - 6, 5, v.id);
  if (v.hp < VEH[v.type].hp) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x - 6, y - 15, 12, 1); g.fillStyle = '#e83'; g.fillRect(x - 6, y - 15, Math.max(0, 12 * v.hp / VEH[v.type].hp), 1); }
}
function lerpC(a, b, t) { return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')'; }
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; r = Math.min(255, r * f) | 0; g = Math.min(255, g * f) | 0; b = Math.min(255, b * f) | 0; return 'rgb(' + r + ',' + g + ',' + b + ')'; }

function drawClonk(g, c, col, x, y) {
  const skin = '#f0c48e', boot = '#4a2e18', dark = shade(col, 0.6), light = shade(col, 1.3);
  g.save(); g.translate(Math.round(x), Math.round(y));
  if (c.act === 'dead') { g.rotate(Math.PI / 2 * c.dir); g.globalAlpha = 0.75; }
  else if (c.act === 'tumble') { g.translate(0, -5); g.rotate(c.anim * c.dir); g.translate(0, 5); }
  if (c.dir < 0) g.scale(-1, 1);
  const f = Math.floor(c.anim) % 4, a = c.act;
  const R = (cl, x, y, w, h) => { g.fillStyle = cl; g.fillRect(x, y, w, h); };
  if (a === 'swim') {
    g.translate(0, -2);
    R(boot, -5, -4, 2, 2); R(dark, -4, -5, 3, 2); R(col, -2, -6, 4, 3); R(skin, 1, -9, 3, 3); R(light, 1, -10, 3, 1); R('#000', 3, -8, 1, 1);
    R(skin, 2 + (f % 2), -5, 2, 1);
    g.restore(); return;
  }
  // Beine
  if (a === 'walk' || a === 'fight') { const o = [0, 1, 0, -1][f]; R(boot, -2 + o, -3, 2, 3); R(boot, 0 - o, -3, 2, 3); }
  else if (a === 'jump' || a === 'tumble' || a === 'float') { R(boot, -3, -3, 2, 2); R(boot, 1, -3, 2, 3); }
  else if (a === 'rope') { const o = f % 2; R(boot, -2, -3 + o, 2, 3); R(boot, 0, -3 - o, 2, 3); }
  else if (a === 'climb') { const o = f % 2; R(boot, 0, -3 - o, 2, 3); R(boot, -2, -3 + o - 1, 2, 3); }
  else if (a === 'hangle') { R(boot, -2, -3, 2, 3); R(boot, 0, -2, 2, 3); }
  else if (a === 'dig') { R(boot, -2, -3, 2, 3); R(boot, 1, -3, 2, 3); }
  else { R(boot, -2, -3, 4, 3); }
  // Körper
  const bob = a === 'dig' ? (f % 2) : 0;
  R(col, -2, -7 + bob, 4, 4); R(dark, -2, -4 + bob, 4, 1); R(light, -2, -7 + bob, 1, 3);
  // Kopf
  R(skin, -2, -10 + bob, 4, 3); R(skin, 2, -9 + bob, 1, 1); R('#000', 1, -9 + bob, 1, 1);
  R('#6b3d1e', -2, -11 + bob, 4, 1); R('#6b3d1e', -2, -10 + bob, 1, 1);
  // Arme / Werkzeug
  if (a === 'dig') { const s = f % 2; R(skin, 1, -6 + bob, 2, 1); R('#9a9a9a', 3 + s, -7 + bob + s, 1, 3); R('#6b4a22', 2, -6 + bob, 2, 1); }
  else if (a === 'climb') { const s = f % 2; R(skin, 1, -12 + s, 1, 4); R(skin, 2, -8 - s, 1, 2); }
  else if (a === 'hangle') { const s = f % 2; R(skin, -1, -14 + s, 1, 4); R(skin, 1, -14 - s + 1, 1, 4); }
  else if (c.punch > 0) { R(skin, 1, -7, 4, 1); }
  else if (a === 'jump') { R(skin, 1, -9, 1, 3); }
  else if (a === 'rope' || a === 'float') { R(skin, 1, -10, 1, 4); R(skin, -1, -10, 1, 3); }
  else if (a === 'push') { R(skin, 1, -7, 4, 1); }
  else { const o = (a === 'walk') ? [0, 1, 0, -1][f] : 0; R(skin, -1 + o, -6, 1, 3); }
  // Rüstung / Helm
  if (c.armor) { R('#a8aeb6', -2, -7 + bob, 4, 3); R('#d4d8de', -2, -7 + bob, 1, 3); R('#7a8088', -2, -12 + bob, 4, 2); R('#a8aeb6', -2, -11 + bob, 1, 1); if (c.knight) R(col, -1, -13 + bob, 2, 1); }
  // Waffen
  const inv = c.inv || [];
  if (a !== 'dig' && a !== 'climb' && a !== 'hangle' && a !== 'swim' && a !== 'rope' && a !== 'float') {
    if (c.swing > 0 && inv.includes('sword')) { const s = c.swing > 6; if (s) { R('#e0e4ea', 1, -13, 1, 6); R('#8a6a2a', 0, -7, 3, 1); } else { R('#e0e4ea', 2, -6, 6, 1); R('#8a6a2a', 1, -7, 1, 3); } }
    else if (c.bowT > 0 && inv.includes('bow')) { R('#8a5a26', 3, -10, 1, 1); R('#8a5a26', 4, -9, 1, 5); R('#8a5a26', 3, -4, 1, 1); R('#eee', 3, -9, 1, 5); R(skin, 1, -7, 3, 1); }
    else if (inv.includes('sword')) { R('#c8ccd2', -3, -9, 1, 6); R('#8a6a2a', -4, -6, 3, 1); }
    if (inv.includes('shield')) { if (c.block || c.blockT > 0) { R('#6a3a18', 3, -10, 2, 8); R('#c0c4c8', 4, -10, 1, 8); R(col, 3, -7, 2, 2); } else { R('#6a3a18', -4, -8, 2, 5); R(col, -4, -7, 2, 2); } }
  }
  g.restore();
  if (c.fire > 0) drawFlame(g, x, y - 4, 4, c.id);
}
// ---------- Tiere ----------
function drawWipf(g, a, x, y) {
  g.save(); g.translate(Math.round(x), Math.round(y)); if (a.dir < 0) g.scale(-1, 1);
  const R = (cl, xx, yy, w, h) => { g.fillStyle = cl; g.fillRect(xx, yy, w, h); };
  const f = Math.floor(a.anim || 0) % 4, o = a.flop ? 0 : [0, 1, 0, -1][f], hop = a.air ? -1 : 0;
  R('#6b4a2e', -3 + o, -1 + hop, 1, 1); R('#6b4a2e', 1 - o, -1 + hop, 1, 1); // Füßchen
  R('#c99a62', -3, -4 + hop, 6, 3); R('#e8c89a', -2, -2 + hop, 4, 1); // Fell + heller Bauch
  R('#c99a62', 2, -5 + hop, 2, 2); R('#a87848', 2, -6 + hop, 1, 1); // Kopf + Ohr
  R('#000', 3, -5 + hop, 1, 1); R('#f08a8a', 4, -4 + hop, 1, 1); // Auge, Nase
  R('#a87848', -4, -4 + hop + (f % 2), 1, 2); // Schwänzchen
  g.restore();
}
function drawAnimal(g, a, x, y) {
  const R = (cl, xx, yy, w, h) => { g.fillStyle = cl; g.fillRect(xx, yy, w, h); };
  if (a.k === 'wipf') return drawWipf(g, a, x, y);
  g.save(); g.translate(Math.round(x), Math.round(y)); if (a.dir < 0) g.scale(-1, 1);
  const f = Math.floor(a.anim || 0) % 4;
  if (a.k === 'bird') {
    R('#2a2a34', -2, -1, 4, 2); R('#2a2a34', 2, -2, 1, 1); R('#e0a030', 3, -2, 1, 1);
    const wy = [-3, -2, 0, -2][f]; R('#3a3a48', -1, wy, 2, 1); R('#3a3a48', -2, wy + (wy < -1 ? 1 : -1), 1, 1);
  } else if (a.k === 'bat') {
    R('#3a2a40', -1, -1, 3, 2); R('#5a4060', 1, -2, 1, 1);
    const up = f % 2; R('#3a2a40', -4, -2 + up * 2, 3, 1); R('#3a2a40', 2, -2 + up * 2, 3, 1); R('#d04040', 1, -1, 1, 1);
  } else if (a.k === 'fish') {
    const t = f % 2;
    R('#e07a28', -2, -2, 4, 2); R('#ffb060', -1, -2, 2, 1); R('#c05a18', -4, -3 + t, 2, 1); R('#c05a18', -4, -1 - t, 2, 1); R('#000', 1, -2, 1, 1);
  } else if (a.k === 'shark') {
    const t = f % 2;
    R('#6a7884', -7, -4, 13, 4); R('#dfe4e8', -5, -1, 10, 1); R('#6a7884', 6, -3, 2, 2); // Körper, Bauch, Schnauze
    R('#56626c', -1, -7, 3, 3); R('#56626c', 0, -8, 1, 1); // Flosse
    R('#56626c', -10, -6 + t, 3, 2); R('#56626c', -10, -1 - t, 3, 2); // Schwanz
    R('#000', 4, -3, 1, 1);
    if (a.bite) { R('#300', 4, -1, 4, 2); R('#fff', 5, -1, 1, 1); R('#fff', 7, -1, 1, 1); }
  }
  g.restore();
}
// Seil + Haken
function drawRope(g, c, x, y, hk) {
  const hx = x + c.dir * 1, hy = y - 7;
  g.strokeStyle = 'rgba(200,170,110,.95)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(hx, hy);
  if (hk.st === 2) g.lineTo(hk.x, hk.y); else { const mx = (hx + hk.x) / 2, my = (hy + hk.y) / 2 + 3; g.quadraticCurveTo(mx, my, hk.x, hk.y); }
  g.stroke();
  g.fillStyle = '#c8ccd2'; g.fillRect(Math.round(hk.x) - 1, Math.round(hk.y) - 1, 3, 1); g.fillRect(Math.round(hk.x), Math.round(hk.y) - 2, 1, 3);
}
function drawBalloon(g, c, col, x, y, bl) {
  const t = performance.now() / 400 + (c.id || 0), bx = Math.round(x + Math.sin(t) * 1.2), by = Math.round(y - 25), empty = bl && !bl.gas;
  g.strokeStyle = 'rgba(230,230,230,.9)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x + c.dir, y - 8); g.lineTo(bx, by + 5); g.stroke();
  const w = empty ? 5 : 7, h = empty ? 6 : 9;
  g.fillStyle = col; g.beginPath(); g.ellipse(bx, by, w / 2, h / 2, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(bx - 2, by - 3, 1, 2);
  g.fillStyle = shade(col.length === 7 ? col : '#d83a3a', 0.7); g.fillRect(bx - 1, by + h / 2 - 1, 2, 1);
}
function drawFlame(g, x, y, s, seed, n) {
  const t = performance.now() / 70 + (seed || 0) * 1.7; n = n || 3;
  for (let k = 0; k < n; k++) {
    const fx = Math.round(x + Math.sin(t + k * 2.1) * s * 0.4 + (k - (n - 1) / 2) * s * 0.45), h = Math.round(s * (1.2 + 0.6 * Math.sin(t * 1.3 + k)));
    g.fillStyle = 'rgba(255,90,10,0.85)'; g.fillRect(fx - 1, Math.round(y) - h, 3, h + 1);
    g.fillStyle = 'rgba(255,210,60,0.95)'; g.fillRect(fx, Math.round(y) - h + 1, 1, h);
  }
}
// Monster: geduckte, stachelige Bestie mit glühenden Augen, Krallen und Zähnen (prozedurale Pixelkunst)
// Animationen: Laufen (4 Phasen, Beine + Kopfwippen), Ausholen vor dem Biss (duckt sich, Augen glühen, Maul öffnet), Biss (Sprung nach vorn, Maul weit auf), Treffer-Blitz
function drawMonster(g, m, x, y) {
  const now = performance.now();
  if (m.hpSeen !== undefined && m.hp < m.hpSeen - 0.5) m.flashT = now + 160;
  m.hpSeen = m.hp;
  const flash = m.flashT > now && ((now / 40) | 0) % 2 === 0;
  const wind = m.wind > 0 ? Math.min(1, (16 - m.wind) / 10 + 0.3) : 0, bite = m.bite > 0 ? m.bite / 10 : 0;
  const f = Math.floor(m.anim * 1.4) % 4, step = [0, 1, 0, -1][f], bob = f % 2 ? 0 : -1;
  const crouch = wind ? 1 : 0, lunge = bite > 0.4 ? 2 : 0, open = bite > 0 ? 3 : wind ? 1 : 0;
  g.save(); g.translate(Math.round(x), Math.round(y)); if (m.dir < 0) g.scale(-1, 1);
  const C = flash ? { d: '#fff', b: '#fff', l: '#fff', s: '#ffd0d0', belly: '#fff', claw: '#fff' } : { d: '#1f3d16', b: '#3e7a24', l: '#5fa634', s: '#7a2f5a', belly: '#9ab86a', claw: '#e6dcc0' };
  const R = (cl, xx, yy, w, h) => { g.fillStyle = cl; g.fillRect(xx, yy, w, h); };
  g.translate(lunge, crouch);
  const O = flash ? '#fff' : '#12240c'; // Umriss
  // Schwanz (wippt, mit Stachelspitze)
  const tw = Math.round(Math.sin(m.anim * 0.9) * 1);
  R(O, -13, -9 + tw, 5, 3); R(C.d, -12, -8 + tw, 4, 2); R(C.b, -9, -8 + tw, 3, 2); R(C.s, -14, -10 + tw, 2, 1); R(C.s, -14, -9 + tw, 1, 1);
  // Hinterbeine (kräftige Schenkel, Krallen)
  const s1 = step, s2 = -step;
  R(O, -8 + s1, -5, 4, 5); R(C.d, -7 + s1, -5, 2, 4); R(C.claw, -8 + s1, -1, 3, 1);
  R(O, -4 + s2, -5, 4, 5); R(C.d, -3 + s2, -5, 2, 4); R(C.claw, -4 + s2, -1, 3, 1);
  // Körper: buckelig, Schultern höher als Hüfte
  R(O, -10, -9 + bob, 15, 6); R(O, -4, -12 + bob, 9, 4);
  R(C.d, -9, -9 + bob, 13, 5); R(C.b, -8, -10 + bob, 11, 5); R(C.b, -4, -12 + bob, 8, 3); R(C.l, -3, -12 + bob, 5, 1); R(C.l, -7, -10 + bob, 4, 1);
  R(C.belly, -6, -5 + bob, 9, 1); R(C.d, -2, -7 + bob, 1, 2); R(C.d, -5, -7 + bob, 1, 1); // Schuppen/Rippen
  // Rückenstacheln (größer an den Schultern)
  for (const [sx, h, yo] of [[-8, 2, 0], [-6, 2, 0], [-4, 3, -2], [-2, 4, -2], [0, 4, -2], [2, 3, -2]]) { R(C.s, sx, -10 + bob + yo - h, 1, h); R(flash ? '#fff' : '#d070b0', sx, -10 + bob + yo - h, 1, 1); }
  // Vorderbeine mit langen Krallen
  R(O, 0 + s2, -5, 4, 5); R(C.d, 1 + s2, -5, 2, 4); R(C.claw, 1 + s2, -1, 3, 1); R(C.claw, 4 + s2, -2, 1, 1);
  R(O, 3 + s1, -5, 4, 5); R(C.d, 4 + s1, -5, 2, 4); R(C.claw, 4 + s1, -1, 3, 1); R(C.claw, 7 + s1, -2, 1, 1);
  // Kopf (groß, nach vorn gereckt; wippt beim Laufen, hebt sich zum Biss)
  const hy = -12 + bob - (bite > 0 ? 1 : 0) + (wind ? 1 : 0);
  R(O, 3, hy - 1, 9, 7); R(C.d, 4, hy, 7, 5); R(C.b, 4, hy - 1, 7, 3); R(C.l, 5, hy - 1, 4, 1);
  R(C.s, 4, hy - 3, 1, 2); R(C.s, 7, hy - 3, 1, 2); R(flash ? '#fff' : '#d070b0', 4, hy - 3, 1, 1); R(flash ? '#fff' : '#d070b0', 7, hy - 3, 1, 1); // Hörner
  R(O, 9, hy + 1, 4, 2); R(C.b, 10, hy + 1, 3, 1); R(O, 12, hy + 1, 1, 1); // Schnauze + Nüster
  // Augenhöhle mit glühender Pupille, finstere Braue
  R('#0a0a06', 6, hy + 1, 3, 2); R(O, 5, hy, 4, 1);
  const eye = flash ? '#f88' : wind || bite ? '#ff3a20' : '#ffd23a';
  R(eye, 7, hy + 1, 2, 1); R(flash ? '#fff' : '#fff8c0', 8, hy + 1, 1, 1);
  if (!flash) { g.fillStyle = wind || bite ? 'rgba(255,60,30,.45)' : 'rgba(255,210,60,.22)'; g.fillRect(5, hy, 5, 4); }
  // Maul: Oberkiefer mit Zahnreihe, Unterkiefer klappt auf
  R(C.d, 8, hy + 3, 5, 1); R('#fff', 9, hy + 4, 1, 1); R('#fff', 11, hy + 4, 1, 1); R('#fff', 12, hy + 4, 1, 1);
  if (open) { R('#3a0808', 8, hy + 4, 5, open); R('#c03030', 9, hy + 3 + open, 3, 1); R(O, 8, hy + 4 + open, 5, 1); R(C.d, 8, hy + 4 + open, 4, 1); R('#fff', 10, hy + 3 + open, 1, 1); R('#fff', 12, hy + 3 + open, 1, 1); }
  else { R(O, 8, hy + 5, 4, 1); R(C.d, 8, hy + 4, 3, 1); R('#fff', 10, hy + 4, 1, 1); }
  g.restore();
  // Warnung vor dem Biss
  if (wind && !flash) { g.fillStyle = 'rgba(255,70,40,' + (0.6 + 0.4 * Math.sin(now / 50)).toFixed(2) + ')'; g.fillRect(Math.round(x) - 1, Math.round(y) - 20, 2, 4); g.fillRect(Math.round(x) - 1, Math.round(y) - 15, 2, 1); }
  // Lebensbalken, wenn verletzt
  if (m.hp < 59.5 && m.hp > 0) { const bx = Math.round(x) - 7, by = Math.round(y) - 17 - (wind ? 6 : 0); R('rgba(0,0,0,.6)', bx, by, 14, 2); R(m.hp > 30 ? '#9be35a' : m.hp > 15 ? '#e8b02c' : '#e0402c', bx, by, Math.max(1, Math.round(14 * m.hp / 60)), 2); }
}
function drawStruct(g, s, col) {
  if (s.type === 'tower') drawTower(g, s, col); else if (s.type === 'castle') drawCastle(g, s, col); else drawHut(g, s, col);
  if (s.fire > 0) for (let k = 0; k < 4; k++) drawFlame(g, s.x + (k - 1.5) * s.w / 4, s.y - s.h * (0.3 + 0.5 * ((k * 7) % 3) / 3), 6, s.id + k);
  if (s.prog >= 1 && s.hp < BUILD[s.type].hp) { const x = Math.round(s.x - s.w / 2), y = Math.round(s.y - s.h - 6); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x, y, s.w, 2); g.fillStyle = '#e44'; g.fillRect(x, y, Math.max(0, s.w * s.hp / BUILD[s.type].hp), 2); }
}
// Bauvorschau: grün = sofort, gelb = Planieren nötig, rot = unmöglich
function buildPreviewInfo(world, type) {
  if (!world || G.myTeam < 0 || !BUILD[type]) return null;
  const t = world.teams[G.myTeam], c = t && world.clonks.find(o => o.id === t.sel);
  if (!c || c.act === 'dead' || c.inside) return null;
  const p = world.sitePos(c, type), pc = c.act === 'walk' ? world.placeCheck(type, p.x, p.y) : { st: 'no', why: 'Buddler muss auf festem Boden stehen' };
  return { x: p.x, y: p.y, pc, B: BUILD[type] };
}
function drawBuildPreview(g, world, type) {
  const I = buildPreviewInfo(world, type); if (!I) return;
  const { x, y, pc, B } = I, hw = B.w >> 1;
  const col = pc.st === 'ok' ? '80,220,110' : pc.st === 'level' ? '255,200,60' : '240,70,60';
  const a = 0.5 + 0.25 * Math.sin(performance.now() / 180);
  g.fillStyle = 'rgba(' + col + ',' + (0.18 + a * 0.12) + ')'; g.fillRect(x - hw, y - B.h + 1, B.w + 1, B.h);
  g.fillStyle = 'rgba(' + col + ',.95)';
  g.fillRect(x - hw, y - B.h + 1, B.w + 1, 1); g.fillRect(x - hw, y, B.w + 1, 1); g.fillRect(x - hw, y - B.h + 1, 1, B.h); g.fillRect(x + hw, y - B.h + 1, 1, B.h);
  if (pc.st === 'level') { g.fillStyle = 'rgba(255,200,60,.5)'; g.fillRect(x - hw, y + 1, B.w + 1, 3); }
}
function drawSite(g, s) {
  const x = Math.round(s.x), y = Math.round(s.y), hw = s.w >> 1, h = Math.round((s.h - 4) * s.prog);
  const R = (cl, xx, yy, w, hh) => { g.fillStyle = cl; g.fillRect(x + xx, y + yy, w, hh); };
  if (s.lv) { // Planierphase: Absteckpflöcke + gestrichelter Rahmen + Schaufel-Balken
    const T = (performance.now() / 120) | 0;
    for (let k = -hw; k < hw; k += 4) if (((k >> 2) + T) % 2) { R('rgba(255,200,60,.85)', k, -s.h, 2, 1); R('rgba(255,200,60,.85)', k, 0, 2, 1); }
    R('#c8a050', -hw, -10, 1, 10); R('#c8a050', hw, -10, 1, 10); R('#e33', -hw, -10, 2, 2); R('#e33', hw - 1, -10, 2, 2);
    R('#222', -12, -s.h - 4, 24, 3); R('#fb3', -12 + (T % 20), -s.h - 4, 4, 3);
    return;
  }
  g.globalAlpha = 0.5 + s.prog * 0.5;
  R('#7a5530', -hw, -2, s.w, 2);
  for (let px = -hw + 1; px < hw; px += 10) R('#8a6038', px, -2 - h, 2, h);
  R('#8a6038', hw - 2, -2 - h, 2, h);
  for (let k = 0; k < h; k += 5) R('#a07040', -hw + 1, -2 - k, s.w - 2, 1);
  g.globalAlpha = 1;
  R('#222', -12, -s.h - 4, 24, 3); R('#5c5', -12, -s.h - 4, 24 * s.prog, 3);
}
function drawTower(g, s, col) {
  if (s.prog < 1) return drawSite(g, s);
  const x = Math.round(s.x), y = Math.round(s.y);
  const R = (cl, xx, yy, w, h) => { g.fillStyle = cl; g.fillRect(x + xx, y + yy, w, h); };
  R('#5c3b1c', -8, -42, 16, 42); for (let k = 0; k < 42; k += 4) R('#7a5228', -8, -42 + k, 16, 2);
  R('#4a2e14', -8, -42, 1, 42); R('#4a2e14', 7, -42, 1, 42);
  R('#6a4422', -10, -46, 20, 4); R('#8a5a2e', -10, -46, 20, 1);
  for (let k = -10; k < 10; k += 4) R('#6a4422', k, -50, 2, 4);
  R('#3a2210', -3, -10, 6, 10); R('#2a2a40', -2, -30, 4, 5); R('#ffd060', -1, -29, 2, 3);
  R('#555', 8, -64, 1, 18); R(col, 9, -64, 8, 5); R(shade(col, 0.7), 9, -61, 8, 2);
}
function drawCastle(g, s, col) {
  if (s.prog < 1) return drawSite(g, s);
  const x = Math.round(s.x), y = Math.round(s.y);
  const R = (cl, xx, yy, w, h) => { g.fillStyle = cl; g.fillRect(x + xx, y + yy, w, h); };
  const st = '#8d8a84', st2 = '#a8a59e', dk = '#5e5b56';
  R(st, -24, -30, 48, 30); for (let k = 0; k < 30; k += 5) for (let j = -24 + (k % 10 ? 0 : 4); j < 24; j += 8) R(dk, j, -30 + k, 1, 5);
  for (let k = 0; k < 30; k += 5) R(st2, -24, -30 + k, 48, 1);
  for (let k = -24; k < 24; k += 6) R(st, k, -34, 4, 4);
  R(st, -32, -44, 12, 44); R(st, 20, -44, 12, 44); R(st2, -32, -44, 12, 1); R(st2, 20, -44, 12, 1);
  for (let k = 0; k < 3; k++) { R(st, -32 + k * 4.5, -48, 3, 4); R(st, 20 + k * 4.5, -48, 3, 4); }
  R(dk, -27, -36, 2, 5); R(dk, 25, -36, 2, 5); R('#ffd060', -27, -35, 2, 3); R('#ffd060', 25, -35, 2, 3);
  R('#2a1c10', -6, -16, 12, 16); R('#3e2814', -6, -18, 12, 2); for (let k = -5; k < 6; k += 3) R('#6a6a6a', k, -16, 1, 16);
  R('#2a2a40', -15, -24, 4, 5); R('#ffd060', -14, -23, 2, 3); R('#2a2a40', 11, -24, 4, 5); R('#ffd060', 12, -23, 2, 3);
  R('#555', -1, -62, 1, 28); R(col, 0, -62, 11, 6); R(shade(col, 0.7), 0, -58, 11, 2);
}
function drawHut(g, s, col) {
  const x = Math.round(s.x), y = Math.round(s.y);
  const R = (cl, xx, yy, w, h) => { g.fillStyle = cl; g.fillRect(x + xx, y + yy, w, h); };
  if (s.prog < 1) return drawSite(g, s);
  R('#5c3b1c', -14, -16, 28, 16); for (let k = 0; k < 16; k += 3) R('#7a5228', -14, -16 + k, 28, 2);
  R('#3a2210', -3, -9, 6, 9); R('#c09040', 1, -5, 1, 1);
  R('#2a2a40', -11, -13, 5, 4); R('#ffd060', -10, -12, 3, 2);
  for (let k = 0; k < 9; k++) R(k % 2 ? '#8a2a1a' : '#a8382a', -16 + k, -17 - k, 32 - 2 * k, 1);
  R('#555', 9, -40, 1, 24); R(col, 10, -40, 9, 6); R(shade(col, 0.7), 10, -36, 9, 2);
}

class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.tc = null; this.tg = null; this.cam = { x: 0, y: 0 }; this.scale = 2;
    this.bgHills = null; this.shake = 0; this.zoom = 1; this.base = 2;
  }
  // Zoom: Faktor auf die Grundskalierung (0,5 … 2,5), begrenzt, damit die Karte den Bildschirm noch füllt
  setZoom(z, world, keep) {
    const w = world || this.world; if (!keep) this.want = z;
    let lo = 0.5; if (w) lo = Math.max(lo, (this.cv.height / (w.H + 30)) / this.base, (this.cv.width / w.W) / this.base);
    this.zoom = Math.max(Math.min(lo, 2.5), Math.min(2.5, z));
    this.scale = Math.max(0.5, Math.round(this.base * this.zoom * 4) / 4);
    return this.zoom;
  }
  attach(world) {
    this.world = world;
    this.tc = document.createElement('canvas'); this.tc.width = world.W; this.tc.height = world.H;
    this.tg = this.tc.getContext('2d');
    this.tg.putImageData(world.img, 0, 0); world.renderDirty.clear();
    this.mini = document.createElement('canvas'); this.mini.width = world.W / 8 | 0; this.mini.height = world.H / 8 | 0; this.miniT = 0;
  }
  resize() {
    const dpr = 1; this.cv.width = innerWidth * dpr; this.cv.height = innerHeight * dpr;
    this.base = Math.max(2, Math.round(Math.min(this.cv.height / 270, this.cv.width / 480)));
    this.setZoom(this.want || this.zoom, null, true);
  }
  flush(world) {
    for (const ci of world.renderDirty) { const cx = ci % world.cw, cy = (ci / world.cw) | 0; this.tg.putImageData(world.img, 0, 0, cx * CH, cy * CH, CH, CH); }
    world.renderDirty.clear();
  }
  draw(world, focus, myTeam, dt) {
    const g = this.g, S = this.scale, vw = this.cv.width / S, vh = this.cv.height / S;
    this.flush(world);
    if (focus) {
      const tx = focus.x - vw / 2, ty = focus.y - 8 - vh / 2 + (typeof G !== 'undefined' && G.menu === 'buildmenu' ? vh * 0.2 : 0); // Bauen: Buddler oberhalb des Menüs zeigen
      this.cam.x += (tx - this.cam.x) * 0.12; this.cam.y += (ty - this.cam.y) * 0.12;
      if (Math.abs(tx - this.cam.x) > vw) { this.cam.x = tx; this.cam.y = ty; }
    }
    this.cam.x = Math.max(0, Math.min(world.W - vw, this.cam.x)); this.cam.y = Math.max(-40, Math.min(world.H - vh, this.cam.y));
    if (world.W < vw) this.cam.x = (world.W - vw) / 2;
    let cx = Math.round(this.cam.x), cy = Math.round(this.cam.y);
    if (this.shake > 0) { cx += Math.round((Math.random() - 0.5) * this.shake); cy += Math.round((Math.random() - 0.5) * this.shake); this.shake *= 0.85; if (this.shake < 0.5) this.shake = 0; }
    this.view = { cx, cy, S };
    const light = world.daylight(), dark = 1 - light, phase = world.dayPhase();
    // Himmel (Tag/Nacht)
    const sky = g.createLinearGradient(0, 0, 0, this.cv.height);
    const dusk = Math.max(0, 1 - Math.abs(light - 0.45) * 3.2);
    sky.addColorStop(0, lerpC([106, 166, 232], [8, 12, 38], dark));
    sky.addColorStop(0.6, lerpC(lerpC([185, 220, 245], [20, 28, 64], dark).match(/\d+/g).map(Number), [235, 140, 90], dusk * 0.6));
    sky.addColorStop(1, lerpC([232, 242, 240], [30, 34, 60], dark));
    g.fillStyle = sky; g.fillRect(0, 0, this.cv.width, this.cv.height);
    if (dark > 0.3) { // Sterne
      g.fillStyle = 'rgba(255,255,240,' + ((dark - 0.3) * 1.2).toFixed(2) + ')';
      for (let k = 0; k < 90; k++) { const sx = (hash2(k, 1, 3) * this.cv.width - cx * 0.05 * S) % this.cv.width, sy = hash2(k, 2, 3) * this.cv.height * 0.55; const tw = hash2(k, (world.tick / 20) | 0, 5) > 0.15 ? 1 : 0; if (tw) g.fillRect((sx + this.cv.width) % this.cv.width, sy, S * (k % 7 === 0 ? 1.5 : 1), S * (k % 7 === 0 ? 1.5 : 1)); }
    }
    { // Sonne / Mond
      const sunA = (phase - 0.25) * Math.PI * 2, W2 = this.cv.width, H2 = this.cv.height;
      const sx = W2 / 2 - Math.cos(sunA) * W2 * 0.42, sy = H2 * 0.62 - Math.sin(sunA) * H2 * 0.55;
      if (Math.sin(sunA) > -0.15) { g.fillStyle = 'rgba(255,240,170,0.35)'; g.beginPath(); g.arc(sx, sy, 11 * S, 0, 7); g.fill(); g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(sx, sy, 7 * S, 0, 7); g.fill(); }
      const mx = W2 / 2 + Math.cos(sunA) * W2 * 0.42, my = H2 * 0.62 + Math.sin(sunA) * H2 * 0.55;
      if (-Math.sin(sunA) > -0.15) { g.fillStyle = '#e8ecf4'; g.beginPath(); g.arc(mx, my, 5 * S, 0, 7); g.fill(); g.fillStyle = lerpC([106, 166, 232], [8, 12, 38], dark); g.beginPath(); g.arc(mx + 2 * S, my - S, 4.5 * S, 0, 7); g.fill(); }
    }
    // Parallax-Berge
    g.imageSmoothingEnabled = false;
    for (let layer = 0; layer < 2; layer++) {
      const par = layer ? 0.5 : 0.25, col = layer ? lerpC([143, 177, 201], [28, 36, 58], dark) : lerpC([169, 196, 216], [22, 30, 52], dark);
      g.fillStyle = col; g.beginPath(); g.moveTo(0, this.cv.height);
      for (let sx = 0; sx <= vw + 4; sx += 4) { const wx = sx + cx * par; const h = fbm(wx / 120, layer * 7, 99 + layer, 3) * 140 + 30 * layer; g.lineTo(sx * S, (world.H * 0.38 - cy * par * 0.6 - h + layer * 40) * S * 0.9 - (layer ? 0 : 20)); }
      g.lineTo(this.cv.width, this.cv.height); g.fill();
    }
    // Wolken
    g.fillStyle = 'rgba(' + lerpC([255, 255, 255], [70, 76, 100], dark).match(/\d+/g).join(',') + ',0.8)';
    for (let k = 0; k < 8; k++) { const wx = ((k * 397 + world.tick * 0.05 * (1 + k % 3) - cx * 0.3) % (vw + 200) + vw + 200) % (vw + 200) - 100; const wy = 20 + (k * 53) % 60 - cy * 0.2; g.fillRect(wx * S, wy * S, (30 + k * 5) * S, 6 * S); g.fillRect((wx + 6) * S, (wy - 4) * S, (18 + k * 3) * S, 5 * S); }
    // Landschaft
    g.drawImage(this.tc, cx, cy, vw, vh, 0, 0, vw * S, vh * S);
    if (cx < 0) { g.fillStyle = '#222'; g.fillRect(0, 0, -cx * S, this.cv.height); g.fillRect((world.W - cx) * S, 0, this.cv.width, this.cv.height); }
    g.save(); g.scale(S, S); g.translate(-cx, -cy);
    const L = (o) => { if (world.remote) { if (o.rx === undefined || Math.abs(o.x - o.rx) > 40 || Math.abs(o.y - o.ry) > 40) { o.rx = o.x; o.ry = o.y; } o.rx += (o.x - o.rx) * 0.35; o.ry += (o.y - o.ry) * 0.35; return [o.rx, o.ry]; } return [o.x, o.y]; };
    const vis = (x, y, m) => x > cx - m && x < cx + vw + m && y > cy - m && y < cy + vh + m;
    for (const s of world.structs) { if (!vis(s.x, s.y, 80)) continue; const t = world.teams[s.team]; drawStruct(g, s, t ? t.color : '#888'); }
    if (typeof G !== 'undefined' && G.buildPrev) drawBuildPreview(g, world, G.buildPrev);
    for (const it of world.items) { const [x, y] = L(it); if (!vis(x, y, 10)) continue; if (it.stuck) g.globalAlpha = 0.85; ITEM_DRAW[it.type](g, Math.round(x), Math.round(y) + 1, it); g.globalAlpha = 1; }
    for (const m of world.monsters) { const [x, y] = L(m); if (!vis(x, y, 20)) continue; drawMonster(g, m, x, y); if (m.fire > 0) drawFlame(g, x, y - 5, 5, m.id); }
    for (const a of world.animals || []) { const [x, y] = L(a); if (!vis(x, y, 16)) continue; drawAnimal(g, a, x, y); }
    for (const c of world.clonks) {
      if (c.inside) continue;
      const [x, y] = L(c); if (!vis(x, y, 140)) continue; const t = world.teams[c.team];
      if (c.hk) drawRope(g, c, x, y, c.hk);
      if (c.bl) drawBalloon(g, c, t.color, x, y, c.bl);
      if (c.invT > 0 && c.act !== 'dead' && (Math.floor(performance.now() / 70) % 2)) g.globalAlpha = 0.35; // Unverwundbar: Blinken
      drawClonk(g, c, t.color, x, y); g.globalAlpha = 1;
      if (c.act === 'dead') continue;
      const isSel = t.sel === c.id;
      if (isSel && t.id === myTeam) { g.fillStyle = '#fff'; const by = Math.round(y) - 17 + (Math.floor(world.tick / 15) % 2); g.fillRect(Math.round(x) - 1, by, 3, 1); g.fillRect(Math.round(x), by + 1, 1, 1); }
      if (c.hp < 100 || isSel) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(Math.round(x) - 5, Math.round(y) - 14, 10, 2); g.fillStyle = c.hp > 50 ? '#3c3' : c.hp > 25 ? '#ec3' : '#e33'; g.fillRect(Math.round(x) - 5, Math.round(y) - 14, Math.max(0, c.hp / 10), 1); g.fillStyle = t.color; g.fillRect(Math.round(x) - 5, Math.round(y) - 13, 10, 1); }
      if (c.breath < 100) { g.fillStyle = '#7cf'; g.fillRect(Math.round(x) - 5, Math.round(y) - 16, c.breath / 10, 1); }
    }
    for (const v of world.vehicles) { const [x, y] = L(v); if (!vis(x, y, 30)) continue; const t = world.teams[v.team]; drawVehicle(g, v, t ? t.color : '#999', x, y); }
    // Feuer
    for (const f of world.fires) if (vis(f.x, f.y, 10)) drawFlame(g, f.x, f.y + 1, f.k ? 3 : 3, f.x * 3 + f.y, 2);
    // Partikel
    for (const p of world.particles) { g.fillStyle = p.c; g.globalAlpha = Math.min(1, p.l / 20); g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
    g.globalAlpha = 1;
    // Namen
    g.font = '5px monospace'; g.textAlign = 'center';
    for (const c of world.clonks) { if (c.act === 'dead' || c.inside) continue; const t = world.teams[c.team]; const sel = t.sel === c.id; if (!sel && t.id !== myTeam) continue; const [x, y] = [c.rx !== undefined && world.remote ? c.rx : c.x, c.ry !== undefined && world.remote ? c.ry : c.y]; g.globalAlpha = sel ? 1 : 0.55; g.fillStyle = 'rgba(0,0,0,0.5)'; const ny = c.bl ? 37 : 20; g.fillText(c.name, Math.round(x) + 0.5, Math.round(y) - ny + 0.5); g.fillStyle = t.id === myTeam ? '#fff' : t.color; g.fillText(c.name, Math.round(x), Math.round(y) - ny); g.globalAlpha = 1; }
    g.restore();
    if (dark > 0.04) this.drawLighting(world, cx, cy, vw, vh, dark, myTeam);
    if (this.miniDom) this.drawMinimap(world, cx, cy, vw, vh, myTeam);
  }
  // Nacht-Beleuchtung: Dunkelheit mit Lichtquellen (Buddler, Gebäude, Feuer, Lava, Explosionen)
  drawLighting(world, cx, cy, vw, vh, dark, myTeam) {
    const Q = 2, lw = Math.ceil(vw / Q) + 1, lh = Math.ceil(vh / Q) + 1;
    if (!this.lc || this.lc.width !== lw || this.lc.height !== lh) { this.lc = document.createElement('canvas'); this.lc.width = lw; this.lc.height = lh; }
    const lg = this.lc.getContext('2d'), S = this.scale, g = this.g;
    lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, lw, lh);
    lg.fillStyle = 'rgba(4,6,22,' + (dark * 0.8).toFixed(3) + ')'; lg.fillRect(0, 0, lw, lh);
    lg.globalCompositeOperation = 'destination-out';
    const lights = [], warm = [];
    const add = (x, y, r, i, w) => { if (x < cx - r || x > cx + vw + r || y < cy - r || y > cy + vh + r) return; lights.push([x, y, r, i]); if (w) warm.push([x, y, r * 0.8, w]); };
    for (const c of world.clonks) if (c.act !== 'dead' && !c.inside) add(c.x, c.y - 5, c.team === myTeam ? 42 : 22, c.team === myTeam ? 0.85 : 0.5);
    for (const s of world.structs) if (s.prog >= 1) add(s.x, s.y - s.h * 0.5, s.type === 'castle' ? 80 : 55, 0.9, 0.08);
    let nf = 0; for (const f of world.fires) add(f.x, f.y, 26, 1, (nf++ % 3) ? 0 : 0.12);
    for (const o of [...world.clonks, ...world.monsters, ...world.structs, ...world.vehicles]) if (o.fire > 0) add(o.x, o.y - 6, 40, 1, 0.15);
    for (const p of world.particles) if (p.light) add(p.x, p.y, p.light, Math.min(1, p.l / 10), 0.25);
    // Lava leuchtet (Stichprobe im Sichtbereich)
    const mat = world.mat, W = world.W; let nl = 0;
    for (let y = Math.max(0, (cy | 0) - 10); y < Math.min(world.H, cy + vh + 10) && nl < 160; y += 7) for (let x = Math.max(0, (cx | 0) - 10); x < Math.min(W, cx + vw + 10) && nl < 160; x += 7) if (mat[y * W + x] === MAT.LAVA) { add(x, y, 22, 0.9, (nl % 4) ? 0 : 0.06); nl++; }
    for (const [x, y, r, i] of lights) {
      const lx = (x - cx) / Q, ly = (y - cy) / Q, lr = r / Q;
      const gr = lg.createRadialGradient(lx, ly, 0, lx, ly, lr); gr.addColorStop(0, 'rgba(0,0,0,' + i + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      lg.fillStyle = gr; lg.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
    }
    g.imageSmoothingEnabled = true; g.drawImage(this.lc, 0, 0, lw * Q * S, lh * Q * S); g.imageSmoothingEnabled = false;
    if (warm.length) {
      g.globalCompositeOperation = 'lighter';
      for (const [x, y, r, w] of warm) { const sx = (x - cx) * S, sy = (y - cy) * S, sr = r * S; const gr = g.createRadialGradient(sx, sy, 0, sx, sy, sr); gr.addColorStop(0, 'rgba(255,140,40,' + (w * dark).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,100,20,0)'); g.fillStyle = gr; g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2); }
      g.globalCompositeOperation = 'source-over';
    }
  }
  drawMinimap(world, cx, cy, vw, vh, myTeam) {
    const mw = this.mini.width, mh = this.mini.height, D = this.miniDom;
    if (--this.miniT <= 0) { this.miniT = 30; const mg = this.mini.getContext('2d'); mg.clearRect(0, 0, mw, mh); mg.imageSmoothingEnabled = true; mg.drawImage(this.tc, 0, 0, mw, mh); }
    if (D.width !== mw || D.height !== mh) { D.width = mw; D.height = mh; }
    const g = D.getContext('2d'), light = world.daylight();
    g.fillStyle = lerpC([120, 170, 220], [14, 18, 40], 1 - light); g.fillRect(0, 0, mw, mh);
    g.drawImage(this.mini, 0, 0);
    for (const v of world.vehicles) { g.fillStyle = '#ddd'; g.fillRect(v.x / 8 - 1, v.y / 8 - 1, 3, 2); }
    for (const s of world.structs) if (s.prog >= 1) { g.fillStyle = world.teams[s.team] ? world.teams[s.team].color : '#aaa'; g.fillRect(s.x / 8 - 2, (s.y - s.h) / 8, 4, Math.max(2, s.h / 8)); }
    for (const c of world.clonks) { if (c.act === 'dead' || c.inside) continue; const t = world.teams[c.team]; g.fillStyle = t.color; g.fillRect(c.x / 8 - 1, c.y / 8 - 2, 3, 3); if (t.id === myTeam && t.sel === c.id) { g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(c.x / 8 - 2.5, c.y / 8 - 3.5, 6, 6); } }
    for (const m of world.monsters) { g.fillStyle = '#6f3'; g.fillRect(m.x / 8 - 1, m.y / 8 - 1, 2, 2); }
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1; g.strokeRect(cx / 8 + 0.5, cy / 8 + 0.5, vw / 8, vh / 8);
  }
}
