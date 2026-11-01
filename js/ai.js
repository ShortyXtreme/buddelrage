// BuddelRage – Computergegner & Helfer-KI (eigener Code, ISC-Lizenz)
// Aufbau (Quellen & Vorbilder siehe AI_NOTES.md):
//  1. Navigationsraster (5×5-px-Zellen) über der Pixel-Landschaft, inkrementell aktualisiert (setMat markiert Zellen)
//  2. A*-Wegsuche mit Laufen/Springen/Klettern/Schwimmen/Graben (Grabkosten; Fels/Granit/Lava unpassierbar), Rechenbudget pro Tick
//  3. Pfadverfolgung mit Steckenbleib-Erkennung und gestufter Erholung (springen → neu planen → graben → Ausweichziel)
//  4. Team-„Hauptquartier“ (wie 0 A.D. Petra): Rollen, Kauf-/Forschungs-/Bauplan, Angriff/Verteidigung nach Stärkevergleich
//  5. Aufgabenwahl pro Buddler per Utility-Bewertung (Dave Mark „Infinite Axis Utility“), Ausführung als kleiner Zustandsautomat
//  6. Kampf: ballistische Wurf-/Schuss-Lösung mit Vorhalt, Schild-Blocken, Projektilen ausweichen (Idee: OpenClonk AI_Protection)
'use strict';
// Leicht schickt bei einem Überfall alle Buddler gemeinsam (statt einzeln einen nach dem anderen) – gemessen: Ritter-Überfälle mit Burg 4 → 7 von 20
const AI_DEF_TUNE = { done: 0, v: { easy: { share: 1.0 } } };
const AI_DIFF = {
  easy: { k: 'easy', n: 'Leicht', think: 34, react: 50, aimErr: 0.2, lead: 0, maxClonks: 3, reserve: 40, attackRatio: 2.4, attackAfter: 60 * 300, healAt: 22,
    throwP: 0.35, blockP: 0.25, evade: 0, fighterShare: 0, research: ['weapons', 'tower', 'castle'], builds: ['castle'], upFirst: 1, chest: 150, vehicles: false, goldCap: 2, idleP: 0.12, pathExp: 1400, group: 1, bonus: 0 },
  normal: { k: 'normal', n: 'Mittel', think: 16, react: 22, aimErr: 0.08, lead: 0.6, maxClonks: 5, reserve: 25, attackRatio: 1.5, attackAfter: 60 * 180, healAt: 32,
    throwP: 0.65, blockP: 0.6, evade: 0.5, fighterShare: 0.34, research: ['weapons', 'tower', 'castle', 'lorry', 'knight', 'tnt'], builds: ['castle', 'tower'], upFirst: 2, vehicles: true, goldCap: 3, idleP: 0.04, pathExp: 2600, group: 1, bonus: 0 },
  hard: { k: 'hard', n: 'Schwer', think: 7, react: 8, aimErr: 0.025, lead: 1, maxClonks: 7, reserve: 15, attackRatio: 1.15, attackAfter: 60 * 110, healAt: 38,
    throwP: 0.92, blockP: 0.95, evade: 0.9, fighterShare: 0.45, research: ['lorry', 'weapons', 'tower', 'castle', 'knight', 'catapult', 'tnt', 'cannon'], builds: ['castle', 'tower'], upFirst: 2, chest: 150, vehicles: true, goldCap: 3, idleP: 0, pathExp: 3600, group: 2, bonus: 1 },
};
const AI_LEVELS = ['easy', 'normal', 'hard'];
function aiDiffName(k) { return (AI_DIFF[k] || AI_DIFF.normal).n; }

// ---------- Navigationsraster ----------
const NC = 5;
const NV_AIR = 0, NV_DIG = 1, NV_HARD = 2, NV_WATER = 3, NV_LAVA = 4;
class NavGrid {
  constructor(w) {
    this.w = w; this.gw = Math.ceil(w.W / NC); this.gh = Math.ceil(w.H / NC);
    const n = this.gw * this.gh;
    this.c = new Uint8Array(n); this.gold = new Uint8Array(n); this.dirty = new Uint8Array(n); this.dl = []; this.lv = new Uint8Array(n); this.lavaN = 0; this.gr = new Uint8Array(n); this.rk = 0; // gr: Zelle enthält Granit (unsprengbar); rk: Wegsuche darf Fels sprengen // lv: Zelle enthält Lava-Pixel (auch neben Fels)
    this.goldSet = new Set();
    for (let i = 0; i < n; i++) this.calc(i);
    this.g = new Float32Array(n); this.par = new Int32Array(n); this.seen = new Uint32Array(n); this.closed = new Uint32Array(n); this.stamp = 0;
    this.pen = new Float32Array(n); this.penT = new Int32Array(n); this.now = 0;
  }
  mark(x, y) { const i = ((y / NC) | 0) * this.gw + ((x / NC) | 0); if (!this.dirty[i]) { this.dirty[i] = 1; this.dl.push(i); } }
  flush() { const d = this.dl; for (let k = 0; k < d.length; k++) { this.calc(d[k]); this.dirty[d[k]] = 0; } d.length = 0; }
  calc(i) {
    const w = this.w, W = w.W, mat = w.mat, gx = i % this.gw, gy = (i / this.gw) | 0;
    let hard = 0, dig = 0, water = 0, lava = 0, gold = 0, gran = 0;
    const y1 = Math.min(w.H, gy * NC + NC), x1 = Math.min(W, gx * NC + NC);
    for (let y = gy * NC; y < y1; y++) for (let x = gx * NC; x < x1; x++) {
      const m = mat[y * W + x];
      if (m === MAT.GOLD) { gold++; dig++; } else if (DIGGABLE[m]) dig++; else if (SOLID[m]) { hard++; if (typeof BLASTABLE !== 'undefined' ? !BLASTABLE[m] : m !== MAT.ROCK) gran++; } else if (m === MAT.WATER) water++; else if (m === MAT.LAVA) lava++;
    }
    this.gr[i] = gran > 0 ? 1 : 0;
    const lv = lava > 0 ? 1 : 0; if (lv !== this.lv[i]) { this.lv[i] = lv; this.lavaN += lv ? 1 : -1; }
    this.c[i] = hard >= 2 ? NV_HARD : lava >= 2 ? NV_LAVA : dig >= 2 ? NV_DIG : water >= 12 ? NV_WATER : NV_AIR;
    const g = gold >= 5 && hard < 2 ? 1 : 0;
    if (g !== this.gold[i]) { this.gold[i] = g; if (g) this.goldSet.add(i); else this.goldSet.delete(i); }
  }
  cls(gx, gy) { if (gx < 0 || gx >= this.gw || gy >= this.gh) return NV_HARD; if (gy < 0) return NV_AIR; return this.c[gy * this.gw + gx]; }
  solidC(gx, gy) { const k = this.cls(gx, gy); return k === NV_DIG || k === NV_HARD; }
  groundBelow(gx, gy, max) { for (let d = 1; d <= max; d++) { const k = this.cls(gx, gy + d); if (k === NV_DIG || k === NV_HARD || k === NV_WATER) return d; if (k === NV_LAVA) return 99; } return 99; }
  lavaNear(gx, gy) { for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) if (this.cls(gx + dx, gy + dy) === NV_LAVA) return true; return false; }
  cellOf(x, y) { return [Math.max(0, Math.min(this.gw - 1, Math.floor(x / NC))), Math.max(0, Math.min(this.gh - 1, Math.floor((y - 1) / NC)))]; }
  // Kosten eines Schritts (cx,cy) → (nx,ny); -1 = unmöglich. Körper = Zelle + Zelle darüber.
  cost(cx, cy, dx, dy) {
    const nx = cx + dx, ny = cy + dy;
    if (nx < 0 || nx >= this.gw || ny < 1 || ny >= this.gh) return -1;
    const a = this.cls(nx, ny), b = this.cls(nx, ny - 1);
    if (a === NV_LAVA || b === NV_LAVA) return -1;
    if (a === NV_HARD || b === NV_HARD) { // Fels: nur mit Sprengstoff (rk) und nie Granit/Rand; teuer → Umweg bevorzugt
      if (!this.rk || (dx === 0 && dy < 0) || ny < 2 || nx < 1 || nx >= this.gw - 1 || this.gr[ny * this.gw + nx] || this.gr[(ny - 1) * this.gw + nx] || this.lavaNear(nx, ny)) return -1;
      return (dx && dy ? 1.42 : 1) * (a === NV_HARD && b === NV_HARD ? AI_US.rockCost : AI_US.rockCost * 0.6) * (dy < 0 ? 2 : 1);
    }
    if (dx && dy) { const s1 = this.cls(nx, cy) === NV_HARD || this.cls(nx, cy - 1) === NV_HARD, s2 = this.cls(cx, ny) === NV_HARD || this.cls(cx, ny - 1) === NV_HARD; if (s1 && s2 && !this.rk) return -1; }
    const base = dx && dy ? 1.42 : 1;
    const lav = this.lavaNear(nx, ny) ? 25 : 0;
    const nd = (a === NV_DIG ? 1 : 0) + (b === NV_DIG ? 1 : 0);
    if (nd) { if (dx === 0 && dy < 0) return -1; let k = base * (1 + 1.7 * nd); if (dy < 0) k *= 1.4; if (this.ft && this.ft[ny * this.gw + nx]) k += 14; return k + lav; } // ft: Fundament eines Gebäudes – nicht untergraben
    if (a === NV_WATER || b === NV_WATER) return base * (b === NV_WATER ? 3 : 1.8) + lav;
    const gb = this.groundBelow(nx, ny, 14);
    const wall = this.solidC(nx - 1, ny) || this.solidC(nx + 1, ny) || this.solidC(nx - 1, ny - 1) || this.solidC(nx + 1, ny - 1);
    const pen = this.penT[ny * this.gw + nx] > this.now ? this.pen[ny * this.gw + nx] : 0; // gelernte Problemstellen
    if (dy < 0) { if (!wall && gb > 5) return -1; return base * (wall && gb > 3 ? 3.0 : wall ? 1.6 : 2.2) + lav + pen; } // langes Klettern ist teurer als eine Rampe
    if (dy === 0) { if (gb === 1) return base + lav + pen; if (gb <= 5 || wall) return base * 1.3 + lav + pen; return -1; }
    return base * (gb > 12 ? AI_US.dropCost : gb > 8 ? AI_US.dropCost * 0.4 : 1) + lav + pen; // tiefer Sturz (Höhle) ist eine Einbahnstraße: teuer → lieber an der Wand entlang graben
  }
  // Problemstelle merken: hier ist ein Buddler gescheitert → eine Weile teurer (alle Teams nutzen dasselbe Raster)
  penalize(i, v, until) { if (i < 0 || i >= this.pen.length) return; this.pen[i] = this.penT[i] > this.now ? Math.min(30, this.pen[i] + v) : v; this.penT[i] = until; }
  // A* (Heap mit verzögertem Löschen); liefert den Pfad zum Ziel oder zum nächstgelegenen erreichten Knoten
  find(sx, sy, tx, ty, maxExp) {
    this.now = this.w.tick;
    const gw = this.gw, st = ++this.stamp, g = this.g, par = this.par, seen = this.seen, closed = this.closed;
    const s = sy * gw + sx, goal = ty * gw + tx;
    const H = i => { const x = i % gw, y = (i / gw) | 0; return Math.hypot(x - tx, y - ty); };
    const hi = [], hf = [];
    const push = (i, f) => { let n = hi.length; hi.push(i); hf.push(f); while (n > 0) { const p = (n - 1) >> 1; if (hf[p] <= f) break; hi[n] = hi[p]; hf[n] = hf[p]; n = p; } hi[n] = i; hf[n] = f; };
    const pop = () => { const r = hi[0], li = hi.pop(), lf = hf.pop(); const n = hi.length; if (n) { let k = 0; for (;;) { let c = 2 * k + 1; if (c >= n) break; if (c + 1 < n && hf[c + 1] < hf[c]) c++; if (hf[c] >= lf) break; hi[k] = hi[c]; hf[k] = hf[c]; k = c; } hi[k] = li; hf[k] = lf; } return r; };
    g[s] = 0; seen[s] = st; par[s] = -1; push(s, H(s));
    let best = s, bestH = H(s), exp = 0, found = false;
    while (hi.length && exp < maxExp) {
      const cur = pop(); if (closed[cur] === st) continue; closed[cur] = st; exp++;
      const cx = cur % gw, cy = (cur / gw) | 0;
      if (Math.abs(cx - tx) <= 1 && Math.abs(cy - ty) <= 1) { best = cur; found = true; break; }
      const h = H(cur); if (h < bestH) { bestH = h; best = cur; }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const k = this.cost(cx, cy, dx, dy); if (k < 0) continue;
        const ni = cur + dy * gw + dx; if (closed[ni] === st) continue;
        const ng = g[cur] + k;
        if (seen[ni] !== st || ng < g[ni]) { seen[ni] = st; g[ni] = ng; par[ni] = cur; push(ni, ng + H(ni) * 1.05); }
      }
    }
    const path = []; let i = best, guard = 0; while (i !== -1 && guard++ < 4000) { path.push(i); i = par[i]; }
    path.reverse();
    return { path, complete: found, exp, goal };
  }
}

// ---------- Ballistik ----------
function aiGauss(r) { return (r() + r() + r() - 1.5) / 1.5; }
// simuliert wie updItem (vy += g, dann Bewegung); misst kleinsten Abstand zum Ziel bis zum Aufschlag
function aiSimShot(w, px, py, vx, vy, g, tx, ty, maxT) {
  let x = px, y = py, best = 1e9, bt = 0;
  for (let t = 1; t <= maxT; t++) {
    vy = Math.min(vy + g, 5);
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(vx), Math.abs(vy)) / 2));
    for (let s = 0; s < steps; s++) {
      x += vx / steps; y += vy / steps;
      const d = Math.hypot(x - tx, y - ty); if (d < best) { best = d; bt = t; }
      if (d < 3) return { d, t };
      if (t > 2 && w.solid(x, y)) return { d: Math.min(best, Math.hypot(x - tx, y - ty)), t: bt || t, imp: Math.hypot(x - tx, y - ty) };
    }
    if (y > w.H || x < 0 || x > w.W) break;
  }
  return { d: best, t: bt };
}
function aiSolveBallistic(w, px, py, tx, ty, speeds, g, maxT) {
  const dir = Math.sign(tx - px) || 1, X = Math.max(1, Math.abs(tx - px)), Y = py - ty;
  let best = null;
  for (const s of speeds) {
    const root = s ** 4 - g * (g * X * X + 2 * Y * s * s);
    if (root < 0) continue;
    for (const sg of [-1, 1]) {
      const th0 = Math.atan((s * s + sg * Math.sqrt(root)) / (g * X));
      for (const dth of [0, -0.04, 0.04, -0.09, 0.09]) {
        const th = th0 + dth, vx = dir * s * Math.cos(th), vy = -s * Math.sin(th);
        const r = aiSimShot(w, px, py, vx, vy, g, tx, ty, maxT);
        const score = r.d + r.t * 0.02;
        if (!best || score < best.score) best = { vx, vy, s, th, t: r.t, d: r.d, score };
        if (r.d < 3 && dth === 0) break;
      }
    }
  }
  return best;
}

