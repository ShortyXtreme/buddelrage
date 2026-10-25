// BuddelRage – Spielwelt / Simulation (eigener Code, inspiriert von Clonk Rage / OpenClonk-Mechaniken)
'use strict';
const MAT = { SKY: 0, TUNNEL: 1, EARTH: 2, SAND: 3, ROCK: 4, GOLD: 5, GRANITE: 6, WATER: 7, WOOD: 8, LAVA: 9 };
const MAT_NAMES = ['Himmel', 'Tunnel', 'Erde', 'Sand', 'Fels', 'Gold', 'Granit', 'Wasser', 'Holz', 'Lava'];
const SOLID = [0, 0, 1, 1, 1, 1, 1, 0, 1, 0];
const DIGGABLE = [0, 0, 1, 1, 0, 1, 0, 0, 0, 0];
const BLASTABLE = [0, 0, 1, 1, 1, 1, 0, 0, 1, 0];
const CH = 32;
const ITEMS = {
  rock: { name: 'Stein', price: 3, sell: 2, dmg: 9 },
  flint: { name: 'Feuerstein', price: 10, sell: 5, blast: 13 },
  superflint: { name: 'Superflint', price: 20, sell: 10, blast: 21 },
  tnt: { name: 'TNT', price: 25, sell: 12, blast: 30 },
  gold: { name: 'Gold', price: 0, sell: 20, dmg: 6 },
  sword: { name: 'Schwert', price: 15, sell: 7, dmg: 7 },
  shield: { name: 'Schild', price: 12, sell: 6, dmg: 5 },
  bow: { name: 'Bogen', price: 15, sell: 7, dmg: 4 },
  arrows: { name: 'Pfeile (10)', price: 6, sell: 3, dmg: 3 },
  armor: { name: 'Rüstung', price: 25, sell: 12, dmg: 6 },
  arrow: { name: 'Pfeil', price: 0, sell: 0, dmg: 13 },
};
const ITEM_CODES = ['rock', 'flint', 'superflint', 'tnt', 'gold', 'sword', 'shield', 'bow', 'arrows', 'armor', 'arrow'];
const AMMO = new Set(['rock', 'flint', 'superflint', 'tnt', 'gold']);
const THROWABLE = new Set(['flint', 'superflint', 'tnt']);
const PRICE_CLONK = 60, PRICE_KNIGHT = 90, PRICE_BRIDGE = 12;
// Fahrzeuge (Lore, Katapult, Kanone)
const VEH = {
  lorry: { name: 'Lore', price: 25, w: 14, h: 8, hp: 80, cap: 25, res: 'lorry' },
  catapult: { name: 'Katapult', price: 45, w: 18, h: 12, hp: 90, wood: 1, gun: 1, speed: 4.9, cd: 70, amin: 0.3, amax: 1.35, ang: 0.8, res: 'catapult' },
  cannon: { name: 'Kanone', price: 80, w: 16, h: 9, hp: 150, gun: 1, speed: 6.6, cd: 100, amin: 0, amax: 1.1, ang: 0.3, res: 'cannon' },
};
const VEH_CODES = ['lorry', 'catapult', 'cannon'];
// Gebäude
const BUILD = {
  hut: { name: 'Hütte', price: 60, w: 30, h: 24, hp: 120, time: 360, base: 1, wood: 1 },
  tower: { name: 'Wachturm', price: 80, w: 18, h: 50, hp: 220, time: 600, wood: 1, res: 'tower' },
  castle: { name: 'Burg', price: 150, w: 64, h: 46, hp: 600, time: 1000, base: 1, res: 'castle' },
};
// Forschungsbaum
const RESEARCH = [
  { k: 'lorry', name: 'Lore', cost: 20, time: 12, desc: 'Fahrzeug: sammelt Gold, Steine & Gegenstände ein' },
  { k: 'tower', name: 'Wachturm', cost: 35, time: 18, desc: 'Gebäude: betretbar, von oben werfen/schießen' },
  { k: 'tnt', name: 'Sprengstoff', cost: 30, time: 15, desc: 'TNT im Laden' },
  { k: 'weapons', name: 'Waffenschmiede', cost: 45, time: 20, desc: 'Schwert, Schild, Bogen, Pfeile, Rüstung' },
  { k: 'catapult', name: 'Katapult', cost: 40, time: 20, req: ['lorry'], desc: 'Fahrzeug: schleudert Steine & Feuersteine' },
  { k: 'castle', name: 'Burg', cost: 70, time: 30, req: ['tower'], desc: 'Gebäude: Heimatbasis, Laden, Rüstung, Heilung' },
  { k: 'cannon', name: 'Kanone', cost: 70, time: 30, req: ['catapult', 'weapons'], desc: 'Fahrzeug: schießt flach und hart' },
  { k: 'knight', name: 'Ritter', cost: 60, time: 25, req: ['castle', 'weapons'], desc: 'Ritter mit Schwert, Schild, Bogen & Rüstung kaufen' },
];
const RES_BY = Object.fromEntries(RESEARCH.map(r => [r.k, r]));
const SHOP_ALL = [
  { k: 'flint' }, { k: 'superflint' }, { k: 'tnt', res: 'tnt' }, { k: 'rock' }, { k: 'clonk' },
  { k: 'lorry', res: 'lorry' }, { k: 'catapult', res: 'catapult' }, { k: 'cannon', res: 'cannon' },
  { k: 'sword', res: 'weapons' }, { k: 'shield', res: 'weapons' }, { k: 'bow', res: 'weapons' }, { k: 'arrows', res: 'weapons' }, { k: 'armor', res: 'weapons' },
  { k: 'knight', res: 'knight' },
];
function shopList(t) { return SHOP_ALL.filter(e => !e.res || (t.res && t.res[e.res])); }
function shopName(k) { return k === 'clonk' ? 'Buddler (neuer Arbeiter)' : k === 'knight' ? 'Ritter (Schwert, Schild, Bogen, Rüstung)' : VEH[k] ? VEH[k].name + ' (Fahrzeug)' : ITEMS[k].name; }
function shopPrice(k) { return k === 'clonk' ? PRICE_CLONK : k === 'knight' ? PRICE_KNIGHT : VEH[k] ? VEH[k].price : ITEMS[k].price; }
// Zielhilfen (auch für die Flugbahn-Vorschau im Client)
function throwVel(px, py, ax, ay) { const dx = ax - px, dy = ay - py, d = Math.hypot(dx, dy) || 1; const sp = Math.max(1.6, Math.min(3.4, 1.3 + d * 0.022)); return [dx / d * sp, dy / d * sp]; }
function arrowVel(px, py, ax, ay, dir) { const dx = ax - px, dy = ay - py, d = Math.hypot(dx, dy); if (d < 2) return [dir * 5.6, -0.5]; return [dx / d * 5.6, dy / d * 5.6]; }
function digAngle(c, ax, ay) { const dx = Math.abs(ax - c.x), dy = ay - (c.y - 5); return Math.max(-1.1, Math.min(1.5, Math.atan2(dy, Math.max(1, dx)))); }
const DAY_LEN = 60 * 60 * 4; // 4 Minuten pro Tag
const TEAM_COLORS = ['#2f5fe0', '#e03030', '#2fae3c', '#e0b818', '#a040d0', '#18b8c0'];
const ACTS = ['walk', 'jump', 'climb', 'hangle', 'dig', 'swim', 'fight', 'tumble', 'dead', 'push'];
const NAMES = ['Hans', 'Jörg', 'Kurt', 'Fritz', 'Otto', 'Paul', 'Karl', 'Willi', 'Bernd', 'Uwe', 'Gerd', 'Heinz', 'Rudi', 'Sepp', 'Franz', 'Toni', 'Max', 'Egon', 'Udo', 'Horst'];
const INV_MAX = 3;
const NOKEYS = { l: 0, r: 0, u: 0, d: 0, b: 0, s: 0, g: 0, am: 0, ax: 0, ay: 0 };
const BLOCK_SLOT = new Set(['sword', 'shield']);
function actIdx(c) { return Math.max(0, Math.min(c.slot || 0, c.inv.length - 1)); }
function actItem(c) { return c.inv.length ? c.inv[actIdx(c)] : null; }
const invEnc = a => a.map(t => String.fromCharCode(97 + ITEM_CODES.indexOf(t))).join('');
const invDec = s => s ? s.split('').map(ch => ITEM_CODES[ch.charCodeAt(0) - 97]) : [];

function hash2(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, o = 4) {
  let t = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < o; i++) { t += vnoise(x * f, y * f, s + i * 17) * a; n += a; a *= 0.5; f *= 2; }
  return t / n;
}
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---- RLE (für Netzwerk) ----
function rleEncode(arr) {
  const out = []; let i = 0;
  while (i < arr.length) {
    const v = arr[i]; let n = 1;
    while (i + n < arr.length && arr[i + n] === v && n < 65535) n++;
    out.push(v, n >> 8, n & 255); i += n;
  }
  let s = ''; for (let k = 0; k < out.length; k += 8192) s += String.fromCharCode.apply(null, out.slice(k, k + 8192));
  return btoa(s);
}
function rleDecode(b64, target) {
  const s = atob(b64); let p = 0;
  for (let k = 0; k < s.length; k += 3) {
    const v = s.charCodeAt(k), n = (s.charCodeAt(k + 1) << 8) | s.charCodeAt(k + 2);
    target.fill(v, p, p + n); p += n;
  }
  return p;
}

// Texturen (werden von main.js gesetzt): TEX[mat] = {d:Uint8ClampedArray, s:size}
const TEX = {};

class World {
  constructor(cfg, remote) {
    this.cfg = cfg;
    this.W = cfg.W; this.H = cfg.H; this.seed = cfg.seed;
    this.remote = !!remote;
    const W = this.W, H = this.H;
    this.mat = new Uint8Array(W * H);
    this.surf = new Int16Array(W);
    this.burnt = new Uint8Array(W);
    this.img = new ImageData(W, H);
    this.cw = Math.ceil(W / CH); this.chh = Math.ceil(H / CH);
    this.active = new Uint8Array(this.cw * this.chh);
    this.activeNext = new Uint8Array(this.cw * this.chh);
    this.stamp = new Uint16Array(W * H);
    this.renderDirty = new Set(); this.netDirty = new Set();
    this.clonks = []; this.items = []; this.monsters = []; this.structs = []; this.teams = []; this.vehicles = [];
    this.fires = []; this.fireSet = new Set();
    this.events = []; this.particles = [];
    this.nextId = 1; this.tick = 0; this.state = 'run'; this.winner = -1;
    this.mode = cfg.mode; this.goal = cfg.goal || 300;
    this.rand = mulberry32(cfg.seed * 7 + 1);
    this.lastSizzle = 0;
  }
  id() { return this.nextId++; }
  ev(o) { this.events.push(o); }
  msg(s, team) { this.ev({ e: 'msg', s, team: team === undefined ? -1 : team }); }
  snd(n, x, y) { this.ev({ e: 'snd', n, x: x | 0, y: y | 0 }); }
  // Tag/Nacht: 0 = tiefe Nacht, 1 = voller Tag
  dayPhase() { return ((this.tick / DAY_LEN) + (this.cfg.dayStart != null ? this.cfg.dayStart : 0.3)) % 1; }
  daylight() {
    if (this.cfg.daynight === false) return 1;
    const sunH = -Math.cos(this.dayPhase() * Math.PI * 2);
    return Math.max(0, Math.min(1, sunH * 1.7 + 0.5));
  }

