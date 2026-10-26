// BuddelRage – Spielwelt / Simulation (eigener Code, inspiriert von Clonk Rage / OpenClonk-Mechaniken)
'use strict';
const MAT = { SKY: 0, TUNNEL: 1, EARTH: 2, SAND: 3, ROCK: 4, GOLD: 5, GRANITE: 6, WATER: 7, WOOD: 8, LAVA: 9 };
const MAT_NAMES = ['Himmel', 'Tunnel', 'Erde', 'Sand', 'Fels', 'Gold', 'Granit', 'Wasser', 'Holz', 'Lava'];
const SOLID = [0, 0, 1, 1, 1, 1, 1, 0, 1, 0];
const DIGGABLE = [0, 0, 1, 1, 0, 1, 0, 0, 0, 0];
const BLASTABLE = [0, 0, 1, 1, 1, 1, 0, 0, 1, 0];
const CH = 32;
const SIM_CHUNK_BUDGET = 360; // max. aktive Material-Chunks pro Tick (große Karten)
const ITEMS = {
  rock: { name: 'Stein', price: 3, sell: 2, dmg: 9 },
  flint: { name: 'Feuerstein', price: 10, sell: 5, blast: 13 },
  superflint: { name: 'Superflint', price: 24, sell: 10, blast: 21 },
  tnt: { name: 'TNT', price: 30, sell: 12, blast: 30 },
  gold: { name: 'Gold', price: 0, sell: 20, dmg: 6 },
  sword: { name: 'Schwert', price: 22, sell: 7, dmg: 7 },
  shield: { name: 'Schild', price: 18, sell: 6, dmg: 5 },
  bow: { name: 'Bogen', price: 22, sell: 7, dmg: 4 },
  arrows: { name: 'Pfeile (10)', price: 8, sell: 3, dmg: 3 },
  armor: { name: 'Rüstung', price: 38, sell: 12, dmg: 6 },
  arrow: { name: 'Pfeil', price: 0, sell: 0, dmg: 13 },
  wipf: { name: 'Wipf', price: 0, sell: 6, dmg: 1 },
  hook: { name: 'Enterhaken', price: 20, sell: 7, dmg: 4 },
  balloon: { name: 'Ballon', price: 15, sell: 5, dmg: 1 },
  earth: { name: 'Erdklumpen', price: 2, sell: 0, dmg: 3 },
};
const ITEM_CODES = ['rock', 'flint', 'superflint', 'tnt', 'gold', 'sword', 'shield', 'bow', 'arrows', 'armor', 'arrow', 'wipf', 'hook', 'balloon', 'earth'];
const AMMO = new Set(['rock', 'flint', 'superflint', 'tnt', 'gold']);
const THROWABLE = new Set(['flint', 'superflint', 'tnt']);
// Ausrüstung: eigene Plätze, getrennt vom 3er-Inventar (Rüstung = c.armor, Pfeile = c.arrows)
const GEAR = new Set(['sword', 'shield', 'bow', 'hook']);
const GEAR_SEL = ['sword', 'bow', 'hook']; // per Taste 4–6 wählbar (Schild/Rüstung wirken passiv)
const EQ_SLOTS = [{ k: 'sword', n: 'Waffe' }, { k: 'shield', n: 'Schild' }, { k: 'bow', n: 'Bogen' }, { k: 'armor', n: 'Rüstung' }, { k: 'hook', n: 'Werkzeug' }];
const SELLABLE = ['gold', 'rock', 'flint', 'superflint', 'tnt', 'wipf', 'balloon']; // Verkaufsmenü: Automatik je Typ
const AUTO_SELL_DEFAULT = { gold: 1 }; // Standard: nur Wertgegenstände
function hasG(c, k) { return !!(c && c.gear && c.gear.includes(k)); }
function canTake(c, type) { if (type === 'arrows') return true; if (type === 'armor') return !c.armor; if (GEAR.has(type)) return !hasG(c, type); return c.inv.length < INV_MAX; }
function giveItem(c, type) {
  if (!canTake(c, type)) return false;
  if (type === 'arrows') c.arrows += 10; else if (type === 'armor') c.armor = 1; else if (GEAR.has(type)) (c.gear || (c.gear = [])).push(type); else c.inv.push(type);
  return true;
}
function bestWeapon(c) { return hasG(c, 'sword') ? 'sword' : hasG(c, 'bow') && c.arrows > 0 ? 'bow' : null; }
// alte Stände/Ritter: Ausrüstung aus dem Inventar in die Ausrüstungsplätze verschieben
function migrateGear(c) { if (!c.gear) c.gear = []; if (!c.inv) c.inv = []; const keep = []; for (const t of c.inv) { if (GEAR.has(t) && !c.gear.includes(t)) c.gear.push(t); else if (!GEAR.has(t)) keep.push(t); } c.inv = keep; if ((c.slot || 0) >= INV_MAX + GEAR_SEL.length) c.slot = 0; return c; }
function selSlots(c) { const L = []; for (let i = 0; i < INV_MAX; i++) if (i < c.inv.length || i === 0) L.push(i); GEAR_SEL.forEach((g, i) => { if (hasG(c, g)) L.push(INV_MAX + i); }); return L; }
const PRICE_CLONK = 60, PRICE_KNIGHT = 110, PRICE_BRIDGE = 12;
// Fahrzeuge (Lore, Katapult, Kanone)
const VEH = {
  lorry: { name: 'Lore', price: 30, w: 14, h: 8, hp: 80, cap: 25, res: 'lorry' },
  catapult: { name: 'Katapult', price: 55, w: 18, h: 12, hp: 90, wood: 1, gun: 1, speed: 4.9, cd: 70, amin: 0.3, amax: 1.35, ang: 0.8, res: 'catapult' },
  cannon: { name: 'Kanone', price: 95, w: 16, h: 9, hp: 150, gun: 1, speed: 6.6, cd: 100, amin: 0, amax: 1.1, ang: 0.3, res: 'cannon' },
};
const VEH_CODES = ['lorry', 'catapult', 'cannon'];
const VSTEP = 5; // Fahrzeuge erklimmen Stufen bis 5 px (Räder)
// Gebäude
// Startplateau: Hütte in der Mitte, Burg auf der Burgseite (CASTLE_OFF), Wachturm auf der Gegenseite
// Planieren: max. Abtrag je Spalte, max. Lückentiefe, Kappe über Schächten, Pixel pro Geldstück
const LEVEL_CUT = 26, LEVEL_FILL = 14, LEVEL_CAP = 6, LEVEL_PX_PER_COIN = 60, LEVEL_RATE = 3;
const CASTLE_OFF = 62, PLAT_BACK = 78, PLAT_FRONT = 118;
// Kartengrößen (Breite = Grundbreite × f, Höhe fest)
const MAP_SIZES = { klein: { n: 'Klein', f: 0.85, h: 580 }, mittel: { n: 'Mittel', f: 1.2, h: 660 }, gross: { n: 'Groß', f: 1.6, h: 760 }, riesig: { n: 'Riesig', f: 2.2, h: 880 } };
function mapDims(baseW, size) { const S = MAP_SIZES[size] || MAP_SIZES.mittel; return { W: Math.round(baseW * S.f / 10) * 10, H: S.h, size: MAP_SIZES[size] ? size : 'mittel' }; }
const BUILD = {
  hut: { name: 'Hütte', price: 60, w: 30, h: 24, hp: 120, time: 360, base: 1, wood: 1 },
  tower: { name: 'Wachturm', price: 90, w: 18, h: 50, hp: 220, time: 600, wood: 1, res: 'tower' },
  castle: { name: 'Burg', price: 170, w: 64, h: 46, hp: 600, time: 1000, base: 1, res: 'castle' },
};
// Forschungsbaum
const RESEARCH = [
  { k: 'lorry', name: 'Lore', cost: 35, time: 18, desc: 'Fahrzeug: sammelt Gold, Steine & Gegenstände ein' },
  { k: 'tower', name: 'Wachturm', cost: 60, time: 27, desc: 'Gebäude: betretbar, von oben werfen/schießen' },
  { k: 'tnt', name: 'Sprengstoff', cost: 50, time: 22, desc: 'TNT im Laden' },
  { k: 'weapons', name: 'Waffenschmiede', cost: 80, time: 30, desc: 'Schwert, Schild, Bogen, Pfeile, Rüstung' },
  { k: 'catapult', name: 'Katapult', cost: 70, time: 30, req: ['lorry'], desc: 'Fahrzeug: schleudert Steine & Feuersteine' },
  { k: 'castle', name: 'Burg', cost: 90, time: 38, req: ['tower'], desc: 'Gebäude: Heimatbasis, Laden, Rüstung, Heilung' },
  { k: 'cannon', name: 'Kanone', cost: 125, time: 45, req: ['catapult', 'weapons'], desc: 'Fahrzeug: schießt flach und hart' },
  { k: 'knight', name: 'Ritter', cost: 75, time: 30, req: ['castle', 'weapons'], desc: 'Ritter mit Schwert, Schild, Bogen & Rüstung kaufen' },
  { k: 'balloon', name: 'Ballonbau', cost: 45, time: 18, desc: 'Ballon im Laden: schwebt langsam nach oben (raus aus Gruben)' },
];
const RES_BY = Object.fromEntries(RESEARCH.map(r => [r.k, r]));
const SHOP_ALL = [
  { k: 'flint' }, { k: 'superflint' }, { k: 'tnt', res: 'tnt' }, { k: 'rock' }, { k: 'hook' }, { k: 'balloon', res: 'balloon' }, { k: 'clonk' },
  { k: 'lorry', res: 'lorry' }, { k: 'catapult', res: 'catapult' }, { k: 'cannon', res: 'cannon' },
  { k: 'sword', res: 'weapons' }, { k: 'shield', res: 'weapons' }, { k: 'bow', res: 'weapons' }, { k: 'arrows', res: 'weapons' }, { k: 'armor', res: 'weapons' },
  { k: 'knight', res: 'knight' }, { k: 'earth' },
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
const ACTS = ['walk', 'jump', 'climb', 'hangle', 'dig', 'swim', 'fight', 'tumble', 'dead', 'push', 'rope', 'float'];
const INV_TICKS = 55; // kurze Unverwundbarkeit nach einem Treffer (~0,9 s, Buddler blinkt)
const NAMES = ['Hans', 'Jörg', 'Kurt', 'Fritz', 'Otto', 'Paul', 'Karl', 'Willi', 'Bernd', 'Uwe', 'Gerd', 'Heinz', 'Rudi', 'Sepp', 'Franz', 'Toni', 'Max', 'Egon', 'Udo', 'Horst'];
const INV_MAX = 3;
const NOKEYS = { l: 0, r: 0, u: 0, d: 0, b: 0, s: 0, g: 0, am: 0, ax: 0, ay: 0 };
const BLOCK_SLOT = new Set(['sword', 'shield']);
// Namen säubern (für HUD/Netz): keine Steuerzeichen/HTML-Zeichen, max. 16 Zeichen
function cleanName(s, def) { const r = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16).trim(); return r || def; }
function newStats() { return { gold: 0, earned: 0, built: 0, builtList: [], research: 0, kills: 0, deaths: 0, bought: 0, stuckEv: 0, maxStuck: 0, paths: 0, bonus: 0 }; }
function actIdx(c) { return (c.slot || 0) >= INV_MAX ? 0 : Math.max(0, Math.min(c.slot || 0, c.inv.length - 1)); }
function actGear(c) { const s = c.slot || 0; if (s < INV_MAX) return null; const g = GEAR_SEL[s - INV_MAX]; return hasG(c, g) ? g : null; }
// aktiver Gegenstand: gewählte Ausrüstung (4–6) oder Inventarplatz (1–3); leere Hand → beste Waffe
function actItem(c) { const g = actGear(c); if (g) return g; return c.inv.length ? c.inv[actIdx(c)] : bestWeapon(c); }
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
    this.clonks = []; this.items = []; this.monsters = []; this.structs = []; this.teams = []; this.vehicles = []; this.animals = [];
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
  // Wie viel echte Wand neben dem Körper ist (gegen Festhalten an einzelnen Pixeln)
  wallSupport(x, y, dir) {
    const xi = Math.round(x), yi = Math.round(y), e = dir > 0 ? xi + 3 : xi - 4; let n = 0;
    for (let yy = yi - 9; yy <= yi; yy++) if (this.solid(e, yy) || this.solid(e + dir, yy) || this.solid(e + 2 * dir, yy)) n++;
    return n;
  }
  boxHit(x, y) {
    const xi = Math.round(x), yi = Math.round(y);
    for (let yy = yi - 9; yy <= yi; yy++) for (let xx = xi - 3; xx <= xi + 2; xx++) if (this.solid(xx, yy)) return true;
    return false;
  }
  setMat(x, y, m) {
    const i = y * this.W + x;
    if (this.mat[i] === m) return;
    this.mat[i] = m;
    if (this.nav) this.nav.mark(x, y);
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
  // Startplateau je Basis: eben, fest, Himmel frei – Platz für Hütte, Wachturm (Gegenseite) und Burg (Burgseite)
  plateauSpan(bx, d) { return d > 0 ? [bx - PLAT_BACK, bx + PLAT_FRONT] : [bx - PLAT_FRONT, bx + PLAT_BACK]; }
  generate(nBases) {
    const { W, H, seed } = this, surf = this.surf, mat = this.mat;
    const sf = new Float32Array(W);
    for (let x = 0; x < W; x++) sf[x] = H * 0.27 + (fbm(x / 260, 0.5, seed, 3) - 0.5) * 260 + (fbm(x / 40, 3.3, seed + 5, 2) - 0.5) * 26;
    this.bases = this.basePositions(nBases);
    this.baseDir = this.bases.map(bx => (nBases === 1 ? 1 : bx < W / 2 ? 1 : -1));
    const lo = 60, hi = H * 0.5;
    const spacing = nBases > 1 ? W / nBases : W;
    this.plats = [];
    this.bases.forEach((bx, i) => {
      const d = this.baseDir[i], [a, b] = this.plateauSpan(bx, d);
      // Höhe: zwischen Gelände an der Basis und dem Umgebungsmittel → natürliche Lage, kleine Übergänge
      let m = 0, n = 0; for (let x = Math.max(0, bx - 260); x < Math.min(W, bx + 260); x++) { m += sf[x]; n++; }
      const h = Math.round(Math.max(lo, Math.min(hi, sf[bx] * 0.5 + (m / n) * 0.5)));
      const room = Math.max(50, spacing / 2 - (b - a) / 2 - 10);
      const blend = (edge, dirn) => {
        const probe = Math.max(0, Math.min(W - 1, edge + dirn * 90));
        const L = Math.round(Math.max(60, Math.min(room, Math.abs(sf[probe] - h) * 2.6)));
        for (let k = 1; k <= L; k++) { const x = edge + dirn * k; if (x < 0 || x >= W) break; const tt = k / L, f = 1 - tt * tt * (3 - 2 * tt); sf[x] = sf[x] * (1 - f) + h * f; }
      };
      for (let x = Math.max(0, a); x <= Math.min(W - 1, b); x++) sf[x] = h;
      blend(a, -1); blend(b, 1);
      this.plats.push({ a, b, h, d });
    });
    for (let x = 0; x < W; x++) surf[x] = Math.max(50, Math.min(H * 0.55, Math.round(sf[x])));
    this.castleSites = this.bases.map((bx, i) => ({ x: bx + this.baseDir[i] * CASTLE_OFF, y: surf[bx] - 1, d: this.baseDir[i] }));
    // Materialien: gleiche Regeln wie zuvor, aber in Prioritätsreihenfolge ausgewertet (spart Rauschaufrufe)
    const granY = new Float32Array(W); for (let x = 0; x < W; x++) granY[x] = H - 16 - fbm(x / 30, 0, seed + 10, 2) * 18;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, s = surf[x];
      if (y < s) { mat[i] = MAT.SKY; continue; }
      if (y > granY[x]) { mat[i] = MAT.GRANITE; continue; }
      const d = y - s; let m;
      if (d > 50 && fbm(x / 60, y / 40, seed + 7, 3) > 0.685) m = (y > H * 0.6 && fbm(x / 220, y / 220, seed + 9, 2) > 0.45) ? MAT.WATER : MAT.TUNNEL;
      else if (d > 40 && Math.abs(fbm(x / 90, y / 45, seed + 6, 4) - 0.5) < 0.02) m = MAT.TUNNEL;
      else if (d > 30 && fbm(x / 16, y / 13, seed + 4, 3) > 0.70) m = MAT.GOLD;
      else if (fbm(x / 45, y / 30, seed + 3, 4) > 0.64 - Math.min(d, 300) / 2500) m = MAT.ROCK;
      else if (d > 25 && fbm(x / 35, y / 30, seed + 8, 3) > 0.69) m = MAT.SAND;
      else if (d < 22 && fbm(x / 130, y / 60, seed + 2, 3) > 0.64) m = MAT.SAND;
      else m = MAT.EARTH;
      if (m === MAT.TUNNEL && d > 70 && y > H * 0.72 && fbm(x / 160, y / 90, seed + 11, 2) > 0.56) m = MAT.LAVA;
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
    for (const P of this.plats) for (let x = Math.max(0, P.a - 8); x <= Math.min(W - 1, P.b + 8); x++) {
      const depth = x >= P.a && x <= P.b ? 34 : 18;
      for (let y = surf[x]; y < Math.min(H - 20, surf[x] + depth); y++) { const i = y * W + x; if (mat[i] !== MAT.EARTH) mat[i] = MAT.EARTH; }
    }
    // Oberflächen-Seen (Anzahl wächst mit der Kartenbreite; nie auf einem Startplateau)
    const nLakes = Math.max(1, Math.round(W / 1700)), lakes = [];
    for (let q = 0; q < nLakes; q++) {
      let lx = -1, best = 0;
      for (let x = 60; x < W - 60; x++) { if (this.bases.some(b => Math.abs(b - x) < 200) || lakes.some(L => x > L[0] - 150 && x < L[1] + 150)) continue; if (surf[x] > best) { best = surf[x]; lx = x; } }
      if (lx < 0) break;
      const level = best - 22; let a = lx, b = lx;
      while (a > 0 && surf[a] > level) a--; while (b < W - 1 && surf[b] > level) b++;
      lakes.push([a, b]);
      if (this.plats.some(P => b >= P.a - 12 && a <= P.b + 12)) continue;
      if (b - a < 360 && a > 2 && b < W - 3) for (let x = a; x <= b; x++) for (let y = level; y < surf[x]; y++) mat[y * W + x] = MAT.WATER;
    }
    // Eingebettete Objekte (Feuersteine, Gold, Steine)
    for (let k = 0; k < Math.round(W * H / (22 * 620)); k++) {
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
    cfg.sharedBase = true; // ein Lager je Lobby-Team (Seite): gemeinsame Hütte, Kasse, Forschung
    this.generate(this.sideList(cfg.teams).length);
    cfg.teams.forEach((tc, ti) => {
      const team = { id: ti, side: Number.isInteger(tc.side) ? tc.side : ti, hdiff: AI_LEVELS.includes(tc.hdiff) ? tc.hdiff : 'normal', name: cleanName(tc.name, 'Team ' + (ti + 1)), color: tc.color || TEAM_COLORS[ti % 6], ai: !!tc.ai, diff: AI_LEVELS.includes(tc.diff) ? tc.diff : 'normal', helper: !tc.ai && !!(tc.helper != null ? tc.helper : cfg.helpers), cname: tc.ai ? '' : cleanName(tc.cname, ''), cnum: 0, pid: tc.pid || null, money: cfg.money != null ? cfg.money : 50, sel: -1, keys: { ...NOKEYS }, elim: false, aiT: 0, nameIdx: ti * 5, res: {}, rq: '', rp: 0, stat: '', stats: newStats(), autoSell: { ...AUTO_SELL_DEFAULT } };
      if (cfg.allResearch) for (const r of RESEARCH) team.res[r.k] = 1;
      this.teams.push(team);
    });
    this.setupPools(true);
    const placed = {};
    for (const team of this.teams) {
      const ti = team.id, bi = this.bIdx(ti), bx0 = this.bases[bi], m = placed[bi] || 0; placed[bi] = m + 1;
      if (!m) this.addStruct('hut', bx0, this.surf[bx0], ti, 1); // nur der erste im Team baut die Hütte – alle teilen sie
      const P = this.plats && this.plats[bi], off = m ? (m % 2 ? 1 : -1) * Math.ceil(m / 2) * 32 : 0;
      const bx = P ? Math.max(P.a + 16, Math.min(P.b - 36, bx0 + off)) : bx0 + off;
      for (let k = 0; k < (cfg.clonks || 3); k++) this.spawnClonk(ti, bx - 12 + k * 10, this.surf[Math.max(0, Math.min(this.W - 1, bx - 12 + k * 10))] - 2);
      team.sel = this.clonks.find(c => c.team === ti).id;
    }
    this._setupEnd();
  }
  // Lobby-Seiten in Reihenfolge ihres ersten Auftretens (eine Basis je Seite)
  sideList(arr) { const L = []; arr.forEach((tc, i) => { const sd = Number.isInteger(tc.side) ? tc.side : i; if (!L.includes(sd)) L.push(sd); }); return L; }
  // Teamkasse: Geld, Forschung und laufendes Projekt gehören der Seite – jedes Mitglied (Mensch/KI) liest und schreibt dieselben Werte
  setupPools(merge) {
    const shared = !!this.cfg.sharedBase, sl = this.sideList(this.teams);
    this.pools = {}; this.baseIdx = [];
    for (const t of this.teams) {
      const sd = this.sideOf(t.id), v = { money: +t.money || 0, res: t.res || {}, rq: t.rq || '', rp: +t.rp || 0 };
      let P = this.pools[sd];
      if (!P) P = this.pools[sd] = { side: sd, lead: t.id, members: [], money: v.money, res: Object.assign({}, v.res), rq: v.rq, rp: v.rp };
      else if (merge) { P.money += v.money; Object.assign(P.res, v.res); if (!P.rq && v.rq) { P.rq = v.rq; P.rp = v.rp; } }
      P.members.push(t.id);
      this.baseIdx[t.id] = shared ? Math.max(0, sl.indexOf(sd)) : t.id;
      for (const k of ['money', 'res', 'rq', 'rp']) Object.defineProperty(t, k, { get() { return P[k]; }, set(x) { P[k] = x; }, enumerable: true, configurable: true });
    }
  }
  poolOf(tid) { return this.pools ? this.pools[this.sideOf(tid)] : null; }
  teamMates(tid) { const P = this.poolOf(tid); return P ? P.members : [tid]; }
  sharedPool(tid) { const P = this.poolOf(tid); return !!(P && P.members.length > 1); }
  msgSide(s, tid) { const M = this.teamMates(tid); for (const id of M) this.msg(s, id); }
  bIdx(tid) { const b = this.baseIdx && this.baseIdx[tid]; return Number.isInteger(b) && b < this.bases.length ? b : Math.min(tid, this.bases.length - 1); }
  baseX(tid) { return this.bases[this.bIdx(tid)]; }
  castleSiteOf(tid) { return this.castleSites && this.castleSites[this.bIdx(tid)]; }
  _setupEnd() {
    const cfg = this.cfg;
    if (cfg.monsters) for (let k = 0; k < (cfg.monsterCount || 2); k++) this.spawnMonster();
    if (cfg.animals !== false && this.spawnFauna) this.spawnFauna();
  }
  addStruct(type, x, y, team, prog) {
    const B = BUILD[type];
    const s = { id: this.id(), type, x, y, team, prog, hp: B.hp, w: B.w, h: B.h, fire: 0 };
    this.structs.push(s); return s;
  }
  spawnClonk(team, x, y) {
    const t = this.teams[team];
    const c = { id: this.id(), team, x, y, vx: 0, vy: 0, dir: 1, act: 'jump', hp: 100, breath: 100, inv: [], gear: [], anim: 0, digA: 0, gold: 0, fightT: 0, cd: 0, tumbleT: 0, deadT: 0, name: t.cname ? (t.cnum++ ? cleanName(t.cname.slice(0, 13) + ' ' + t.cnum, t.cname) : t.cname) : NAMES[(t.nameIdx++) % NAMES.length], aiKeys: { ...NOKEYS }, punch: 0, digIdle: 0, armor: 0, knight: 0, arrows: 0, block: 0, inside: 0, fire: 0, swing: 0, bowT: 0, veh: 0, blockT: 0 };
    while (this.boxHit(c.x, c.y) && c.y > 2) c.y--;
    this.clonks.push(c); return c;
  }
  spawnKnight(team, x, y) {
    const c = this.spawnClonk(team, x, y);
    c.knight = 1; c.armor = 1; c.inv = []; c.gear = ['sword', 'shield', 'bow']; c.arrows = 15;
    return c;
  }
  spawnItem(type, x, y) {
    if (type === 'wipf' && this.spawnAnimal) return this.spawnAnimal('wipf', x, y, true); // Wipfe sind lebendig: Ablegen/Werfen lässt sie frei
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
      const m = { id: this.id(), k: 'boar', x, y: this.surf[x] - 1, vx: 0, vy: 0, dir: this.rand() < 0.5 ? -1 : 1, hp: 40, act: 'walk', anim: 0, cd: 0, think: 0, fire: 0, chg: 0, flee: 0 };
      while (this.boxHit(m.x, m.y) && m.y > 2) m.y--;
      this.monsters.push(m); return m;
    }
  }
  structById(id) { return this.structs.find(s => s.id === id); }
  vehById(id) { return this.vehicles.find(v => v.id === id); }
  hasBase(teamId) { return this.structs.some(s => this.ally(s.team, teamId) && BUILD[s.type].base && s.prog >= 1 && !s.remove); }
  // Bündnisse: Teams mit gleicher Seite (Lobby-Team) sind verbündet – kein Eigenbeschuss, gemeinsame Gebäude
  sideOf(tid) { const t = this.teams[tid]; return t ? (Number.isInteger(t.side) ? t.side : t.id) : -1 - tid; }
  ally(a, b) { return a === b || this.sideOf(a) === this.sideOf(b); }
  sideTitle(id) { const n = this.sideName(id); return /^team\b/i.test(n) ? n : 'Team ' + n; }
  sideName(tid) { const t = this.teams[tid]; if (!t) return ''; const sd = this.cfg.sides && this.cfg.sides[this.sideOf(tid)]; return sd && sd.name ? sd.name : t.name; }
  // Schaden durch einen Verbündeten (anderer Spieler/KI im selben Lobby-Team)?
  friendly(c, src) {
    const k = src && typeof src === 'object' ? src : typeof src === 'number' && src ? this.clonks.find(o => o.id === src) : null;
    return !!(k && k.team !== undefined && k.id !== c.id && k.team !== c.team && this.ally(k.team, c.team));
  }
  friendlyTeam(owner, team) { const k = typeof owner === 'number' && owner ? this.clonks.find(o => o.id === owner) : null; return !!(k && k.team !== team && this.ally(k.team, team)); }

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
    if (a === 'helper') { // KI-Helfer für die eigenen, nicht gesteuerten Buddler: aus / Leicht / Mittel / Schwer
      if (t.ai) return; const on = AI_LEVELS.includes(arg);
      t.helper = on; if (on) t.hdiff = arg; t.brain = null;
      for (const c of this.clonks) if (c.team === teamId) { c.ai = null; c.aiKeys = { ...NOKEYS }; }
      this.msg(on ? 'KI-Helfer: ' + aiDiffName(arg) : 'KI-Helfer aus – nicht gesteuerte Buddler warten.', teamId); return;
    }
    if (a === 'slot' || a === 'slotd') { const c = this.selClonk(t); if (!c) return; if (a === 'slot') { const n = Math.max(0, Math.min(INV_MAX + GEAR_SEL.length - 1, arg | 0)); if (n >= INV_MAX && !hasG(c, GEAR_SEL[n - INV_MAX])) { if (!t.ai) this.msg('Kein ' + ITEMS[GEAR_SEL[n - INV_MAX]].name + ' – im Laden kaufen.', teamId); return; } c.slot = n; } else { const L = selSlots(c), k = L.indexOf(c.slot || 0); c.slot = L[((k < 0 ? 0 : k) + (arg > 0 ? 1 : L.length - 1)) % L.length]; } return; }
    if (a === 'autosell') { if (!Array.isArray(arg) || !SELLABLE.includes(arg[0])) return; if (!t.autoSell) t.autoSell = { ...AUTO_SELL_DEFAULT }; t.autoSell[arg[0]] = arg[1] ? 1 : 0; return; }
    if (a === 'sellone') { const c = this.selClonk(t); if (c) this.sellOne(c, arg); return; }
    if (a === 'cup') { if (this.castleUpgrade) this.castleUpgrade(t, typeof arg === 'number' ? arg : 0); return; }
    if (a === 'cammo') { if (this.castleAmmo) this.castleAmmo(t, arg); return; }
    if (a === 'research') return this.research(t, arg);
    const c = this.selClonk(t); if (!c) return;
    this.clonkAction(c, a, arg);
  }
  clonkAction(c, a, arg) {
    const t = this.teams[c.team];
    const aim = Array.isArray(arg) && arg.length === 2 && isFinite(arg[0]) && isFinite(arg[1]) ? [+arg[0], +arg[1]] : null;
    if (a === 'primary') return this.primary(c, aim);
    if (a === 'interact') a = 'use';
    if (a === 'up') { if (c.act === 'rope' || c.act === 'float') return; a = 'jump'; } // „Hoch“ zieht am Seil, statt loszulassen
    if (c.inside) { // im Gebäude
      if (a === 'use' || a === 'jump') this.leave(c);
      else if (a === 'throw') this.throwItem(c);
      else if (a === 'drop') this.throwItem(c);
      else if (a === 'attack') this.attack(c);
      else if (a === 'sell') this.sell(c);
      else if (a === 'inv') { if (c.inv.length > 1) c.inv.push(c.inv.shift()); }
      return;
    }
    if ((c.act === 'rope' || c.act === 'float') && this.gearAction(c, a, aim)) return;
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
      case 'escape': this.escape(c); break;
    }
  }
  // Hauptaktion (Linksklick / RT): Richtung Zielpunkt werfen, schlagen, schießen, feuern
  primary(c, aim) {
    if (c.act === 'dead') return;
    const it = actItem(c);
    if (c.act === 'push') { const v = this.vehById(c.veh); if (v) { if (VEH[v.type].gun) this.fireGun(v, c); else this.loadLorry(v, c); } return; }
    if (aim && !c.inside && (c.act === 'walk' || c.act === 'fight' || c.act === 'jump' || c.act === 'swim' || c.act === 'dig') && Math.abs(aim[0] - c.x) > 2) c.dir = Math.sign(aim[0] - c.x);
    if (c.act === 'rope' || c.act === 'float') { this.gearAction(c, 'primary', aim); return; }
    if (it === 'hook' && !c.inside) { this.fireHook(c, aim); return; }
    if (it === 'balloon' && !c.inside) { this.inflate(c); return; }
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
    const s0 = this.structs.find(s => this.ally(s.team, c.team) && !s.remove && s.prog >= 1 && Math.abs(c.x - s.x) < Math.min(14, s.w / 2) && c.y > s.y - 10 && c.y < s.y + 5);
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
    const wf = this.nearWipf ? this.nearWipf(c, bd) : null;
    if (wf) { // Wipf fangen und tragen
      if (c.inv.length >= INV_MAX) { if (!this.teams[c.team].ai) this.msg('Inventar voll (3 Plätze)!', c.team); return true; }
      wf.remove = true; c.inv.push('wipf'); this.snd('grab', c.x, c.y); if (!this.teams[c.team].ai) this.msg('Wipf gefangen! (Ablegen lässt ihn frei, an der Hütte verkaufen)', c.team); return true;
    }
    if (!best) return false;
    if (!giveItem(c, best.type)) { if (!this.teams[c.team].ai) this.msg(GEAR.has(best.type) || best.type === 'armor' ? ITEMS[best.type].name + ' hast du schon.' : 'Inventar voll (3 Plätze)!', c.team); return true; }
    best.remove = true; this.snd('grab', c.x, c.y); return true;
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
    return this.structs.find(s => BUILD[s.type].base && this.ally(s.team, tm) && !s.remove && s.prog >= 1 && Math.abs(c.x - s.x) < s.w / 2 + 12 && c.y > s.y - 30 && c.y < s.y + 8);
  }
  nearHut(c, team) { return this.nearBase(c, team); }
  sell(c, only) {
    const t = this.teams[c.team];
    if (!this.nearBase(c)) { this.msg('Zum Verkaufen zur Hütte/Burg gehen!', c.team); this.snd('error', c.x, c.y); return; }
    const v = c.act === 'push' ? this.vehById(c.veh) : null;
    const lor = v && v.type === 'lorry' ? v.inv : [];
    if (!c.inv.length && !lor.length) { this.msg('Nichts zu verkaufen.', c.team); return; }
    // nur gewählte Typen verkaufen (Standard: Wertgegenstände); only = feste Liste (KI)
    const set = t.autoSell || AUTO_SELL_DEFAULT, pick = only ? (ty => only.includes(ty)) : (ty => !!set[ty]);
    const keepC = c.inv.filter(ty => !pick(ty)), keepL = lor.filter(ty => !pick(ty));
    const sold = c.inv.filter(pick).concat(lor.filter(pick));
    if (!sold.length) { if (!t.ai) this.msg('Nichts zum Verkaufen ausgewählt – im Laden unter „Verkaufen“ einstellen.', c.team); return; }
    let sum = 0; for (const ty of sold) sum += ITEMS[ty].sell;
    c.inv = keepC; if (v && v.type === 'lorry') v.inv = keepL;
    if ((c.slot || 0) < INV_MAX && c.slot >= c.inv.length) c.slot = Math.max(0, c.inv.length - 1);
    t.money += sum; if (t.stats) { t.stats.earned += sum; } this.snd('cash', c.x, c.y); this.msg('+' + sum + ' Geld', c.team);
    this.checkGoal();
  }
  // einzelnen Gegenstand verkaufen: Zahl = Inventarplatz, Text = Ausrüstung ('sword', 'shield', 'bow', 'hook', 'armor')
  sellOne(c, what) {
    const t = this.teams[c.team];
    if (!this.nearBase(c)) { this.msg('Zum Verkaufen zur Hütte/Burg gehen!', c.team); this.snd('error', c.x, c.y); return; }
    let ty = null;
    if (typeof what === 'number') { if (what >= 0 && what < c.inv.length) ty = c.inv.splice(what, 1)[0]; }
    else if (what === 'armor') { if (c.armor && !c.knight) { c.armor = 0; ty = 'armor'; } }
    else if (GEAR.has(what) && hasG(c, what)) { c.gear.splice(c.gear.indexOf(what), 1); ty = what; if (actGear(c) === null && c.slot >= INV_MAX) c.slot = 0; }
    if (!ty) return;
    const sum = ITEMS[ty].sell; t.money += sum; if (t.stats) t.stats.earned += sum;
    this.snd('cash', c.x, c.y); this.msg(ITEMS[ty].name + ' verkauft: +' + sum + ' Geld', c.team); this.checkGoal();
  }
  buy(t, what) {
    let bases = this.structs.filter(s => BUILD[s.type].base && s.team === t.id && s.prog >= 1 && !s.remove);
    if (!bases.length) bases = this.structs.filter(s => BUILD[s.type].base && this.ally(s.team, t.id) && s.prog >= 1 && !s.remove); // Basis eines Verbündeten
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
    } else if (sc && this.nearBase(sc) && giveItem(sc, what)) { if (!t.ai && GEAR.has(what)) this.msg(ITEMS[what].name + ' ausgerüstet' + (GEAR_SEL.includes(what) ? ' (Taste ' + (INV_MAX + 1 + GEAR_SEL.indexOf(what)) + ')' : '') + '.', t.id); }
    else { const it = this.spawnItem(what, base.x + (this.rand() * 10 - 5), base.y - 6); it.pickCd = 10; }
    this.snd('uncash', base.x, base.y);
  }
  // Bauplatz vor dem Buddler (gleiche Formel für Spieler, KI und Vorschau)
  sitePos(c, what) { const hw = BUILD[what].w >> 1; return { x: Math.round(c.x + c.dir * (hw + 6)), y: Math.round(c.y) }; }
  // Prüft einen Bauplatz: st = 'ok' (sofort), 'level' (Planieren nötig: Erde/Sand abtragen, Lücken auffüllen), 'no' (unmöglich, why)
  placeCheck(type, x, y) {
    const B = BUILD[type]; if (!B) return { st: 'no', why: 'unbekannt' };
    const hw = B.w >> 1, W = this.W, mat = this.mat;
    if (x - hw < 3 || x + hw > W - 4 || y - B.h < 1 || y + LEVEL_FILL + 2 >= this.H) return { st: 'no', why: 'Kartenrand' };
    if (this.structs.some(s => !s.remove && Math.abs(s.x - x) < (s.w + B.w) / 2 + 4 && Math.abs(s.y - y) < 40)) return { st: 'no', why: 'anderes Gebäude im Weg' };
    let ground = 0, cut = 0, fill = 0, hard = 0, wet = 0, deep = 0, tall = 0;
    for (let xx = x - hw; xx <= x + hw; xx++) {
      if (SOLID[mat[(y + 1) * W + xx]] || SOLID[mat[(y + 2) * W + xx]]) ground++;
      let col = 0;
      for (let yy = y - B.h + 1; yy <= y; yy++) {
        const m = mat[yy * W + xx];
        if (m === MAT.LAVA || (m === MAT.WATER && yy > y - 6)) wet++;
        if (!SOLID[m]) continue;
        if (!DIGGABLE[m]) hard++; else { cut++; col = Math.max(col, y - yy + 1); }
      }
      if (col > LEVEL_CUT) tall++;
      let k = 1; while (k <= LEVEL_FILL && !SOLID[mat[(y + k) * W + xx]]) { if (mat[(y + k) * W + xx] === MAT.LAVA) wet++; k++; }
      if (k > LEVEL_FILL) { deep++; fill += LEVEL_CAP; } else fill += k - 1;
    }
    if (wet) return { st: 'no', why: 'Wasser oder Lava im Weg' };
    if (hard) return { st: 'no', why: 'Fels/Granit im Weg – erst sprengen' };
    if (cut === 0 && ground >= B.w * 0.8) return { st: 'ok', cut: 0, fill: 0, cost: 0 };
    if (tall) return { st: 'no', why: 'Hang zu steil (zu viel Erde)' };
    if (deep > B.w * 0.3) return { st: 'no', why: 'kein Boden darunter' };
    const n = cut + fill;
    return { st: 'level', cut, fill, cost: Math.ceil(n / LEVEL_PX_PER_COIN) };
  }
  // Planieren als erste Bauphase: pro Arbeitsschritt einige Pixel abtragen (oben zuerst) bzw. auffüllen (von unten)
  levelStep(s, n) {
    const B = BUILD[s.type], hw = B.w >> 1, W = this.W, mat = this.mat, y = s.y;
    let done = 0, any = false;
    for (let xx = s.x - hw; xx <= s.x + hw && done < n; xx++) {
      for (let yy = y - B.h + 1; yy <= y && done < n; yy++) {
        const m = mat[yy * W + xx]; if (!SOLID[m]) continue;
        any = true; if (!DIGGABLE[m]) continue;
        if (m === MAT.GOLD) { s.lvG = (s.lvG || 0) + 1; if (s.lvG >= 36) { s.lvG = 0; const it = this.spawnItem('gold', xx, y - 4); it.pickCd = 20; } }
        const open = yy <= 0 || mat[(yy - 1) * W + xx] === MAT.SKY;
        this.setMat(xx, yy, open ? MAT.SKY : this.bg(xx, yy));
        if (open && yy >= this.surf[xx]) this.surf[xx] = yy + 1;
        done++;
      }
      // Lücken darunter: tiefste leere Zelle über festem Grund zuerst füllen (bei Schacht nur eine Kappe)
      let k = 1; while (k <= LEVEL_FILL && !SOLID[mat[(y + k) * W + xx]]) k++;
      const from = k > LEVEL_FILL ? LEVEL_CAP : k - 1;
      for (let j = from; j >= 1 && done < n; j--) { if (SOLID[mat[(y + j) * W + xx]]) continue; this.setMat(xx, y + j, MAT.EARTH); any = true; done++; }
    }
    s.lvD += done;
    if (!any || done === 0) { s.lv = 0; this.msg('Boden für ' + B.name + ' planiert – jetzt wird gebaut.', s.team); this.snd('build', s.x, s.y); }
  }
  build(c, what, at) {
    const t = this.teams[c.team];
    if (c.act !== 'walk') { this.msg('Zum Bauen auf festem Boden stehen.', c.team); return; }
    if (BUILD[what]) {
      const B = BUILD[what];
      if (B.res && !t.res[B.res]) { this.msg('Erst erforschen: ' + RES_BY[B.res].name, c.team); this.snd('error', c.x, c.y); return; }
      if (t.money < B.price) { this.msg('Nicht genug Geld (' + B.price + ')!', c.team); this.snd('error', c.x, c.y); return; }
      let { x, y } = this.sitePos(c, what);
      if (at && Math.abs(at.x - x) <= 4 && Math.abs(at.y - y) <= 2) { x = at.x; y = at.y; } // KI: exakt geplanter Platz
      const pc = this.placeCheck(what, x, y);
      if (pc.st === 'no') { this.msg('Hier kann nicht gebaut werden: ' + pc.why + '.', c.team); this.snd('error', c.x, c.y); return; }
      const total = B.price + (pc.cost || 0);
      if (t.money < total) { this.msg('Nicht genug Geld (' + B.price + (pc.cost ? ' + ' + pc.cost + ' Planieren' : '') + ')!', c.team); this.snd('error', c.x, c.y); return; }
      t.money -= total;
      const s = this.addStruct(what, x, y, c.team, 0);
      if (pc.st === 'level') { s.lv = 1; s.lvN = pc.cut + pc.fill; s.lvD = 0; if (t.stats) t.stats.leveled = (t.stats.leveled || 0) + 1; }
      this.msg('Baustelle errichtet: ' + B.name + (pc.st === 'level' ? ' – der Boden wird zuerst planiert' : '') + '. Buddler in der Nähe bauen sie auf.', c.team); this.snd('click', x, y);
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
    if (c.act === 'dead' || c.inside) return;
    const g = actGear(c);
    if (g) { c.gear.splice(c.gear.indexOf(g), 1); c.slot = 0; const it = this.spawnItem(g, c.x, c.y - 4); it.pickCd = 80; this.snd('drop', c.x, c.y); return; }
    if (!c.inv.length) return;
    if (c.inv[actIdx(c)] === 'earth' && this.placeEarth) { if (this.placeEarth(c)) return; }
    const type = c.inv.splice(actIdx(c), 1)[0];
    const it = this.spawnItem(type, c.x, c.y - 4); it.pickCd = 80;
    if (type === 'tnt') { it.fuse = 150; this.snd('fuse', c.x, c.y); }
  }
  // Schild: blockt, wenn Träger blockt (oder zufällig im Nahkampf) und zum Angreifer schaut
  blocks(target, fromDir, auto) {
    if (!target.inv || !hasG(target, 'shield') || target.act === 'dead' || target.act === 'tumble') return false;
    if (target.dir !== -fromDir) return false;
    return !!target.block || (auto && this.rand() < 0.3);
  }
  attack(c, melee) {
    if (c.act === 'dead' || c.cd > 0) return;
    const hasSword = hasG(c, 'sword'), hasBow = hasG(c, 'bow') && c.arrows > 0;
    if (c.inside) { if (hasBow) this.shoot(c); else if (c.inv.length) this.throwItem(c); return; }
    if (c.act === 'push' || c.act === 'climb' || c.act === 'hangle') return;
    const foe = this.clonks.find(o => !this.ally(o.team, c.team) && o.act !== 'dead' && !o.inside && Math.abs(o.x - c.x) < 16 && Math.abs(o.y - c.y) < 10 && Math.sign(o.x - c.x) === c.dir)
      || this.monsters.find(o => Math.abs(o.x - c.x) < 16 && Math.abs(o.y - c.y) < 10 && Math.sign(o.x - c.x) === c.dir);
    if (melee) { if (hasSword) this.swingSword(c); else this.strike(c); return; }
    if (hasSword && (foe || !hasBow)) this.swingSword(c);
    else if (hasBow) this.shoot(c);
    else this.strike(c);
  }
  swingSword(c) {
    c.cd = 28; c.swing = 12; this.snd('swing', c.x, c.y);
    const foe = this.clonks.find(o => !this.ally(o.team, c.team) && o.act !== 'dead' && !o.inside && Math.abs(o.x - c.x) < 15 && Math.abs(o.y - c.y) < 10 && Math.sign(o.x - c.x) === c.dir);
    if (foe) {
      if (this.blocks(foe, c.dir)) { this.snd('shield', foe.x, foe.y); foe.blockT = 10; this.walkStep(c, -c.dir * 2); }
      else { this.hurt(foe, 12 + this.rand() * 5, c); this.snd('metalhit', foe.x, foe.y); if (foe.act !== 'dead' && this.rand() < 0.35) this.fling(foe, c.dir * 1.6, -1.4); }
    }
    for (const m of this.monsters) if (Math.abs(m.x - c.x) < 15 && Math.abs(m.y - c.y) < 10 && Math.sign(m.x - c.x) === c.dir) { m.hp -= 18; m.prov = c.id; m.vx = c.dir * 1.6; m.vy = -1.2; m.act = 'jump'; this.snd('hitliving', m.x, m.y); }
    if (this.faunaMelee) this.faunaMelee(c, 15, 18);
    for (const v of this.vehicles) if (!this.ally(v.team, c.team) && Math.abs(v.x - c.x) < 14 && Math.abs(v.y - c.y) < 10) v.hp -= 6;
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
    const foe = this.clonks.find(o => !this.ally(o.team, c.team) && o.act !== 'dead' && !o.inside && Math.abs(o.x - c.x) < 11 && Math.abs(o.y - c.y) < 9 && Math.sign(o.x - c.x) === c.dir);
    c.punch = 10; c.cd = 50;
    if (foe) {
      if (this.blocks(foe, c.dir)) { this.snd('shield', foe.x, foe.y); foe.blockT = 10; }
      else { this.hurt(foe, 8, c); if (foe.act !== 'dead') this.fling(foe, c.dir * 2.2, -1.8); this.snd('punch', c.x, c.y); }
    }
    if (this.faunaMelee) this.faunaMelee(c, 12, 10);
    const mo = this.monsters.find(o => Math.abs(o.x - c.x) < 12 && Math.abs(o.y - c.y) < 10);
    if (mo) { mo.hp -= 10; mo.prov = c.id; mo.vx = c.dir * 2; mo.vy = -1.5; mo.act = 'jump'; this.snd('punch', c.x, c.y); }
  }
  fling(c, vx, vy) { if (c.act === 'dead' || c.inside) return; if (c.act === 'push') this.release(c); if (c.hk) c.hk = null; c.act = 'tumble'; c.vx = vx; c.vy = vy; c.tumbleT = 0; c.block = 0; }
  hurt(c, dmg, src) {
    if (c.act === 'dead' || dmg <= 0 || c.inside) return;
    if (src !== 'fire' && src && this.friendly(c, src)) return; // kein Schaden durch Verbündete
    const cont = src === 'fire'; // Dauerschaden (Brennen, Lava, Ertrinken) zählt nicht als Treffer
    if (!cont && c.invT > 0) return;
    if (c.armor && src !== 'fire') dmg *= 0.6;
    { const hk = typeof src === 'number' ? src : src && typeof src === 'object' && src.team !== undefined ? src.id : 0; if (hk && !cont) c.hitBy = { id: hk, t: this.tick }; } // KI-Verteidigung: wer greift an?
    c.hp -= dmg;
    if (!cont && dmg >= 3 && c.hp > 0) c.invT = INV_TICKS;
    if (c.hp <= 0) { this.creditKill(c, src); this.kill(c); return; }
    if (dmg >= 3 && (c.hurtSnd || 0) < this.tick) { this.snd('hurt', c.x, c.y); c.hurtSnd = this.tick + 25; }
  }
  creditKill(c, src) {
    let k = null; if (src && typeof src === 'object') k = src; else if (typeof src === 'number') k = this.clonks.find(o => o.id === src);
    if (k && !this.ally(k.team, c.team) && this.teams[k.team] && this.teams[k.team].stats) this.teams[k.team].stats.kills++;
    if (this.teams[c.team].stats) this.teams[c.team].stats.deaths++;
  }
  kill(c) {
    if (c.act === 'push') this.release(c);
    c.hp = 0; c.act = 'dead'; c.deadT = 0; c.vx = 0; c.fire = 0; c.block = 0; c.hk = null; c.bl = null; c.invT = 0;
    for (const ty of c.inv.concat(c.gear || [])) { const it = this.spawnItem(ty, c.x, c.y - 5); it.vx = (this.rand() - 0.5) * 1.5; it.vy = -1.5; it.pickCd = 30; }
    c.inv = []; c.gear = [];
    this.snd('die', c.x, c.y);
    this.msg(c.name + ' (' + this.teams[c.team].name + ') ist gestorben.');
    const t = this.teams[c.team];
    if (t.sel === c.id) {
      // Steuerung geht an den besten verbliebenen eigenen Buddler (gesund und nah), die übrigen bleiben KI-Helfer
      let n = null, bs = -1e9;
      for (const o of this.clonks) if (o.team === c.team && o.act !== 'dead') { const s = o.hp - Math.hypot(o.x - c.x, o.y - c.y) * 0.15 + (o.knight ? 10 : 0); if (s > bs) { bs = s; n = o; } }
      t.sel = n ? n.id : -1;
      if (n) { if (n.ai && this.aiForget) this.aiForget(n); n.aiKeys = { ...NOKEYS }; if (!t.ai) { this.msg('Du steuerst jetzt ' + n.name + '.', c.team); this.ev({ e: 'takeover', team: c.team, id: n.id }); } }
    }
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
    const left = this.teams.filter(t => !t.elim), sides = new Set(left.map(t => this.sideOf(t.id)));
    if (sides.size <= 1) { this.state = 'over'; this.winner = left.length ? left[0].id : -1; this.snd('fanfare', 0, 0); if (left.length > 1) this.msg(this.sideTitle(left[0].id) + ' gewinnt!'); }
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
      if (d < R && !(owner && this.friendly(c, owner))) { const f = 1 - d / R; this.hurt(c, f * r * 2.6, owner); if (c.act !== 'dead') { this.fling(c, dx / d * f * 3.5, -2.5 * f - 0.6); if (d < R * 0.6 && this.rand() < 0.45) c.fire = Math.max(c.fire, 150); } }
    }
    for (const m of this.monsters) {
      const dx = m.x - x, dy = m.y - 5 - y, d = Math.hypot(dx, dy) || 1;
      if (d < R) { const f = 1 - d / R; m.hp -= f * r * 2.6; if (typeof owner === 'number') m.prov = owner; m.vx = dx / d * f * 3; m.vy = -2 * f; m.act = 'jump'; if (d < R * 0.6) m.fire = 150; }
    }
    for (const it of this.items) {
      const dx = it.x - x, dy = it.y - y, d = Math.hypot(dx, dy) || 1;
      if (d < R) {
        if ((it.type === 'flint' || it.type === 'superflint') && !it.remove && !it.chain) it.chain = 6 + (this.rand() * 6 | 0);
        else if (it.type === 'tnt' && (it.fuse === 0 || it.fuse > 10)) it.fuse = 8;
        it.stuck = false; const f = 1 - d / R; it.vx += dx / d * f * 3; it.vy += dy / d * f * 3 - 1;
      }
    }
    if (this.faunaBlast) this.faunaBlast(x, y, r, R);
    for (const v of this.vehicles) {
      const dx = v.x - x, dy = v.y - 4 - y, d = Math.hypot(dx, dy) || 1;
      if (d < R + 4 && !this.friendlyTeam(owner, v.team)) { const f = 1 - d / (R + 4); v.hp -= f * r * 2.2; v.vx += dx / d * f * 2; v.vy = -f * 2; if (VEH[v.type].wood && this.rand() < 0.5) v.fire = 400; }
    }
    for (const s of this.structs) {
      if (Math.abs(s.x - x) < r + s.w / 2 && y > s.y - s.h - r && y < s.y + r && !this.friendlyTeam(owner, s.team)) {
        s.hp -= r * 1.5; if (typeof owner === 'number' && owner) s.hitBy = { id: owner, t: this.tick }; if (BUILD[s.type].wood && this.rand() < 0.6) s.fire = Math.max(s.fire, 500);
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
    for (const t of this.teams) if ((t.ai || t.helper) && !t.elim) this.aiTeam(t);
    if (this.rescueTick) this.rescueTick();
    for (const c of this.clonks) this.updClonk(c);
    for (const v of this.vehicles) this.updVehicle(v);
    for (const it of this.items) this.updItem(it);
    for (const m of this.monsters) this.updMonster(m);
    if (this.updFauna) this.updFauna();
    if (this.castleTick) this.castleTick();
    for (const s of this.structs) if (s.prog < 1) {
      const B = BUILD[s.type];
      const builders = this.clonks.filter(c => this.ally(c.team, s.team) && (c.act === 'walk' || (s.lv && c.act === 'dig')) && !c.inside && Math.abs(c.x - s.x) < s.w / 2 + (s.lv ? 14 : 8) && Math.abs(c.y - s.y) < (s.lv ? 30 : 12)).length;
      if (builders && s.lv) { if (this.tick % 2 === 0) this.levelStep(s, Math.min(3, builders) * LEVEL_RATE); if (this.tick % 40 === 0) this.snd('dig', s.x, s.y); continue; }
      if (builders) { s.prog = Math.min(1, s.prog + Math.min(3, builders) / B.time); if (s.prog >= 1) { this.snd('build', s.x, s.y); this.msg(B.name + ' fertig gebaut!', s.team); const st = this.teams[s.team].stats; if (st) { st.built++; st.builtList.push(s.type); } } }
    }
    // Forschung
    const rdone = new Set(); // Teamkasse: jedes Forschungsprojekt läuft einmal je Seite
    for (const t of this.teams) if (t.rq) {
      const P = this.poolOf(t.id); if (P) { if (rdone.has(P)) continue; rdone.add(P); }
      if (!this.hasBase(t.id)) continue;
      const r = RES_BY[t.rq]; t.rp += 1 / (r.time * 60);
      if (t.rp >= 1) { t.res[t.rq] = 1; if (t.stats) t.stats.research++; this.msgSide('Forschung abgeschlossen: ' + r.name + '!', t.id); for (const id of this.teamMates(t.id)) this.ev({ e: 'snd', n: 'ding', x: 0, y: 0, team: id }); t.rq = ''; t.rp = 0; }
    }
    this.clonks = this.clonks.filter(c => !c.remove);
    this.items = this.items.filter(i => !i.remove);
    this.monsters = this.monsters.filter(m => !m.remove);
    this.vehicles = this.vehicles.filter(v => !v.remove);
    if (this.structs.some(s => s.remove)) { this.structs = this.structs.filter(s => !s.remove); this.checkEnd(); }
    if (this.cfg.monsters && this.tick % 3600 === 0 && this.monsters.length < (this.cfg.monsterCount || 2)) this.spawnMonster(); // Wildschweine: langsam nachwachsend, keine Nacht-Extras
    if (this.tick % 120 === 0) for (const t of this.teams) if (t.ai && !t.elim && (AI_DIFF[t.diff] || {}).bonus) { t.money += 1; t.stats.bonus++; } // dokumentierter kleiner Bonus nur für „Schwer“
    for (const t of this.teams) if (t.sel === -1 || !this.selClonk(t)) { const n = this.clonks.find(o => o.team === t.id && o.act !== 'dead'); t.sel = n ? n.id : -1; }
    if (this.tick % 60 === 0) this.checkEnd();
  }

  simMaterials() {
    const cur = this.activeNext; this.activeNext = this.active; this.activeNext.fill(0); this.active = cur;
    const W = this.W, H = this.H, mat = this.mat, R = this.rand, st = (this.tick & 0xffff) || 1, stamp = this.stamp, an = this.activeNext;
    const EMPTY = m => m === MAT.SKY || m === MAT.TUNNEL;
    // Budget für große Karten: bei sehr vielen aktiven Chunks pro Tick nur eine rotierende Teilmenge rechnen (Rest bleibt aktiv)
    let nAct = 0; for (let k = 0; k < cur.length; k++) nAct += cur[k];
    const every = nAct > SIM_CHUNK_BUDGET ? Math.ceil(nAct / SIM_CHUNK_BUDGET) : 1, phase = this.tick % every;
    for (let cy = this.chh - 1; cy >= 0; cy--) for (let cx = 0; cx < this.cw; cx++) {
      const ci = cy * this.cw + cx;
      if (!cur[ci]) continue;
      if (every > 1 && (ci % every) !== phase) { an[ci] = 1; continue; }
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
            // nur aktiv halten, wenn die Flüssigkeitsregeln unten wirklich eine Bewegung erlauben (sonst bleibt der Chunk ewig aktiv)
            const restL = b === m && (y === 0 || mat[i - W] !== m);
            const canFall = EMPTY(b) || (x > 0 && EMPTY(mat[i + W - 1]) && !SOLID[mat[i - 1]] && mat[i - 1] !== MAT.WATER) || (x < W - 1 && EMPTY(mat[i + W + 1]) && !SOLID[mat[i + 1]] && mat[i + 1] !== MAT.WATER) || (!restL && ((x > 0 && EMPTY(mat[i - 1])) || (x < W - 1 && EMPTY(mat[i + 1]))));
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
          // Film/Tropfen direkt auf festem Boden wandert sonst endlos hin und her (Chunk bleibt aktiv): langsam verdunsten bzw. erstarren
          if (SOLID[b] && (y === 0 || mat[i - W] !== L) && mat[i - 1] !== L && mat[i + 1] !== L && R() < 0.02) { this.setMat(x, y, L === MAT.LAVA ? MAT.ROCK : this.bg(x, y)); continue; }
          if (SOLID[b] && (y === 0 || mat[i - W] !== L) && R() < 0.0015) { this.setMat(x, y, L === MAT.LAVA ? MAT.ROCK : this.bg(x, y)); continue; }
          for (const dd of [d, -d]) {
            const nx = x + dd; if (nx < 0 || nx >= W) continue;
            const s2 = mat[i + dd];
            if (EMPTY(s2) && (y === 0 || mat[i - W] !== L || !SOLID[mat[i + dd - W]])) { this.setMat(x, y, this.bg(x, y)); this.setMat(nx, y, L); stamp[i + dd] = st; break; } // eingeschlossene Luftblase unter Fels nicht endlos verschieben
          }
        }
      }
    }
  }

  keysFor(c) {
    const t = this.teams[c.team];
    if (t.ai || c.ai) return c.aiKeys;
    if (t.sel === c.id) return t.keys;
    return t.helper ? c.aiKeys : NOKEYS;
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
          if (control && Math.sign(c.vx) === c.dir && c.vy > -2.2 && !this.boxHit(c.x, c.y + 2) && this.wallSupport(c.x, c.y, c.dir) >= 3) {
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
    if (c.cd > 0) c.cd--; if (c.punch > 0) c.punch--; if (c.swing > 0) c.swing--; if (c.bowT > 0) c.bowT--; if (c.blockT > 0) c.blockT--; if (c.invT > 0) c.invT--;
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
    if (c.hk || c.bl || c.act === 'rope' || c.act === 'float') { this.updGear(c, k, inWater, inLava); if (c.act === 'rope' || c.act === 'float') return; }
    const hasShield = hasG(c, 'shield');
    const secBlock = k.g && hasShield && !c.ai && actGear(c) === 'sword'; // Rechtsklick blockt nur mit gewähltem Schwert (sonst graben)
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
          const foe = this.clonks.find(o => !this.ally(o.team, c.team) && o.act !== 'dead' && !o.inside && (o.act === 'walk' || o.act === 'fight' || o.act === 'dig') && Math.abs(o.x - (c.x + mv * 6)) < 3 && Math.abs(o.y - c.y) < 6);
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
        if (this.wallSupport(c.x, c.y, c.dir) < 2) { c.act = 'jump'; c.vy = 0; c.vx = 0; break; } // nur ein loses Pixel: loslassen
        if (!this.boxHit(c.x + c.dir, c.y)) {
          // Wand weicht leicht zurück (unebene Schachtwand): nachrutschen statt abzufallen
          let snap = 0; for (let d = 2; d <= 3; d++) if (this.boxHit(c.x + c.dir * d, c.y)) { snap = d - 1; break; }
          if (snap) c.x += c.dir * snap; else { c.act = 'jump'; c.vy = 0; c.vx = 0; break; }
        }
        if (k.u) {
          // kleine Wandbeule über dem Kopf: 1–2 px von der Wand weg ausweichen
          if (this.boxHit(c.x, c.y - 0.6)) for (const d of [1, 2]) { const nx = c.x - c.dir * d; if (!this.boxHit(nx, c.y - 0.6) && !this.boxHit(nx, c.y)) { c.x = nx; break; } }
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
        const sword = hasG(c, 'sword');
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
      const tst = this.teams[c.team].stats; if (tst) tst.gold++;
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
        if (!giveItem(c, it.type)) continue;
        it.remove = true; this.snd('grab', c.x, c.y);
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
        if (it.armed && it.type === 'earth' && this.splatEarth && this.splatEarth(it)) return;
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
      if (this.gearHit && this.gearHit(it)) return;
      if (this.faunaHit && this.faunaHit(it, sp)) return;
      if (it.remove) return;
      for (const m of this.monsters) {
        if (Math.abs(it.x - m.x) <= 5 && it.y >= m.y - 11 && it.y <= m.y + 1) {
          if (it.type === 'flint' || it.type === 'superflint') { it.remove = true; this.explode(it.x, it.y, ITEMS[it.type].blast, it.owner); return; }
          if (isArrow) { m.hp -= 16; m.prov = it.owner; this.snd('hitliving', m.x, m.y); it.remove = true; return; }
          m.hp -= (ITEMS[it.type].dmg || 5) * sp / 2; m.prov = it.owner; it.vx *= -0.3; it.armed = false; this.snd('hitliving', m.x, m.y);
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
          if (isArrow) { it.remove = true; s.hp -= 1; if (it.owner) s.hitBy = { id: it.owner, t: this.tick }; return; }
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
    // Hangabtrieb: ungeschoben auf steilem Hang langsam zurückrollen
    if (ground && !inWater) { const sl = this.vSlope(v); if (Math.abs(sl) > 0.75) { v.vx += Math.sign(sl) * 0.035; v.vx = Math.max(-0.45, Math.min(0.45, v.vx)); if (pc && Math.sign(v.vx) !== Math.sign(sl)) {} } }
    if (Math.abs(v.vx) < 0.02) v.vx = 0;
    if (v.vx) {
      const nx = Math.max(d.w / 2 + 1, Math.min(this.W - d.w / 2 - 1, v.x + v.vx)), f = this.vFit(v, nx, v.y);
      if (!f) { v.vx = 0; v.blockT = (v.blockT || 0) + 1; }
      else if (f.steep && Math.sign(v.vx) === -Math.sign(f.slope) && pc) { v.vx = Math.sign(f.slope) * 0.15; v.blockT = (v.blockT || 0) + 1; } // zu steil: rutscht sanft zurück
      else { v.x = nx; if (f.ground && (ground || f.y < v.y)) v.y = f.y; v.blockT = 0; }
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
    if (this.vHit(v, v.x, v.y)) { let up = 0; while (up < VSTEP + 2 && this.vHit(v, v.x, v.y - up)) up++; if (!this.vHit(v, v.x, v.y - up)) v.y -= up; } // nie im Boden stecken
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
  // Rad-Bodenfolger: Ruhehöhe an drei Spalten (Räder + Mitte); Stufen bis VSTEP px werden erklommen
  vRest(xx, y) {
    const r0 = Math.round(y) - VSTEP;
    if (this.solid(xx, r0)) return null; // Wand höher als eine Stufe
    let r = r0; const lim = Math.round(y) + 4;
    while (r < lim && !this.solid(xx, r + 1)) r++;
    return this.solid(xx, r + 1) ? r : Infinity;
  }
  vFit(v, nx, y) {
    const d = VEH[v.type], hw = (d.w >> 1) - 2, xi = Math.round(nx), hb = d.w >> 1;
    let Y = Infinity; const rs = [];
    for (let xx = xi - hb; xx <= xi + hb; xx++) { const r = this.vRest(xx, y); if (r === null) return null; if (r < Y) Y = r; if (xx === xi - hw || xx === xi + hw) rs.push(r); }
    rs.splice(1, 0, 0);
    const ground = Y !== Infinity; if (!ground) Y = Math.round(y);
    for (let xx = xi - (d.w >> 1); xx <= xi + (d.w >> 1); xx += 2) if (this.solid(xx, Y) || this.solid(xx, Y - (d.h >> 1)) || this.solid(xx, Y - d.h + 1)) return null; // Aufbau passt nicht
    const L = rs[0] === Infinity ? Y + 4 : rs[0], Rr = rs[2] === Infinity ? Y + 4 : rs[2], slope = (L - Rr) / (2 * hw); // >0: rechts höher … Abtrieb nach links
    return { y: Y, ground, slope: -slope, steep: Math.abs(slope) > 1.25 };
  }
  // Neigung (Bodenwinkel) für Darstellung und Hangabtrieb; positiv = rechts tiefer
  vSlope(v) {
    const d = VEH[v.type], hw = (d.w >> 1) - 2, xi = Math.round(v.x);
    const a = this.vRest(xi - hw, v.y), b = this.vRest(xi + hw, v.y);
    const L = a === null ? v.y - VSTEP : a === Infinity ? v.y + 4 : a, Rr = b === null ? v.y - VSTEP : b === Infinity ? v.y + 4 : b;
    return (Rr - L) / (2 * hw);
  }
  vHit(v, x, y) {
    const d = VEH[v.type], hw = d.w >> 1, xi = Math.round(x), yi = Math.round(y);
    for (let xx = xi - hw; xx <= xi + hw; xx += 2) if (this.solid(xx, yi) || this.solid(xx, yi - (d.h >> 1)) || this.solid(xx, yi - d.h + 1)) return true;
    return false;
  }
  // Wildschwein (ersetzt das frühere Monster): grast und wandert; wird es angegriffen oder in die Enge getrieben,
  // stürmt es höchstens zweimal auf den Angreifer los und flieht dann – es verfolgt niemanden dauerhaft.
  updMonster(m) {
    if (m.hp <= 0) {
      m.remove = true; this.snd('hitliving', m.x, m.y);
      const n = 1 + (this.rand() < 0.5 ? 1 : 0); for (let k = 0; k < n; k++) { const it = this.spawnItem('gold', m.x + k * 3, m.y - 5); it.vy = -2; it.vx = (this.rand() - 0.5); }
      const kt = this.clonks.find(c => c.id === m.prov); this.msg('Wildschwein erlegt! Es ließ Gold fallen.', kt ? kt.team : undefined); return;
    }
    if (m.cd > 0) m.cd--;
    if (m.y > this.H + 10) { m.remove = true; return; }
    const here = this.matAt(m.x, m.y - 3);
    if (here === MAT.LAVA) { m.hp -= 1; m.fire = 200; }
    if (m.fire > 0) { m.fire--; m.hp -= 0.15; if (here === MAT.WATER) m.fire = 0; if (this.tick % 25 === m.id % 25) this.ignitePoint(m.x, m.y); }
    if (m.fire > 0 && !m.flee) { m.flee = 180; m.chg = 0; }
    // Treffer erkennen (Nahkampf setzt m.prov, Pfeile/Explosionen: nächster Buddler gilt als Angreifer)
    if (m.lastHp === undefined) m.lastHp = m.hp;
    if (m.hp < m.lastHp - 0.5 && !m.flee) {
      let foe = this.clonks.find(c => c.id === m.prov && c.act !== 'dead');
      if (!foe) { let bd = 160; for (const c of this.clonks) { if (c.act === 'dead' || c.inside) continue; const d = Math.hypot(c.x - m.x, c.y - m.y); if (d < bd) { bd = d; foe = c; } } }
      if (foe && !m.chg && (m.charges === undefined || m.charges > 0) && this.rand() < 0.8) { m.chg = 150; m.foe = foe.id; m.charges = m.charges === undefined ? 2 : m.charges; this.snd('growl', m.x, m.y); }
      else { m.flee = 240; m.chg = 0; if (foe) m.dir = Math.sign(m.x - foe.x) || m.dir; }
    }
    m.lastHp = m.hp;
    // in die Enge getrieben: ein Buddler steht lange direkt davor
    let near = null; for (const c of this.clonks) { if (c.act === 'dead' || c.inside) continue; if (Math.abs(c.x - m.x) < 10 && Math.abs(c.y - m.y) < 9) { near = c; break; } }
    m.crowd = near ? (m.crowd || 0) + 1 : 0;
    if (m.crowd > 150 && !m.chg && !m.flee) { m.crowd = 0; if (m.charges === undefined || m.charges > 0) { m.chg = 90; m.foe = near.id; if (m.charges === undefined) m.charges = 2; this.snd('growl', m.x, m.y); } else m.flee = 200; }
    m.think--;
    let sp;
    const foe = m.chg ? this.clonks.find(c => c.id === m.foe && c.act !== 'dead' && !c.inside) : null;
    if (m.chg && !foe) { m.chg = 0; m.flee = 120; }
    if (m.chg) {
      m.chg--; m.dir = Math.sign(foe.x - m.x) || m.dir; sp = 1.35;
      if (m.cd === 0 && Math.abs(foe.x - m.x) < 9 && Math.abs(foe.y - m.y) < 9) { // Treffer mit den Hauern
        m.cd = 50; m.charges = Math.max(0, (m.charges || 1) - 1);
        if (this.blocks(foe, m.dir)) { this.snd('shield', foe.x, foe.y); foe.blockT = 10; }
        else { this.hurt(foe, 8, null); foe.aHit = { t: this.tick, k: 'boar', id: m.id }; this.snd('hitliving', foe.x, foe.y); if (foe.act !== 'dead') this.fling(foe, m.dir * 1.8, -1.6); }
        m.chg = 0; if (m.charges <= 0) { m.flee = 300; m.dir = -m.dir; } else { m.flee = 45; m.dir = -m.dir; } // zurückweichen, ggf. erneut anlaufen
        if (m.charges > 0) m.rech = 60;
      }
      if (m.chg === 0 && !m.flee) m.flee = 200;
    } else if (m.flee > 0) {
      m.flee--; sp = 1.0;
      if (m.flee === 0 && m.rech > 0 && (m.charges || 0) > 0) { const f2 = this.clonks.find(c => c.id === m.foe && c.act !== 'dead' && !c.inside && Math.abs(c.x - m.x) < 80); if (f2) m.chg = 120; m.rech = 0; }
      if (m.flee === 0 && !m.chg) { m.charges = undefined; m.foe = 0; m.prov = 0; }
    } else {
      sp = 0.25; // gemütliches Grasen
      if (m.think <= 0) { m.think = 90 + this.rand() * 220 | 0; m.graze = this.rand() < 0.45; if (this.rand() < 0.4) m.dir = -m.dir; }
      if (m.graze) sp = 0;
      for (const c of this.clonks) if (c.act !== 'dead' && !c.inside && Math.abs(c.x - m.x) < 24 && Math.abs(c.y - m.y) < 12 && (c.punch > 0 || c.swing > 0)) { m.flee = 120; m.dir = Math.sign(m.x - c.x) || m.dir; break; } // erschreckt sich
      if (Math.abs(m.x - this.bases.reduce((b, x) => Math.abs(x - m.x) < Math.abs(b - m.x) ? x : b, -9999)) < 90 && m.think > 30) { m.dir = Math.sign(m.x - this.bases.reduce((b, x) => Math.abs(x - m.x) < Math.abs(b - m.x) ? x : b, -9999)) || m.dir; } // meidet Siedlungen
    }
    const inWater = this.matAt(m.x, m.y - 4) === MAT.WATER;
    if (m.act === 'walk') {
      const v = sp * (inWater ? 0.5 : 1);
      if (v && !this.walkStep(m, m.dir * v)) { if (m.chg || m.flee || this.rand() < 0.5) { m.act = 'jump'; m.vy = -2.1; m.vx = m.dir * 0.6; } if (this.rand() < 0.4) m.dir = -m.dir; }
      m.anim += v ? 0.12 + v * 0.1 : 0.03;
      if (!this.boxHit(m.x, m.y + 1)) { let d = 0; while (d < 4 && !this.boxHit(m.x, m.y + d + 1)) d++; if (d < 4) m.y += d; else { m.act = 'jump'; m.vy = 0; m.vx = m.dir * 0.4; } }
      if (inWater && !this.boxHit(m.x, m.y - 0.5)) m.y -= 0.5;
    } else {
      m.vy = Math.min(m.vy + (inWater ? 0.03 : 0.11), inWater ? 0.6 : 4.5);
      if (!this.boxHit(m.x + m.vx, m.y)) m.x += m.vx; else m.vx = 0;
      if (!this.boxHit(m.x, m.y + m.vy)) m.y += m.vy; else { if (m.vy > 0) { m.act = 'walk'; m.y = Math.round(m.y); } m.vy = 0; }
      if (inWater) m.act = 'walk';
    }
    m.bite = m.chg > 0 ? 1 : 0; m.wind = m.flee > 0 ? 1 : 0; // für Schnappschuss/Darstellung
  }

  // ---------- KI: siehe js/ai.js ----------

  // ---------- Netzwerk ----------
  snap() {
    const r1 = v => Math.round(v * 10) / 10;
    const fl = [];
    for (const f of this.fires) fl.push(f.x, f.y, f.k);
    return {
      c: this.clonks.map(c => [c.id, c.team, r1(c.x), r1(c.y), c.dir, ACTS.indexOf(c.act), Math.ceil(c.hp), r1(c.anim), invEnc(c.inv), Math.round(c.breath), c.name, c.punch, r1(c.digA),
        (c.armor ? 1 : 0) | (c.knight ? 2 : 0) | (c.block ? 4 : 0) | (c.bowT > 0 ? 8 : 0) | (c.fire > 0 ? 16 : 0) | (c.blockT > 0 ? 32 : 0) | (c.invT > 0 ? 64 : 0), c.arrows, c.inside, c.swing, c.veh, c.slot || 0,
        c.hk ? c.hk.st : 0, c.hk ? r1(c.hk.x) : 0, c.hk ? r1(c.hk.y) : 0, c.bl ? (c.bl.gas > 0 ? 1 : 2) : 0, (c.escCd || 0) > this.tick ? Math.ceil((c.escCd - this.tick) / 60) : 0, c.help ? (this.rescuerOf && this.rescuerOf(c) ? 2 : 1) : 0, invEnc(c.gear || [])]),
      i: this.items.map(i => [i.id, ITEM_CODES.indexOf(i.type), r1(i.x), r1(i.y), i.fuse, i.stuck ? 1 : 0, r1(i.vx), r1(i.vy), i.landed ? 1 : 0]),
      m: this.monsters.map(m => [m.id, r1(m.x), r1(m.y), m.dir, Math.ceil(m.hp), r1(m.anim), m.bite > 0 ? m.bite : m.wind > 0 ? -m.wind : 0, m.fire > 0 ? 1 : 0]),
      a: this.animals.map(a => [a.id, ANIMAL_KINDS.indexOf(a.k), r1(a.x), r1(a.y), a.dir, r1(a.anim), (a.flee > 0 ? 1 : 0) | (a.flop ? 2 : 0) | (a.bite > 0 ? 4 : 0) | (a.perch ? 8 : 0) | (a.gold ? 16 : 0)]),
      s: this.structs.map(s => [s.id, s.type, s.x, s.y, s.team, Math.round(s.prog * 100) / 100, Math.ceil(s.hp), s.fire > 0 ? 1 : 0, s.lv ? 1 : 0, s.up | 0, s.upT > 0 ? Math.ceil(s.upT / 60) : 0, s.arrows | 0, s.bolts | 0, s.walls ? s.walls.map(q => [q.x, q.y, Math.ceil(q.hp), q.br ? 1 : 0, q.d]) : 0, s.bDir || 0]),
      cs: (this.cshots || []).map(p => [r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), p.k]),
      v: this.vehicles.map(v => [v.id, VEH_CODES.indexOf(v.type), r1(v.x), r1(v.y), v.dir, v.team, Math.ceil(v.hp), Math.round(v.ang * 100) / 100, invEnc(v.inv), v.fire > 0 ? 1 : 0, v.pusher, v.cd]),
      t: this.teams.map(t => [t.money, t.sel, t.elim ? 1 : 0, Object.keys(t.res).join(','), t.rq, Math.round(t.rp * 1000) / 1000, t.ai ? 1 : 0, t.diff || '', t.stat || '', t.helper ? 1 : 0, t.hdiff || '', SELLABLE.filter(k => (t.autoSell || AUTO_SELL_DEFAULT)[k]).join(',')]),
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
        armor: fl & 1, knight: fl & 2, block: fl & 4, bowT: fl & 8 ? 1 : 0, fire: fl & 16 ? 1 : 0, blockT: fl & 32 ? 1 : 0, invT: fl & 64 ? 1 : 0, arrows: a[14], inside: a[15], swing: a[16], veh: a[17], slot: a[18] || 0 });
      c.hk = a[19] ? { st: a[19], x: a[20], y: a[21] } : null; c.bl = a[22] ? { gas: a[22] === 1 ? 1 : 0 } : null; c.escCd = a[23] ? this.tick + a[23] * 60 : 0; c.helpS = a[24] || 0; c.gear = invDec(a[25] || '');
      return c;
    });
    const oi = new Map(this.items.map(c => [c.id, c]));
    this.items = s.i.map(a => { const it = oi.get(a[0]) || { rx: a[2], ry: a[3] }; Object.assign(it, { id: a[0], type: ITEM_CODES[a[1]], x: a[2], y: a[3], fuse: a[4], stuck: !!a[5], vx: a[6], vy: a[7], landed: !!a[8] }); if (it.type === 'arrow' && !it.landed) it.ang = Math.atan2(it.vy, it.vx); return it; });
    const om = new Map(this.monsters.map(c => [c.id, c]));
    this.monsters = s.m.map(a => { const m = om.get(a[0]) || { rx: a[1], ry: a[2] }; Object.assign(m, { id: a[0], x: a[1], y: a[2], dir: a[3], hp: a[4], anim: a[5], bite: a[6] > 0 ? a[6] : 0, wind: a[6] < 0 ? -a[6] : 0, fire: a[7] }); return m; });
    const oa = new Map(this.animals.map(c => [c.id, c]));
    this.animals = (s.a || []).map(a => { const o = oa.get(a[0]) || { rx: a[2], ry: a[3] }; Object.assign(o, { id: a[0], k: ANIMAL_KINDS[a[1]], x: a[2], y: a[3], dir: a[4], anim: a[5], flee: a[6] & 1, flop: a[6] & 2, bite: a[6] & 4 ? 1 : 0, perch: a[6] & 8, gold: a[6] & 16 ? 1 : 0 }); return o; });
    this.structs = s.s.map(a => { const B = BUILD[a[1]]; return { id: a[0], type: a[1], x: a[2], y: a[3], team: a[4], prog: a[5], hp: a[6], fire: a[7], lv: a[8] || 0, w: B.w, h: B.h, up: a[9] || 0, upT: (a[10] || 0) * 60, arrows: a[11] || 0, bolts: a[12] || 0, walls: a[13] ? a[13].map(q => ({ x: q[0], y: q[1], hp: q[2], br: q[3], d: q[4] })) : null, bDir: a[14] || 0 }; });
    this.cshots = (s.cs || []).map(a => ({ x: a[0], y: a[1], vx: a[2], vy: a[3], k: a[4] }));
    const ov = new Map(this.vehicles.map(c => [c.id, c]));
    this.vehicles = (s.v || []).map(a => { const v = ov.get(a[0]) || { rx: a[2], ry: a[3] }; Object.assign(v, { id: a[0], type: VEH_CODES[a[1]], x: a[2], y: a[3], dir: a[4], team: a[5], hp: a[6], ang: a[7], inv: invDec(a[8]), fire: a[9], pusher: a[10], cd: a[11] }); return v; });
    s.t.forEach((a, i) => { const t = this.teams[i]; if (t) { t.money = a[0]; t.sel = a[1]; t.elim = !!a[2]; t.res = {}; if (a[3]) for (const k of a[3].split(',')) t.res[k] = 1; t.rq = a[4]; t.rp = a[5]; t.ai = !!a[6]; t.diff = a[7] || ''; t.stat = a[8] || ''; t.helper = !!a[9]; t.hdiff = a[10] || 'normal'; if (a[11] != null) { t.autoSell = {}; for (const k of String(a[11]).split(',')) if (k) t.autoSell[k] = 1; } } });
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