// ---------- KI-Methoden der Welt ----------
Object.assign(World.prototype, {
  // Spieler hat das Spiel verlassen: KI übernimmt das Team mit der gewählten Stufe
  aiTakeover(t, diff) {
    t.ai = true; t.helper = false; t.diff = AI_DIFF[diff] ? diff : 'normal'; t.brain = null; t.keys = {}; t.stat = '';
    if (!t.stats) t.stats = newStats();
    for (const c of this.clonks) if (c.team === t.id) { c.ai = null; c.aiKeys = { ...NOKEYS }; }
  },
  aiInit() {
    if (!this.nav) this.nav = new NavGrid(this);
  },
  aiBrain(t) {
    if (!t.brain) t.brain = { roles: new Map(), claims: new Map(), unbuild: {}, site: null, buildId: 0, attack: false, defend: false, threat: [], lastPlan: -999, stat: '', rally: 0, itemClaims: new Map(), gun: 0 };
    return t.brain;
  },
  aiDiff(t) { return AI_DIFF[!t.ai && t.helper && t.hdiff ? t.hdiff : t.diff] || AI_DIFF.normal; }, // Helfer-KI eines Spielers: eigene Stufe
  aiAllyBases(tid) { return this.structs.filter(s => this.ally(s.team, tid) && BUILD[s.type].base && s.prog >= 1 && !s.remove); },
  // Haupteinstieg pro Team und Tick
  aiTeam(t) {
    this.aiInit();
    if (this.tick % 2 === 0 || this.nav.dl.length > 400) this.nav.flush();
    const B = this.aiBrain(t), D = this.aiDiff(t);
    const helper = !t.ai; // Helfer-KI: arbeitet für menschliche Spieler (nur nicht ausgewählte Buddler, kein Geldausgeben)
    if (this.tick - B.lastPlan >= D.think * 3) { B.lastPlan = this.tick; this.aiPlan(t, B, D, helper); }
    for (const c of this.clonks) {
      if (c.team !== t.id || c.act === 'dead') continue;
      if (helper && c.id === t.sel) { if (c.ai) this.aiForget(c); continue; }
      this.aiClonk(c, t, B, D, helper);
    }
  },
  aiForget(c) { const A = c.ai; if (A) { const t = this.teams[c.team], B = t && t.brain; if (B) { B.claims.delete(c.id); for (const [k, v] of B.itemClaims) if (v === c.id) B.itemClaims.delete(k); } } c.ai = null; c.aiKeys = { ...NOKEYS }; },
  aiStat(t, s) { const B = this.aiBrain(t); B.stat = s; t.stat = s; },
  aiBases(tid) { return this.structs.filter(s => this.ally(s.team, tid) && BUILD[s.type].base && s.prog >= 1 && !s.remove); },
  aiHome(c) { let best = null, bd = 1e9; for (const s of this.aiAllyBases(c.team)) { const d = Math.abs(s.x - c.x) + Math.abs(s.y - c.y) * 2; if (d < bd) { bd = d; best = s; } } return best; },
  aiArmed(c) { return hasG(c, 'sword') || (hasG(c, 'bow') && c.arrows > 0) || c.inv.some(x => THROWABLE.has(x)); },
  aiStrength(tid) {
    let s = 0;
    for (const c of this.clonks) if (c.team === tid && c.act !== 'dead') s += (0.4 + c.hp / 100) * (1 + (c.knight ? 1.2 : 0) + (hasG(c, 'sword') ? 0.5 : 0) + (hasG(c, 'shield') ? 0.3 : 0) + c.inv.filter(x => THROWABLE.has(x)).length * 0.35 + (c.armor ? 0.3 : 0));
    for (const st of this.structs) if (st.team === tid && st.prog >= 1) s += st.type === 'castle' ? 1.5 : st.type === 'tower' ? 0.7 : 0.3;
    return s;
  },
  // Figur (Buddler, Ritter, künftige Spezialisten wie Burgwart/Retter): alles im Laden, was weder Gegenstand noch Fahrzeug ist, oder als Einheit markiert
  aiIsUnit(what) {
    if (what === 'clonk' || what === 'knight') return true;
    const e = typeof SHOP_ALL !== 'undefined' && SHOP_ALL.find(x => x.k === what);
    if (e && (e.unit || e.char || e.spec || e.cls === 'unit')) return true;
    if (typeof UNITS !== 'undefined' && UNITS && UNITS[what]) return true;
    if (typeof SPECIALISTS !== 'undefined' && SPECIALISTS && SPECIALISTS[what]) return true;
    if (typeof SPEC !== 'undefined' && SPEC && SPEC[what]) return true;
    return !(typeof ITEMS !== 'undefined' && ITEMS[what]) && !(typeof VEH !== 'undefined' && VEH[what]);
  },
  // Team mit echtem Menschen (Helfer-KI des Spielers): keine Figuren kaufen. Verbündete reine KI-Teams dürfen kaufen (Shorty, 01.11.); alte Sperre per AI_US.off.allyBuy
  aiNoUnits(t) { return (typeof teamHasHuman === 'function' && teamHasHuman(t)) || !t.ai || !!t.helper || (!!AI_US.off.allyBuy && this.teams.some(o => o && o !== t && !o.ai && this.ally(o.id, t.id))); },
  // Einkauf für einen bestimmten Buddler (geht über die normale Laden-Funktion)
  aiBuy(t, c, what) {
    if (this.aiIsUnit(what) && this.aiNoUnits(t)) return false; // Figuren kauft im Team mit Mensch nur der Mensch
    const sel = t.sel; if (c) t.sel = c.id;
    const m0 = t.money; this.buy(t, what); t.sel = sel;
    const ok = t.money < m0;
    if (ok && (what === 'clonk' || what === 'knight')) { t.stats.bought++; }
    return ok;
  },
  aiSell(c) { // verkauft Gold/Steine/Lore-Inhalt, behält Waffen und Sprengstoff
    const keep = c.inv.filter(x => x !== 'gold' && x !== 'rock'), sellIt = c.inv.filter(x => x === 'gold' || x === 'rock');
    const v = c.act === 'push' ? this.vehById(c.veh) : null;
    if (!sellIt.length && !(v && v.type === 'lorry' && v.inv.length)) return false;
    c.inv = sellIt; this.sell(c, ITEM_CODES); c.inv = keep.concat(c.inv); return true; /* KI: feste Liste, Ausrüstung liegt eh in c.gear */
  },

  // ---------- Team-Planung (Hauptquartier) ----------
  aiPlan(t, B, D, helper) {
    this.aiFootMask();
    if (typeof AI_DEF !== 'undefined' && !AI_DEF_TUNE.done) { AI_DEF_TUNE.done = 1; for (const k in AI_DEF_TUNE.v) if (AI_DEF[k]) Object.assign(AI_DEF[k], AI_DEF_TUNE.v[k]); } // Abwehr-Feinschliff (aidef.js bleibt unverändert)
    const own = this.clonks.filter(c => c.team === t.id && c.act !== 'dead');
    const bases = this.aiBases(t.id);
    const enemies = this.clonks.filter(c => !this.ally(c.team, t.id) && c.act !== 'dead' && !this.teams[c.team].elim);
    const defBases = this.aiAllyBases(t.id); // Verbündete verteidigen auch die Basen ihrer Teamkollegen
    // Bedrohung der Basis
    // Bedrohung: bewaffnete Gegner im Umkreis der Basis oder jeder Gegner direkt an der Basis (gegnerische Bergleute in Höhlen darunter zählen nicht)
    B.threat = enemies.filter(e => !e.inside && defBases.some(s => { const dx = Math.abs(e.x - s.x), dy = Math.abs(e.y - s.y); return (dx < 230 && dy < 120 && (e.knight || this.aiArmed(e) || (e.ai && e.ai.task && e.ai.task.type === 'attack'))) || (dx < 90 && dy < 50); }));
    B.defend = B.threat.length > 0;
    // laufende Baustelle
    const site = this.structs.find(s => s.team === t.id && s.prog < 1 && !s.remove);
    B.buildId = site ? site.id : 0;
    if (B.site && !helper && this.tick - B.site.t0 > 60 * 75) { B.unbuild[B.site.type] = this.tick + 60 * 20; B.site = null; } // geplanter Bau hängt (Bauarbeiter im Kampf) → neu planen
    if (site && !helper) { // Baustelle ohne Fortschritt (60 s) aufgeben – halber Preis zurück, Gebäudetyp eine Weile meiden
      const v = site.prog + (site.lvD || 0) * 1e-4;
      if (!B.siteW || B.siteW.id !== site.id || B.siteW.v !== v) B.siteW = { id: site.id, v, t: this.tick };
      else if (this.tick - B.siteW.t > 3600) { site.remove = true; t.money += BUILD[site.type].price >> 1; B.unbuild[site.type] = this.tick + 60 * 40; B.buildId = 0; B.siteW = null; this.msg('Baustelle aufgegeben: ' + BUILD[site.type].name, t.id); }
    }
    // Rollen: Bergleute, Bauarbeiter, Kämpfer (Petra-artige Arbeitsteilung)
    const fighters = [], workers = [];
    for (const c of own) { if (c.spec) continue; (c.knight ? fighters : workers).push(c); } // Spezialisten (c.spec) arbeiten selbstständig: weder Kämpfer noch Bergmann, zählen aber für maxClonks
    const want = helper || this.aiRush(t) ? 0 : (own.length < 3 && !B.defend && !B.attack) ? 0 : Math.round(own.length * (t.res.weapons || t.res.knight ? D.fighterShare : 0)) + (B.attack ? 1 : 0); // früh: alle bauen ab (Wirtschaft zuerst)
    workers.sort((a, b) => (hasG(b, 'sword') ? 1 : 0) - (hasG(a, 'sword') ? 1 : 0));
    while (fighters.length < want && workers.length > 1) fighters.push(workers.shift());
    B.roles.clear();
    for (const c of fighters) B.roles.set(c.id, 'fighter');
    for (const c of workers) B.roles.set(c.id, 'miner');
    // Bauarbeiter: nächster Arbeiter zur Baustelle bzw. zum geplanten Bauplatz
    const bpos = site || B.site;
    if (bpos && workers.length) { // Bauarbeiter bleibt derselbe, solange er lebt (kein Hin- und Herwechseln)
      let bw = workers.find(c => c.id === B.builder);
      if (!bw) { let bd = 1e9; for (const c of workers) { const d = Math.abs(c.x - bpos.x) + 2.5 * Math.abs(c.y - bpos.y) + golds(c) * 25; if (d < bd) { bd = d; bw = c; } } }
      // alle Arbeiter tief unter der Erde (Heimweg dauert/klappt nicht): ein Kämpfer an der Oberfläche übernimmt den Bau
      if (bw && bw.y - bpos.y > 60 && !B.defend) { let fb = null, fd = 1e9; for (const c of fighters) { if (c.knight || Math.abs(c.y - bpos.y) > 30) continue; const d = Math.abs(c.x - bpos.x); if (d < fd && d < 600) { fd = d; fb = c; } } if (fb) bw = fb; }
      if (bw) B.roles.set(bw.id, 'builder'); B.builder = bw ? bw.id : 0;
    } else B.builder = 0;
    if (site && (workers.length >= 4 || (site.type === 'castle' && workers.length >= 3))) { const c2 = workers.find(c => B.roles.get(c.id) === 'miner'); if (c2) B.roles.set(c2.id, 'builder'); } // Burg: zweiter Bauarbeiter schon ab 3 Arbeitern (Burg schneller fertig)
    if (helper) { this.aiStatusHelper(t, B, own); return; }
    // Angriff/Verteidigung nach Stärkevergleich (mit Hysterese)
    const my = this.aiStrength(t.id);
    let foeT = null, foeS = 1e9;
    for (const o of this.teams) if (!this.ally(o.id, t.id) && !o.elim) { const s = this.aiStrength(o.id); if (s < foeS) { foeS = s; foeT = o; } }
    if (foeT) {
      const ready = this.tick > D.attackAfter || my > foeS * 3;
      if (!B.attack && ready && my > foeS * D.attackRatio && fighters.filter(c => this.aiArmed(c) || c.knight).length >= D.group) { B.attack = true; B.target = foeT.id; }
      else if (B.attack && my < foeS * 0.9) B.attack = false;
      if (B.attack && (this.teams[B.target] || {}).elim) B.target = foeT.id;
    } else B.attack = false;
    // Ausgaben (Bauplan / Kauf / Forschung) – höchstens eine Entscheidung pro Planungsschritt
    this.aiSpend(t, B, D, own, bases, fighters);
    this.aiStatus(t, B, site);
  },
  aiStatusHelper(t, B, own) {
    const working = own.filter(c => c.id !== t.sel).length;
    t.stat = working ? working + (working === 1 ? ' Helfer arbeitet' : ' Helfer arbeiten') : '';
  },
  aiStatus(t, B, site) {
    let s;
    if (B.defend) s = 'verteidigt die Basis';
    else if (B.attack) s = 'greift an';
    else if (site) s = (site.lv ? 'planiert für ' : 'baut ') + BUILD[site.type].name;
    else if (B.site) s = 'plant ' + BUILD[B.site.type].name;
    else if (t.rq) s = 'forscht: ' + RES_BY[t.rq].name;
    else s = 'baut Gold ab';
    t.stat = s; B.stat = s;
  },
  aiSpend(t, B, D, own, bases, fighters) {
    // Teamkasse: nur die erste KI des Teams plant Forschung/Gebäude; mit Menschen im Team bleibt eine Rücklage für sie
    const P = this.poolOf && this.poolOf(t.id), hum = P ? P.members.filter(id => !this.teams[id].ai).length : 0;
    const lead = !P || P.members.find(id => this.teams[id].ai && !this.teams[id].elim) === t.id;
    const R = D.reserve, n = own.length, m = t.money - (hum ? Math.max(25 + 10 * hum, Math.round(t.money * 0.4)) : 0); // KI gibt höchstens ~60 % der Teamkasse aus
    if (!bases.length) {
      if (!lead) return; // Basis verloren → neue Hütte hat Vorrang
      if (!B.site && !B.buildId && m >= BUILD.hut.price) this.aiPlanSite(t, B, 'hut');
      return;
    }
    const noU = this.aiNoUnits(t);
    if (n === 0) { if (!noU && m >= PRICE_CLONK) this.aiBuy(t, null, t.res.knight && m >= PRICE_KNIGHT ? 'knight' : 'clonk'); return; }
    if (this.aiRush(t)) return this.aiSpendRush(t, B, D, own);
    const save = B.site ? BUILD[B.site.type].price + (B.site.cost || 0) : 0;
    const free = m - save;
    // 1) Grundversorgung: mindestens 2 Arbeiter
    if (!noU && n < 2 && free >= PRICE_CLONK) { this.aiBuy(t, null, 'clonk'); return; }
    if (!lead) { // weitere KI im Team: nur eigene Buddler/Ritter, mit größerer Rücklage für die Teamplanung
      B.keep = 0; const kn = t.res.knight && (B.attack || B.defend) && free >= PRICE_KNIGHT + R + 40;
      if (!noU && n < D.maxClonks - 1 && (kn || free >= PRICE_CLONK + R + 40)) this.aiBuy(t, null, kn ? 'knight' : 'clonk');
      return;
    }
    // erforschtes, aber noch nicht gebautes Gebäude hat Vorrang vor weiterer Forschung (sonst wird die Burg nie bezahlt)
    let pend = 0, cwait = 0;
    if (!B.site && !B.buildId && (n >= 3 || D.builds[0] === 'castle')) for (const k of D.builds) { const Bd = BUILD[k]; if (Bd.res && !t.res[Bd.res]) continue; if (k === 'tower' && (n < 3 || this.aiCastleFirst(t, D))) continue; if (this.structs.some(s => this.ally(s.team, t.id) && s.type === k && !s.remove)) continue; if ((B.unbuild[k] || 0) > this.tick) continue; if (k === 'castle' && D.chest) { cwait = Bd.price; break; } pend = Bd.price; break; } // Kriegskasse (Leicht): für die Burg nicht horten, sondern erst bauen, wenn genug übrig ist
    B.keep = save + pend + cwait; // Rücklage, die beim Ausrüsten nicht angetastet wird
    // Burg-Munition nachfüllen (billig, wichtig für die Verteidigung)
    const cs = this.castleOf ? this.castleOf(t.id) : null, cupMax = D.k === 'hard' ? 3 : D.k === 'normal' ? 2 : 1;
    const csL = cs ? (typeof castleLevel === 'function' ? castleLevel(cs) : (cs.up | 0)) : 0; // fertige Stufe (läuft ein Ausbau, zählt die neue Stufe noch nicht)
    const zeug = this.aiSpecN(t, 'zeug') > 0; if (zeug) B.keep += (typeof SPEC_RESERVE !== 'undefined' ? SPEC_RESERVE : 20); // Zeugmeister kauft Munition selbst (lässt 20 übrig)
    if (cs && csL >= 2 && !zeug) for (const k in CAMMO) { const A = CAMMO[k]; if (csL < A.lvl) continue; const low = (cs[k] | 0) < (B.defend ? A.max - A.add : A.add); if (low && free >= A.price + (B.defend ? 0 : R) && this.castleAmmo(t, k, cs.id)) return; } // nur bei Erfolg abbrechen (sonst blockiert ein laufender Ausbau die ganze Planung)
    // Burg steht: Mauern (und bei Mittel/Schwer Schützentürme) haben Vorrang vor weiterer Forschung – erst danach geht es weiter
    if (cs && !(cs.upT > 0) && (cs.up | 0) < Math.min(cupMax, D.upFirst || 0) && n >= 2) {
      const U = CUP[cs.up | 0];
      if (free >= U.price + (D.chest || (B.defend ? 0 : Math.round(R / 2)))) { this.castleUpgrade(t, cs.id); return; }
      if (!D.chest) { pend += U.price; B.keep = save + pend; }
    }
    // Wachtürme (Ausbau-API aus castle.js): Munition ab Stufe 2 (Pfeile) bzw. 3 (Pech), nur fertige Stufen, nie während eines Ausbaus
    const towers = typeof towerLevel === 'function' ? this.structs.filter(s => s.type === 'tower' && s.team === t.id && s.prog >= 1 && !s.remove) : [];
    if (!zeug) for (const s of towers) {
      if (s.upT > 0) continue; const L = towerLevel(s);
      if (L >= TAMMO.arrows.lvl && (s.arrows | 0) < (B.defend ? TAMMO.arrows.max - TAMMO.arrows.add : TAMMO.arrows.add) && free >= TAMMO.arrows.price + (B.defend ? 0 : R) && this.towerAmmo(t, 'arrows', s.id)) return;
      if (L >= TAMMO.pitch.lvl && (s.pitch | 0) < (B.defend ? 4 : 2) && free >= TAMMO.pitch.price + (B.defend ? 0 : R) && this.towerAmmo(t, 'pitch', s.id)) return;
    }
    // Spezialisten (nur reine KI-Teams): Zeugmeister ab Burgstufe 2 (übernimmt Munition + Reparatur)
    if (!noU && cs && csL >= 2 && !zeug && n < D.maxClonks + 1 && this.aiSpecOk(t, 'zeug') && free >= SPEC.zeug.price + R + pend && this.aiBuy(t, null, 'zeug')) return;
    // 2) Forschung nach Plan (Bauordnung)
    if (!t.rq && !cwait) for (const k of D.research) { // erforschte, noch nicht gebaute Burg (Kriegskasse): erst bauen, dann weiter forschen
      const r = RES_BY[k]; if (t.res[k]) continue;
      if (r.req && !r.req.every(q => t.res[q])) continue;
      if (free >= r.cost + R + pend + (D.chest && !B.attack && (k === 'castle' || k === 'tower') ? D.chest : 0)) { this.research(t, k); return; }
      break;
    }
    // 3) Gebäude
    if (!B.site && !B.buildId) for (const k of D.builds) {
      const Bd = BUILD[k]; if (Bd.res && !t.res[Bd.res]) continue;
      if (this.structs.some(s => this.ally(s.team, t.id) && s.type === k && !s.remove)) continue;
      if ((B.unbuild[k] || 0) > this.tick) continue;
      if (k === 'tower' && (n < 3 || this.aiCastleFirst(t, D))) continue; // Burg zuerst (Turm danach)
      if (m >= Bd.price + (k === 'castle' ? (B.attack ? 0 : (D.chest || 0)) : R)) { this.aiPlanSite(t, B, k); return; } // Burg: Sparziel reicht, keine zusätzliche Reserve
    }
    // Burg-Ausbau: Leicht höchstens Mauern, Mittel bis Schützentürme, Schwer bis Balliste
    if (cs && !(cs.upT > 0) && (cs.up | 0) < cupMax && n >= 3) { const U = CUP[cs.up | 0]; if (free >= U.price + R + (B.defend ? 0 : 20)) { this.castleUpgrade(t, cs.id); return; } }
    // Wachturm-Ausbau erst NACH der Burg (und deren Pflicht-Stufen): Leicht bis Stufe 1, Mittel 2, Schwer 3 (Kosten 50/80/100)
    if (cs && csL >= Math.min(cupMax, D.upFirst || 0) && n >= 3 && typeof TUP !== 'undefined') {
      const tMax = D.k === 'hard' ? 3 : D.k === 'normal' ? 2 : 1;
      for (const s of towers) { if (s.upT > 0 || (s.up | 0) >= Math.min(tMax, TUP.length)) continue; if (free >= TUP[s.up | 0].price + R + (B.defend ? 0 : 20) && this.towerUpgrade(t, s.id)) return; break; }
    }
    // Sparziel: nächste geplante Forschung bzw. nächstes Gebäude (sonst frisst der Buddler-Kauf alles auf)
    let goal = 0;
    if (n >= 3 && !B.defend) {
      if (pend) goal = pend;
      if (!goal && !t.rq) for (const k of D.research) { const r = RES_BY[k]; if (t.res[k]) continue; if (r.req && !r.req.every(q => t.res[q])) continue; goal = r.cost; break; }
      if (!goal && !B.site && !B.buildId) for (const k of D.builds) { const Bd = BUILD[k]; if (Bd.res && !t.res[Bd.res]) continue; if (this.structs.some(s => this.ally(s.team, t.id) && s.type === k && !s.remove)) continue; if ((B.unbuild[k] || 0) > this.tick) continue; goal = Bd.price; break; }
    }
    // 4) Spezialisten: Goldgräber früh (statt eines weiteren Buddlers), Sanitäter sobald mehrere Buddler graben
    if (!noU && n < D.maxClonks && !B.defend) {
      const gN = this.aiSpecN(t, 'gold'), diggers = own.filter(c => !c.spec && !c.knight).length;
      if (gN < (n >= 4 && cs ? 2 : 1) && n >= 2 && this.aiSpecOk(t, 'gold') && free >= SPEC.gold.price + R + goal && this.aiBuy(t, null, 'gold')) return;
      if (diggers >= 3 && (cs || !D.builds.includes('castle')) && !this.aiSpecN(t, 'medic') && this.aiSpecOk(t, 'medic') && free >= SPEC.medic.price + R + goal && this.aiBuy(t, null, 'medic')) return;
    }
    // 4) mehr Buddler / Ritter
    const knights = own.filter(c => c.knight).length;
    if (!noU && t.res.knight && (B.attack || B.defend || knights < 1) && n < D.maxClonks + 2 && free >= PRICE_KNIGHT + R + goal) { this.aiBuy(t, null, 'knight'); return; }
    if (!noU && n < D.maxClonks && free >= PRICE_CLONK + R + goal) { this.aiBuy(t, null, 'clonk'); return; }
    // 5) Fahrzeuge
    if (D.vehicles) {
      const mine = this.vehicles.filter(v => v.team === t.id);
      const miners = [...B.roles.values()].filter(r => r === 'miner').length;
      if (t.res.lorry && !mine.some(v => v.type === 'lorry') && miners >= 2 && free >= VEH.lorry.price + R) { this.aiBuy(t, null, 'lorry'); return; }
      if (D.k === 'hard' && B.attack) {
        const gun = t.res.cannon ? 'cannon' : t.res.catapult ? 'catapult' : null;
        if (gun && !mine.some(v => VEH[v.type].gun) && free >= VEH[gun].price + R) { this.aiBuy(t, null, gun); return; }
      }
    }
  },
  aiEsc(c, why) { AI_US.lastWhy = why; const ok = this.escape(c); AI_US.lastWhy = ''; if (ok) { const W = AI_US.escWhy || (AI_US.escWhy = {}); W[why] = (W[why] || 0) + 1; } return ok; },
  // Spezialisten-API (helpers.js): Anzahl lebender Spezialisten / Kauf möglich (Limit SPEC[kind].max)
  // Fundament-Zone (Modell: specFootAt/specLeaveFoot in helpers.js)
  aiFootAt(x, y) {
    if (this.specFootAt) return this.specFootAt(x, y);
    for (const s of this.structs) { if (s.remove) continue; if (Math.abs(x - s.x) < s.w / 2 + 8 && y > s.y - 30 && y < s.y + 26) return { x: s.x, h: s.w / 2 + 12 }; if (s.walls) for (const q of s.walls) if (Math.abs(x - q.x) < 11 && y > q.y - 30 && y < q.y + 26) return { x: q.x, h: 14 }; }
    return null;
  },
  // Bergmann gräbt in der Fundament-Zone → aufhören und seitlich hinaus (Wegsuche meidet die Zone über NavGrid.ft)
  aiFootGuard(c, A, k) {
    if (c.act !== 'dig' || c.inside || AI_US.off.foot) return false;
    const f = this.aiFootAt(c.x, c.y); if (!f) return false;
    const S = this.teams[c.team] && this.teams[c.team].stats; if (S) S.footGuard = (S.footGuard || 0) + 1;
    if (this.specLeaveFoot) return this.specLeaveFoot(c, A, k);
    c.act = 'walk'; c.vx = 0; const N = this.nav, tx = A.mine >= 0 && N ? (A.mine % N.gw) * NC : c.x + (c.dir || 1) * 30;
    let side = Math.sign(tx - f.x) || 1; const ex = f.x + side * f.h; if (ex < 6 || ex > this.W - 6) side = -side;
    k[side > 0 ? 'r' : 'l'] = 1; A.moving = true; A.path = null; A.arrived = false; return true;
  },
  // Fundament-Maske für die Wegsuche (alle 300 Ticks neu): Erd-Zellen unter Gebäuden/Mauern sind teuer
  aiFootMask() {
    const N = this.nav; if (!N || AI_US.off.foot || (this.ftT && this.tick - this.ftT < 300)) return; this.ftT = this.tick;
    if (!N.ft || N.ft.length !== N.c.length) N.ft = new Uint8Array(N.c.length); else N.ft.fill(0);
    const mark = (x0, x1, y0, y1) => { for (let gy = Math.max(0, Math.floor(y0 / NC)); gy <= Math.min(N.gh - 1, Math.floor(y1 / NC)); gy++) for (let gx = Math.max(0, Math.floor(x0 / NC)); gx <= Math.min(N.gw - 1, Math.floor(x1 / NC)); gx++) N.ft[gy * N.gw + gx] = 1; };
    for (const s of this.structs) { if (s.remove) continue; mark(s.x - s.w / 2 - 8, s.x + s.w / 2 + 8, s.y + 1, s.y + 26); if (s.walls) for (const q of s.walls) mark(q.x - 11, q.x + 11, q.y + 1, q.y + 26); }
  },
  aiSpecN(t, kind) { return typeof specCount === 'function' ? specCount(this, t.id, kind) : this.clonks.filter(c => c.team === t.id && c.spec === kind && c.act !== 'dead').length; },
  aiSpecOk(t, kind) { return !AI_US.off.spec && typeof SPEC !== 'undefined' && SPEC[kind] && typeof this.specBuy === 'function' && this.aiSpecN(t, kind) < SPEC[kind].max; },
  aiCastleFirst(t, D) { return D.builds[0] === 'castle' && D.research.includes('castle') && !this.structs.some(s => s.type === 'castle' && this.ally(s.team, t.id) && !s.remove) && !((this.aiBrain(t).unbuild.castle || 0) > this.tick); },
  // Goldrausch (keine Gegner, Ziel = Kontostand): nur ausgeben, was das Ziel schneller erreichbar macht
  aiRush(t) { return this.mode === 'settle' && !this.teams.some(o => !this.ally(o.id, t.id) && !o.elim); },
  aiSpendRush(t, B, D, own) {
    B.keep = 0; const left = (this.goal || 1e9) - t.money, n = own.length, R = D.reserve;
    if (left <= 0) return;
    // ein Buddler bringt im Schnitt sein Geld nach wenigen Fuhren wieder herein – lohnt nur, wenn noch viel fehlt
    if (!this.aiNoUnits(t) && n < D.maxClonks && left > PRICE_CLONK * 3 + 40 * n && t.money >= PRICE_CLONK + R) { this.aiBuy(t, null, 'clonk'); return; }
    if (D.vehicles && n >= 3 && left > 200) {
      if (!t.res.lorry && !t.rq && t.money >= RES_BY.lorry.cost + R) { this.research(t, 'lorry'); return; }
      if (t.res.lorry && !this.vehicles.some(v => v.team === t.id && v.type === 'lorry') && t.money >= VEH.lorry.price + R) { this.aiBuy(t, null, 'lorry'); return; }
    }
  },
  // Bauplatz suchen (wie die Prüfung in build()); merkt unmögliche Gebäude eine Zeit lang (Petra: „unbuildables“)
  aiPlanSite(t, B, type) {
    const base = this.aiBases(t.id)[0] || this.structs.find(s => this.ally(s.team, t.id)) || { x: this.baseX(t.id), y: this.surf[this.baseX(t.id)] };
    const Bd = BUILD[type], hw = Bd.w >> 1;
    const cs = this.castleSiteOf(t.id), home = cs && Math.abs(base.x - this.baseX(t.id)) < 4;
    const hasCastle = this.structs.some(s => this.ally(s.team, t.id) && s.type === 'castle' && !s.remove);
    const cand = [];
    if (type === 'castle' && home) cand.push({ x: cs.x, dir: cs.d, pri: -100 }); // reserviertes Burg-Plateau zuerst
    for (let o = 50; o <= 320; o += 10) cand.push({ x: Math.round(base.x + o), dir: 1, pri: o / 10 }, { x: Math.round(base.x - o), dir: -1, pri: o / 10 });
    let best = null;
    for (const C of cand) {
      const x = C.x, dir = C.dir, sx = x - dir * (hw + 6);
      if (x - hw < 4 || x + hw > this.W - 4 || sx < 4 || sx > this.W - 4) continue;
      let y = 0; while (y < this.H - 1 && !this.solid(sx, y + 1)) y++;
      if (y >= this.H - 2 || this.matAt(sx, y) === MAT.WATER) continue;
      if (Math.abs(y - base.y) > 70) continue;
      if (this.boxHit(sx, y) || !this.boxHit(sx, y + 2)) continue;
      if (type !== 'castle' && home && !hasCastle && Math.abs(x - cs.x) < (Bd.w + BUILD.castle.w) / 2 + 4) continue; // Burgfläche freihalten
      const pc = this.placeCheck(type, x, y);
      if (pc.st === 'no') continue;
      const score = C.pri + (pc.st === 'level' ? 6 + pc.cost * 2 : 0);
      if (!best || score < best.score) best = { score, x, y, dir, sx, cost: pc.cost || 0, lv: pc.st === 'level' };
      if (pc.st === 'ok' && C.pri < 0) break;
    }
    if (best) { B.site = { type, x: best.x, y: best.y, dir: best.dir, sx: best.sx, cost: best.cost, lv: best.lv, t0: this.tick }; return true; }
    B.unbuild[type] = this.tick + 60 * 40; return false;
  },

  // ---------- Buddler-Steuerung ----------
  aiAgent(c) {
    if (!c.ai) c.ai = { t: 0, task: null, path: null, pi: 0, gx: -1, gy: -1, goalX: 0, goalY: 0, bestD: 1e9, impT: 0, lvl: 0, jumpCd: 0, replanT: 0, black: new Map(), anchorX: c.x, anchorY: c.y, anchorT: 0, moving: false, react: 0, blockT: 0, mine: -1, wander: null, idleT: 0, tool: 0 };
    return c.ai;
  },
  aiClonk(c, t, B, D, helper) {
    const A = this.aiAgent(c); A.t++;
    if (A.jumpCd > 0) A.jumpCd--;
    const k = c.aiKeys = { ...NOKEYS };
    A.moving = false;
    if (c.act === 'tumble') return this.aiStuckTrack(c, t, A, false);
    if (c.inside) { this.aiInside(c, t, B, D, A, helper); return this.aiStuckTrack(c, t, A, false); }
    if ((c.act === 'rope' || c.act === 'float') && this.aiGearCtl(c, A, k)) return this.aiStuckTrack(c, t, A, false);
    if (c.act === 'push') { this.aiPush(c, t, B, D, A, helper, k); return this.aiStuckTrack(c, t, A, A.moving); }
    if (!AI_US.off.air && this.aiAir(c, A)) { this.aiExec(c, t, B, D, A, helper, k); this.aiStuckTrack(c, t, A, A.moving); return; } // Atemnot unter Wasser: zuerst Luft holen
    if (A.task && A.task.type === 'rescue') { this.aiExec(c, t, B, D, A, helper, k); this.aiStuckTrack(c, t, A, A.moving); return; } // Rettung hat Vorrang (zeitlich begrenzt)
    if (!A.task || A.t >= A.nextThink) { A.nextThink = A.t + D.think + (c.id % 5); this.aiDecide(c, t, B, D, A, helper); }
    this.aiProtect(c, t, D, A, k);
    this.aiExec(c, t, B, D, A, helper, k);
    this.aiPitchAvoid(c, A, k);
    this.aiStuckTrack(c, t, A, A.moving);
  },
  // Rettung (rescue.js): steckt der Retter in der Wegsuche kurz vor dem Eingeschlossenen fest, sofort direkt hingraben (Rampe) statt bis zu 15 s zu warten
  aiHardLine(c, s) { let hard = 0; const L = Math.hypot(s.x - c.x, s.y - c.y); for (let d = 4; d < L - 4; d += 2) { const m = this.matAt(Math.round(c.x + (s.x - c.x) * d / L), Math.round(c.y - 5 + (s.y - c.y) * d / L)); if (SOLID[m] && !DIGGABLE[m]) hard++; } return hard; },
  aiRescueX(c, A, k) {
    const T = A.task, s = T && this.clonks.find(o => o.id === T.id);
    if (T && s && T.ph === 'path' && A.t - (A.impT || 0) > (AI_US.rpSt || 100) && Math.hypot(s.x - c.x, s.y - c.y) < (AI_US.rpD || 75) && (c.act === 'walk' || c.act === 'dig')) { T.ph = 'dig'; T.dt = A.t; T.lx = c.x; T.ly = c.y; A.path = null; }
    // Retter steckt schon unter der Erde ungefähr auf Höhe des Eingeschlossenen (eigene Mine): direkt hingraben, solange kein harter Fels auf der Linie liegt
    if (T && s && T.ph === 'go' && T.ex === undefined && !AI_US.off.rdirect && c.y > this.surf[Math.max(0, Math.min(this.W - 1, Math.round(c.x)))] + 12 && Math.abs(c.y - s.y) < 75 && Math.abs(c.x - s.x) < 170 && this.aiHardLine(c, s) < (AI_US.rdHard || 1)) { T.ex = Math.round(c.x); T.ey = Math.round(c.y); T.ph = 'dig'; T.dt = A.t; A.path = null; }
    if (AI_US.rescPath !== 0 && T && s && T.ph === 'go' && T.ex === undefined) { T.ex = Math.round(c.x); T.ey = Math.round(c.y); T.ph = 'path'; T.pt0 = A.t; A.path = null; }
    // Ausgangspunkt der Rampe: Seite wählen, auf der weniger harter Fels / Hohlraum zwischen Oberfläche und Eingeschlossenem liegt
    if (T && s && T.ph === 'go' && T.ex === undefined && !(c.y > this.surf[Math.round(c.x)] + 12 && Math.abs(c.y - s.y) < 40 && Math.abs(c.x - s.x) < 160)) {
      const sx = Math.round(s.x), depth = Math.max(0, s.y - this.surf[Math.max(0, Math.min(this.W - 1, sx))]), dx = Math.max(24, Math.min(170, depth * 1.45));
      const cost = side => { const ex = Math.round(s.x + side * dx); if (ex < 8 || ex > this.W - 8) return 1e9; const ey = this.surf[ex] - 1, L = Math.hypot(ex - s.x, ey - s.y); let h = 0, air = 0;
        for (let d = 6; d < L - 4; d += 2) for (const oy of [-9, -3]) { const m = this.matAt(Math.round(ex + (s.x - ex) * d / L), Math.round(ey + oy + (s.y - ey) * d / L)); if (SOLID[m] && !DIGGABLE[m]) h++; else if (!SOLID[m] && d > 10) air++; }
        return h * 3 + air * 0.5 + Math.abs(c.x - ex) / 40; };
      const pref = Math.sign(c.x - s.x) || 1, cp = cost(pref), co = cost(-pref);
      if (co + 4 < cp) { const ex = Math.round(s.x - pref * dx); T.ex = Math.max(8, Math.min(this.W - 8, ex)); T.ey = this.surf[T.ex] - 1; }
    }
    // direkt über dem Eingeschlossenen: senkrecht graben geht nicht (Grabwinkel ≤ 1,1 rad) → ein Stück zur Seite, dann schräg hinunter
    if (T && s && T.ph === 'dig') {
      if (T.qx === undefined || Math.hypot(c.x - T.qx, c.y - T.qy) > 2) { T.qx = c.x; T.qy = c.y; T.qt = A.t; }
      if ((T.sideT || 0) > A.t) { if (c.act === 'dig') c.act = 'walk'; k[T.sideD > 0 ? 'r' : 'l'] = 1; A.moving = true; return; }
      if (A.t - T.qt > 40 && A.t - T.qt < 90 && !AI_US.off.rbias && !((T.biasT || 0) > A.t)) { if (s.y < c.y - 6) { T.bias = -(AI_US.rBias || 0.8); T.biasT = A.t + 50; } else if (s.y < c.y + 14) { T.bias = 0.45; T.biasT = A.t + 30; } } // flach nach oben graben bleibt hängen (Schwerkraft) → steiler ansetzen
      if (A.t - T.qt > 90 && (T.rpN || 0) < 3) { // Graben kommt nicht weiter und harter Fels liegt auf der Linie → Wegsuche um den Fels herum
        const hard = this.aiHardLine(c, s);
        if (hard >= 2 || A.t - T.qt > 150) { T.rpN = (T.rpN || 0) + 1; T.ph = 'path'; T.pt0 = A.t; A.path = null; A.impT = A.t; T.qt = A.t; if (c.act === 'dig') c.act = 'walk'; return; }
      }
      if (A.t - T.qt > 90 && Math.abs(s.x - c.x) < 14 && s.y - c.y > 14) { T.sideD = (c.x <= s.x ? -1 : 1); T.sideT = A.t + 45; T.qt = A.t; if (c.act === 'dig') c.act = 'walk'; return; }
    }
    return this.aiRescue(c, A, k);
  },
  // Pechkessel: Fuß gegnerischer Wachtürme der Stufe 3 (±PITCH_W px) meiden – außer man greift genau diesen Turm im Nahkampf an
  aiPitchAvoid(c, A, k) {
    if (typeof towerLevel !== 'function' || c.inside) return;
    const W = (typeof PITCH_W !== 'undefined' ? PITCH_W : 15) + 4;
    for (const s of this.structs) {
      if (s.type !== 'tower' || s.remove || s.prog < 1 || this.ally(s.team, c.team) || towerLevel(s) < 3 || !((s.pitch | 0) > 0)) continue;
      const dx = c.x - s.x; if (Math.abs(dx) > W + 6 || c.y < s.y - 24 || c.y > s.y + 10) continue;
      const T = A.task, tgtThis = T && T.target && T.target.id === s.id;
      if (tgtThis && c.inv.some(x => THROWABLE.has(x))) { /* Fernkampf möglich: Abstand halten */ }
      else if (tgtThis) continue;
      if (Math.abs(dx) <= W) { k.l = dx < 0 ? 1 : 0; k.r = dx >= 0 ? 1 : 0; k.d = 0; A.moving = true; }
      else if ((dx > 0 && k.l) || (dx < 0 && k.r)) { k.l = 0; k.r = 0; } // nicht hineinlaufen
      return;
    }
  },
  // Utility-Auswahl der Aufgabe (höchste Bewertung gewinnt, kleine Hysterese für die laufende Aufgabe)
  aiDecide(c, t, B, D, A, helper) {
    const role = B.roles.get(c.id) || 'miner';
    const home = this.aiHome(c);
    const cand = [];
    const add = (type, s, extra) => cand.push(Object.assign({ type, s }, extra || {}));
    const golds = c.inv.filter(x => x === 'gold').length;
    // Heilen
    if (home && c.hp < D.healAt) add('heal', 1.0);
    else if (home && c.hp < 70 && A.task && A.task.type === 'heal') add('heal', 0.97);
    // Selbstverteidigung gegen nahe Gegner/Monster
    const foe = this.aiNearestFoe(c, helper ? 45 : 150, helper);
    if (foe) add('fight', (this.aiArmed(c) || c.knight ? 0.95 : 0.72) - (helper ? 0.1 : 0), { target: foe });
    this.aiAnimalThreat(c, A, add, helper);
    if (helper && B.defend && (this.aiArmed(c) || c.knight)) { const e = this.aiPick(c, B.threat.filter(e => Math.abs(e.x - c.x) < 160 && Math.abs(e.y - c.y) < 80)); if (e) add('fight', 0.9, { target: e, defend: 1 }); } // Helfer verteidigen die Basis, wenn sie bewaffnet sind
    if (!helper) {
      if (B.defend && (role === 'fighter' || (this.aiArmed(c) && B.threat.some(e => Math.abs(e.x - c.x) < 140 && Math.abs(e.y - c.y) < 70)))) { const e = this.aiPick(c, B.threat); if (e) add('fight', 0.9, { target: e, defend: 1 }); } // Bergleute verteidigen nur in der Nähe
      const spare = t.money - (B.defend ? 0 : (B.keep || 0)); // Rücklage (Gebäude) nicht fürs Ausrüsten verwenden
      if ((role === 'fighter' || (t.ai && !helper && !AI_US.off.allyArm && t.res.weapons && this.aiNoUnits(t) && spare >= 60)) && !this.aiArmedEnough(c) && home && spare >= 22) add('arm', 0.86);
      if (B.defend && t.ai && !helper && !AI_US.off.allyArm && home && t.money >= 40 && c.inv.includes('gold') && this.aiNoUnits(t) && Math.abs(home.x - c.x) < 260 && Math.abs(home.y - c.y) < 120) add('arm', 0.96); // Überfall: heim, Gold abgeben, Wurfwaffen holen // KI-Verbündeter eines Menschen darf keine Figuren kaufen → stattdessen alle eigenen Buddler ausrüsten
      if (role === 'fighter' && B.attack && (this.aiArmedEnough(c) || B.defend)) add('attack', 0.8);
      else if (role === 'fighter' && this.aiArmedEnough(c)) add('guard', (B.threat.length || B.roles.size >= 5) ? 0.45 : 0.28); // ruhige Lage: Kämpfer helfen beim Abbau
      const gun = this.vehicles.find(v => v.team === t.id && VEH[v.type].gun && !v.pusher && !v.remove);
      if (gun && role === 'fighter' && B.attack && D.k === 'hard' && c.inv.some(x => AMMO.has(x)) && (!B.gun || B.gun === c.id)) add('gun', 0.83, { veh: gun.id });
    }
    // Wirtschaft
    if (golds >= D.goldCap || (c.inv.length >= INV_MAX && golds)) add('sell', 0.9);
    else if (golds >= 2 && golds >= D.goldCap - 1 && !AI_US.off.early && (A.earlyS || c.y - this.surf[Math.max(0, Math.min(this.W - 1, Math.round(c.x)))] > AI_US.earlyDepth)) { A.earlyS = 1; add('sell', 0.86); } // Hysterese: einmal umgekehrt, bleibt es beim Heimweg (sonst Pendeln an der Tiefengrenze)
    if (golds < 2) A.earlyS = 0; // tief unten: schon bei fast voller Tasche umkehren
    if (role === 'builder' || helper) {
      if (B.site && !helper && B.builder === c.id) add('build', 0.92);
      const s = this.structs.find(s => s.team === c.team && s.prog < 1 && !s.remove) || this.structs.find(s => s.team !== c.team && this.ally(s.team, c.team) && s.prog < 1 && !s.remove && Math.abs(s.x - c.x) < 220 && Math.abs(s.y - c.y) < 90); // auch Baustellen von Verbündeten
      if (s) add('help', role === 'builder' ? 0.9 : 0.55, { sid: s.id });
    }
    const lorry = this.vehicles.find(v => v.team === t.id && v.type === 'lorry' && !v.pusher && !v.remove && v.inv.filter(x => x === 'gold').length >= 6 && !(v.haulBlock > this.tick));
    if (lorry && role !== 'fighter') add('haul', 0.88, { veh: lorry.id });
    const it = this.aiFindItem(c, B);
    if (it && canTake(c, it.type)) add('collect', 0.62, { item: it.id });
    const fullNoGold = c.inv.length >= INV_MAX && !golds; // Taschen voll mit Waffen: kann nicht abbauen → Wache halten
    if (fullNoGold) { if (home) add('guard', 0.42); }
    else if (role !== 'fighter' || !B.attack || !this.aiArmedEnough(c)) add('mine', role === 'fighter' ? (B.attack ? 0.5 : 0.3) : 0.5); // unbewaffnete Kämpfer arbeiten statt untätig zu warten
    // laufende Fahrzeug-/Turm-Aufgaben nicht ständig unterbrechen
    if (A.task && (A.task.type === 'park' || A.task.type === 'haul' || A.task.type === 'gun') && this.vehById(A.task.veh)) add(A.task.type, 0.87, { veh: A.task.veh, x: A.task.x });
    if (!helper && B.defend && this.aiArmed(c)) {
      const tw = this.structs.find(s => s.team === c.team && s.type === 'tower' && s.prog >= 1 && !s.remove && Math.abs(s.x - c.x) < 220);
      if (tw && Math.abs(c.y - tw.y) < 40 && B.threat.some(e => Math.abs(e.x - tw.x) < 200)) add('tower', 0.93, { sid: tw.id, until: A.t + 1200 });
    }
    if (D.idleP && golds < 2 && !foe && this.rand() < D.idleP) add('idle', 0.7, { until: A.t + 50 + (this.rand() * 70 | 0) }); // Leicht: trödelt ab und zu (aber nicht mit vollen Taschen oder im Kampf)
    if (A.wander && A.wander.until > A.t) add('wander', 1.05, A.wander);
    let best = null;
    for (const o of cand) { if (A.task && A.task.type === o.type) o.s += 0.08; if (!best || o.s > best.s) best = o; }
    if (!best) best = { type: 'idle', s: 0, until: A.t + 30 };
    if (A.task && A.task.type === best.type) { // gleiche Aufgabe: Parameter übernehmen (Ziel nicht ständig wechseln)
      if (best.target) A.task.target = best.target; if (best.item) A.task.item = best.item;
      if (best.animal && !A.task.animal) Object.assign(A.task, { animal: 1, hunt: best.hunt, until: best.until }); else if (!best.animal && A.task.animal && best.type === 'fight') { A.task.animal = 0; }
      return;
    }
    if (A.task && A.task.type === 'idle' && A.task.until > A.t && best.type !== 'heal' && best.type !== 'fight') return;
    if (best.type === 'idle' && !(best.until > A.t)) best.until = A.t + 40;
    if (A.task && A.task.item) B.itemClaims.delete(A.task.item);
    if (best.item) B.itemClaims.set(best.item, c.id);
    best.t0 = A.t; A.task = best; A.path = null;
  },
  aiArmedEnough(c) { return c.knight || hasG(c, 'sword') || c.inv.filter(x => THROWABLE.has(x)).length >= 1 || (hasG(c, 'bow') && c.arrows > 3); },
  aiNearestFoe(c, r, helper) {
    let best = null, bd = r;
    for (const o of this.clonks) { if (this.ally(o.team, c.team) || o.act === 'dead' || o.inside) continue; const d = Math.hypot(o.x - c.x, (o.y - c.y) * 1.6); if (d < bd) { bd = d; best = o; } }
    for (const m of this.monsters) { if (!(m.chg > 0 || m.bite > 0) && m.foe !== c.id) continue; const d = Math.hypot(m.x - c.x, (m.y - c.y) * 1.6); if (d < Math.min(bd, 70)) { bd = d; best = m; } } // nur angreifende Wildschweine
    return best;
  },
  // Tiere: auf Angriffe reagieren (Wildschwein: wehren oder ausweichen, Hai: raus aus dem Wasser), gelegentlich Wildschweine jagen
  aiInWater(c) { return this.matAt(c.x, c.y - 4) === MAT.WATER || c.act === 'swim'; },
  aiShore(c, away) {
    for (let d = 8; d <= 260; d += 6) for (const s of [away || 1, -(away || 1)]) {
      const x = Math.round(c.x + s * d); if (x < 3 || x >= this.W - 3) continue;
      const y = this.surf[x]; if (this.matAt(x, y) !== MAT.WATER && this.matAt(x, y - 2) !== MAT.WATER && this.matAt(x, y + 2) !== MAT.WATER && Math.abs(y - c.y) < 90) return { x, y };
    }
    return null;
  },
  aiAnimalThreat(c, A, add, helper) {
    const hit = c.aHit && this.tick - c.aHit.t < 240 ? c.aHit : null;
    // Hai in der Nähe, während man schwimmt (oder gerade gebissen): ans Ufer
    if (this.aiInWater(c)) {
      let sh = null, bd = hit && hit.k === 'shark' ? 140 : 75;
      for (const a of this.animals) if (a.k === 'shark' && !a.remove) { const d = Math.hypot(a.x - c.x, a.y - (c.y - 5)); if (d < bd) { bd = d; sh = a; } }
      if (sh) { const p = this.aiShore(c, Math.sign(c.x - sh.x)); add('flee', 1.02, { x: p ? p.x : c.x + Math.sign(c.x - sh.x) * 60, y: p ? p.y : c.y - 30, until: A.t + 360, why: 'shark' }); return; }
    }
    // Wildschwein greift an: bewaffnet/gesund → zurückschlagen, sonst ausweichen
    let boar = null, bd = 90;
    for (const m of this.monsters) { if (m.remove || m.hp <= 0) continue; const mine = m.foe === c.id || (hit && hit.k === 'boar' && hit.id === m.id); if (!(m.chg > 0 || m.bite > 0) && !mine) continue; const d = Math.hypot(m.x - c.x, m.y - c.y); if (d < bd && (mine || d < 40)) { bd = d; boar = m; } }
    if (boar) {
      if (this.aiArmed(c) || c.knight || c.hp > 35) add('fight', 0.98, { target: boar, animal: 1, until: A.t + 300 });
      else add('flee', 0.99, { x: c.x + (Math.sign(c.x - boar.x) || 1) * 90, y: c.y, until: A.t + 200, why: 'boar' });
      return;
    }
    // Goldvogel abschießen (nur mit Bogen), sonst sammeln sie das fallengelassene Gold ohnehin ein
    if (hasG(c, 'bow') && c.arrows > 0) for (const a of this.animals) if (a.k === 'bird' && a.steal && !a.remove && Math.abs(a.x - c.x) < 170 && Math.abs(a.y - c.y) < 110) { add('fight', 0.7, { target: a, animal: 1, hunt: 1, until: A.t + 300 }); return; }
    // Gelegenheitsjagd: ruhiges Wildschwein in der Nähe, gut bewaffnet, keine Eile
    if (!helper && (A.huntCd || 0) < A.t && c.hp > 60 && (hasG(c, 'sword') || (hasG(c, 'bow') && c.arrows > 2) || c.knight)) {
      for (const m of this.monsters) if (!m.remove && !m.flee && !m.chg && Math.abs(m.x - c.x) < 110 && Math.abs(m.y - c.y) < 40) { add('fight', 0.6, { target: m, animal: 1, hunt: 1, until: A.t + 600 }); A.huntCd = A.t + 2400; break; }
    }
  },
  aiPick(c, list) { let best = null, bd = 1e9; for (const o of list) { if (o.act === 'dead' || o.inside) continue; const d = Math.hypot(o.x - c.x, o.y - c.y) + o.hp * 0.6; if (d < bd) { bd = d; best = o; } } return best; },
  aiFindItem(c, B) {
    let best = null, bd = 160;
    for (const it of this.items) {
      if (it.remove || it.stuck || it.armed || it.fuse > 0 || it.chain || it.type === 'arrow') continue;
      if (it.type !== 'gold' && !THROWABLE.has(it.type) && it.type !== 'arrows' && !(GEAR.has(it.type) && it.type !== 'hook') && it.type !== 'armor') continue;
      if (!canTake(c, it.type)) continue;
      const cl = B.itemClaims.get(it.id); if (cl && cl !== c.id) continue;
      const d = Math.hypot(it.x - c.x, (it.y - c.y) * 1.5); if (d < bd && !(c.ai.black.get('i' + it.id) > this.tick)) { bd = d; best = it; }
    }
    return best;
  },

  // ---------- Ausführung ----------
  aiExec(c, t, B, D, A, helper, k) {
    const T = A.task; if (!T) return;
    const home = this.aiHome(c);
    switch (T.type) {
      case 'idle': if (c.act === 'dig') c.act = 'walk'; if (A.t > T.until) A.task = null; return;
      case 'wander': if (this.aiGoto(c, A, k, T.x, T.y, 6) || A.t > T.until) { A.task = null; A.wander = null; } return;
      case 'heal':
        if (!home) { A.task = null; return; }
        this.aiStat0(c, 'heilt');
        { // Tür = Gebäudemitte (use() braucht < 14 px Abstand; nearBase() reicht bis an den Rand)
          const nb = this.nearBase(c);
          if (nb && Math.abs(c.x - nb.x) < 11 && c.y >= nb.y + 4 && !AI_US.off.healUp && !(this.aiNearestFoe && this.aiNearestFoe(c, 36, false))) { if (golds(c)) this.aiSell(c); if (c.act === 'dig') c.act = 'walk'; A.moving = true; k.u = 1; if (Math.abs(c.x - nb.x) > 3) k[nb.x > c.x ? 'r' : 'l'] = 1; } // in einer Mulde unter der Tür: use() verlangt y < Tür+5 → erst hochspringen
          else if (nb && Math.abs(c.x - nb.x) < 11) { if (golds(c)) this.aiSell(c); if (c.act === 'dig') c.act = 'walk'; this.use(c); }
          else if (nb && !AI_US.off.healgo && (c.act === 'climb' || c.act === 'hangle' || c.y > nb.y + 10)) { if (this.aiGoto(c, A, k, nb.x, nb.y, 8)) { A.moving = true; k[nb.x > c.x ? 'r' : 'l'] = 1; } } // tiefer als die Tür (Grube/Schacht am Rand): richtige Wegsuche statt gegen die Wand drücken
          else if (nb) { A.moving = true; if (c.act === 'dig') c.act = 'walk'; k[nb.x > c.x ? 'r' : 'l'] = 1; }
          else { const hs = this.aiTaskSpot(c, A, home); if (this.aiGoto(c, A, k, hs.x, hs.y, 3)) { A.moving = true; k[home.x > c.x ? 'r' : 'l'] = 1; } }
        }
        return;
      case 'sell':
        if (!home) { A.task = null; return; }
        if (this.nearBase(c)) { this.aiSell(c); this.aiArmUp(c, t, D); this.aiToolUp(c, t, D); A.task = null; return; }
        { const sp = this.aiTaskSpot(c, A, home); if (this.aiGoto(c, A, k, sp.x, sp.y, 2) && !this.nearBase(c)) { A.arrived = false; A.moving = true; k[home.x > c.x ? 'r' : 'l'] = 1; } } return;
      case 'arm':
        if (!home) { A.task = null; return; }
        if (this.nearBase(c)) { if (B.defend && t.ai && !helper && golds(c) && !AI_US.off.allyArm && this.aiNoUnits(t)) this.aiSell(c); this.aiArm(c, t, D); A.task = null; return; } // Verbündeter eines Menschen im Überfall: Gold abgeben, Platz für Wurfwaffen
        { const sp = this.aiTaskSpot(c, A, home); if (this.aiGoto(c, A, k, sp.x, sp.y, 2) && !this.nearBase(c)) { A.arrived = false; A.moving = true; k[home.x > c.x ? 'r' : 'l'] = 1; } } return;
      case 'collect': {
        const it = this.items.find(i => i.id === T.item);
        if (!it || it.remove || it.stuck || !canTake(c, it.type)) { B.itemClaims.delete(T.item); A.task = null; return; }
        if (this.aiGoto(c, A, k, it.x, it.y, 3)) { if (!this.grabNear(c)) { A.black.set('i' + it.id, this.tick + 1800); A.task = null; } }
        return;
      }
      case 'build': {
        const S = B.site; if (!S || B.builder !== c.id) { A.task = null; return; }
        if (this.tick - S.t0 > 60 * 60) { B.unbuild[S.type] = this.tick + 60 * 30; B.site = null; A.task = null; return; }
        if (this.aiGoto(c, A, k, S.sx, S.y, 2) && c.act === 'walk') {
          c.dir = S.dir; const n0 = this.structs.length; this.build(c, S.type, { x: S.x, y: S.y });
          if (this.structs.length > n0) { B.buildId = this.structs[this.structs.length - 1].id; B.site = null; A.task = { type: 'help', sid: B.buildId, s: 0.9 }; }
          else { B.unbuild[S.type] = this.tick + 60 * 25; B.site = null; A.task = null; }
        }
        return;
      }
      case 'help': {
        const s = this.structs.find(o => o.id === T.sid);
        if (!s || s.prog >= 1 || s.remove) { A.task = null; return; }
        const off = ((c.id % 3) - 1) * 6;
        if (s.lv) { // beim Planieren am Rand der Baufläche stehen (Mitte kann noch Hügel/Loch sein)
          const ex = s.x + (c.x < s.x ? -1 : 1) * ((s.w >> 1) + 2);
          if (this.aiGoto(c, A, k, ex, s.y, 4)) { if (c.act === 'dig') c.act = 'walk'; }
          return;
        }
        if (this.aiGoto(c, A, k, s.x + off, s.y, 4)) { if (c.act === 'dig') c.act = 'walk'; }
        return;
      }
      case 'mine': return this.aiMine(c, t, B, D, A, k, home);
      case 'haul': case 'park': return this.aiHaulStart(c, t, B, A, k);
      case 'tower': {
        const s = this.structById(T.sid); if (!s || s.remove || (T.until && A.t > T.until)) { A.task = null; return; }
        if (this.aiGoto(c, A, k, s.x, s.y, 4) && c.act === 'walk') { this.use(c); if (!c.inside) A.task = null; }
        return;
      }
      case 'gun': {
        const v = this.vehById(T.veh); if (!v || v.pusher) { A.task = null; return; }
        if (this.aiGoto(c, A, k, v.x, v.y, 5) && (c.act === 'walk')) { this.use(c); if (c.act === 'push') B.gun = c.id; else A.task = null; }
        return;
      }
      case 'fight': case 'attack': case 'guard':
        if (T.animal) { // Tierkampf: zeitlich begrenzt, flüchtende Tiere nicht verfolgen
          const m = T.target;
          if (!m || m.remove || m.hp <= 0 || A.t > T.until || (m.wind > 0 && !(m.bite > 0) && !T.hunt) || Math.abs(m.x - c.x) > 170) { A.task = null; A.huntCd = Math.max(A.huntCd || 0, A.t + 1800); return; }
        }
        return this.aiCombat(c, t, B, D, A, k, home);
      case 'rescue': return this.aiRescueX(c, A, k);
      case 'flee': // ausweichen / Wasser verlassen
        if (this.aiGoto(c, A, k, T.x, T.y, 6) || A.t > T.until || (T.why === 'shark' && !this.aiInWater(c) && c.act === 'walk') || (T.why === 'air' && c.breath > 95)) A.task = null;
        return;
    }
  },
  aiStat0(c, s) { c.aiS = s; },
  aiArm(c, t, D) {
    const Bt = t.brain, R = Math.max(0, D.reserve - 10) + (Bt && !Bt.defend ? (Bt.keep || 0) : 0);
    if (c.knight && c.arrows < 6 && t.money >= 6 + R) this.aiBuy(t, c, 'arrows');
    // wer schon öfter feststeckte, nimmt einen Enterhaken mit (Mittel/Schwer)
    if (D.k !== 'easy' && (c.stuckN || 0) >= 2 && !hasG(c, 'hook') && t.money >= ITEMS.hook.price + R) this.aiBuy(t, c, 'hook');
    if (t.res.weapons && !hasG(c, 'sword') && t.money >= ITEMS.sword.price + R) this.aiBuy(t, c, 'sword');
    if (t.res.weapons && hasG(c, 'sword') && !hasG(c, 'shield') && t.money >= ITEMS.shield.price + R) this.aiBuy(t, c, 'shield');
    if (t.res.weapons && !c.armor && t.money >= ITEMS.armor.price + R + 20) this.aiBuy(t, c, 'armor');
    let g = 0; const keep = (hasG(c, 'sword') ? 1 : 0) + (hasG(c, 'shield') ? 1 : 0); /* Platz für Gold lassen wie früher (Schwert/Schild belegten Inventar) */ while (c.inv.length + keep < INV_MAX && g++ < 3) { const it = t.res.tnt && t.money >= ITEMS.tnt.price + R + 30 && this.rand() < 0.3 ? 'tnt' : 'flint'; if (t.money < ITEMS[it].price + R) break; this.aiBuy(t, c, it); }
  },
  // Bergbau: nächste Goldzelle wählen (mit Reservierung, damit sich die Bergleute verteilen), hingraben, voll → verkaufen
  aiMine(c, t, B, D, A, k, home) {
    const N = this.nav;
    if (this.aiFootGuard(c, A, k)) return; // Fundamentschutz: nie unter Gebäuden/Mauern graben (wie specLeaveFoot)
    if (A.mine >= 0 && A.oreId && this.nearestGold && !this.aiGoldLeft(A.mine)) { // Golderz: nächstes Goldpixel desselben Brockens
      const g = this.nearestGold(c.x, c.y - 5, 400, o => o.id !== A.oreId);
      const i = g ? this.aiGoldCellOf(g.x, g.y) : -1; A.mine = i; B.claims.set(c.id, i); A.path = null; if (i < 0) A.oreId = 0;
    }
    if (A.mine >= 0 && !A.oreId && !N.gold[A.mine]) { // Zelle abgebaut → Nachbarzelle derselben Ader bevorzugen
      const mx = A.mine % N.gw, my = (A.mine / N.gw) | 0; let nb = -1, bd = 1e9;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const i = (my + dy) * N.gw + mx + dx; if (i >= 0 && i < N.gold.length && N.gold[i] && !this.aiClaimedByOther(B, i, c.id)) { const d = Math.abs(dx) + Math.abs(dy); if (d < bd) { bd = d; nb = i; } } }
      A.mine = nb; B.claims.set(c.id, nb); A.path = null;
    }
    if (A.mine < 0 || (A.black.get('g' + A.mine) > this.tick)) { A.mine = this.aiChooseGold(c, t, B, home); B.claims.set(c.id, A.mine); A.path = null; }
    if (A.mine < 0) { // kein Gold mehr erreichbar: lose Gegenstände suchen oder in der Nähe der Basis graben (eingebettete Objekte)
      this.aiStat0(c, 'sucht Gold');
      if (!A.explore || A.t > A.explore.until) { const bx = home ? home.x : c.x; A.explore = { x: Math.max(10, Math.min(this.W - 10, bx + (this.rand() - 0.5) * 500)), y: (home ? home.y : c.y) + 40 + this.rand() * 120, until: A.t + 600 }; }
      if (this.aiGoto(c, A, k, A.explore.x, A.explore.y, 6)) A.explore = null;
      return;
    }
    this.aiStat0(c, 'baut Gold ab');
    const gx = A.mine % N.gw, gy = (A.mine / N.gw) | 0;
    const tx = gx * NC + 2.5, ty = gy * NC + NC;
    if (A.lorryLoad) return this.aiLoadLorry(c, t, A, k);
    // Lore an die Mine holen (Mittel/Schwer, wenn die Mine weit weg ist)
    if (D.vehicles && home && Math.abs(tx - home.x) > 160 && !A.parked) {
      const v = this.vehicles.find(o => o.team === t.id && o.type === 'lorry' && !o.pusher && !o.remove && Math.abs(o.x - home.x) < 90 && !(o.haulBlock > this.tick));
      if (v) { A.task = { type: 'park', veh: v.id, x: tx, s: 0.8 }; A.parked = 1; return this.aiHaulStart(c, t, B, A, k); }
    }
    if (c.inv.length >= INV_MAX) { // voll: Gold in die nahe Lore laden, sonst heim
      const v = this.vehicles.find(o => o.team === t.id && o.type === 'lorry' && !o.pusher && Math.abs(o.x - c.x) < 160 && Math.abs(o.y - c.y) < 160 && o.inv.length < VEH.lorry.cap - 3);
      if (v && D.vehicles) { A.lorryLoad = v.id; A.path = null; return; }
      A.task = { type: 'sell', s: 0.9 }; A.path = null; return;
    }
    this.aiGoto(c, A, k, tx, ty, 2, true);
    // Gold in Reichweite (z. B. in der Decke): nicht klettern/hangeln, sondern landen und schräg hineingraben
    const ndx = tx - c.x, ndy = ty - c.y;
    if (!A.arrived && Math.abs(ndx) < 18 && ndy > -24 && ndy < 8) {
      if (c.act === 'climb' || c.act === 'hangle') { k.l = k.r = k.u = 0; k.d = 1; A.moving = true; return; }
      if (c.act === 'walk' || c.act === 'dig') A.arrived = true;
    }
    if (A.arrived) { // im Goldfeld: weitergraben Richtung Zellmitte
      if (c.act === 'walk' || c.act === 'fight') { c.act = 'dig'; c.digIdle = 0; c.vx = 0; }
      if (c.act === 'dig') { const dx = tx - c.x, dy = ty - 3 - (c.y - 5); if (Math.abs(dx) > 1) c.dir = Math.sign(dx); c.digA = Math.max(-1.1, Math.min(1.5, Math.atan2(dy, Math.max(1.5, Math.abs(dx))))); }
      A.moving = true;
      if (c.mineT && this.tick - c.mineT < 40) A.mineT = 0; // Golderz: Hiebe alle ORE_HIT_T Ticks = Fortschritt
      if ((A.mineT = (A.mineT || 0) + 1) > 240) { A.black.set('g' + A.mine, this.tick + 3600); if (A.oreId) A.black.set('o' + A.oreId, this.tick + 2400); A.mine = -1; A.oreId = 0; A.mineT = 0; }
    } else A.mineT = 0;
  },
  aiLavaRisk(N, gx, gy) { if (!N.lavaN) return false; for (let dy = -4; dy <= 3; dy++) { const y = gy + dy; if (y < 0 || y >= N.gh) continue; for (let dx = -4; dx <= 4; dx++) { const x = gx + dx; if (x >= 0 && x < N.gw && N.lv[y * N.gw + x]) return true; } } return false; },
  aiUnderBase(tid, x, y) {
    for (const s of this.structs) if (BUILD[s.type].base && this.ally(s.team, tid) && !s.remove && Math.abs(x - s.x) < s.w / 2 + 14 && y > s.y - 4 && y < s.y + 48) return true;
    const cs = this.castleSiteOf && this.castleSiteOf(tid); // reservierter Burgplatz: Untergrund nicht aushöhlen, sonst ist er später unbebaubar
    if (cs && !this.structs.some(s => s.type === 'castle' && this.ally(s.team, tid) && !s.remove) && Math.abs(x - cs.x) < BUILD.castle.w / 2 + 8 && y > cs.y - 4 && y < cs.y + 40) return true;
    return false;
  },
  aiClaimedByOther(B, i, id) { for (const [cid, ci] of B.claims) if (cid !== id && ci >= 0 && Math.abs((ci % this.nav.gw) - (i % this.nav.gw)) < 6 && Math.abs(((ci / this.nav.gw) | 0) - ((i / this.nav.gw) | 0)) < 6) return true; return false; },
  // Goldquellen gekapselt: Golderz-API (world.goldDeposits/nearestGold, Brocken mit ~15 Gold, je Hieb 1 Gold) – Fallback: Goldpixel im Raster.
  // Alles, was „wo ist Gold, wie viel, wo graben“ betrifft, steckt in aiChooseGold/aiGoldCellOf/aiGoldRich – aiMine bleibt unabhängig davon.
  aiGoldCellOf(x, y) { const N = this.nav, gx = Math.max(0, Math.min(N.gw - 1, Math.floor(x / NC))), gy = Math.max(0, Math.min(N.gh - 1, Math.floor(y / NC))); return gy * N.gw + gx; },
  aiGoldCells() { return this.nav.goldSet; },
  aiGoldLeft(i) { const N = this.nav, x0 = (i % N.gw) * NC, y0 = ((i / N.gw) | 0) * NC; for (let y = y0; y < y0 + NC; y++) for (let x = x0; x < x0 + NC; x++) if (this.matAt(x, y) === MAT.GOLD) return true; return false; },
  aiGoldRich(i) { const N = this.nav, gw = N.gw; let rich = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const j = i + dy * gw + dx; if (j >= 0 && j < N.gold.length && N.gold[j]) rich++; } return rich; },
  aiGoldOk(c, B, x, y, i) { // gemeinsame Filter: gesperrt, Lava (Vulkan), Fundament der Basis, Kollege gräbt dort
    const N = this.nav, gx = i % N.gw, gy = (i / N.gw) | 0;
    if (c.ai.black.get('g' + i) > this.tick) return false;
    if (N.lavaNear(gx, gy) || this.aiLavaRisk(N, gx, gy)) return false; // Vulkan: Gold mit Lava in der Nachbarschaft meiden (Lava fließt in den Stollen)
    if (this.aiUnderBase(c.team, x, y)) return false; // Fundament der eigenen Hütte/Burg nicht aushöhlen
    return !this.aiClaimedByOther(B, i, c.id);
  },
  // Hohlraum über dem Erz (unterirdische Höhle zwischen Erz und Oberfläche): mit voller Tasche kommt man aus einer Höhle schlecht wieder hinauf → Erz abwerten
  aiCaveAbove(x, y) {
    const N = this.nav, gx = Math.max(0, Math.min(N.gw - 1, Math.floor(x / NC))), key = gx * 100000 + Math.floor(y / NC), C = this.aiCaveC || (this.aiCaveC = new Map()), h = C.get(key);
    if (h && this.tick - h.t < 1500) return h.v;
    const sy = this.surf[Math.max(0, Math.min(this.W - 1, Math.round(x)))]; let v = 0;
    for (let gy = Math.floor(y / NC) - 2; gy * NC > sy + 8; gy--) { const ty = N.c[gy * N.gw + gx]; if (ty === NV_AIR || ty === NV_WATER) v++; }
    C.set(key, { t: this.tick, v }); return v;
  },
  aiChooseGold(c, t, B, home) {
    const A = c.ai, hx = home ? home.x : c.x, hy = home ? home.y : c.y;
    // Golderz: Brocken nach Nähe zu Basis/Buddler und Restertrag wählen; Ziel = nächstes Goldpixel (liegt es im Fels, ist der Brocken nur von der Erdseite erreichbar → überspringen)
    if (this.goldDeposits && this.nearestGold) { // Golderz-API
      let best = null, bs = 1e9;
      for (const o of this.goldDeposits(1)) {
        if (A.black.get('o' + o.id) > this.tick) continue;
        const s = Math.abs(o.x - hx) * 1.0 + Math.max(0, o.y - hy) * 1.6 + Math.hypot(o.x - c.x, o.y - c.y) * 0.5 - Math.min(20, o.yield) * 6 + (AI_US.off.cave ? 0 : this.aiCaveAbove(o.x, o.y) * AI_US.caveW);
        if (s < bs) { const g = this.nearestGold(c.x, c.y - 5, 1e9, q => q.id !== o.id); if (!g) continue; const i = this.aiGoldCellOf(g.x, g.y); if (this.nav.c[i] === NV_HARD || !this.aiGoldOk(c, B, g.x, g.y, i)) continue; bs = s; best = { o, i }; }
      }
      A.oreId = best ? best.o.id : 0;
      return best ? best.i : -1;
    }
    const N = this.nav, gw = N.gw; let best = -1, bs = 1e9, n = 0;
    for (const i of this.aiGoldCells()) {
      if (n++ > 4000) break;
      const x = (i % gw) * NC, y = ((i / gw) | 0) * NC;
      if (!this.aiGoldOk(c, B, x, y, i)) continue;
      const s = Math.abs(x - hx) * 1.0 + Math.max(0, y - hy) * 1.6 + Math.hypot(x - c.x, y - c.y) * 0.5 - this.aiGoldRich(i) * 9;
      if (s < bs) { bs = s; best = i; }
    }
    return best;
  },
  aiLoadLorry(c, t, A, k) {
    const v = this.vehById(A.lorryLoad);
    if (!v || v.pusher || !c.inv.includes('gold')) { A.lorryLoad = 0; return; }
    if (this.aiGoto(c, A, k, v.x, v.y, 5) && c.act === 'walk') {
      this.use(c);
      if (c.act === 'push') { let g = 0; while (c.inv.includes('gold') && g++ < 3) { c.slot = c.inv.indexOf('gold'); this.loadLorry(v, c); } this.release(c); }
      A.lorryLoad = 0;
    }
  },
  aiHaulStart(c, t, B, A, k) {
    const T = A.task, v = this.vehById(T.veh);
    if (!v || (v.pusher && v.pusher !== c.id)) { A.task = null; return; }
    if (this.aiGoto(c, A, k, v.x, v.y, 5) && c.act === 'walk') { this.use(c); if (c.act !== 'push') { v.haulBlock = this.tick + 1200; A.task = null; } else { A.pushT = 0; A.pushBest = 1e9; } }
  },
  // Fahrzeug schieben: Lore heimbringen/parken, Geschütz in Stellung bringen und feuern
  aiPush(c, t, B, D, A, helper, k) {
    const v = this.vehById(c.veh); const T = A.task;
    if (!v || !T || (T.type !== 'haul' && T.type !== 'park' && T.type !== 'gun')) { this.release(c); return; }
    const home = this.aiHome(c);
    let tx;
    if (T.type === 'haul') { if (!home) { this.release(c); A.task = null; return; } if (this.nearBase(c)) { this.aiSell(c); this.release(c); A.task = null; return; } tx = home.x; }
    else if (T.type === 'park') { tx = T.x; if (Math.abs(v.x - tx) < 14) { this.release(c); A.task = { type: 'mine', s: 0.5 }; return; } }
    else { // Geschütz
      const tgt = this.aiGunTarget(c, t, B);
      if (!tgt || !c.inv.some(x => AMMO.has(x)) && !v.inv.some(x => AMMO.has(x))) { this.release(c); B.gun = 0; A.task = null; return; }
      const dist = Math.abs(tgt.x - v.x);
      if (dist > 280) tx = tgt.x;
      else {
        const sol = this.aiSolveGun(v, tgt.x, tgt.y, D);
        if (sol) { k.am = 1; k.ax = Math.round(v.x + Math.sign(tgt.x - v.x) * 100 * Math.cos(sol.th)); k.ay = Math.round(v.y - 6 - 100 * Math.sin(sol.th)); if (Math.abs(v.ang - sol.th) < 0.04 && v.dir === Math.sign(tgt.x - v.x) && v.cd <= 0 && A.t % 4 === 0) this.primary(c, null); }
        else tx = tgt.x;
        if (tx === undefined) return;
      }
    }
    const dx = tx - v.x; if (Math.abs(dx) > 4) k[dx > 0 ? 'r' : 'l'] = 1;
    A.moving = true;
    A.pushT = (A.pushT || 0) + 1; const d = Math.abs(dx);
    if (d < (A.pushBest || 1e9) - 3) { A.pushBest = d; A.pushT = 0; }
    if (A.pushT > 150) { v.haulBlock = this.tick + 1800; this.release(c); A.task = null; A.pushBest = 1e9; t.stats.stuckEv++; }
  },
  aiGunTarget(c, t, B) {
    const tid = B.target; let best = null, bd = 1e9;
    for (const o of this.clonks) if (!this.ally(o.team, t.id) && o.act !== 'dead' && !o.inside) { const d = Math.abs(o.x - c.x); if (d < bd) { bd = d; best = { x: o.x, y: o.y - 5 }; } }
    for (const s of this.structs) if (!this.ally(s.team, t.id) && !s.remove && (tid === undefined || s.team === tid)) { const d = Math.abs(s.x - c.x) + 60; if (d < bd) { bd = d; best = { x: s.x, y: s.y - s.h / 2 }; } }
    return best;
  },
  aiSolveGun(v, tx, ty, D) {
    const d = VEH[v.type], dir = Math.sign(tx - v.x) || 1; let best = null;
    for (let th = d.amin; th <= d.amax + 1e-6; th += 0.025) {
      const mx = v.x + dir * Math.cos(th) * d.w * 0.55, my = v.y - d.h + 1 - Math.sin(th) * 5;
      const r = aiSimShot(this, mx, my, dir * Math.cos(th) * d.speed, -Math.sin(th) * d.speed, 0.1, tx, ty, 160);
      if (!best || r.d < best.d) best = { th, d: r.d };
    }
    if (!best || best.d > 14) return null;
    best.th += aiGauss(this.rand) * D.aimErr * 0.6; return best;
  },
  aiInside(c, t, B, D, A, helper) {
    const s = this.structById(c.inside); if (!s) return;
    const T = A.task;
    if (T && T.type === 'heal') { if (c.hp >= 92 || (!helper && B.defend && c.hp > 60 && this.aiArmed(c))) { this.leave(c); A.task = null; } return; }
    if (T && T.type === 'tower') { // vom Turm aus werfen/schießen
      const e = this.aiNearestFoe(c, 230, false);
      if (!e || !this.aiArmed(c) || A.t > T.until) { this.leave(c); A.task = null; return; }
      if (c.cd <= 0 && A.t >= A.react) { A.react = A.t + D.react; this.aiRanged(c, e, D, true); }
      return;
    }
    this.leave(c);
  },
  // Projektile erkennen: mit Schild blocken (zum Werfer drehen) oder wegspringen
  aiProtect(c, t, D, A, k) {
    if (A.blockT > 0) { A.blockT--; if (hasG(c, 'shield')) { k.b = 1; c.dir = A.blockDir || c.dir; } return; }
    if (!D.evade && !hasG(c, 'shield')) return;
    if ((A.t + c.id) % 3) return;
    for (const it of this.items) {
      if (!it.armed || it.remove) continue;
      const own = this.clonks.find(o => o.id === it.owner); if (own && this.ally(own.team, c.team)) continue;
      const sp = Math.hypot(it.vx, it.vy); if (sp < 1.4) continue;
      let x = it.x, y = it.y, vx = it.vx, vy = it.vy, hit = false;
      for (let s = 0; s < 18; s++) { vy += 0.1; x += vx; y += vy; if (Math.abs(x - c.x) < 7 && y > c.y - 13 && y < c.y + 3) { hit = true; break; } }
      if (!hit) continue;
      if (hasG(c, 'shield') && this.rand() < D.blockP && (c.act === 'walk' || c.act === 'fight')) { A.blockT = 16; A.blockDir = Math.sign(it.x - c.x) || c.dir; k.b = 1; c.dir = A.blockDir; }
      else if (this.rand() < D.evade && c.act === 'walk' && A.jumpCd <= 0) { k[it.vx > 0 ? 'r' : 'l'] = 1; this.clonkAction(c, 'jump'); A.jumpCd = 30; }
      return;
    }
  },
  // Kampf: Ziel wählen, auf Wurfweite gehen, ballistisch werfen/schießen; Nahkampf mit Schwert und Schild
  aiCombat(c, t, B, D, A, k, home) {
    const T = A.task;
    let tgt = T.target && T.target.act !== 'dead' && !T.target.remove && !T.target.inside ? T.target : null;
    if (T.type === 'guard') { // vor der eigenen Basis Stellung halten
      if (!home) { A.task = null; return; }
      const gx = home.x + (B.target !== undefined && this.baseX(B.target) < home.x ? -50 : 50);
      this.aiGoto(c, A, k, gx, home.y, 10); if (A.arrived && c.act === 'dig') c.act = 'walk';
      const e = this.aiNearestFoe(c, 160, false); if (e) { A.task = { type: 'fight', target: e, s: 0.9 }; }
      return;
    }
    if (T.type === 'attack') {
      const tid = B.target;
      if (!tgt || A.t % 30 === 0) { let best = null, bd = 1e9; for (const o of this.clonks) { if (this.ally(o.team, t.id) || o.act === 'dead' || o.inside) continue; const d = Math.abs(o.x - c.x) + Math.abs(o.y - c.y) * 2 + (o.team === tid ? 0 : 300); if (d < bd) { bd = d; best = o; } } tgt = best; T.target = best; }
      if (!tgt) { // niemand draußen: feindliche Gebäude angreifen
        // ausgebaute Türme (Stufe ≥ 1: +150 Struktur, ab 2 Schütze mit Reichweite 200, ab 3 Pech am Fuß) zuletzt angreifen
        const sc = o => Math.abs(o.x - c.x) + (o.type === 'tower' && typeof towerLevel === 'function' ? (towerLevel(o) >= 1 ? 250 : 0) + (towerLevel(o) >= 2 && (o.arrows | 0) > 0 ? 200 : 0) + (towerLevel(o) >= 3 && (o.pitch | 0) > 0 ? 400 : 0) : 0);
        const s = this.structs.filter(o => !this.ally(o.team, t.id) && !o.remove).sort((a, b) => sc(a) - sc(b))[0];
        if (!s) { A.task = null; return; }
        tgt = { x: s.x, y: s.y - Math.min(10, s.h / 3) + 5, struct: s, vx: 0, vy: 0, hp: 50, act: 'walk' };
      }
      // Schwer: koordinieren – warten, bis genug Kämpfer am Sammelpunkt sind
      if (D.group > 1 && home && !A.rallied) {
        const mates = this.clonks.filter(o => o.team === t.id && o.act !== 'dead' && B.roles.get(o.id) === 'fighter');
        const rx = home.x + Math.sign(tgt.x - home.x) * 70;
        const near = mates.filter(o => Math.abs(o.x - rx) < 40).length;
        if (near >= Math.min(D.group, mates.length) || A.t - (A.rallyT || (A.rallyT = A.t)) > 900) A.rallied = true;
        else { this.aiGoto(c, A, k, rx, home.y, 12); return; }
      }
    }
    if (!tgt) { A.task = null; return; }
    const dx = tgt.x - c.x, dy = tgt.y - c.y, ad = Math.abs(dx);
    const hasSword = hasG(c, 'sword'), hasBow = hasG(c, 'bow') && c.arrows > 0, ammo = c.inv.some(x => THROWABLE.has(x));
    if (!hasSword && !hasBow && !ammo && !tgt.struct && T.type === 'attack' && home) { A.task = { type: 'arm', s: 0.86 }; return; }
    // Fernkampf
    if ((ammo || hasBow) && ad > 22 && ad < (hasBow ? 210 : 140) && Math.abs(dy) < 90 && c.cd <= 0 && (c.act === 'walk' || c.act === 'fight') && A.t >= A.react) {
      A.react = A.t + D.react;
      if (this.rand() < D.throwP && this.aiRanged(c, tgt, D, false)) return;
    }
    // Nahkampf
    if (ad < 15 && Math.abs(dy) < 10 && !tgt.struct) {
      if (Math.abs(dx) > 1) c.dir = Math.sign(dx);
      if (hasSword && c.cd <= 0 && c.act !== 'climb' && c.act !== 'hangle' && A.t >= A.react) { A.react = A.t + Math.ceil(D.react / 2); this.aiSlot(c, 'sword'); this.primary(c, [tgt.x, tgt.y]); }
      if (hasG(c, 'shield') && tgt.swing > 0 && this.rand() < D.blockP) { A.blockT = 12; A.blockDir = Math.sign(dx) || c.dir; }
      if (!hasSword && tgt.team === undefined && tgt.hp !== undefined && c.cd <= 0 && c.act === 'walk' && A.t >= A.react) { A.react = A.t + D.react; this.strike(c); return; } // Tiere: Faustschlag
      if (!hasSword && c.act === 'walk') k[dx > 0 ? 'r' : 'l'] = 1; // hineinlaufen = Faustkampf
      return;
    }
    // Annähern (mit Abstand, wenn nur Fernwaffen)
    const keep = (ammo || hasBow) && !hasSword ? 60 : 0;
    if (keep && ad < keep && ad > 22 && Math.abs(dy) < 40) { if (c.act === 'dig') c.act = 'walk'; return; }
    if (T.type === 'fight' && home && T.defend && Math.abs(tgt.x - home.x) > 320) { A.task = null; return; }
    this.aiGoto(c, A, k, tgt.x, tgt.y, keep ? 50 : 3);
  },
  aiSlot(c, type) { const g = GEAR_SEL.indexOf(type); if (g >= 0 && hasG(c, type)) { c.slot = INV_MAX + g; return; } const i = c.inv.indexOf(type); if (i >= 0) c.slot = i; },
  // Ballistisch zielen (mit Vorhalt) und werfen/schießen
  aiRanged(c, tgt, D, inside) {
    const hasBow = hasG(c, 'bow') && c.arrows > 0;
    const throwIt = c.inv.find(x => THROWABLE.has(x)) || (inside ? c.inv.find(x => AMMO.has(x)) : null);
    const useBow = hasBow && (!throwIt || Math.abs(tgt.x - c.x) > 120 || this.rand() < 0.5);
    if (!useBow && !throwIt) return false;
    const dir = Math.sign(tgt.x - c.x) || c.dir, d0 = c.dir; c.dir = dir;
    const [px, py0] = this.throwPos(c); c.dir = d0;
    const py = useBow ? py0 + (c.inside ? 0 : 1) : py0;
    let tx = tgt.x, ty = tgt.y - 5;
    if (tgt.struct) ty = tgt.y;
    let sol = null;
    for (let it = 0; it < 2; it++) {
      sol = useBow ? aiSolveBallistic(this, px, py, tx, ty, [5.6], 0.07, 90) : aiSolveBallistic(this, px, py, tx, ty, [3.4, 3.0, 2.6, 2.2, 1.9], 0.1, 140);
      if (!sol || !D.lead) break;
      const lv = (tgt.vx || 0) * D.lead; if (Math.abs(lv) < 0.05) break;
      tx = tgt.x + lv * sol.t; ty = tgt.y - 5 + (tgt.act === 'jump' ? Math.min(20, (tgt.vy || 0) * sol.t * 0.5) : 0);
    }
    if (!sol || sol.d > (tgt.struct ? 9 : 6)) return false;
    // eigene Leute in der Nähe des Ziels? (kein Eigenbeschuss)
    if (!useBow && this.clonks.some(o => this.ally(o.team, c.team) && o !== c && o.act !== 'dead' && Math.hypot(o.x - tx, o.y - 5 - ty) < 24)) return false;
    if (!useBow && Math.hypot(tx - px, ty - py) < 24) return false; // zu nah für Sprengstoff
    const th = Math.atan2(sol.vy, sol.vx) + aiGauss(this.rand) * D.aimErr, s = sol.s * (1 + aiGauss(this.rand) * D.aimErr * 0.4);
    const dist = useBow ? 60 : Math.max(14, (s - 1.3) / 0.022);
    const aim = [px + Math.cos(th) * dist, py + Math.sin(th) * dist];
    this.aiSlot(c, useBow ? 'bow' : throwIt);
    this.primary(c, aim);
    return true;
  },

  // ---------- Bewegung: A*-Pfad planen und verfolgen ----------
  aiGoto(c, A, k, x, y, tol, toCell) {
    A.arrived = false;
    const N = this.nav;
    const dxg = x - c.x, dyg = y - c.y;
    if (Math.abs(dxg) <= tol && Math.abs(dyg) <= Math.max(6, tol)) { A.arrived = true; A.path = null; return true; }
    A.moving = true;
    const [tx, ty] = N.cellOf(x, y);
    // neues Ziel → Fortschrittsmessung zurücksetzen
    if (Math.abs(tx - A.gx) > 2 || Math.abs(ty - A.gy) > 2) { A.gx = tx; A.gy = ty; A.path = null; A.bestD = 1e9; A.impT = A.t; A.lvl = 0; A.ramp = null; }
    const dist = Math.hypot(dxg, dyg);
    if (dist < A.bestD - 3) { A.bestD = dist; A.impT = A.t; if (A.lvl) A.lvl = 0; }
    // Steckenbleiben → gestufte Erholung
    const st = A.t - A.impT;
    // Rampe: Ziel weit oben und Klettern klappt nicht → schräge, begehbare Treppe graben (wie ein Spieler)
    const resc = !!(A.task && A.task.type === 'rescue'); // Retter: ursprüngliches Verhalten (gezielte Rettungsrampe nicht stören)
    const l3 = A.l3m && A.l3m.get(tx + ',' + ty), n3 = l3 && this.tick - l3.t < 3600 ? l3.n : 0; // dieses Ziel ist schon öfter gescheitert
    if (A.ramp) { if (this.aiRamp(c, A, k, x, y)) return false; }
    else if (n3 >= 1 && !resc && st > 120 && dyg < -16 && !c.inside && !(A.rampCd > A.t)) { if (this.aiRampStart(c, A, dxg)) return false; } // wiederholt gescheitert: Treppe graben, auch bei weit entferntem Ziel
    else if (st > 120 && dyg < (resc ? -30 : -20) && Math.abs(dxg) < 160 && (hasG(c, 'hook') || c.inv.includes('balloon')) && this.aiGearUp(c, A, x, y)) return false;
    else if (st > 160 && dyg < -24 && (Math.abs(dxg) < 140 || (dyg < -40 && !resc)) && !c.inside && !(A.rampCd > A.t)) { if (this.aiRampStart(c, A, dxg)) return false; }
    if (st > 75 && !AI_US.off.goto && this.aiUnstuck(c, A, k, x, y)) return false; // eingeschlossen/festgefahren: sprengen, Erdklumpen, Notausgang
    if (st > 90 && A.lvl < 1) { A.lvl = 1; A.path = null; if (c.act === 'walk') { k[dxg > 0 ? 'r' : 'l'] = 1; this.clonkAction(c, 'jump'); } }
    else if (st > 200 && A.lvl < 2) { // Problemstelle für die Wegsuche merken, dann freigraben
      if (A.path) for (let q = Math.max(0, A.pi - 1); q < Math.min(A.path.length, A.pi + 5); q++) N.penalize(A.path[q], 8, this.tick + 2400);
      A.lvl = 2; A.path = null; A.forceDig = 50;
    }
    else if (st > 360 && A.lvl < 3) {
      const key = tx + ',' + ty, M = A.l3m || (A.l3m = new Map()), e = M.get(key) || { n: 0, t: 0 }; e.n = this.tick - e.t < 3600 ? e.n + 1 : 1; e.t = this.tick; M.set(key, e); if (M.size > 12) M.delete(M.keys().next().value);
      if (e.n >= 3 && this.teams[c.team].ai && this.escapeCheck(c) === '' && this.aiEsc(c, 'l3')) { M.delete(key); return false; } // dreimal gescheitert, unter der Erde: Notausgang
      A.lvl = 3; A.black.set('c' + tx + ',' + ty, this.tick + 1800); if (A.task && A.task.type === 'mine' && A.mine >= 0) { A.black.set('g' + A.mine, this.tick + 3600); A.mine = -1; } A.wander = { type: 'wander', x: c.x + (this.rand() < 0.5 ? -1 : 1) * (40 + this.rand() * 60), y: c.y - 10, until: A.t + 180 }; A.task = A.wander; A.path = null; A.impT = A.t; return false; }
    if (A.forceDig > 0) { // aus der Klemme graben
      A.forceDig--;
      if (c.act === 'walk' || c.act === 'fight') { c.act = 'dig'; c.digIdle = 0; c.vx = 0; }
      if (c.act === 'dig') { c.dir = Math.sign(dxg) || c.dir; c.digA = Math.max(-1.1, Math.min(1.5, Math.atan2(dyg, Math.max(2, Math.abs(dxg))))); }
      else this.aiMoveKeys(c, A, k, x, y, false);
      return false;
    }
    // planen (mit globalem Budget pro Tick)
    if (!A.path || (A.t > A.replanT && !A.pathDone)) {
      if (this.navBudgetT !== this.tick) { this.navBudgetT = this.tick; this.navBudget = 9000; }
      if (this.navBudget > 600 || !A.path) {
        const D = this.aiDiff(this.teams[c.team]);
        const lim = Math.min(D.pathExp, Math.max(600, this.navBudget));
        const [sx, sy] = N.cellOf(c.x, c.y);
        let r = N.find(sx, sy, tx, ty, lim);
        // kein Weg ohne Fels, Sprengstoff dabei und NICHT eingeschlossen (das regelt aiUnstuck): Fels als teure, sprengbare Zellen einplanen
        if (!r.complete && !AI_US.off.rock && this.aiRockCap(c) && this.navBudget - r.exp > 600 && this.aiReach(c, AI_US.reachN).open) { N.rk = 1; const r2 = N.find(sx, sy, tx, ty, lim); N.rk = 0; this.navBudget -= r2.exp; if (r2.complete) { r = r2; A.rkT = A.t; } }
        this.navBudget -= r.exp;
        A.path = r.path; A.pi = 1; A.pathDone = r.complete; A.replanT = A.t + (r.complete ? 360 : 120);
        if (this.teams[c.team].stats) this.teams[c.team].stats.paths++;
      }
    }
    // Pfad verfolgen
    const P = A.path;
    if (!P || P.length < 2 || A.pi >= P.length) { // Pfadende erreicht (Teilpfad) → direkt ansteuern, bald neu planen
      if (P && A.pi >= P.length && !A.pathDone) { A.path = null; }
      this.aiMoveKeys(c, A, k, x, y, toCell);
      return false;
    }
    const gw = N.gw, [cx, cy] = N.cellOf(c.x, c.y), cur = cy * gw + cx;
    for (let j = Math.min(P.length - 1, A.pi + 6); j >= A.pi - 1 && j >= 0; j--) if (P[j] === cur || P[j] === cur - gw) { A.pi = j + 1; break; }
    while (A.pi < P.length - 1) { const q = P[A.pi]; if (Math.abs((q % gw) * NC + 2.5 - c.x) < 3 && Math.abs(((q / gw) | 0) * NC + NC - c.y) < 4) A.pi++; else break; }
    if (A.pi >= P.length) { this.aiMoveKeys(c, A, k, x, y, toCell); return false; }
    const wi = P[A.pi], wgx = wi % gw, wgy = (wi / gw) | 0;
    if ((N.c[wi] === NV_HARD || (wi - gw >= 0 && N.c[wi - gw] === NV_HARD)) && this.aiRockStep(c, A, k, wi, wgx * NC + 2.5, wgy * NC + NC)) return false;
    this.aiMoveKeys(c, A, k, wgx * NC + 2.5, wgy * NC + NC, true, wi);
    return false;
  },
  // Tasten/Aktionen erzeugen, um einen nahen Wegpunkt zu erreichen
  aiMoveKeys(c, A, k, wx, wy, cellMode, wi) {
    const N = this.nav, dx = wx - c.x, dy = wy - c.y;
    let needDig = false;
    if (wi !== undefined) { const a = N.c[wi], b = wi - N.gw >= 0 ? N.c[wi - N.gw] : NV_AIR; needDig = a === NV_DIG || b === NV_DIG; }
    else { const [gx, gy] = N.cellOf(wx, wy); needDig = cellMode && (N.cls(gx, gy) === NV_DIG || N.cls(gx, gy - 1) === NV_DIG); }
    if (!needDig && (c.act === 'walk') && Math.abs(dx) > 1 && this.boxHit(c.x + Math.sign(dx) * 2, c.y - 4) && DIGGABLE[this.matAt(c.x + Math.sign(dx) * 6, c.y - 5)] && Math.abs(dy) < 5 && (A.wallT = (A.wallT || 0) + 1) > 25) needDig = true;
    else if (!needDig) A.wallT = 0;
    const act = c.act;
    if (needDig && (act === 'walk' || act === 'fight' || act === 'dig')) {
      if (act !== 'dig') { c.act = 'dig'; c.digIdle = 0; c.vx = 0; c.digHold = 0; }
      // Graben ohne Vorankommen (Körper passt nicht an Fels-Pixeln vorbei, die das grobe Raster nicht sieht): Stelle meiden, sofort neu planen
      if ((A.task && A.task.type === 'rescue') || A.digX === undefined || Math.hypot(c.x - A.digX, c.y - A.digY) > 2) { A.digX = c.x; A.digY = c.y; A.digT = 0; }
      else if (++A.digT > 75) { A.digT = 0; const pi = wi !== undefined ? wi : null; if (pi !== null) { N.penalize(pi, 15, this.tick + 2400); if (pi - N.gw >= 0) N.penalize(pi - N.gw, 15, this.tick + 2400); } A.path = null; c.act = 'walk'; return; }
      if (Math.abs(dx) > 1) c.dir = Math.sign(dx);
      c.digA = Math.max(-1.1, Math.min(1.5, Math.atan2(dy, Math.max(1.5, Math.abs(dx)))));
      return;
    }
    if (act === 'dig' && !needDig) { c.act = 'walk'; }
    const h = Math.abs(dx) > 1.5 ? (dx > 0 ? 'r' : 'l') : null;
    switch (c.act) {
      case 'walk': case 'fight':
        if (h) k[h] = 1;
        // gegen eine Wand gelaufen (Stufe zu hoch): schnell springen oder durchgraben statt lange zu drücken
        if (h && c.act === 'walk') {
          if (A.wx === undefined || Math.abs(c.x - A.wx) > 0.6) { A.wx = c.x; A.wT = 0; } else A.wT++;
          if (A.wT > 20) {
            A.wT = 0; const sd = h === 'r' ? 1 : -1;
            if (!this.boxHit(c.x, c.y - 8) && !this.boxHit(c.x + sd * 3, c.y - 12) && A.jumpCd <= 0) { this.clonkAction(c, 'jump'); A.jumpCd = 18; }
            else if (DIGGABLE[this.matAt(c.x + sd * 6, c.y - 4)] || DIGGABLE[this.matAt(c.x + sd * 6, c.y - 8)]) { c.dir = sd; c.act = 'dig'; c.digIdle = 0; c.vx = 0; c.digA = dy < -3 ? -0.5 : 0; }
          }
        }
        if (dy < -4 && A.jumpCd <= 0) {
          let sd = Math.sign(dx) || c.dir;
          let wall = this.boxHit(c.x + sd * 3, c.y - 2);
          if (!wall && Math.abs(dx) < 14 && dy < -8) { const ws = this.aiWallSide(c, sd); if (ws) { sd = ws; wall = true; } }
          if (wall || Math.abs(dx) < 26) { k.l = sd < 0 ? 1 : 0; k.r = sd > 0 ? 1 : 0; if (Math.abs(dx) < 2 && !wall) { k.l = k.r = 0; } this.clonkAction(c, 'jump'); A.jumpCd = 18; }
        } else if (dy > 4 && Math.abs(dx) < 3 && this.boxHit(c.x, c.y + 1)) { // Wegpunkt unter den Füßen: runtergraben oder von der Kante treten
          const m = this.matAt(c.x, c.y + 2);
          if (DIGGABLE[m]) { c.act = 'dig'; c.digIdle = 0; c.vx = 0; c.digA = 1.45; }
          else k[(Math.sign(dx) || c.dir) > 0 ? 'r' : 'l'] = 1;
        }
        break;
      case 'jump':
        if (h) k[h] = 1;
        if (dy < -6) {
          k.u = 1;
          // Ziel weit oben: an die nächste Wand drücken, damit der Buddler (wieder) zu klettern beginnt
          if (Math.abs(dx) < 14 && !(A.dropT > A.t)) { const side = this.aiWallSide(c, Math.sign(dx) || c.dir); if (side) { k.l = side < 0 ? 1 : 0; k.r = side > 0 ? 1 : 0; } }
        }
        break;
      case 'climb':
        if (A.climbY === undefined || Math.abs(c.y - A.climbY) > 1.5) { A.climbY = c.y; A.climbT = 0; } else A.climbT++;
        if (A.climbT > 35) { A.climbT = 0; A.climbY = undefined; c.act = 'jump'; c.vx = -c.dir * 0.7; c.vy = -0.3; c.dir = -c.dir; A.dropT = A.t + 40; A.forceDig = 45; break; } // klemmt: abspringen (wie Gegenrichtung drücken) und freigraben
        { // Vorausschau: geht der Pfad in den nächsten Wegpunkten noch nach oben, weiterklettern statt abzuspringen
          let upAhead = false, farX = 0;
          if (A.path) for (let q = A.pi; q < Math.min(A.path.length, A.pi + 7); q++) { const pi = A.path[q], py = ((pi / N.gw) | 0) * NC + NC, px = (pi % N.gw) * NC + 2.5; if (py < c.y - 6) upAhead = true; if (Math.abs(px - c.x) > Math.abs(farX)) farX = px - c.x; }
          if (dy < -2 || upAhead) { k.u = 1; }
          else if (dy > 9) { k.d = 1; }
          if (upAhead) break;
          if (h && (dx > 0 ? 1 : -1) === -c.dir && dy > -6 && (Math.abs(dx) > 10 || Math.abs(farX) > 14)) k[h] = 1; // abspringen zur anderen Seite
          else if (dy <= 2 && dy >= -2 && h) k[h] = 1;
        }
        break;
      case 'hangle':
        if (h) k[h] = 1;
        if (dy > 6) k.d = 1;
        break;
      case 'swim':
        if (h) k[h] = 1;
        if (dy < -2) k.u = 1; else if (dy > 4) k.d = 1;
        break;
    }
  },
  aiRampStart(c, A, dxg) {
    if (c.act === 'swim' && !AI_US.off.rswim) { A.rampCd = A.t + 200; return false; } // im Wasser keine Treppe
    const score = d => { let sc = 0; for (let i = 6; i <= 40; i += 2) { const m = this.matAt(c.x + d * i * 0.75, c.y - 5 - i * 0.66); if (SOLID[m] && !DIGGABLE[m]) sc -= 3; else if (m === MAT.LAVA || m === MAT.WATER) sc -= 4; else sc += 1; } return sc; };
    const pref = Math.sign(dxg) || c.dir, a = score(pref) + 2, b = score(-pref);
    if (Math.max(a, b) < 0) { A.rampCd = A.t + 400; return false; }
    A.ramp = { dir: a >= b ? pref : -pref, until: A.t + 1600, flips: 0, lastY: c.y, lastT: A.t };
    A.path = null; A.forceDig = 0; return true;
  },
  aiRamp(c, A, k, x, y) {
    const R = A.ramp;
    if (c.y <= y + 4 || A.t > R.until || R.flips > 3 || (c.act === 'swim' && !AI_US.off.rswim)) { // im Wasser gibt es keine Treppe: Rampe beenden, normale Wegsuche schwimmt
      if (c.act === 'swim') { A.ramp = null; A.rampCd = A.t + 600; A.impT = A.t; A.lvl = 0; A.path = null; return false; } A.ramp = null; A.rampCd = A.t + 300; A.impT = A.t; A.lvl = 0; A.path = null; return false; }
    if (c.y < R.lastY - 2) { R.lastY = c.y; R.lastT = A.t; A.impT = A.t; }
    else if (c.y > R.lastY + 8) { R.lastY = c.y; R.lastT = A.t; } // in Hohlraum gefallen: von hier aus weiter
    if (c.act === 'dig') { // Serpentinen: nach ~40 px Rampe umdrehen (nur in die Richtung zurück, in der das Ziel liegt)
      if (R.zx === undefined) R.zx = c.x;
      if ((c.x - R.zx) * R.dir > 40 && (x - c.x) * R.dir < 0) { R.dir = -R.dir; R.zx = c.x; }
      else if (!AI_US.off.ramp2) { const m = this.matAt(c.x + R.dir * 9, c.y - 5 - 7); if (SOLID[m] && !DIGGABLE[m]) { R.dir = -R.dir; R.flips++; R.zx = undefined; R.lastT = A.t; c.act = 'walk'; return true; } } // Fels vor der Schaufel: andere Richtung
    }
    if (A.t - R.lastT > (c.act === 'dig' && AI_US.off.ramp2 ? 1e9 : 240)) { R.dir = -R.dir; R.flips++; R.lastT = A.t; R.zx = undefined; if (c.act === 'dig') c.act = 'walk'; } // kommt nicht höher (Fels/Decke): Richtung wechseln – auch beim Graben
    A.moving = true;
    if (c.act === 'climb' || c.act === 'hangle') { c.act = 'jump'; c.vx = 0; c.vy = 0.2; return true; }
    if (c.act === 'dig' && c.digIdle > 6) { c.act = 'walk'; return true; } // nur Luft vor der Schaufel: erst zur Wand laufen
    if (c.act === 'walk' || c.act === 'fight') {
      const ahead = [4, 8, 12].some(h => SOLID[this.matAt(c.x + R.dir * 5, c.y - h)]);
      if (!ahead) { k[R.dir > 0 ? 'r' : 'l'] = 1; return true; } // über den Höhlenboden zur Wand
      const m = this.matAt(c.x + R.dir * 8, c.y - 5 - 6);
      if (SOLID[m] && !DIGGABLE[m]) { R.dir = -R.dir; R.flips++; R.zx = undefined; return true; }
      c.act = 'dig'; c.digIdle = 0; c.vx = 0;
    }
    if (c.act === 'dig') { c.dir = R.dir; c.digA = -0.72; }
    return true;
  },
  // Begehbarer Punkt in der Verkaufszone einer Hütte/Burg (die Hütte kann über einem selbst gegrabenen Schacht stehen)
  aiBaseSpot(c, s) {
    const C = s.spots && s.spotsT > this.tick ? s.spots : null;
    let list = C;
    if (!list) {
      list = []; const hw = s.w / 2 + 5;
      for (let x = Math.round(s.x - hw); x <= s.x + hw; x += 3) {
        for (let y = Math.round(s.y - 22); y <= s.y + 1; y++) if (!this.boxHit(x, y) && (this.solid(x, y + 1) || this.solid(x - 1, y + 1) || this.solid(x + 1, y + 1))) { list.push({ x, y }); break; } else if (this.boxHit(x, y) && y > s.y - 20) break;
      }
      s.spots = list; s.spotsT = this.tick + 120;
    }
    let best = null, bd = 1e9; for (const p of list) { const d = Math.abs(p.x - c.x) + Math.abs(p.y - c.y) * 1.5 + Math.abs(p.x - s.x) * 0.3; if (d < bd) { bd = d; best = p; } }
    return best || { x: s.x, y: s.y };
  },
  // Zielpunkt an der Basis für die laufende Aufgabe festhalten (sonst wandert das Ziel mit dem Buddler mit und die gestufte Erholung beginnt nach jedem Sturz von vorn)
  aiTaskSpot(c, A, home) {
    const T = A.task; if (!T) return this.aiBaseSpot(c, home);
    if (!T.sp || T.spB !== home.id || A.t > T.spT) { T.sp = this.aiBaseSpot(c, home); T.spB = home.id; T.spT = A.t + 900; }
    return T.sp;
  },
  aiWallSide(c, pref) { for (let d = 1; d <= 7; d++) { if (this.boxHit(c.x + pref * d, c.y - 3)) return pref; if (this.boxHit(c.x - pref * d, c.y - 3)) return -pref; } return 0; },
  // Steckenbleib-Statistik: Buddler will sich bewegen, kommt aber nicht vom Fleck
  aiStuckTrack(c, t, A, wants) {
    const S = t.stats; if (!S) return;
    if (!wants || Math.hypot(c.x - A.anchorX, c.y - A.anchorY) > 8) {
      const dur = A.t - A.anchorT;
      if (A.stuckOn) { if (dur > S.maxStuck) S.maxStuck = dur; A.stuckOn = false; }
      A.anchorX = c.x; A.anchorY = c.y; A.anchorT = A.t; A.anchorG = golds(c); return;
    }
    const dur = A.t - A.anchorT;
    if (dur > 300 && !A.stuckOn) { A.stuckOn = true; S.stuckEv++; A.stuckN = (A.stuckN || 0) + 1; c.stuckN = (c.stuckN || 0) + 1; }
    // sehr lange fest und unter der Erde: Notausgang (nur echte KI-Teams, kostet deren Geld)
    if (dur > 2400 && t.ai && !A.escTried && this.escapeCheck(c) === '') { A.escTried = true; if (this.aiEsc(c, 'dur')) { A.anchorX = c.x; A.anchorY = c.y; A.anchorT = A.t; A.stuckOn = false; return; } } // escape() zählt t.stats.escapes selbst
    if (dur < 2400) A.escTried = false;
    if (A.stuckOn && dur > S.maxStuck) S.maxStuck = dur;
    if (dur > 1500 && (!A.hardReset || dur % 900 === 0)) { // letzte Stufe (wiederholt): Aufgabe verwerfen, loslassen, Feuerstein zum Freisprengen
      A.hardReset = true; A.task = null; A.path = null; A.mine = -1; A.lvl = 0; A.forceDig = 60;
      if (c.act === 'climb' || c.act === 'hangle') { c.act = 'jump'; c.vx = -c.dir * 0.7; c.vy = 0.2; c.dir = -c.dir; A.dropT = A.t + 40; }
      A.wander = { type: 'wander', x: c.x + (this.rand() < 0.5 ? -1 : 1) * (40 + this.rand() * 80), y: c.y + 20, until: A.t + 240 };
      // früher: Feuerstein blind schräg nach oben werfen (unter der Erde oft direkt an die Wand → Selbstschaden). Jetzt: geprüfter Sprengplan
      const H = this.aiHome(c); this.aiUnstuck(c, A, c.aiKeys, A.gx >= 0 ? A.gx * NC + 2.5 : (H ? H.x : c.x), A.gy >= 0 ? A.gy * NC + NC : (H ? H.y : c.y - 60), true);
    }
    if (dur < 1500) A.hardReset = false;
    // Abbau-Wächter: gräbt seit 15 s an derselben Stelle ohne Gold (z. B. Fels-Pixel, die das Raster nicht sieht) → Ziel sperren, neu wählen
    if (dur > 900 && dur % 900 === 0 && A.task && A.task.type === 'mine' && golds(c) <= (A.anchorG || 0)) {
      if (A.mine >= 0) A.black.set('g' + A.mine, this.tick + 5400); A.mine = -1; A.task = null; A.path = null; if (c.act === 'dig') c.act = 'walk'; S.mineWd = (S.mineWd || 0) + 1;
    }
    // Taschen voll, aber seit 60 s nicht heimgekommen (Heimweg physisch unmöglich, z. B. Überhang) und unter der Erde: Notausgang (echte KI-Teams)
    { const g = golds(c), cap = Math.min(this.aiDiff(t).goldCap, INV_MAX - (c.inv.length - g)); if (g > 0 && g >= cap) { if (!A.fullT) A.fullT = A.t; } else A.fullT = 0; } // volle Taschen seit …
    if (A.fullT && t.ai && !c.inside && A.t % 30 === 0) { // Heimweg-Fortschritt messen: Notausgang nur, wenn lange KEIN Fortschritt nach Hause und tief unter der Erde
      const H = this.aiHome(c), hd = H ? Math.abs(H.x - c.x) + Math.abs(H.y - c.y) * 1.5 : 0, depth = c.y - this.surf[Math.max(0, Math.min(this.W - 1, Math.round(c.x)))];
      if (A.fullT0 !== A.fullT) { A.fullT0 = A.fullT; A.fullB = hd; A.fullI = A.t; A.fullR = 0; }
      if (hd < A.fullB - 25) { A.fullB = hd; A.fullI = A.t; }
      const np = A.t - A.fullI;
      // zuerst echte Auswege: Treppe Richtung Heimat graben, dann Sprengen/Erdklumpen (aiUnstuck), erst zuletzt Notausgang
      if (np > AI_US.fullRamp && H && depth > 16 && (A.fullR || 0) < 2 && !A.ramp && !(A.rampCd > A.t)) { A.fullR = (A.fullR || 0) + 1; A.fullI = A.t - AI_US.fullRamp / 2; if (H.y < c.y - 20) this.aiRampStart(c, A, H.x - c.x); else this.aiUnstuck(c, A, c.aiKeys, H.x, H.y - 4, true); }
      if (A.t - A.fullT > AI_US.fullEsc && np > AI_US.fullNoProg && depth > AI_US.fullDepth && this.escapeCheck(c) === '') { if (this.aiEsc(c, 'full')) { A.fullT = 0; S.homeEsc = (S.homeEsc || 0) + 1; return; } }
    }
    // eingesperrt, aber in Bewegung (läuft in einer Fels-Kammer hin und her): Anker-Messung greift nicht → Bewegungsradius prüfen
    if (A.t % 60 === 0 && !AI_US.off.conf) {
      const Hs = A.hist || (A.hist = []); Hs.push(wants ? [c.x, c.y] : null); if (Hs.length > 16) Hs.shift();
      if (Hs.length >= 12 && Hs.every(p => p) && !c.inside) {
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of Hs) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        const H = this.aiHome(c), gx = A.gx >= 0 ? A.gx * NC + 2.5 : (H ? H.x : c.x), gy = A.gy >= 0 ? A.gy * NC + NC : (H ? H.y : c.y);
        if (x1 - x0 < 50 && y1 - y0 < 40 && Math.hypot(gx - c.x, gy - c.y) > 40) this.aiUnstuck(c, A, c.aiKeys, gx, gy, !(A.usCd > A.t));
      }
    }
  },
});
// ---------- Befreien (generisch, unabhängig von der Kartenart): eingeschlossen? → sprengen / Haken / Erdklumpen / Notausgang ----------
// Idee: statt fester Fallen-Regeln wird die erreichbare Umgebung im Navigationsraster geflutet (BFS). Erde/Sand/Gold zählen als
// passierbar (graben), Fels/Granit/Holz/Lava nicht. Kommt die Flut nicht an die Oberfläche, ist der Buddler eingeschlossen.
// Dann: Sprengung mit sicherem Abstand (Wurfbahn wird simuliert, Selbstschaden vorausberechnet), sonst Notausgang.
const AI_US = { caveW: 8, dropCost: 5, earlyDepth: 80, rockCost: 9, rockDmg: 6, fullRamp: 1e9, fullEsc: 3600, fullNoProg: 1200, fullDepth: 16, reachN: 1400, checkCd: 110, enclEsc: 420, maxSelfDmg: 16, minHpAfter: 45, off: {} };
Object.assign(World.prototype, {
  aiPassC(N, gx, gy) { const a = N.cls(gx, gy), b = N.cls(gx, gy - 1); return a !== NV_HARD && a !== NV_LAVA && b !== NV_HARD && b !== NV_LAVA; },
  // Flutfüllung ab dem Buddler: { open, n, set } – open = Oberfläche (oder großer Bereich) erreichbar
  aiReach(c, maxN) {
    const N = this.nav, gw = N.gw, [sx, sy] = N.cellOf(c.x, c.y), s0 = sy * gw + sx;
    const set = new Set([s0]), q = [s0];
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % gw, y = (i / gw) | 0;
      const px = Math.min(this.W - 1, x * NC + 2);
      if (y * NC + NC < this.surf[px] - 1 || y <= 1) return { open: true, n: set.size, set };
      if (set.size >= maxN) return { open: true, n: set.size, set };
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || nx >= gw || ny < 1 || ny >= N.gh) continue;
        const j = ny * gw + nx; if (set.has(j) || !this.aiPassC(N, nx, ny)) continue;
        if (dy < 0 && !dx && (N.cls(nx, ny) === NV_DIG || N.cls(nx, ny - 1) === NV_DIG)) continue; // senkrecht nach oben graben geht nicht (wie A*)
        set.add(j); q.push(j);
      }
    }
    return { open: false, n: set.size, set };
  },
  // Wurf wie throwItem/updItem simulieren → Aufschlagpunkt (dort explodiert ein Feuerstein)
  aiThrowImpact(c, ax, ay) {
    const d0 = c.dir; c.dir = Math.sign(ax - c.x) || c.dir; const [px, py] = this.throwPos(c); c.dir = d0;
    let [vx, vy] = throwVel(px, py, ax, ay), x = px, y = py;
    for (let t = 0; t < 120; t++) {
      vy = Math.min(vy + 0.1, 5); if (this.matAt(x, y) === MAT.WATER) { vx *= 0.9; vy *= 0.85; }
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(vx), Math.abs(vy))));
      for (let s = 0; s < steps; s++) { const nx = x + vx / steps, ny = y + vy / steps; if (this.solid(nx, ny)) return { x, y, t, ux: vx, uy: vy }; x = nx; y = ny; }
      if (y > this.H || x < 0 || x > this.W) return null;
    }
    return null;
  },
  aiBlastDmg(c, x, y, r) { const R = r * 1.8, d = Math.hypot(c.x - x, c.y - 5 - y); return { d, R, dmg: d < R ? (1 - d / R) * r * 2.6 * (c.armor ? 0.6 : 1) : 0 }; },
  // Sprengplan: Feuerstein/Superflint so werfen, dass er Fels zum Ziel hin wegsprengt, ohne den Werfer ernsthaft zu verletzen
  aiBlastPlan(c, reach, gx, gy) {
    const N = this.nav, types = ['flint', 'superflint'];
    const idx = c.inv.findIndex(x => types.includes(x)); if (idx < 0) return null;
    const r = ITEMS[c.inv[idx]].blast;
    const gd = Math.hypot(gx - c.x, gy - c.y) || 1, gux = (gx - c.x) / gd, guy = (gy - c.y) / gd;
    let best = null;
    for (let a = 0; a < 32; a++) {
      const th = a / 32 * Math.PI * 2, ux = Math.cos(th), uy = Math.sin(th);
      for (const L of [28, 60]) {
        if (Math.abs(ux * L) < 3) continue;
        const imp = this.aiThrowImpact(c, c.x + ux * L, c.y - 8 + uy * L); if (!imp) continue;
        const B = this.aiBlastDmg(c, imp.x, imp.y, r);
        if (B.d < B.R * 0.6 + 1 || B.dmg > AI_US.maxSelfDmg || c.hp - B.dmg < AI_US.minHpAfter) continue;
        const sp = Math.hypot(imp.ux, imp.uy) || 1, vx = imp.ux / sp, vy = imp.uy / sp;
        // was liegt hinter der Wand? (neues Gebiet = nicht in der aktuellen Flutfläche, kein Granit im Weg)
        let hard = 0, granite = false, through = false;
        for (let k = 1; k <= r + 7; k++) {
          const qx = imp.x + vx * k, qy = imp.y + vy * k, m = this.matAt(qx, qy);
          if (m === MAT.GRANITE) { granite = true; break; }
          if (m === MAT.LAVA || m === MAT.WATER) { if (k <= r) { granite = true; break; } }
          if (SOLID[m] && !DIGGABLE[m]) { hard++; continue; }
          if (k > 3) { const [qx2, qy2] = N.cellOf(qx, qy + 5); const j = qy2 * N.gw + qx2; if (!reach.set.has(j)) { through = k <= r + 2; break; } }
        }
        if (granite || !hard) continue;
        const toward = vx * gux + vy * guy;
        const score = (through ? 3 : 0) + toward * 1.5 - (vy > 0.5 ? 0.6 : 0) - B.dmg * 0.05 + hard * 0.01;
        if (!best || score > best.score) best = { score, idx, ax: c.x + ux * L, ay: c.y - 8 + uy * L, ix: imp.x, iy: imp.y, dmg: B.dmg, through };
      }
    }
    if (best && !best.through && c.inv.filter(x => types.includes(x)).length < 2 && best.score < 1) return null; // ein einzelner Feuerstein nur für einen Durchbruch oder klaren Fortschritt
    return best;
  },
  // TNT: an die Wand legen und weit weg laufen (Zündschnur 2,5 s) – nur wenn genug Platz zum Zurückweichen ist
  aiTntPlan(c, reach, gx, gy) {
    const idx = c.inv.indexOf('tnt'); if (idx < 0) return null;
    const N = this.nav, gw = N.gw, R = ITEMS.tnt.blast * 1.8;
    const sd = Math.sign(gx - c.x) || c.dir;
    if (!(SOLID[this.matAt(c.x + sd * 6, c.y - 5)] && !DIGGABLE[this.matAt(c.x + sd * 6, c.y - 5)])) return null; // nur direkt an einer Fels-Wand
    for (let k = 6; k <= ITEMS.tnt.blast; k++) if (this.matAt(c.x + sd * k, c.y - 5) === MAT.GRANITE) return null;
    let far = null, fd = 0;
    for (const j of reach.set) { const x = (j % gw) * NC + 2.5, y = ((j / gw) | 0) * NC + NC; const d = Math.hypot(x - c.x, y - c.y); if (d > fd && N.cls(j % gw, (j / gw) | 0) === NV_AIR) { fd = d; far = { x, y }; } }
    if (!far || fd < R + 8) return null;
    return { idx, far };
  },
  // Haupteinstieg (aus aiGoto bei fehlendem Fortschritt bzw. aus der Steckenbleib-Erkennung)
  // Sprengstoff dabei → Wegsuche darf Fels einplanen (teuer)
  aiRockCap(c) { return c.inv.some(x => x === 'flint' || x === 'superflint' || x === 'tnt'); },
  // nächster Wegpunkt ist Fels: sicher sprengen (geprüfter Wurf), sonst Zelle sperren → Umweg
  aiRockStep(c, A, k, wi, wx, wy) {
    const N = this.nav;
    if (Math.hypot(wx - c.x, wy - 5 - (c.y - 5)) > 22) return false; // erst nah heran
    if (!this.aiRockCap(c)) { N.penalize(wi, 30, this.tick + 3600); A.path = null; return false; }
    if (c.act === 'dig') c.act = 'walk';
    if (c.act !== 'walk' || c.cd > 0) { A.moving = true; return true; }
    if ((A.rockBlT || 0) > A.t) { A.moving = true; return (A.rockBlT - A.t) > 0 && (A.rockBlT - A.t) < 90; } // nach dem Wurf kurz warten (Explosion)
    const bp = this.aiBlastPlan(c, this.aiReach(c, AI_US.reachN), wx, wy);
    if (bp && bp.through && bp.dmg <= AI_US.rockDmg) { c.slot = bp.idx; this.primary(c, [bp.ax, bp.ay]); this.aiGearStat(c, 'blast'); const S = this.teams[c.team].stats; if (S) S.rockPath = (S.rockPath || 0) + 1; A.rockBlT = A.t + 100; A.path = null; A.impT = A.t; return true; }
    N.penalize(wi, 30, this.tick + 3600); A.rockBlT = A.t + 200; A.path = null; return false; // kein sicherer Wurf → Umweg
  },
  aiUnstuck(c, A, k, gx, gy, force) {
    const t = this.teams[c.team];
    if (c.inside || c.act === 'dead' || c.act === 'rope' || c.act === 'float' || c.act === 'push') return false;
    if ((A.task && A.task.type === 'rescue') || (c.help && (!this.teams[c.team].ai || (this.rescuerOf && this.rescuerOf(c))))) return false; // Rettung läuft: Retter gräbt gezielt, Eingeschlossener wartet auf ihn
    if (!force && A.usCd > A.t) return false;
    A.usCd = A.t + AI_US.checkCd;
    const reach = this.aiReach(c, AI_US.reachN);
    const N = this.nav, [tx, ty] = N.cellOf(gx, gy);
    if (reach.set.has(ty * N.gw + tx)) { A.enclT0 = 0; return false; } // Ziel liegt im erreichbaren Bereich
    const S = t.stats;
    if (reach.open) {
      A.enclT0 = 0;
      // offen, aber festgefahren: Erdklumpen als Stufe/Brücke (z. B. im Wasserloch oder an einer zu hohen Kante)
      const ei = c.inv.indexOf('earth');
      if (ei >= 0 && (c.act === 'walk' || c.act === 'swim') && (gy < c.y - 12 || this.aiInWater(c))) {
        c.slot = ei; c.dir = Math.sign(gx - c.x) || c.dir; const n0 = c.inv.length; this.dropItem(c);
        if (c.inv.length < n0) { this.aiGearStat(c, 'earth'); A.path = null; A.impT = A.t; return true; }
      }
      // offen, aber eine Felswand (z. B. Gebirge) steht genau zwischen Buddler und Ziel: mit Feuerstein durchsprengen statt endlos Umwege zu suchen
      if (c.act === 'walk' && c.cd <= 0 && (A.rockBlT || 0) < A.t && c.inv.some(x => x === 'flint' || x === 'superflint')) {
        const gd = Math.hypot(gx - c.x, gy - c.y) || 1, ux = (gx - c.x) / gd, uy = (gy - c.y) / gd; let rock = 0;
        for (let d = 6; d <= 16; d += 2) { const m = this.matAt(c.x + ux * d, c.y - 5 + uy * d); if (m === MAT.ROCK) rock++; else if (m === MAT.GRANITE) { rock = 0; break; } }
        if (rock >= 2) {
          A.rockBlT = A.t + 600; const bp = this.aiBlastPlan(c, reach, gx, gy);
          if (bp && bp.score >= 1.2) { c.slot = bp.idx; this.primary(c, [bp.ax, bp.ay]); this.aiGearStat(c, 'blast'); A.path = null; A.impT = A.t; A.usCd = A.t + 70; return true; }
        }
      }
      return false;
    }
    // eingeschlossen (Fels/Granit/Lava rundherum)
    if (!A.enclT0) { A.enclT0 = A.t; if (S) S.enclosed = (S.enclosed || 0) + 1; }
    if (c.act === 'climb' || c.act === 'hangle') { c.act = 'jump'; c.vx = 0; c.vy = 0.2; A.usCd = A.t + 30; return true; }
    if (c.act === 'dig') c.act = 'walk';
    if (c.act === 'walk' && c.cd <= 0) {
      const bp = this.aiBlastPlan(c, reach, gx, gy);
      if (bp) {
        c.slot = bp.idx; this.primary(c, [bp.ax, bp.ay]); this.aiGearStat(c, 'blast');
        A.path = null; A.impT = A.t; A.usCd = A.t + 70; A.enclT0 = A.t; return true;
      }
      const tp = this.aiTntPlan(c, reach, gx, gy);
      if (tp) {
        c.slot = tp.idx; this.dropItem(c); this.aiGearStat(c, 'tnt');
        A.wander = { type: 'wander', x: tp.far.x, y: tp.far.y, until: A.t + 200 }; A.task = A.wander; A.path = null; A.impT = A.t; A.usCd = A.t + 220; A.enclT0 = A.t; return true;
      }
    }
    // keine Sprengmittel / kein sicherer Wurf: Notausgang (nur echte KI-Teams; Helfer werden von Teamkollegen gerettet)
    if (t.ai && A.t - A.enclT0 > AI_US.enclEsc && this.escapeCheck(c) === '') { if (this.aiEsc(c, 'encl')) { A.enclT0 = 0; return true; } }
    return false;
  },
  // Luft holen: Kopf unter Wasser und wenig Atem → zur nächsten Luftstelle (Oberfläche des Wassers oder Ufer)
  aiAir(c, A) {
    if (c.breath > 55 || this.matAt(c.x, c.y - 9) !== MAT.WATER) return false;
    if (A.task && A.task.type === 'flee' && A.task.why === 'air') return true;
    let best = null, bd = 1e9;
    for (let ox = 0; ox <= 90; ox += 3) for (const sg of ox ? [1, -1] : [1]) {
      const x = Math.round(c.x + sg * ox); if (x < 2 || x >= this.W - 2) continue;
      for (let y = Math.round(c.y) - 9; y > c.y - 120 && y > 2; y--) {
        const m = this.matAt(x, y); if (m === MAT.WATER) continue;
        if (SOLID[m] && !DIGGABLE[m]) break;
        if (!SOLID[m]) { const d = ox * 1.3 + (c.y - y); if (d < bd) { bd = d; best = { x, y: y + 4 }; } }
        break;
      }
    }
    if (!best) return false;
    A.task = { type: 'flee', x: best.x, y: best.y, until: A.t + 300, why: 'air', s: 1.1 }; A.path = null;
    return true;
  },
  // Vorsorge gegen Überfälle: steht die Burg mit ihren Pflicht-Stufen (bzw. ist keine geplant), nimmt jeder Buddler beim Verkaufen ein Schwert mit
  // (gemessen: ohne Kriegskasse verliert Leicht nach dem Burgbau die meisten Ritter-Überfälle – das Geld steckt dann in Steinen statt in Waffen)
  aiArmUp(c, t, D) {
    if (!t.ai || c.knight || !t.res.weapons || hasG(c, 'sword') || this.aiRush(t)) return;
    const Bt = t.brain; if (!Bt) return;
    const cs = this.castleOf ? this.castleOf(t.id) : null, wantC = D.builds[0] === 'castle' && D.research.includes('castle');
    if (wantC && !D.chest && (!cs || (typeof castleLevel === 'function' ? castleLevel(cs) : (cs.up | 0)) < Math.min(1, D.upFirst || 0))) return;
    if (t.money >= ITEMS.sword.price + D.reserve + (Bt.keep || 0) + 20) this.aiBuy(t, c, 'sword');
  },
  // Vorsorge beim Verkaufen (Mittel/Schwer, echte KI): wer schon festsaß, nimmt einen Enterhaken (Ausrüstung, kostet keinen Taschenplatz) mit.
  // Feuerstein nur, wenn der Buddler schon ein Schwert hat: ein Feuerstein in der Tasche zählt sonst als „bewaffnet“ (aiArmedEnough)
  // und der Buddler kauft vor einem Überfall kein Schwert mehr (gemessen: Schwer-Überfall 12 → 6 von 20 abgewehrt).
  aiToolUp(c, t, D) {
    if (AI_US.off.tool || !t.ai || D.k === 'easy' || c.knight || (this.aiRush(t) && (this.goal || 1e9) - t.money < 120)) return;
    const Bt = t.brain; if (Bt && Bt.defend) return;
    const R = D.reserve + (Bt ? (Bt.keep || 0) : 0) + 30;
    if ((c.stuckN || 0) >= 1 && !hasG(c, 'hook') && t.money >= ITEMS.hook.price + R) this.aiBuy(t, c, 'hook');
    if ((c.stuckN || 0) >= 2 && hasG(c, 'sword') && !c.inv.some(x => THROWABLE.has(x)) && c.inv.length < INV_MAX - 1 && t.money >= ITEMS.flint.price + R) this.aiBuy(t, c, 'flint');
  },
});
function golds(c) { return c.inv.filter(x => x === 'gold').length; }