  // ---------- Landschaft ----------
  bg(x, y) { return y < this.surf[x] ? MAT.SKY : MAT.TUNNEL; }
  matAt(x, y) { x = Math.round(x); y = Math.round(y); if (x < 0 || x >= this.W || y >= this.H) return MAT.GRANITE; if (y < 0) return MAT.SKY; return this.mat[y * this.W + x]; }
  solid(x, y) { x = Math.round(x); y = Math.round(y); if (x < 0 || x >= this.W || y >= this.H) return true; if (y < 0) return false; return SOLID[this.mat[y * this.W + x]] === 1; }
  boxHit(x, y) {
    const xi = Math.round(x), yi = Math.round(y);
    for (let yy = yi - 9; yy <= yi; yy++) for (let xx = xi - 3; xx <= xi + 2; xx++) if (this.solid(xx, yy)) return true;
    return false;
  }
  setMat(x, y, m) {
    const i = y * this.W + x;
    if (this.mat[i] === m) return;
    this.mat[i] = m;
    this.colorPixel(x, y);
    const cx = (x / CH) | 0, cy = (y / CH) | 0, ci = cy * this.cw + cx;
    this.renderDirty.add(ci);
    if (y + 1 < this.H) { this.colorPixel(x, y + 1); if ((y + 1) % CH === 0) this.renderDirty.add(ci + this.cw); }
    if (!this.remote) {
      this.netDirty.add(ci);
      const a = this.activeNext;
      a[ci] = 1;
      if (cx > 0) a[ci - 1] = 1; if (cx < this.cw - 1) a[ci + 1] = 1;
      if (cy > 0) { a[ci - this.cw] = 1; if (cx > 0) a[ci - this.cw - 1] = 1; if (cx < this.cw - 1) a[ci - this.cw + 1] = 1; }
      if (cy < this.chh - 1) a[ci + this.cw] = 1;
    }
  }
  colorPixel(x, y) {
    const i = y * this.W + x, m = this.mat[i], d = this.img.data, o = i * 4;
    if (m === MAT.SKY) { d[o + 3] = 0; return; }
    if (m === MAT.LAVA) { // prozedurale Lava (keine Lava-Textur aus Clonk/RedWolf)
      const n = fbm(x / 9, y / 6, 77, 2), h = hash2(x, y, 9);
      let r = 200 + n * 55, g = 50 + n * 120 + h * 20, b = 10 + h * 20;
      if (y > 0 && this.mat[i - this.W] !== MAT.LAVA) { r = 255; g = Math.min(255, g + 70); b += 40; }
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255; return;
    }
    const t = TEX[m] || TEX[MAT.EARTH];
    let r, g, b;
    if (t) { const s = t.s, ti = (((y % s) * s) + (x % s)) * 4; r = t.d[ti]; g = t.d[ti + 1]; b = t.d[ti + 2]; }
    else { const n = hash2(x, y, 3) * 30; r = 120 + n; g = 90 + n; b = 60; }
    const surfD = y - this.surf[x];
    if (m === MAT.TUNNEL) { r = r * 0.75 + 22; g = g * 0.7 + 16; b = b * 0.65 + 12; }
    else if (m === MAT.EARTH && surfD >= 0 && surfD < 3 && (y === 0 || this.mat[i - this.W] === MAT.SKY || surfD < 2)) {
      if (this.burnt[x]) { r = r * 0.25 + 22; g = g * 0.22 + 18; b = b * 0.2 + 14; }
      else { r = r * 0.3 + 30; g = g * 0.4 + 110; b = b * 0.2 + 20; }
    }
    else if (m === MAT.WATER) {
      if (this.bg(x, y) === MAT.TUNNEL) { const tt = TEX[MAT.TUNNEL]; let tr = 40, tg = 30, tb = 25; if (tt) { const s = tt.s, ti = (((y % s) * s) + (x % s)) * 4; tr = tt.d[ti] * 0.4; tg = tt.d[ti + 1] * 0.4; tb = tt.d[ti + 2] * 0.4; } r = r * 0.45 + tr * 0.55; g = g * 0.5 + tg * 0.5; b = b * 0.6 + tb * 0.4 + 30; d[o + 3] = 255; }
      else d[o + 3] = 185;
      d[o] = r; d[o + 1] = g; d[o + 2] = b; return;
    }
    if (SOLID[m] && y > 0 && !SOLID[this.mat[i - this.W]]) { r *= 1.18; g *= 1.18; b *= 1.18; }
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  recolorAll() {
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) this.colorPixel(x, y);
    for (let i = 0; i < this.cw * this.chh; i++) this.renderDirty.add(i);
  }
  markBurnt(x) {
    if (x < 0 || x >= this.W || this.burnt[x]) return;
    this.burnt[x] = 1; if (!this.remote) (this.burntNew || (this.burntNew = [])).push(x);
    const s = this.surf[x];
    for (let y = Math.max(0, s - 1); y < Math.min(this.H, s + 4); y++) this.colorPixel(x, y);
    const cx = (x / CH) | 0; for (let y = Math.max(0, s - 1); y < Math.min(this.H, s + 4); y += 2) this.renderDirty.add(((y / CH) | 0) * this.cw + cx);
  }

  basePositions(n) {
    const xs = [];
    if (n === 1) xs.push(Math.round(this.W * 0.3));
    else for (let i = 0; i < n; i++) xs.push(Math.round(this.W * (i + 0.5) / n));
    return xs;
  }
  generate(nBases) {
    const { W, H, seed } = this, surf = this.surf, mat = this.mat;
    const sf = new Float32Array(W);
    for (let x = 0; x < W; x++) sf[x] = H * 0.27 + (fbm(x / 260, 0.5, seed, 3) - 0.5) * 260 + (fbm(x / 40, 3.3, seed + 5, 2) - 0.5) * 26;
    this.bases = this.basePositions(nBases);
    for (const bx of this.bases) {
      const h = sf[bx];
      for (let x = Math.max(0, bx - 90); x < Math.min(W, bx + 90); x++) {
        const d = Math.abs(x - bx); const f = d < 50 ? 1 : 1 - (d - 50) / 40;
        sf[x] = sf[x] * (1 - f) + h * f;
      }
    }
    for (let x = 0; x < W; x++) surf[x] = Math.max(50, Math.min(H * 0.55, Math.round(sf[x])));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, s = surf[x];
      if (y < s) { mat[i] = MAT.SKY; continue; }
      const d = y - s; let m = MAT.EARTH;
      if (d < 22 && fbm(x / 130, y / 60, seed + 2, 3) > 0.64) m = MAT.SAND;
      if (d > 25 && fbm(x / 35, y / 30, seed + 8, 3) > 0.69) m = MAT.SAND;
      if (fbm(x / 45, y / 30, seed + 3, 4) > 0.64 - Math.min(d, 300) / 2500) m = MAT.ROCK;
      if (d > 30 && fbm(x / 16, y / 13, seed + 4, 3) > 0.70) m = MAT.GOLD;
      const c = fbm(x / 90, y / 45, seed + 6, 4);
      if (d > 40 && Math.abs(c - 0.5) < 0.02) m = MAT.TUNNEL;
      if (d > 50 && fbm(x / 60, y / 40, seed + 7, 3) > 0.685) m = (y > H * 0.6 && fbm(x / 220, y / 220, seed + 9, 2) > 0.45) ? MAT.WATER : MAT.TUNNEL;
      if (m === MAT.TUNNEL && d > 70 && y > H * 0.72 && fbm(x / 160, y / 90, seed + 11, 2) > 0.56) m = MAT.LAVA;
      if (y > H - 16 - fbm(x / 30, 0, seed + 10, 2) * 18) m = MAT.GRANITE;
      mat[i] = m;
    }
    // Lava-Höhlen (unten mit Lava gefüllt, oben Hohlraum)
    const R = this.rand;
    const nLava = this.cfg.lava === false ? 0 : Math.max(1, Math.round(W / 800));
    for (let k = 0; k < nLava; k++) {
      let cx = 0; for (let t = 0; t < 30; t++) { cx = 60 + Math.floor(R() * (W - 120)); if (!this.bases.some(b => Math.abs(b - cx) < 150)) break; }
      const cy = Math.round(H * 0.74 + R() * H * 0.1), rx = 22 + R() * 16, ry = 11 + R() * 5;
      for (let y = Math.round(cy - ry); y <= cy + ry; y++) for (let x = Math.round(cx - rx); x <= cx + rx; x++) {
        if (x < 1 || x >= W - 1 || y < 1 || y >= H - 20) continue;
        const dx = (x - cx) / rx, dy = (y - cy) / ry; if (dx * dx + dy * dy > 1 + (hash2(x, y, 4) - 0.5) * 0.2) continue;
        mat[y * W + x] = y > cy - ry * 0.1 ? MAT.LAVA : MAT.TUNNEL;
      }
    }
    if (this.cfg.lava === false) for (let i = 0; i < W * H; i++) if (mat[i] === MAT.LAVA) mat[i] = MAT.TUNNEL;
    // Lava vorab "setzen": nur aufliegende, seitlich begrenzte Lava bleibt (sonst fließt sie zu Spielbeginn überall)
    const EMP = m => m === MAT.TUNNEL || m === MAT.SKY;
    for (let pass = 0; pass < 3; pass++) for (let y = H - 2; y >= 1; y--) {
      for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (mat[i] === MAT.LAVA && (EMP(mat[i + W]) || EMP(mat[i - 1]) && EMP(mat[i - 1 + W]))) mat[i] = MAT.TUNNEL; }
      for (let x = W - 2; x >= 1; x--) { const i = y * W + x; if (mat[i] === MAT.LAVA && (EMP(mat[i + W]) || EMP(mat[i + 1]) && EMP(mat[i + 1 + W]))) mat[i] = MAT.TUNNEL; }
    }
    // Boden unter Basen festigen
    for (const bx of this.bases) for (let x = bx - 46; x < bx + 46; x++) for (let y = surf[x]; y < surf[x] + 26; y++) {
      const i = y * W + x; if (mat[i] !== MAT.EARTH && mat[i] !== MAT.GOLD) mat[i] = MAT.EARTH;
    }
    // Oberflächen-See
    let lx = -1, best = 0;
    for (let x = 60; x < W - 60; x++) { if (this.bases.some(b => Math.abs(b - x) < 160)) continue; if (surf[x] > best) { best = surf[x]; lx = x; } }
    if (lx > 0) {
      const level = best - 22; let a = lx, b = lx;
      while (a > 0 && surf[a] > level) a--; while (b < W - 1 && surf[b] > level) b++;
      if (b - a < 360 && a > 2 && b < W - 3) for (let x = a; x <= b; x++) for (let y = level; y < surf[x]; y++) mat[y * W + x] = MAT.WATER;
    }
    // Eingebettete Objekte (Feuersteine, Gold, Steine)
    for (let k = 0; k < Math.round(W / 22); k++) {
      const x = 10 + Math.floor(R() * (W - 20)); const y = surf[x] + 15 + Math.floor(R() * (H - surf[x] - 50));
      if (mat[y * W + x] !== MAT.EARTH) continue;
      const r = R(); const type = r < 0.55 ? 'flint' : r < 0.75 ? 'gold' : 'rock';
      const it = this.spawnItem(type, x, y); it.stuck = true;
    }
    this.activeNext.fill(1);
    this.recolorAll();
  }

  // ---------- Setup ----------
  setup() {
    const cfg = this.cfg;
    this.generate(cfg.teams.length);
    cfg.teams.forEach((tc, ti) => {
      const team = { id: ti, name: tc.name, color: tc.color || TEAM_COLORS[ti % 6], ai: !!tc.ai, pid: tc.pid || null, money: cfg.money != null ? cfg.money : 50, sel: -1, keys: { ...NOKEYS }, elim: false, aiT: 0, nameIdx: ti * 5, res: {}, rq: '', rp: 0 };
      if (cfg.allResearch) for (const r of RESEARCH) team.res[r.k] = 1;
      this.teams.push(team);
      const bx = this.bases[ti];
      this.addStruct('hut', bx, this.surf[bx], ti, 1);
      for (let k = 0; k < (cfg.clonks || 3); k++) this.spawnClonk(ti, bx - 12 + k * 10, this.surf[bx] - 2);
      team.sel = this.clonks.find(c => c.team === ti).id;
    });
    if (cfg.monsters) for (let k = 0; k < (cfg.monsterCount || 4); k++) this.spawnMonster();
  }
  addStruct(type, x, y, team, prog) {
    const B = BUILD[type];
    const s = { id: this.id(), type, x, y, team, prog, hp: B.hp, w: B.w, h: B.h, fire: 0 };
    this.structs.push(s); return s;
  }
  spawnClonk(team, x, y) {
    const t = this.teams[team];
    const c = { id: this.id(), team, x, y, vx: 0, vy: 0, dir: 1, act: 'jump', hp: 100, breath: 100, inv: [], anim: 0, digA: 0, gold: 0, fightT: 0, cd: 0, tumbleT: 0, deadT: 0, name: NAMES[(t.nameIdx++) % NAMES.length], aiKeys: { ...NOKEYS }, punch: 0, digIdle: 0, armor: 0, knight: 0, arrows: 0, block: 0, inside: 0, fire: 0, swing: 0, bowT: 0, veh: 0, blockT: 0 };
    while (this.boxHit(c.x, c.y) && c.y > 2) c.y--;
    this.clonks.push(c); return c;
  }
  spawnKnight(team, x, y) {
    const c = this.spawnClonk(team, x, y);
    c.knight = 1; c.armor = 1; c.inv = ['sword', 'shield', 'bow']; c.arrows = 15;
    return c;
  }
  spawnItem(type, x, y) {
    const it = { id: this.id(), type, x, y, vx: 0, vy: 0, armed: false, owner: 0, fuse: 0, stuck: false, age: 0, pickCd: 0, chain: 0, shot: 0 };
    this.items.push(it); return it;
  }
  spawnVehicle(type, x, y, team) {
    const d = VEH[type];
    const v = { id: this.id(), type, x, y, vx: 0, vy: 0, dir: 1, team, hp: d.hp, inv: [], ang: d.ang || 0, cd: 0, pusher: 0, fire: 0 };
    let g = 0; while (this.vHit(v, v.x, v.y) && v.y > 2 && g++ < 60) v.y--;
    this.vehicles.push(v); return v;
  }
  spawnMonster() {
    for (let tries = 0; tries < 50; tries++) {
      const x = 30 + Math.floor(this.rand() * (this.W - 60));
      if (this.bases.some(b => Math.abs(b - x) < 220)) continue;
      if (this.matAt(x, this.surf[x] - 1) === MAT.WATER) continue;
      const m = { id: this.id(), x, y: this.surf[x] - 1, vx: 0, vy: 0, dir: this.rand() < 0.5 ? -1 : 1, hp: 60, act: 'walk', anim: 0, cd: 0, think: 0, fire: 0 };
      while (this.boxHit(m.x, m.y) && m.y > 2) m.y--;
      this.monsters.push(m); return m;
    }
  }
  structById(id) { return this.structs.find(s => s.id === id); }
  vehById(id) { return this.vehicles.find(v => v.id === id); }
  hasBase(teamId) { return this.structs.some(s => s.team === teamId && BUILD[s.type].base && s.prog >= 1); }

  // ---------- Eingabe ----------
  setKeys(teamId, k) { const t = this.teams[teamId]; if (!t) return; const num = v => (typeof v === 'number' && isFinite(v)) ? Math.max(-500, Math.min(9000, Math.round(v))) : 0; t.keys = { l: +!!k.l, r: +!!k.r, u: +!!k.u, d: +!!k.d, b: +!!k.b, s: +!!k.s, g: +!!k.g, am: +!!k.am, ax: num(k.ax), ay: num(k.ay) }; }
  selClonk(t) { return this.clonks.find(c => c.id === t.sel && c.act !== 'dead'); }
  action(teamId, a, arg) {
    const t = this.teams[teamId]; if (!t || this.state !== 'run') return;
    if (a === 'sel' || a === 'next') {
      const own = this.clonks.filter(c => c.team === teamId && c.act !== 'dead'); if (!own.length) return;
      let idx;
      if (a === 'sel') idx = arg; else idx = (own.findIndex(c => c.id === t.sel) + 1) % own.length;
      if (own[idx]) { t.sel = own[idx].id; own.forEach(c => { if (c.id !== t.sel) c.aiKeys = { ...NOKEYS }; }); }
      return;
    }
    if (a === 'buy') return this.buy(t, arg);
    if (a === 'slot' || a === 'slotd') { const c = this.selClonk(t); if (!c) return; c.slot = a === 'slot' ? Math.max(0, Math.min(INV_MAX - 1, arg | 0)) : ((c.slot || 0) + (arg > 0 ? 1 : INV_MAX - 1)) % INV_MAX; return; }
    if (a === 'research') return this.research(t, arg);
    const c = this.selClonk(t); if (!c) return;
    this.clonkAction(c, a, arg);
  }
  clonkAction(c, a, arg) {
    const t = this.teams[c.team];
    const aim = Array.isArray(arg) && arg.length === 2 && isFinite(arg[0]) && isFinite(arg[1]) ? [+arg[0], +arg[1]] : null;
    if (a === 'primary') return this.primary(c, aim);
    if (a === 'interact') a = 'use';
    if (c.inside) { // im Gebäude
      if (a === 'use' || a === 'jump') this.leave(c);
      else if (a === 'throw') this.throwItem(c);
      else if (a === 'drop') this.throwItem(c);
      else if (a === 'attack') this.attack(c);
      else if (a === 'sell') this.sell(c);
      else if (a === 'inv') { if (c.inv.length > 1) c.inv.push(c.inv.shift()); }
      return;
    }
    if (c.act === 'push') {
      const v = this.vehById(c.veh);
      if (a === 'use') { this.release(c); return; }
      if (a === 'throw' && v) { if (VEH[v.type].gun) this.fireGun(v, c); else this.loadLorry(v, c); return; }
      if (a === 'drop' && v && v.type === 'lorry') { this.unloadLorry(v, c); return; }
      if (a === 'sell') { this.sell(c); return; }
      if (a === 'inv') { if (c.inv.length > 1) c.inv.push(c.inv.shift()); }
      if (a === 'build') this.build(c, arg);
      return;
    }
    switch (a) {
      case 'jump':
        if (c.act === 'walk' || c.act === 'fight') { const kk = this.keysFor(c); c.vy = -2.45; c.vx = (kk.r - kk.l) * 0.95; c.act = 'jump'; }
        else if (c.act === 'swim' && this.matAt(c.x, c.y - 9) !== MAT.WATER) { c.act = 'jump'; c.vy = -2.3; }
        break;
      case 'dig':
        if (c.act === 'dig') c.act = 'walk';
        else if (c.act === 'walk' || c.act === 'fight') { c.act = 'dig'; c.digA = (t.keys.d || c.aiKeys.d) ? 1.25 : 0; c.digIdle = 0; c.vx = 0; }
        break;
      case 'digdown':
        if (c.act === 'walk') { c.act = 'dig'; c.digA = 1.45; c.digIdle = 0; }
        break;
      case 'throw': this.throwItem(c); break;
      case 'attack': this.attack(c); break;
      case 'drop': this.dropItem(c); break;
      case 'inv': if (c.inv.length > 1) c.inv.push(c.inv.shift()); break;
      case 'sell': this.sell(c); break;
      case 'build': this.build(c, arg); break;
      case 'use': this.use(c); break;
    }
  }
  // Hauptaktion (Linksklick / RT): Richtung Zielpunkt werfen, schlagen, schießen, feuern
  primary(c, aim) {
    if (c.act === 'dead') return;
    const it = actItem(c);
    if (c.act === 'push') { const v = this.vehById(c.veh); if (v) { if (VEH[v.type].gun) this.fireGun(v, c); else this.loadLorry(v, c); } return; }
    if (aim && !c.inside && (c.act === 'walk' || c.act === 'fight' || c.act === 'jump' || c.act === 'swim' || c.act === 'dig') && Math.abs(aim[0] - c.x) > 2) c.dir = Math.sign(aim[0] - c.x);
    if (c.inside) { const s = this.structById(c.inside); if (aim && s && Math.abs(aim[0] - s.x) > 2) c.dir = Math.sign(aim[0] - s.x); }
    if (it === 'bow' && c.arrows > 0) { if (c.cd <= 0 && c.act !== 'climb' && c.act !== 'hangle' && c.act !== 'push') this.shoot(c, aim); return; }
    if (it === 'sword') { if (c.inside) return; if (c.cd <= 0 && c.act !== 'climb' && c.act !== 'hangle') this.swingSword(c); return; }
    if (!it || it === 'shield' || it === 'bow') { if (c.inside) return; this.attack(c, true); return; }
    this.throwItem(c, aim);
  }
  // Benutzen: Fahrzeug anfassen oder Gebäude betreten
  use(c) {
    if (c.act !== 'walk' && c.act !== 'fight') return;
    let v = null; for (const o of this.vehicles) if (!o.pusher && Math.abs(o.x - c.x) < VEH[o.type].w / 2 + 5 && Math.abs(o.y - c.y) < 8 && (!v || Math.abs(o.x - c.x) < Math.abs(v.x - c.x))) v = o;
    const s0 = this.structs.find(s => s.team === c.team && s.prog >= 1 && Math.abs(c.x - s.x) < Math.min(14, s.w / 2) && c.y > s.y - 10 && c.y < s.y + 5);
    if (v && !(s0 && Math.abs(s0.x - c.x) < Math.abs(v.x - c.x))) { c.act = 'push'; c.veh = v.id; v.pusher = c.id; v.team = c.team; v.dir = c.dir; c.vx = 0; this.snd('grab', c.x, c.y); return; }
    const s = s0;
    if (s) {
      c.inside = s.id; c.act = 'walk'; c.vx = c.vy = 0; c.x = s.x; c.y = s.y; c.fire = 0; this.snd('door', s.x, s.y);
      if (s.type === 'castle' && !c.armor && this.teams[c.team].res.weapons) { c.armor = 1; this.msg(c.name + ' erhält eine Rüstung.', c.team); }
      return;
    }
    if (this.grabNear(c)) return;
    if (!this.teams[c.team].ai) this.msg('Hier gibt es nichts zu benutzen.', c.team);
  }
  // Gegenstand in der Nähe aufheben (E)
  grabNear(c) {
    let best = null, bd = 14;
    for (const it of this.items) { if (it.remove || it.fuse > 0 || it.chain || it.type === 'arrow' || it.stuck) continue; const d = Math.hypot(it.x - c.x, (it.y - c.y + 4) * 1.5); if (d < bd) { bd = d; best = it; } }
    if (!best) return false;
    if (best.type === 'arrows') { c.arrows += 10; best.remove = true; this.snd('grab', c.x, c.y); return true; }
    if (best.type === 'armor' && !c.armor) { c.armor = 1; best.remove = true; this.snd('grab', c.x, c.y); return true; }
    if (c.inv.length >= INV_MAX) { if (!this.teams[c.team].ai) this.msg('Inventar voll (3 Plätze)!', c.team); return true; }
    c.inv.push(best.type); best.remove = true; this.snd('grab', c.x, c.y); return true;
  }
  leave(c) {
    const s = this.structById(c.inside); c.inside = 0; c.act = 'walk'; c.vy = 0;
    if (s) { c.x = s.x; c.y = s.y; this.snd('door', s.x, s.y); }
    let g = 0; while (this.boxHit(c.x, c.y) && g++ < 12) c.y--;
  }
  release(c) {
    const v = this.vehById(c.veh);
    if (v) { v.pusher = 0; c.x = v.x; c.y = v.y; v.vx = 0; }
    c.act = 'walk'; c.veh = 0;
    let g = 0; while (this.boxHit(c.x, c.y) && g++ < 12) c.y--;
  }
  loadLorry(v, c) {
    if (!c.inv.length) { this.msg('Nichts zum Einladen.', c.team); return; }
    if (v.inv.length >= VEH.lorry.cap) { this.msg('Lore ist voll!', c.team); return; }
    v.inv.push(c.inv.splice(actIdx(c), 1)[0]); this.snd('grab', v.x, v.y);
  }
  unloadLorry(v, c) {
    if (!v.inv.length) { this.msg('Lore ist leer.', c.team); return; }
    for (const ty of v.inv) { const it = this.spawnItem(ty, v.x + v.dir * 9, v.y - 6); it.vx = v.dir * (0.4 + this.rand()); it.vy = -1 - this.rand(); it.pickCd = 60; }
    v.inv = []; this.snd('dump', v.x, v.y);
  }
  fireGun(v, c) {
    const d = VEH[v.type]; if (v.cd > 0) return;
    let type = null;
    const idx = v.inv.findIndex(t => AMMO.has(t));
    if (idx >= 0) type = v.inv.splice(idx, 1)[0];
    else { const j = c.inv.findIndex(t => AMMO.has(t)); if (j >= 0) type = c.inv.splice(j, 1)[0]; }
    if (!type) { if (!this.teams[c.team].ai) this.msg('Keine Munition! (Steine, Feuersteine, TNT, Gold)', c.team); this.snd('error', c.x, c.y); return; }
    const ang = v.ang, sp = d.speed;
    const mx = v.x + v.dir * Math.cos(ang) * d.w * 0.55, my = v.y - d.h + 1 - Math.sin(ang) * 5;
    const it = this.spawnItem(type, mx, my);
    it.vx = v.dir * Math.cos(ang) * sp; it.vy = -Math.sin(ang) * sp; it.armed = true; it.owner = c.id; it.pickCd = 60; it.shot = v.type === 'cannon' ? 2 : 1;
    if (type === 'tnt') it.fuse = 170;
    v.cd = d.cd; this.snd(v.type, v.x, v.y);
    this.ev({ e: 'muzzle', x: Math.round(mx), y: Math.round(my), big: v.type === 'cannon' ? 1 : 0 });
  }
  research(t, k) {
    const r = RES_BY[k]; if (!r) return;
    if (t.res[k]) { this.msg(r.name + ' ist bereits erforscht.', t.id); return; }
    if (t.rq) { this.msg('Es wird bereits geforscht: ' + RES_BY[t.rq].name, t.id); this.ev({ e: 'snd', n: 'error', x: 0, y: 0, team: t.id }); return; }
    if (r.req && !r.req.every(q => t.res[q])) { this.msg('Benötigt zuerst: ' + r.req.filter(q => !t.res[q]).map(q => RES_BY[q].name).join(', '), t.id); this.ev({ e: 'snd', n: 'error', x: 0, y: 0, team: t.id }); return; }
    if (!this.hasBase(t.id)) { this.msg('Forschung braucht eine Hütte oder Burg!', t.id); return; }
    if (t.money < r.cost) { this.msg('Nicht genug Geld (' + r.cost + ')!', t.id); this.ev({ e: 'snd', n: 'error', x: 0, y: 0, team: t.id }); return; }
    t.money -= r.cost; t.rq = k; t.rp = 0;
    this.msg('Forschung gestartet: ' + r.name + ' (' + r.time + ' s)', t.id); this.ev({ e: 'snd', n: 'uncash', x: 0, y: 0, team: t.id });
  }
  nearBase(c, team) {
    if (c.inside) { const s = this.structById(c.inside); if (s && BUILD[s.type].base) return s; }
    const tm = team === undefined ? c.team : team;
    return this.structs.find(s => BUILD[s.type].base && s.team === tm && s.prog >= 1 && Math.abs(c.x - s.x) < s.w / 2 + 12 && c.y > s.y - 30 && c.y < s.y + 8);
  }
  nearHut(c, team) { return this.nearBase(c, team); }
  sell(c) {
    const t = this.teams[c.team];
    if (!this.nearBase(c)) { this.msg('Zum Verkaufen zur Hütte/Burg gehen!', c.team); this.snd('error', c.x, c.y); return; }
    const v = c.act === 'push' ? this.vehById(c.veh) : null;
    const lor = v && v.type === 'lorry' ? v.inv : [];
    if (!c.inv.length && !lor.length) { this.msg('Nichts zu verkaufen.', c.team); return; }
    let sum = 0; for (const ty of c.inv) sum += ITEMS[ty].sell; for (const ty of lor) sum += ITEMS[ty].sell;
    c.inv = []; if (v && v.type === 'lorry') v.inv = [];
    t.money += sum; this.snd('cash', c.x, c.y); this.msg('+' + sum + ' Geld', c.team);
    this.checkGoal();
  }
  buy(t, what) {
    const bases = this.structs.filter(s => BUILD[s.type].base && s.team === t.id && s.prog >= 1);
    if (!bases.length) { this.msg('Keine Hütte – kein Einkauf möglich!', t.id); return; }
    const entry = SHOP_ALL.find(e => e.k === what); if (!entry) return;
    if (entry.res && !t.res[entry.res]) { this.msg('Erst erforschen: ' + RES_BY[entry.res].name, t.id); return; }
    const price = shopPrice(what);
    if (t.money < price) { this.msg('Nicht genug Geld!', t.id); this.ev({ e: 'snd', n: 'error', x: bases[0].x, y: bases[0].y, team: t.id }); return; }
    t.money -= price;
    const sc = this.selClonk(t);
    const base = (sc && this.nearBase(sc)) || bases[0];
    if (what === 'clonk' || what === 'knight') {
      const c = what === 'knight' ? this.spawnKnight(t.id, base.x, base.y - 2) : this.spawnClonk(t.id, base.x, base.y - 2);
      this.msg((what === 'knight' ? 'Ritter ' : '') + c.name + ' ist angekommen.', t.id);
      if (!this.selClonk(t)) t.sel = c.id;
    } else if (VEH[what]) {
      let vx = base.x + base.w / 2 + 10, n = 0; while (n++ < 6 && this.vehicles.some(o => Math.abs(o.x - vx) < 17)) vx += 18;
      this.spawnVehicle(what, Math.min(this.W - 12, vx), base.y - 2, t.id); this.msg(VEH[what].name + ' steht bereit.', t.id);
    } else if (what === 'arrows' && sc && this.nearBase(sc)) sc.arrows += 10;
    else if (what === 'armor' && sc && this.nearBase(sc) && !sc.armor) sc.armor = 1;
    else if (sc && this.nearBase(sc) && sc.inv.length < INV_MAX) sc.inv.push(what);
    else { const it = this.spawnItem(what, base.x + (this.rand() * 10 - 5), base.y - 6); it.pickCd = 10; }
    this.snd('uncash', base.x, base.y);
  }
  build(c, what) {
    const t = this.teams[c.team];
    if (c.act !== 'walk') { this.msg('Zum Bauen auf festem Boden stehen.', c.team); return; }
    if (BUILD[what]) {
      const B = BUILD[what];
      if (B.res && !t.res[B.res]) { this.msg('Erst erforschen: ' + RES_BY[B.res].name, c.team); this.snd('error', c.x, c.y); return; }
      if (t.money < B.price) { this.msg('Nicht genug Geld (' + B.price + ')!', c.team); this.snd('error', c.x, c.y); return; }
      const hw = B.w >> 1;
      const x = Math.round(c.x + c.dir * (hw + 6)), y = Math.round(c.y);
      let ground = 0; for (let xx = x - hw; xx <= x + hw; xx++) if (this.solid(xx, y + 1) || this.solid(xx, y + 2)) ground++;
      let free = true; for (let xx = x - hw; xx <= x + hw && free; xx += 2) for (let yy = y - B.h + 2; yy <= y - 1; yy += 3) if (this.solid(xx, yy)) { free = false; break; }
      if (ground < B.w * 0.8 || !free || this.structs.some(s => Math.abs(s.x - x) < (s.w + B.w) / 2 + 4 && Math.abs(s.y - y) < 40)) { this.msg('Hier kann nicht gebaut werden (Platz/Boden).', c.team); this.snd('error', c.x, c.y); return; }
      t.money -= B.price;
      this.addStruct(what, x, y, c.team, 0);
      this.msg('Baustelle errichtet: ' + B.name + '. Buddler in der Nähe bauen sie auf.', c.team); this.snd('click', x, y);
    } else if (what === 'bridge') {
      if (t.money < PRICE_BRIDGE) { this.msg('Nicht genug Geld (' + PRICE_BRIDGE + ')!', c.team); return; }
      t.money -= PRICE_BRIDGE;
      const x0 = Math.round(c.x) + c.dir * 3, y0 = Math.round(c.y) + 1;
      for (let k = 0; k < 40; k++) for (let dy = 0; dy < 3; dy++) {
        const x = x0 + c.dir * k, y = y0 + dy;
        if (x > 0 && x < this.W && y > 0 && y < this.H && !SOLID[this.mat[y * this.W + x]]) this.setMat(x, y, MAT.WOOD);
      }
      this.snd('build', c.x, c.y);
    }
  }
  throwPos(c) {
    if (c.inside) { const s = this.structById(c.inside); if (s) { if (s.type === 'hut') return [s.x + c.dir * 16, s.y - 6]; return [s.x + c.dir * (s.w / 2 - 3), s.y - s.h - 2]; } }
    return [c.x + c.dir * 4, c.y - 8];
  }
  throwItem(c, aim) {
    if (c.act === 'dead' || c.cd > 0) return;
    if (!c.inv.length) { this.attack(c); return; }
    const type = c.inv.splice(actIdx(c), 1)[0];
    const [px, py] = this.throwPos(c);
    const it = this.spawnItem(type, px, py);
    if (!c.inside && (c.act === 'climb' || c.act === 'hangle')) { it.vx = c.dir * 0.4; it.vy = 0; }
    else if (aim) { const v = throwVel(px, py, aim[0], aim[1]); it.vx = v[0]; it.vy = v[1]; }
    else if (c.act === 'dig') { it.vx = c.dir * 0.4; it.vy = 0; }
    else { it.vx = c.dir * 2.5 + c.vx * 0.4; it.vy = c.inside ? -1.2 : -2.1; }
    it.armed = true; it.owner = c.id; it.pickCd = 45;
    if (type === 'tnt') { it.fuse = 150; this.snd('fuse', c.x, c.y); }
    this.snd('throw', c.x, c.y); c.punch = 10; c.cd = 12;
  }
  dropItem(c) {
    if (!c.inv.length || c.act === 'dead' || c.inside) return;
    const type = c.inv.splice(actIdx(c), 1)[0];
    const it = this.spawnItem(type, c.x, c.y - 4); it.pickCd = 80;
    if (type === 'tnt') { it.fuse = 150; this.snd('fuse', c.x, c.y); }
  }
  // Schild: blockt, wenn Träger blockt (oder zufällig im Nahkampf) und zum Angreifer schaut
  blocks(target, fromDir, auto) {
    if (!target.inv || !target.inv.includes('shield') || target.act === 'dead' || target.act === 'tumble') return false;
    if (target.dir !== -fromDir) return false;
    return !!target.block || (auto && this.rand() < 0.3);
  }
  attack(c, melee) {
    if (c.act === 'dead' || c.cd > 0) return;
    const hasSword = c.inv.includes('sword'), hasBow = c.inv.includes('bow') && c.arrows > 0;
    if (c.inside) { if (hasBow) this.shoot(c); else if (c.inv.length) this.throwItem(c); return; }
    if (c.act === 'push' || c.act === 'climb' || c.act === 'hangle') return;
    const foe = this.clonks.find(o => o.team !== c.team && o.act !== 'dead' && !o.inside && Math.abs(o.x - c.x) < 16 && Math.abs(o.y - c.y) < 10 && Math.sign(o.x - c.x) === c.dir)
      || this.monsters.find(o => Math.abs(o.x - c.x) < 16 && Math.abs(o.y - c.y) < 10 && Math.sign(o.x - c.x) === c.dir);
    if (melee) { if (hasSword) this.swingSword(c); else this.strike(c); return; }
    if (hasSword && (foe || !hasBow)) this.swingSword(c);
    else if (hasBow) this.shoot(c);
    else this.strike(c);
  }
  swingSword(c) {
    c.cd = 28; c.swing = 12; this.snd('swing', c.x, c.y);
    const foe = this.clonks.find(o => o.team !== c.team && o.act !== 'dead' && !o.inside && Math.abs(o.x - c.x) < 15 && Math.abs(o.y - c.y) < 10 && Math.sign(o.x - c.x) === c.dir);
    if (foe) {
      if (this.blocks(foe, c.dir)) { this.snd('shield', foe.x, foe.y); foe.blockT = 10; this.walkStep(c, -c.dir * 2); }
      else { this.hurt(foe, 12 + this.rand() * 5, c); this.snd('metalhit', foe.x, foe.y); if (foe.act !== 'dead' && this.rand() < 0.35) this.fling(foe, c.dir * 1.6, -1.4); }
    }
    for (const m of this.monsters) if (Math.abs(m.x - c.x) < 15 && Math.abs(m.y - c.y) < 10 && Math.sign(m.x - c.x) === c.dir) { m.hp -= 18; m.vx = c.dir * 1.6; m.vy = -1.2; m.act = 'jump'; this.snd('hitliving', m.x, m.y); }
    for (const v of this.vehicles) if (v.team !== c.team && Math.abs(v.x - c.x) < 14 && Math.abs(v.y - c.y) < 10) v.hp -= 6;
  }
  shoot(c, aim) {
    const k = this.keysFor(c);
    c.arrows--; c.cd = 38; c.bowT = 16;
    const [px, py] = this.throwPos(c);
    const it = this.spawnItem('arrow', px, py + (c.inside ? 0 : 1));
    if (aim) { const v = arrowVel(px, py + (c.inside ? 0 : 1), aim[0], aim[1], c.dir); it.vx = v[0]; it.vy = v[1]; }
    else { const up = k.u ? -1.6 : k.d ? 1.0 : -0.5; it.vx = c.dir * 5.6; it.vy = up + (c.inside ? 0.3 : 0); }
    it.armed = true; it.owner = c.id; it.pickCd = 99999;
    this.snd('bow', c.x, c.y);
  }
  strike(c) {
    const foe = this.clonks.find(o => o.team !== c.team && o.act !== 'dead' && !o.inside && Math.abs(o.x - c.x) < 11 && Math.abs(o.y - c.y) < 9 && Math.sign(o.x - c.x) === c.dir);
    c.punch = 10; c.cd = 50;
    if (foe) {
      if (this.blocks(foe, c.dir)) { this.snd('shield', foe.x, foe.y); foe.blockT = 10; }
      else { this.hurt(foe, 8, c); if (foe.act !== 'dead') this.fling(foe, c.dir * 2.2, -1.8); this.snd('punch', c.x, c.y); }
    }
    const mo = this.monsters.find(o => Math.abs(o.x - c.x) < 12 && Math.abs(o.y - c.y) < 10);
    if (mo) { mo.hp -= 10; mo.vx = c.dir * 2; mo.vy = -1.5; mo.act = 'jump'; this.snd('punch', c.x, c.y); }
  }
  fling(c, vx, vy) { if (c.act === 'dead' || c.inside) return; if (c.act === 'push') this.release(c); c.act = 'tumble'; c.vx = vx; c.vy = vy; c.tumbleT = 0; c.block = 0; }
  hurt(c, dmg, src) {
    if (c.act === 'dead' || dmg <= 0 || c.inside) return;
    if (c.armor && src !== 'fire') dmg *= 0.6;
    c.hp -= dmg;
    if (c.hp <= 0) { this.kill(c); return; }
    if (dmg >= 3 && (c.hurtSnd || 0) < this.tick) { this.snd('hurt', c.x, c.y); c.hurtSnd = this.tick + 25; }
  }
  kill(c) {
    if (c.act === 'push') this.release(c);
    c.hp = 0; c.act = 'dead'; c.deadT = 0; c.vx = 0; c.fire = 0; c.block = 0;
    for (const ty of c.inv) { const it = this.spawnItem(ty, c.x, c.y - 5); it.vx = (this.rand() - 0.5) * 1.5; it.vy = -1.5; it.pickCd = 30; }
    c.inv = [];
    this.snd('die', c.x, c.y);
    this.msg(c.name + ' (' + this.teams[c.team].name + ') ist gestorben.');
    const t = this.teams[c.team];
    if (t.sel === c.id) { const n = this.clonks.find(o => o.team === c.team && o.act !== 'dead'); t.sel = n ? n.id : -1; }
    this.checkEnd();
  }
  checkGoal() {
    if (this.mode === 'settle') { const t = this.teams[0]; if (t.money >= this.goal && this.state === 'run') { this.state = 'over'; this.winner = 0; this.snd('fanfare', 0, 0); this.msg('Ziel erreicht! ' + this.goal + ' Geld verdient!'); } }
  }
  checkEnd() {
    if (this.state !== 'run') return;
    for (const t of this.teams) {
      if (t.elim) continue;
      const alive = this.clonks.some(c => c.team === t.id && c.act !== 'dead');
      const canBuy = t.money >= PRICE_CLONK && this.hasBase(t.id);
      if (!alive && !canBuy) { t.elim = true; this.msg('Team ' + t.name + ' ist ausgeschieden!'); }
    }
    if (this.mode === 'settle') { if (this.teams[0].elim) { this.state = 'over'; this.winner = -1; this.snd('error', 0, 0); } return; }
    const left = this.teams.filter(t => !t.elim);
    if (left.length <= 1) { this.state = 'over'; this.winner = left.length ? left[0].id : -1; this.snd('fanfare', 0, 0); }
  }

  // ---------- Explosion ----------
  explode(x, y, r, owner) {
    x = Math.round(x); y = Math.round(y);
    let gold = 0;
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
      const px = x + xx, py = y + yy; if (px < 0 || py < 0 || px >= this.W || py >= this.H) continue;
      const d2 = xx * xx + yy * yy; if (d2 > r * r * (0.85 + hash2(px, py, this.tick) * 0.3)) continue;
      const m = this.mat[py * this.W + px];
      if (BLASTABLE[m]) { if (m === MAT.GOLD) gold++; this.setMat(px, py, this.bg(px, py)); }
    }
    for (let g = 0; g < Math.floor(gold / 30); g++) { const it = this.spawnItem('gold', x, y); it.vx = (this.rand() - 0.5) * 3; it.vy = -2 * this.rand() - 1; }
    const R = r * 1.8;
    for (const c of this.clonks) {
      if (c.act === 'dead' || c.inside) continue;
      const dx = c.x - x, dy = c.y - 5 - y, d = Math.hypot(dx, dy) || 1;
      if (d < R) { const f = 1 - d / R; this.hurt(c, f * r * 2.6, owner); if (c.act !== 'dead') { this.fling(c, dx / d * f * 3.5, -2.5 * f - 0.6); if (d < R * 0.6 && this.rand() < 0.45) c.fire = Math.max(c.fire, 150); } }
    }
    for (const m of this.monsters) {
      const dx = m.x - x, dy = m.y - 5 - y, d = Math.hypot(dx, dy) || 1;
      if (d < R) { const f = 1 - d / R; m.hp -= f * r * 2.6; m.vx = dx / d * f * 3; m.vy = -2 * f; m.act = 'jump'; if (d < R * 0.6) m.fire = 150; }
    }
    for (const it of this.items) {
      const dx = it.x - x, dy = it.y - y, d = Math.hypot(dx, dy) || 1;
      if (d < R) {
        if ((it.type === 'flint' || it.type === 'superflint') && !it.remove && !it.chain) it.chain = 6 + (this.rand() * 6 | 0);
        else if (it.type === 'tnt' && (it.fuse === 0 || it.fuse > 10)) it.fuse = 8;
        it.stuck = false; const f = 1 - d / R; it.vx += dx / d * f * 3; it.vy += dy / d * f * 3 - 1;
      }
    }
    for (const v of this.vehicles) {
      const dx = v.x - x, dy = v.y - 4 - y, d = Math.hypot(dx, dy) || 1;
      if (d < R + 4) { const f = 1 - d / (R + 4); v.hp -= f * r * 2.2; v.vx += dx / d * f * 2; v.vy = -f * 2; if (VEH[v.type].wood && this.rand() < 0.5) v.fire = 400; }
    }
    for (const s of this.structs) {
      if (Math.abs(s.x - x) < r + s.w / 2 && y > s.y - s.h - r && y < s.y + r) {
        s.hp -= r * 1.5; if (BUILD[s.type].wood && this.rand() < 0.6) s.fire = Math.max(s.fire, 500);
        if (s.hp <= 0) this.destroyStruct(s);
      }
    }
    // Feuer entfachen (Gras, Holz)
    for (let k = 0; k < r * 2; k++) { const a = this.rand() * 6.283, dd = r * 0.6 + this.rand() * (r * 0.7 + 4); this.ignitePoint(x + Math.cos(a) * dd, y + Math.sin(a) * dd); }
    this.ev({ e: 'boom', x, y, r });
    this.snd('blast', x, y);
  }
  destroyStruct(s) {
    if (s.remove) return;
    s.remove = true;
    this.msg((BUILD[s.type].name) + ' von ' + this.teams[s.team].name + ' wurde zerstört!');
    for (const c of this.clonks) if (c.inside === s.id) { c.inside = 0; c.act = 'jump'; c.vy = -1; c.x = s.x; c.y = s.y; }
  }

  // ---------- Feuer ----------
  grassTop(x, y) {
    if (x < 0 || x >= this.W || this.burnt[x]) return -1;
    const s = this.surf[x], W = this.W;
    for (let yy = Math.max(1, y - 4); yy <= y + 4 && yy < this.H; yy++) {
      if (yy - s < 0 || yy - s >= 3) continue;
      const up = this.mat[(yy - 1) * W + x];
      if (this.mat[yy * W + x] === MAT.EARTH && (up === MAT.SKY || up === MAT.TUNNEL)) return yy;
    }
    return -1;
  }
  ignitePoint(x, y) {
    x = Math.round(x); y = Math.round(y);
    if (x < 1 || y < 1 || x >= this.W - 1 || y >= this.H - 1 || this.fires.length >= 260) return false;
    let k = -1, fy = y;
    if (this.mat[y * this.W + x] === MAT.WOOD) k = 1;
    else { const gy = this.grassTop(x, y); if (gy >= 0) { k = 0; fy = gy - 1; } }
    if (k < 0) return false;
    const key = (fy >> 1) * 4096 + (x >> 1);
    if (this.fireSet.has(key)) return false;
    this.fireSet.add(key);
    if (k === 0) this.markBurnt(x);
    this.fires.push({ x, y: fy, k, t: k ? 150 + this.rand() * 90 | 0 : 45 + this.rand() * 50 | 0 });
    if (this.tick - (this.lastInflame || -99) > 30) { this.lastInflame = this.tick; this.snd('inflame', x, y); }
    return true;
  }
  igniteNear(x, y, r) {
    for (const c of this.clonks) if (c.act !== 'dead' && !c.inside && !c.fire && !(c.fireCd > 0) && Math.abs(c.x - x) < r && y > c.y - 11 && y < c.y + 3 && this.rand() < 0.3) c.fire = 120;
    for (const m of this.monsters) if (!m.fire && Math.abs(m.x - x) < r && y > m.y - 12 && y < m.y + 3 && this.rand() < 0.3) m.fire = 120;
    for (const s of this.structs) if (BUILD[s.type].wood && Math.abs(s.x - x) < s.w / 2 + 2 && y > s.y - s.h && y < s.y + 3) s.fire = Math.max(s.fire, 600);
    for (const v of this.vehicles) if (VEH[v.type].wood && Math.abs(v.x - x) < VEH[v.type].w / 2 + 2 && y > v.y - 12 && y < v.y + 3) v.fire = Math.max(v.fire, 400);
    for (const it of this.items) if (!it.remove && Math.abs(it.x - x) < 4 && Math.abs(it.y - y) < 5) {
      if ((it.type === 'flint' || it.type === 'superflint') && !it.chain) it.chain = 10;
      else if (it.type === 'tnt' && !it.fuse) { it.fuse = 60; }
    }
  }
  updFires() {
    if (this.fires.length) {
      const keep = [], W = this.W; this.fireSet.clear();
      for (const f of this.fires) {
        f.t--;
        const m = this.mat[f.y * W + f.x], below = this.mat[(f.y + 1) * W + f.x];
        if (m === MAT.WATER || below === MAT.WATER) continue;
        if (f.k === 1 && m !== MAT.WOOD) continue;
        if (f.t <= 0) {
          if (f.k === 1) for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) { const px = f.x + xx, py = f.y + yy; if (this.mat[py * W + px] === MAT.WOOD) this.setMat(px, py, this.bg(px, py)); }
          continue;
        }
        if (((this.tick + f.x) % 9) === 0) {
          if (this.rand() < (f.k ? 0.5 : 0.3)) {
            const dx = (this.rand() < 0.5 ? -1 : 1) * (1 + (this.rand() * 3 | 0));
            this.ignitePoint(f.x + dx, f.y + (this.rand() * 5 | 0) - 2);
          }
          this.igniteNear(f.x, f.y, 5);
        }
        keep.push(f); this.fireSet.add((f.y >> 1) * 4096 + (f.x >> 1));
      }
      this.fires = keep;
    }
    for (const s of this.structs) if (s.fire > 0) {
      s.fire--; s.hp -= BUILD[s.type].wood ? 0.07 : 0.01;
      if (s.prog < 1) s.hp -= 0.05;
      if (this.tick % 40 === s.id % 40) this.ignitePoint(s.x + (this.rand() - 0.5) * s.w, s.y + 1);
      if (this.tick % 25 === 0) this.igniteNear(s.x + (this.rand() - 0.5) * s.w, s.y - 2, 6);
      if (s.hp <= 0) this.destroyStruct(s);
    }
  }

  // ---------- Update ----------
  update() {
    if (this.remote) return;
    this.tick++;
    this.simMaterials();
    this.updFires();
    for (const t of this.teams) if (t.ai && !t.elim) this.aiTeam(t);
    for (const c of this.clonks) this.updClonk(c);
    for (const v of this.vehicles) this.updVehicle(v);
    for (const it of this.items) this.updItem(it);
    for (const m of this.monsters) this.updMonster(m);
    for (const s of this.structs) if (s.prog < 1) {
      const B = BUILD[s.type];
      const builders = this.clonks.filter(c => c.team === s.team && c.act === 'walk' && !c.inside && Math.abs(c.x - s.x) < s.w / 2 + 8 && Math.abs(c.y - s.y) < 12).length;
      if (builders) { s.prog = Math.min(1, s.prog + Math.min(3, builders) / B.time); if (s.prog >= 1) { this.snd('build', s.x, s.y); this.msg(B.name + ' fertig gebaut!', s.team); } }
    }
    // Forschung
    for (const t of this.teams) if (t.rq) {
      if (!this.hasBase(t.id)) continue;
      const r = RES_BY[t.rq]; t.rp += 1 / (r.time * 60);
      if (t.rp >= 1) { t.res[t.rq] = 1; this.msg('Forschung abgeschlossen: ' + r.name + '!', t.id); this.ev({ e: 'snd', n: 'ding', x: 0, y: 0, team: t.id }); t.rq = ''; t.rp = 0; }
    }
    this.clonks = this.clonks.filter(c => !c.remove);
    this.items = this.items.filter(i => !i.remove);
    this.monsters = this.monsters.filter(m => !m.remove);
    this.vehicles = this.vehicles.filter(v => !v.remove);
    if (this.structs.some(s => s.remove)) { this.structs = this.structs.filter(s => !s.remove); this.checkEnd(); }
    if (this.cfg.monsters && this.tick % 1500 === 0 && this.monsters.length < (this.cfg.monsterCount || 4) + (this.daylight() < 0.3 ? 2 : 0)) this.spawnMonster();
    if (this.tick % 120 === 0) for (const t of this.teams) if (t.ai && !t.elim) t.money += 1;
    for (const t of this.teams) if (t.sel === -1 || !this.selClonk(t)) { const n = this.clonks.find(o => o.team === t.id && o.act !== 'dead'); t.sel = n ? n.id : -1; }
    if (this.tick % 60 === 0) this.checkEnd();
  }

  simMaterials() {
    const cur = this.activeNext; this.activeNext = this.active; this.activeNext.fill(0); this.active = cur;
    const W = this.W, H = this.H, mat = this.mat, R = this.rand, st = (this.tick & 0xffff) || 1, stamp = this.stamp, an = this.activeNext;
    const EMPTY = m => m === MAT.SKY || m === MAT.TUNNEL;
    for (let cy = this.chh - 1; cy >= 0; cy--) for (let cx = 0; cx < this.cw; cx++) {
      const ci = cy * this.cw + cx;
      if (!cur[ci]) continue;
      const x0 = cx * CH, x1 = Math.min(W, x0 + CH), y0 = cy * CH, y1 = Math.min(H - 1, y0 + CH);
      for (let y = y1 - 1; y >= y0; y--) {
        const rev = ((y + this.tick) & 1) === 1;
        for (let k = x0; k < x1; k++) {
          const x = rev ? x1 - 1 - (k - x0) : k;
          const i = y * W + x, m = mat[i];
          if (m !== MAT.SAND && m !== MAT.WATER && m !== MAT.LAVA) continue;
          if (stamp[i] === st) continue;
          const b = mat[i + W];
          if (m === MAT.SAND) {
            if (!SOLID[b]) { this.setMat(x, y, (b === MAT.WATER || b === MAT.LAVA) ? b : this.bg(x, y)); this.setMat(x, y + 1, MAT.SAND); stamp[i + W] = st; continue; }
            if (R() < 0.5) {
              const d = R() < 0.5 ? -1 : 1;
              for (const dd of [d, -d]) {
                const nx = x + dd; if (nx < 0 || nx >= W) continue;
                const t2 = mat[i + W + dd], s2 = mat[i + dd];
                if (!SOLID[t2] && !SOLID[s2]) { this.setMat(x, y, (t2 === MAT.WATER || t2 === MAT.LAVA) ? t2 : this.bg(x, y)); this.setMat(nx, y + 1, MAT.SAND); stamp[i + W + dd] = st; break; }
              }
            }
            continue;
          }
          if (m === MAT.LAVA) {
            // Lava + Wasser -> Fels (Wasser verdampft)
            let quenched = false;
            const nb = [i - W, i + W, i - 1, i + 1];
            for (let q = 0; q < 4; q++) {
              const j = nb[q]; if (j < 0 || j >= W * H) continue;
              if (mat[j] === MAT.WATER) { const jx = j % W, jy = (j / W) | 0; this.setMat(jx, jy, this.bg(jx, jy)); this.setMat(x, y, MAT.ROCK); quenched = true; break; }
            }
            if (quenched) { if (this.tick - this.lastSizzle > 20) { this.lastSizzle = this.tick; this.snd('sizzle', x, y); } continue; }
            if (R() < 0.004) { // Lava entzündet Holz und Gras in der Nähe
              for (let q = 0; q < 4; q++) { const j = nb[q]; if (j >= 0 && j < W * H && mat[j] === MAT.WOOD) this.ignitePoint(j % W, (j / W) | 0); }
              if (y > 0 && EMPTY(mat[i - W])) { this.ignitePoint(x + 2, y - 1); this.ignitePoint(x - 2, y - 1); }
            }
            const canFall = EMPTY(b) || (x > 0 && EMPTY(mat[i - 1])) || (x < W - 1 && EMPTY(mat[i + 1]));
            if (!canFall) continue;
            if (R() > 0.22) { an[ci] = 1; continue; } // fließt langsam
          }
          const L = m; // Flüssigkeit
          if (EMPTY(b)) { this.setMat(x, y, this.bg(x, y)); this.setMat(x, y + 1, L); stamp[i + W] = st; continue; }
          const d = R() < 0.5 ? -1 : 1; let moved = false;
          for (const dd of [d, -d]) {
            const nx = x + dd; if (nx < 0 || nx >= W) continue;
            const t2 = mat[i + W + dd];
            if (EMPTY(t2) && !SOLID[mat[i + dd]] && mat[i + dd] !== (L === MAT.WATER ? MAT.LAVA : MAT.WATER)) { this.setMat(x, y, this.bg(x, y)); this.setMat(nx, y + 1, L); stamp[i + W + dd] = st; moved = true; break; }
          }
          if (moved) continue;
          if (b === L && (y === 0 || mat[i - W] !== L)) continue; // ruhige Oberfläche
          for (const dd of [d, -d]) {
            const nx = x + dd; if (nx < 0 || nx >= W) continue;
            const s2 = mat[i + dd];
            if (EMPTY(s2)) { this.setMat(x, y, this.bg(x, y)); this.setMat(nx, y, L); stamp[i + dd] = st; break; }
          }
        }
      }
    }
  }

  keysFor(c) {
    const t = this.teams[c.team];
    if (t.ai || c.ai) return c.aiKeys;
    return t.sel === c.id ? t.keys : NOKEYS;
  }
  walkStep(c, dx) {
    const nx = c.x + dx;
    if (!this.boxHit(nx, c.y)) { c.x = nx; return true; }
    for (let up = 1; up <= 3; up++) if (!this.boxHit(nx, c.y - up)) { c.x = nx; c.y -= up; return true; }
    return false;
  }
  fallPhysics(c, control, k) {
    c.vy = Math.min(c.vy + 0.11, 4.6);
    if (control) { const mv = k.r - k.l; if (mv) { c.dir = mv; c.vx += (mv * 0.9 - c.vx) * 0.06; } }
    if (c.vx) {
      const steps = Math.ceil(Math.abs(c.vx));
      for (let s = 0; s < steps; s++) {
        const nx = c.x + c.vx / steps;
        if (this.boxHit(nx, c.y)) {
          if (control && Math.sign(c.vx) === c.dir && c.vy > -2.2 && !this.boxHit(c.x, c.y + 2)) {
            c.act = 'climb'; c.vx = 0; c.vy = 0; c.x = Math.round(c.x); return;
          }
          if (c.act === 'tumble') c.vx *= -0.3; else c.vx = 0;
          break;
        }
        c.x = nx;
      }
    }
    const steps = Math.max(1, Math.ceil(Math.abs(c.vy)));
    for (let s = 0; s < steps; s++) {
      const ny = c.y + c.vy / steps;
      if (this.boxHit(c.x, ny)) {
        if (c.vy > 0) {
          if (c.vy > 3.7) this.hurt(c, (c.vy - 3.7) * 30, null);
          c.y = Math.round(c.y); let g = 0; while (!this.boxHit(c.x, c.y + 1) && g++ < 3) c.y++;
          if (c.act !== 'dead') { if (c.act === 'tumble' && c.tumbleT < 18) { c.vx *= 0.5; c.vy = 0; } else { c.act = 'walk'; c.vx = 0; c.vy = 0; } }
        } else {
          c.vy = 0;
          if (control && k.u && c.act === 'jump') { c.act = 'hangle'; }
        }
        return;
      }
      c.y = ny;
    }
  }
  updClonk(c) {
    if (c.cd > 0) c.cd--; if (c.punch > 0) c.punch--; if (c.swing > 0) c.swing--; if (c.bowT > 0) c.bowT--; if (c.blockT > 0) c.blockT--;
    if (c.act === 'dead') { c.deadT++; if (!this.boxHit(c.x, c.y + 1)) c.y += 1; if (c.deadT > 400) c.remove = true; return; }
    const k = this.keysFor(c);
    if (c.inside) {
      const s = this.structById(c.inside);
      if (!s) { c.inside = 0; c.act = 'jump'; c.vy = 0; return; }
      c.x = s.x; c.y = s.y; c.vx = c.vy = 0; c.act = 'walk'; c.breath = 100; c.fire = 0; c.block = 0;
      if (c.hp < 100) c.hp = Math.min(100, c.hp + (s.type === 'castle' ? 0.08 : 0.03));
      const mv = k.r - k.l; if (mv) c.dir = mv;
      return;
    }
    if (c.y > this.H + 20) { this.kill(c); return; }
    const mAt4 = this.matAt(c.x, c.y - 4), mAt9 = this.matAt(c.x, c.y - 9);
    const inLava = mAt4 === MAT.LAVA || this.matAt(c.x, c.y - 1) === MAT.LAVA;
    const inWater = mAt4 === MAT.WATER || inLava, headWater = mAt9 === MAT.WATER;
    if (inLava) { this.hurt(c, 0.9, 'fire'); c.fire = 240; if (c.act === 'dead') return; }
    if (c.fireCd > 0) c.fireCd--;
    if (c.fire > 0) {
      c.fire--; if (mAt4 === MAT.WATER) c.fire = 0;
      if (c.fire === 0) c.fireCd = 150;
      this.hurt(c, 0.1, 'fire'); if (c.act === 'dead') return;
      if (this.tick % 45 === c.id % 45) this.ignitePoint(c.x, c.y);
    }
    if (headWater) { c.breath -= 0.16; if (c.breath <= 0) { c.breath = 0; this.hurt(c, 0.25, 'fire'); if (c.act === 'dead') return; } } else c.breath = Math.min(100, c.breath + 1);
    if (inWater && (c.act === 'walk' || c.act === 'jump' || c.act === 'hangle' || c.act === 'fight')) { if (c.act === 'jump' && c.vy > 1.5) this.snd('splash', c.x, c.y); c.act = 'swim'; }
    const hasShield = c.inv.includes('shield');
    const secBlock = k.g && hasShield && BLOCK_SLOT.has(actItem(c));
    c.block = ((k.b || secBlock) && hasShield && (c.act === 'walk' || c.act === 'fight')) ? 1 : 0;
    if (k.g && !secBlock) { // Graben halten (Rechtsklick / LT)
      if ((c.act === 'walk' || c.act === 'fight') && (!c.digHold || this.tick % 15 === 0)) { c.act = 'dig'; c.digHold = 1; c.digIdle = 0; c.vx = 0; if (k.am) c.digA = digAngle(c, k.ax, k.ay); }
    } else if (c.digHold) { c.digHold = 0; if (c.act === 'dig') c.act = 'walk'; }
    let mv = k.r - k.l;
    if (c.block && c.act === 'walk') { if (mv) c.dir = mv; mv = 0; }
    switch (c.act) {
      case 'walk': {
        const spd = k.s ? 1.5 : 1;
        if (mv) { c.dir = mv; this.walkStep(c, mv * (c.armor ? 0.75 : 0.85) * spd); c.anim += 0.18 * spd; } else c.anim = 0;
        c.vx = mv * 0.85;
        if (!this.boxHit(c.x, c.y + 1)) {
          let down = 0; while (down < 4 && !this.boxHit(c.x, c.y + down + 1)) down++;
          if (down < 4) c.y += down; else { c.act = 'jump'; c.vy = 0; }
        }
        if (mv && c.act === 'walk') {
          const foe = this.clonks.find(o => o.team !== c.team && o.act !== 'dead' && !o.inside && (o.act === 'walk' || o.act === 'fight' || o.act === 'dig') && Math.abs(o.x - (c.x + mv * 6)) < 3 && Math.abs(o.y - c.y) < 6);
          if (foe) { c.act = 'fight'; c.foe = foe.id; c.fightT = 0; if (foe.act !== 'fight') { foe.act = 'fight'; foe.foe = c.id; foe.fightT = 15; } foe.dir = -mv; }
        }
        this.pickup(c);
        break;
      }
      case 'jump': case 'tumble': {
        if (c.act === 'tumble') { c.tumbleT++; c.anim += 0.3; }
        this.fallPhysics(c, c.act === 'jump', k);
        if (c.act === 'jump' || c.act === 'tumble') this.pickup(c);
        break;
      }
      case 'push': {
        const v = this.vehById(c.veh);
        if (!v || v.pusher !== c.id) { c.act = 'walk'; c.veh = 0; break; }
        if (mv) c.anim += 0.15;
        this.pickup(c);
        break;
      }
      case 'climb': {
        if (!this.boxHit(c.x + c.dir, c.y)) { c.act = 'jump'; c.vy = 0; c.vx = 0; break; }
        if (k.u) {
          if (!this.boxHit(c.x, c.y - 0.6)) {
            c.y -= 0.6; c.anim += 0.12;
            if (!this.boxHit(c.x + c.dir * 2, c.y - 4)) {
              for (let up = 0; up < 12; up++) if (!this.boxHit(c.x + c.dir * 5, c.y - up)) { c.x += c.dir * 5; c.y -= up; c.act = 'walk'; break; }
            }
          } else if (this.solid(c.x, c.y - 10) && this.solid(c.x - c.dir * 3, c.y - 10)) { c.act = 'hangle'; c.dir = -c.dir; }
        } else if (k.d) {
          if (!this.boxHit(c.x, c.y + 0.6)) { c.y += 0.6; c.anim += 0.12; } else c.act = 'walk';
        }
        if (mv && mv === -c.dir) { c.act = 'jump'; c.vx = -c.dir * 0.7; c.vy = -0.5; c.dir = -c.dir; }
        break;
      }
      case 'hangle': {
        let ceil = false; for (let xx = -2; xx <= 1; xx++) if (this.solid(c.x + xx, c.y - 10) || this.solid(c.x + xx, c.y - 11)) ceil = true;
        if (!ceil || k.d) { c.act = 'jump'; c.vy = 0.3; c.vx = 0; break; }
        if (mv) {
          c.dir = mv; const nx = c.x + mv * 0.5;
          if (!this.boxHit(nx, c.y)) c.x = nx;
          else if (!this.boxHit(nx, c.y - 1)) { c.x = nx; c.y -= 1; }
          else { c.act = 'climb'; }
          c.anim += 0.12;
          if (!this.boxHit(c.x, c.y - 1)) { c.y -= 1; if (!this.solid(c.x, c.y - 10)) c.y += 1; }
        }
        break;
      }
      case 'swim': {
        if (!inWater) { c.act = 'jump'; if (k.u) c.vy = -1.8; break; }
        const sl = inLava ? 0.35 : 1;
        c.vx += (mv * 0.7 * sl - c.vx) * 0.12; if (mv) c.dir = mv;
        const tv = k.u ? -0.8 * sl : k.d ? 0.8 * sl : (headWater ? -0.25 : 0.1);
        c.vy += (tv - c.vy) * 0.1;
        if (c.vx) { if (!this.walkStep(c, c.vx)) c.vx = 0; }
        const ny = c.y + c.vy; if (!this.boxHit(c.x, ny)) c.y = ny; else { if (c.vy > 0 && !headWater) c.act = 'walk'; c.vy = 0; }
        if (k.u && !headWater && this.boxHit(c.x + c.dir * 2, c.y)) { c.vy = -2.2; c.act = 'jump'; }
        c.anim += 0.1;
        this.pickup(c);
        break;
      }
      case 'dig': {
        if (c.digHold && k.am) { const dx0 = k.ax - c.x; if (Math.abs(dx0) > 3) c.dir = Math.sign(dx0); const ta = digAngle(c, k.ax, k.ay); c.digA += Math.max(-0.06, Math.min(0.06, ta - c.digA)); }
        else {
          if (mv) c.dir = mv;
          if (k.u) c.digA = Math.max(-1.1, c.digA - 0.03);
          if (k.d) c.digA = Math.min(1.5, c.digA + 0.03);
        }
        const dx = c.dir * Math.cos(c.digA), dy = Math.sin(c.digA);
        const n = this.digCircle(c.x + dx * 3, c.y - 5 + dy * 3, 5.6, c);
        const nx = c.x + dx * 0.33, ny = c.y + dy * 0.33;
        let ok = false;
        if (!this.boxHit(nx, ny)) { c.x = nx; c.y = ny; ok = true; }
        else if (!this.boxHit(nx, ny - 1)) { c.x = nx; c.y = ny - 1; ok = true; }
        if (!ok) {
          const m = this.matAt(c.x + dx * 8, c.y - 5 + dy * 8);
          if (!DIGGABLE[m] && SOLID[m]) { c.act = 'walk'; if (!c.ai && !this.teams[c.team].ai && this.tick - (c.hardT || -999) > 150 && (c.hardT = this.tick)) this.msg(MAT_NAMES[m] + ' ist zu hart zum Graben!', c.team); }
        }
        if (n === 0) c.digIdle++; else c.digIdle = 0;
        if (c.digIdle > 40) c.act = 'walk';
        if (c.act === 'dig' && Math.abs(dy) < 0.5 && !this.boxHit(c.x, c.y + 1) && !this.boxHit(c.x, c.y + 1.5)) c.y += 0.5;
        if (c.act === 'dig' && this.tick % 26 === c.id % 26 && n > 0) this.snd('dig', c.x, c.y);
        c.anim += 0.2;
        this.pickup(c);
        if (c.act === 'walk' && !this.boxHit(c.x, c.y + 1)) { c.act = 'jump'; c.vy = 0; }
        break;
      }
      case 'fight': {
        const foe = this.clonks.find(o => o.id === c.foe);
        if (!foe || foe.act === 'dead' || foe.inside || Math.abs(foe.x - c.x) > 13 || Math.abs(foe.y - c.y) > 8) { c.act = 'walk'; break; }
        c.dir = Math.sign(foe.x - c.x) || c.dir;
        if (Math.abs(foe.x - c.x) < 5) this.walkStep(c, -c.dir * 0.5);
        c.fightT++;
        const sword = c.inv.includes('sword');
        if (!c.block && c.fightT % (sword ? 30 : 34) === 0) {
          c.punch = 10; if (sword) c.swing = 10;
          if (this.blocks(foe, c.dir, true)) { this.snd('shield', foe.x, foe.y); foe.blockT = 10; }
          else { this.hurt(foe, sword ? 7 + this.rand() * 4 : 3 + this.rand() * 3, c); this.snd(sword ? 'swing' : 'punch', c.x, c.y); if (this.rand() < 0.12 && foe.act !== 'dead') this.fling(foe, c.dir * 1.8, -1.6); }
        }
        if (mv === -c.dir) { c.act = 'walk'; this.walkStep(c, mv * 2); }
        if (!this.boxHit(c.x, c.y + 1)) { c.act = 'jump'; c.vy = 0; }
        break;
      }
    }
  }
  digCircle(cx, cy, r, c) {
    let n = 0; const r2 = r * r;
    for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++) for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
      if (xx < 0 || yy < 0 || xx >= this.W || yy >= this.H) continue;
      const dx = xx - cx, dy = yy - cy; if (dx * dx + dy * dy > r2) continue;
      const m = this.mat[yy * this.W + xx];
      if (DIGGABLE[m]) { if (m === MAT.GOLD) c.gold++; this.setMat(xx, yy, this.bg(xx, yy)); n++; }
    }
    if (c.gold >= 36) {
      c.gold -= 36;
      if (c.inv.length < INV_MAX) { c.inv.push('gold'); this.snd('grab', c.x, c.y); if (!this.teams[c.team].ai) this.msg('Gold gefunden!', c.team); }
      else {
        const lor = this.vehicles.find(v => v.type === 'lorry' && v.inv.length < VEH.lorry.cap && Math.abs(v.x - c.x) < 40 && Math.abs(v.y - c.y) < 30);
        if (lor) { lor.inv.push('gold'); this.snd('grab', lor.x, lor.y); }
        else { const it = this.spawnItem('gold', c.x, c.y - 4); it.pickCd = 40; }
      }
    }
    return n;
  }
  pickup(c) {
    for (const it of this.items) {
      if (it.remove || it.stuck || it.pickCd > 0 || it.fuse > 0 || it.chain || it.type === 'arrow') continue;
      if (Math.abs(it.x - c.x) < 6 && it.y > c.y - 12 && it.y < c.y + 3 && Math.hypot(it.vx, it.vy) < 2.5) {
        if (it.type === 'arrows') { c.arrows += 10; it.remove = true; this.snd('grab', c.x, c.y); continue; }
        if (it.type === 'armor' && !c.armor) { c.armor = 1; it.remove = true; this.snd('grab', c.x, c.y); continue; }
        if (c.inv.length >= INV_MAX) continue;
        c.inv.push(it.type); it.remove = true; this.snd('grab', c.x, c.y);
      }
    }
  }
  updItem(it) {
    if (it.remove) return;
    it.age++; if (it.pickCd > 0) it.pickCd--;
    if (it.chain) { it.chain--; if (it.chain === 0) { it.remove = true; this.explode(it.x, it.y, ITEMS[it.type].blast, it.owner); return; } }
    if (it.fuse > 0) { it.fuse--; if (it.fuse === 0) { it.remove = true; this.explode(it.x, it.y, ITEMS.tnt.blast, it.owner); return; } }
    if (it.type === 'arrow' && it.landed) { if (it.age > 360) it.remove = true; return; }
    if (it.stuck) { if (this.solid(it.x, it.y)) return; it.stuck = false; }
    if (it.y > this.H + 10) { it.remove = true; return; }
    const isArrow = it.type === 'arrow';
    it.vy = Math.min(it.vy + (isArrow ? 0.07 : 0.1), 5);
    const mHere = this.matAt(it.x, it.y);
    if (mHere === MAT.WATER) { it.vx *= 0.9; it.vy *= 0.85; }
    else if (mHere === MAT.LAVA) {
      if (it.type === 'flint' || it.type === 'superflint' || it.type === 'tnt') { it.remove = true; this.explode(it.x, it.y, ITEMS[it.type].blast, it.owner); return; }
      it.vx *= 0.7; it.vy *= 0.6; if (it.age > 30 && this.rand() < 0.01) { it.remove = true; return; }
    }
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(it.vx), Math.abs(it.vy))));
    for (let s = 0; s < steps; s++) {
      const nx = it.x + it.vx / steps, ny = it.y + it.vy / steps;
      if (this.solid(nx, ny)) {
        if (it.armed && (it.type === 'flint' || it.type === 'superflint')) { it.remove = true; this.explode(it.x, it.y, ITEMS[it.type].blast + (it.shot === 2 ? 4 : 0), it.owner); return; }
        if (it.armed && it.shot === 2 && (it.type === 'rock' || it.type === 'gold')) { it.remove = true; this.explode(it.x, it.y, 8, it.owner); return; }
        if (isArrow) { it.x = nx; it.y = ny; it.landed = true; it.armed = false; it.age = 0; this.snd('arrowhit', it.x, it.y); return; }
        const sp = Math.hypot(it.vx, it.vy);
        if (sp > 1.5) this.snd('rock', it.x, it.y);
        if (this.solid(nx, it.y)) it.vx *= -0.35;
        if (this.solid(it.x, ny)) { it.vy *= -0.3; it.vx *= 0.6; }
        if (Math.abs(it.vy) < 0.3) it.vy = 0;
        it.armed = false; it.shot = 0;
        if (this.solid(it.x, it.y)) { it.y -= 1; }
        break;
      }
      it.x = nx; it.y = ny;
    }
    if (isArrow) it.ang = Math.atan2(it.vy, it.vx);
    const sp = Math.hypot(it.vx, it.vy);
    if (sp > 1.4 && it.armed) {
      for (const c of this.clonks) {
        if (c.act === 'dead' || c.inside || (c.id === it.owner && it.age < 25)) continue;
        if (Math.abs(it.x - c.x) <= 4 && it.y >= c.y - 11 && it.y <= c.y + 1) {
          if (this.blocks(c, Math.sign(it.vx) || 1)) { this.snd('shield', c.x, c.y); c.blockT = 10; it.vx *= -0.25; it.vy = -1; it.armed = false; if (isArrow) it.landed = false; break; }
          if (it.type === 'flint' || it.type === 'superflint') { it.remove = true; this.explode(it.x, it.y, ITEMS[it.type].blast, it.owner); return; }
          if (it.shot === 2) { it.remove = true; this.explode(it.x, it.y, 8, it.owner); return; }
          if (isArrow) { this.hurt(c, 13, it.owner); this.snd('hitliving', c.x, c.y); it.remove = true; return; }
          this.hurt(c, (ITEMS[it.type].dmg || 5) * sp / 2.5, it.owner); this.snd('hitliving', c.x, c.y);
          if (c.act !== 'dead' && it.type === 'rock') this.fling(c, Math.sign(it.vx) * 1.2, -1.2);
          it.vx *= -0.3; it.armed = false; break;
        }
      }
      if (it.remove) return;
      for (const m of this.monsters) {
        if (Math.abs(it.x - m.x) <= 5 && it.y >= m.y - 11 && it.y <= m.y + 1) {
          if (it.type === 'flint' || it.type === 'superflint') { it.remove = true; this.explode(it.x, it.y, ITEMS[it.type].blast, it.owner); return; }
          if (isArrow) { m.hp -= 16; this.snd('hitliving', m.x, m.y); it.remove = true; return; }
          m.hp -= (ITEMS[it.type].dmg || 5) * sp / 2; it.vx *= -0.3; it.armed = false; this.snd('hitliving', m.x, m.y);
        }
      }
      for (const v of this.vehicles) {
        const d = VEH[v.type];
        if (v.pusher && this.clonks.find(c => c.id === v.pusher && c.id === it.owner)) continue;
        if (Math.abs(it.x - v.x) <= d.w / 2 && it.y >= v.y - d.h && it.y <= v.y + 1 && it.age > 8) {
          if (it.type === 'flint' || it.type === 'superflint') { it.remove = true; this.explode(it.x, it.y, ITEMS[it.type].blast, it.owner); return; }
          v.hp -= isArrow ? 2 : 8; it.vx *= -0.3; it.armed = false; this.snd('metalhit', v.x, v.y); if (isArrow) { it.remove = true; return; }
        }
      }
      for (const s of this.structs) {
        if (it.age > 10 && Math.abs(it.x - s.x) < s.w / 2 && it.y > s.y - s.h && it.y < s.y && !this.clonks.some(c => c.id === it.owner && c.inside === s.id)) {
          if (it.type === 'flint' || it.type === 'superflint') { it.remove = true; this.explode(it.x, it.y, ITEMS[it.type].blast, it.owner); return; }
          if (it.shot === 2) { it.remove = true; this.explode(it.x, it.y, 8, it.owner); return; }
          if (isArrow) { it.remove = true; s.hp -= 1; return; }
        }
      }
    }
  }
  updVehicle(v) {
    const d = VEH[v.type];
    if (v.hp <= 0) {
      v.remove = true;
      const pc = this.clonks.find(c => c.id === v.pusher); if (pc) this.release(pc);
      for (const ty of v.inv) { const it = this.spawnItem(ty, v.x, v.y - 5); it.vx = (this.rand() - 0.5) * 2; it.vy = -1.5 - this.rand(); it.pickCd = 30; }
      this.msg(d.name + ' wurde zerstört!'); this.snd('metalhit', v.x, v.y); this.ev({ e: 'boom', x: Math.round(v.x), y: Math.round(v.y - 4), r: 5 });
      return;
    }
    if (v.cd > 0) v.cd--;
    let pc = v.pusher ? this.clonks.find(c => c.id === v.pusher) : null;
    if (pc && (pc.act !== 'push' || pc.veh !== v.id)) { pc = null; v.pusher = 0; }
    const liq = this.matAt(v.x, v.y - 2);
    const inWater = liq === MAT.WATER;
    if (liq === MAT.LAVA) { v.hp -= 0.4; if (d.wood) v.fire = 300; }
    if (v.fire > 0) { v.fire--; v.hp -= 0.08; if (inWater) v.fire = 0; if (this.tick % 30 === 0) this.igniteNear(v.x, v.y - 3, 8); }
    const ground = this.vHit(v, v.x, v.y + 1);
    if (pc) {
      const k = this.keysFor(pc), mv = k.r - k.l;
      if (mv) v.dir = mv;
      if (ground || inWater) v.vx = mv * (inWater ? 0.3 : 0.62);
      if (d.gun && k.am) { const tx = k.ax - v.x, ty = (v.y - 6) - k.ay; if (Math.abs(tx) > 4 && !mv) v.dir = Math.sign(tx); const ta = Math.max(d.amin, Math.min(d.amax, Math.atan2(ty, Math.max(1, Math.abs(tx))))); v.ang += Math.max(-0.03, Math.min(0.03, ta - v.ang)); }
      else if (d.gun) { if (k.u) v.ang = Math.min(d.amax, v.ang + 0.02); if (k.d) v.ang = Math.max(d.amin, v.ang - 0.02); }
    } else if (ground) v.vx *= 0.8;
    if (Math.abs(v.vx) < 0.02) v.vx = 0;
    if (v.vx) {
      const nx = v.x + v.vx; let moved = false;
      for (let up = 0; up <= 3; up++) if (!this.vHit(v, nx, v.y - up)) { v.x = nx; v.y -= up; moved = true; break; }
      if (!moved) v.vx = 0;
    }
    v.x = Math.max(d.w / 2 + 1, Math.min(this.W - d.w / 2 - 1, v.x));
    if (!this.vHit(v, v.x, v.y + 1)) {
      let down = 0; while (down < 3 && !this.vHit(v, v.x, v.y + down + 1)) down++;
      if (down < 3 && v.vy <= 0.3) { v.y += down; v.vy = 0; }
      else {
        v.vy = Math.min(v.vy + (inWater ? 0.02 : 0.11), inWater ? 0.35 : 4.5);
        const steps = Math.max(1, Math.ceil(Math.abs(v.vy)));
        for (let s = 0; s < steps; s++) { const ny = v.y + v.vy / steps; if (this.vHit(v, v.x, ny)) { if (v.vy > 3.6) v.hp -= (v.vy - 3.6) * 12; v.vy = 0; v.y = Math.round(v.y); break; } v.y = ny; }
      }
    } else v.vy = 0;
    if (v.y > this.H + 20) { v.remove = true; if (pc) this.release(pc); return; }
    if (pc) {
      pc.x = v.x - v.dir * (d.w / 2 + 1); pc.y = v.y; pc.dir = v.dir;
      if (v.vy > 1.6) { this.release(pc); pc.act = 'jump'; pc.vy = v.vy; }
    }
    if (v.type === 'lorry' && v.inv.length < d.cap) for (const it of this.items) {
      if (it.remove || it.stuck || it.armed || it.fuse > 0 || it.chain || it.type === 'arrow' || it.pickCd > 0) continue;
      if (Math.abs(it.x - v.x) <= d.w / 2 && it.y > v.y - d.h - 3 && it.y <= v.y + 1) { v.inv.push(it.type); it.remove = true; this.snd('grab', v.x, v.y); if (v.inv.length >= d.cap) break; }
    }
  }
  vHit(v, x, y) {
    const d = VEH[v.type], hw = d.w >> 1, xi = Math.round(x), yi = Math.round(y);
    for (let xx = xi - hw; xx <= xi + hw; xx += 2) if (this.solid(xx, yi) || this.solid(xx, yi - (d.h >> 1)) || this.solid(xx, yi - d.h + 1)) return true;
    return false;
  }
  updMonster(m) {
    if (m.hp <= 0) { m.remove = true; this.snd('growl', m.x, m.y); if (this.rand() < 0.6) { const it = this.spawnItem('gold', m.x, m.y - 5); it.vy = -2; } this.msg('Ein Monster wurde besiegt!'); return; }
    if (m.cd > 0) m.cd--;
    if (m.y > this.H + 10) { m.remove = true; return; }
    const here = this.matAt(m.x, m.y - 3);
    if (here === MAT.LAVA) { m.hp -= 1; m.fire = 200; }
    if (m.fire > 0) { m.fire--; m.hp -= 0.15; if (here === MAT.WATER) m.fire = 0; if (this.tick % 25 === m.id % 25) this.ignitePoint(m.x, m.y); }
    m.think--;
    const night = this.daylight() < 0.3;
    let target = null, best = night ? 200 : 140;
    for (const c of this.clonks) { if (c.act === 'dead' || c.inside) continue; const d = Math.abs(c.x - m.x); if (d < best && Math.abs(c.y - m.y) < 50) { best = d; target = c; } }
    if (target) m.dir = Math.sign(target.x - m.x) || m.dir;
    else if (m.think <= 0) { m.think = 120 + this.rand() * 200 | 0; if (this.rand() < 0.4) m.dir = -m.dir; }
    const inWater = this.matAt(m.x, m.y - 4) === MAT.WATER;
    if (m.act === 'walk') {
      const sp = (target ? (night ? 0.85 : 0.7) : 0.4) * (inWater ? 0.5 : 1);
      if (!this.walkStep(m, m.dir * sp)) { m.act = 'jump'; m.vy = -2.3; m.vx = m.dir * 0.6; if (this.rand() < 0.3) m.dir = -m.dir; }
      m.anim += 0.12;
      if (!this.boxHit(m.x, m.y + 1)) { let d = 0; while (d < 4 && !this.boxHit(m.x, m.y + d + 1)) d++; if (d < 4) m.y += d; else { m.act = 'jump'; m.vy = 0; m.vx = m.dir * 0.4; } }
      if (inWater && !this.boxHit(m.x, m.y - 0.5)) m.y -= 0.5;
    } else {
      m.vy = Math.min(m.vy + (inWater ? 0.03 : 0.11), inWater ? 0.6 : 4.5);
      if (!this.boxHit(m.x + m.vx, m.y)) m.x += m.vx; else m.vx = 0;
      if (!this.boxHit(m.x, m.y + m.vy)) m.y += m.vy; else { if (m.vy > 0) { m.act = 'walk'; m.y = Math.round(m.y); } m.vy = 0; }
      if (inWater) m.act = 'walk';
    }
    if (target && m.cd === 0 && Math.abs(target.x - m.x) < 8 && Math.abs(target.y - m.y) < 9) {
      m.cd = 55; m.bite = 10; this.snd('growl', m.x, m.y);
      if (this.blocks(target, m.dir)) { this.snd('shield', target.x, target.y); target.blockT = 10; m.vx = -m.dir; }
      else { this.hurt(target, 9, null); if (target.act !== 'dead') this.fling(target, m.dir * 1.6, -1.4); }
    }
    if (m.bite > 0) m.bite--;
  }

  // ---------- KI ----------
  aiTeam(t) {
    t.aiT++;
    const own = this.clonks.filter(c => c.team === t.id && c.act !== 'dead');
    if (!own.length && t.money >= PRICE_CLONK) this.buy(t, t.res.knight && t.money >= PRICE_KNIGHT ? 'knight' : 'clonk');
    if (t.aiT % 600 === 300 && !t.rq) {
      for (const k of ['weapons', 'tower', 'castle', 'knight', 'tnt']) { const r = RES_BY[k]; if (!t.res[k] && (!r.req || r.req.every(q => t.res[q])) && t.money >= r.cost + 40) { this.research(t, k); break; } }
    }
    if (t.res.knight && t.money >= PRICE_KNIGHT + 30 && own.length < 5 && t.aiT % 900 === 0) this.buy(t, 'knight');
    for (const c of own) this.aiClonk(c, t);
  }
  aiClonk(c, t) {
    c.aiTick = (c.aiTick || 0) + 1;
    if (c.inside) { if (c.aiTick % 120 === 0) this.leave(c); return; }
    if (c.act === 'push') { this.release(c); return; }
    if (c.aiTick % 6) return;
    const k = { ...NOKEYS };
    const enemies = this.clonks.filter(o => o.team !== c.team && o.act !== 'dead' && !o.inside);
    let target = null, bd = 1e9;
    for (const o of enemies) { const d = Math.hypot(o.x - c.x, (o.y - c.y) * 1.5); if (d < bd) { bd = d; target = o; } }
    const ammo = c.inv.filter(x => THROWABLE.has(x)).length;
    const hasSword = c.inv.includes('sword'), hasBow = c.inv.includes('bow') && c.arrows > 0;
    const hut = this.structs.find(s => BUILD[s.type].base && s.team === t.id && s.prog >= 1);
    let goal = target;
    if (!ammo && !hasSword && hut && t.money >= 10) {
      goal = { x: hut.x, y: hut.y };
      if (this.nearBase(c)) {
        if (t.res.weapons && t.money >= 45 && c.inv.length < INV_MAX) { t.money -= 15; c.inv.push('sword'); if (c.inv.length < INV_MAX) { t.money -= 12; c.inv.push('shield'); } }
        while (c.inv.length < INV_MAX && t.money >= 10) { t.money -= 10; c.inv.push(t.money >= 40 && this.rand() < 0.3 ? 'superflint' : 'flint'); }
        goal = target;
      }
    }
    if (c.inv.includes('gold') && hut && this.nearBase(c)) this.sell(c);
    if (!goal) { c.aiKeys = k; return; }
    const dx = goal.x - c.x, dy = goal.y - c.y;
    if (target && goal === target && c.cd === 0 && (c.act === 'walk' || c.act === 'jump' || c.act === 'swim' || c.act === 'fight')) {
      const adx = Math.abs(dx);
      if (hasSword && adx < 15 && Math.abs(dy) < 9 && this.rand() < 0.5) { c.dir = Math.sign(dx) || c.dir; this.attack(c); }
      else if (hasBow && adx > 30 && adx < 170 && Math.abs(dy) < 30 && this.rand() < 0.25) { c.dir = Math.sign(dx); this.shoot(c); c.cd = 70; }
      else if (ammo && adx > 30 && adx < 150 && dy > -40 && dy < 50 && this.rand() < 0.3) {
        c.dir = Math.sign(dx); let g = 0; while (!THROWABLE.has(c.inv[0]) && g++ < INV_MAX) c.inv.push(c.inv.shift());
        this.throwItem(c); c.cd = 90;
      }
    }
    if (c.inv.includes('shield') && target && Math.abs(target.x - c.x) < 18 && (target.swing > 0 || this.rand() < 0.3)) k.b = 1;
    if (Math.abs(dx) > 5) { if (dx > 0) k.r = 1; else k.l = 1; }
    if (c.act === 'climb' || c.act === 'swim') k.u = 1;
    if (c.act === 'hangle') { if (dx > 0) k.r = 1; else k.l = 1; }
    if (c.act === 'dig') { if (dy < -20) k.u = 1; else if (dy > 20) k.d = 1; c.digT = (c.digT || 0) + 1; if (c.digT > 60) { c.act = 'walk'; c.digT = 0; } }
    const moved = Math.abs(c.x - (c.lastX || 0)) + Math.abs(c.y - (c.lastY || 0));
    c.lastX = c.x; c.lastY = c.y;
    if (c.act === 'walk' && Math.abs(dx) > 8 && moved < 0.5 && !k.b) {
      c.stuckT = (c.stuckT || 0) + 1;
      if (c.stuckT % 3 === 1) this.clonkAction(c, 'jump');
      else if (c.stuckT > 4) { const m = this.matAt(c.x + Math.sign(dx) * 6, c.y - 5); if (DIGGABLE[m]) { c.act = 'dig'; c.dir = Math.sign(dx); c.digA = dy > 20 ? 0.8 : dy < -20 ? -0.6 : 0; c.digIdle = 0; c.digT = 0; } c.stuckT = 0; }
    } else c.stuckT = 0;
    if (c.act === 'walk' && dy > 50 && Math.abs(dx) < 20 && this.rand() < 0.2) { c.act = 'dig'; c.digA = 1.4; c.digIdle = 0; c.digT = 0; }
    c.aiKeys = k;
  }

  // ---------- Netzwerk ----------
  snap() {
    const r1 = v => Math.round(v * 10) / 10;
    const fl = [];
    for (const f of this.fires) fl.push(f.x, f.y, f.k);
    return {
      c: this.clonks.map(c => [c.id, c.team, r1(c.x), r1(c.y), c.dir, ACTS.indexOf(c.act), Math.ceil(c.hp), r1(c.anim), invEnc(c.inv), Math.round(c.breath), c.name, c.punch, r1(c.digA),
        (c.armor ? 1 : 0) | (c.knight ? 2 : 0) | (c.block ? 4 : 0) | (c.bowT > 0 ? 8 : 0) | (c.fire > 0 ? 16 : 0) | (c.blockT > 0 ? 32 : 0), c.arrows, c.inside, c.swing, c.veh, c.slot || 0]),
      i: this.items.map(i => [i.id, ITEM_CODES.indexOf(i.type), r1(i.x), r1(i.y), i.fuse, i.stuck ? 1 : 0, r1(i.vx), r1(i.vy), i.landed ? 1 : 0]),
      m: this.monsters.map(m => [m.id, r1(m.x), r1(m.y), m.dir, Math.ceil(m.hp), r1(m.anim), m.bite || 0, m.fire > 0 ? 1 : 0]),
      s: this.structs.map(s => [s.id, s.type, s.x, s.y, s.team, Math.round(s.prog * 100) / 100, Math.ceil(s.hp), s.fire > 0 ? 1 : 0]),
      v: this.vehicles.map(v => [v.id, VEH_CODES.indexOf(v.type), r1(v.x), r1(v.y), v.dir, v.team, Math.ceil(v.hp), Math.round(v.ang * 100) / 100, invEnc(v.inv), v.fire > 0 ? 1 : 0, v.pusher, v.cd]),
      t: this.teams.map(t => [t.money, t.sel, t.elim ? 1 : 0, Object.keys(t.res).join(','), t.rq, Math.round(t.rp * 1000) / 1000]),
      f: fl, b: this.burntNew && this.burntNew.length ? this.burntNew.splice(0) : undefined,
      st: this.state, w: this.winner, tk: this.tick,
    };
  }
  applySnap(s) {
    const old = new Map(this.clonks.map(c => [c.id, c]));
    this.clonks = s.c.map(a => {
      const c = old.get(a[0]) || { rx: a[2], ry: a[3] };
      const fl = a[13] || 0;
      Object.assign(c, { id: a[0], team: a[1], x: a[2], y: a[3], dir: a[4], act: ACTS[a[5]], hp: a[6], anim: a[7], inv: invDec(a[8]), breath: a[9], name: a[10], punch: a[11], digA: a[12],
        armor: fl & 1, knight: fl & 2, block: fl & 4, bowT: fl & 8 ? 1 : 0, fire: fl & 16 ? 1 : 0, blockT: fl & 32 ? 1 : 0, arrows: a[14], inside: a[15], swing: a[16], veh: a[17], slot: a[18] || 0 });
      return c;
    });
    const oi = new Map(this.items.map(c => [c.id, c]));
    this.items = s.i.map(a => { const it = oi.get(a[0]) || { rx: a[2], ry: a[3] }; Object.assign(it, { id: a[0], type: ITEM_CODES[a[1]], x: a[2], y: a[3], fuse: a[4], stuck: !!a[5], vx: a[6], vy: a[7], landed: !!a[8] }); if (it.type === 'arrow' && !it.landed) it.ang = Math.atan2(it.vy, it.vx); return it; });
    const om = new Map(this.monsters.map(c => [c.id, c]));
    this.monsters = s.m.map(a => { const m = om.get(a[0]) || { rx: a[1], ry: a[2] }; Object.assign(m, { id: a[0], x: a[1], y: a[2], dir: a[3], hp: a[4], anim: a[5], bite: a[6], fire: a[7] }); return m; });
    this.structs = s.s.map(a => { const B = BUILD[a[1]]; return { id: a[0], type: a[1], x: a[2], y: a[3], team: a[4], prog: a[5], hp: a[6], fire: a[7], w: B.w, h: B.h }; });
    const ov = new Map(this.vehicles.map(c => [c.id, c]));
    this.vehicles = (s.v || []).map(a => { const v = ov.get(a[0]) || { rx: a[2], ry: a[3] }; Object.assign(v, { id: a[0], type: VEH_CODES[a[1]], x: a[2], y: a[3], dir: a[4], team: a[5], hp: a[6], ang: a[7], inv: invDec(a[8]), fire: a[9], pusher: a[10], cd: a[11] }); return v; });
    s.t.forEach((a, i) => { const t = this.teams[i]; if (t) { t.money = a[0]; t.sel = a[1]; t.elim = !!a[2]; t.res = {}; if (a[3]) for (const k of a[3].split(',')) t.res[k] = 1; t.rq = a[4]; t.rp = a[5]; } });
    const fs = [], f = s.f || [];
    for (let k = 0; k < f.length; k += 3) fs.push({ x: f[k], y: f[k + 1], k: f[k + 2] });
    if (s.b) for (const x of s.b) this.markBurnt(x);
    this.fires = fs;
    this.state = s.st; this.winner = s.w; this.tick = s.tk;
  }
  encodeChunk(ci) {
    const cx = ci % this.cw, cy = (ci / this.cw) | 0;
    const x0 = cx * CH, y0 = cy * CH, w = Math.min(CH, this.W - x0), h = Math.min(CH, this.H - y0);
    const buf = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) buf.set(this.mat.subarray((y0 + y) * this.W + x0, (y0 + y) * this.W + x0 + w), y * w);
    return [ci, rleEncode(buf)];
  }
  applyChunk(ci, data) {
    const cx = ci % this.cw, cy = (ci / this.cw) | 0;
    const x0 = cx * CH, y0 = cy * CH, w = Math.min(CH, this.W - x0), h = Math.min(CH, this.H - y0);
    const buf = new Uint8Array(w * h); rleDecode(data, buf);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y0 + y) * this.W + x0 + x; if (this.mat[i] !== buf[y * w + x]) { this.mat[i] = buf[y * w + x]; this.colorPixel(x0 + x, y0 + y); if (y0 + y + 1 < this.H) this.colorPixel(x0 + x, y0 + y + 1); }
    }
    this.renderDirty.add(ci);
    if (cy + 1 < this.chh) this.renderDirty.add(ci + this.cw);
  }
  fullMap() { return { mat: rleEncode(this.mat), surf: Array.from(this.surf), burnt: rleEncode(this.burnt) }; }
  loadMap(m) { rleDecode(m.mat, this.mat); this.surf.set(m.surf); if (m.burnt) rleDecode(m.burnt, this.burnt); this.recolorAll(); }
}
if (typeof module !== 'undefined') module.exports = { World, MAT, ITEMS };
