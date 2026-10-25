// BuddelRage – Computergegner & Helfer-KI (eigener Code, ISC-Lizenz)
// Aufbau (Quellen & Vorbilder siehe AI_NOTES.md):
//  1. Navigationsraster (5×5-px-Zellen) über der Pixel-Landschaft, inkrementell aktualisiert (setMat markiert Zellen)
//  2. A*-Wegsuche mit Laufen/Springen/Klettern/Schwimmen/Graben (Grabkosten; Fels/Granit/Lava unpassierbar), Rechenbudget pro Tick
//  3. Pfadverfolgung mit Steckenbleib-Erkennung und gestufter Erholung (springen → neu planen → graben → Ausweichziel)
//  4. Team-„Hauptquartier“ (wie 0 A.D. Petra): Rollen, Kauf-/Forschungs-/Bauplan, Angriff/Verteidigung nach Stärkevergleich
//  5. Aufgabenwahl pro Buddler per Utility-Bewertung (Dave Mark „Infinite Axis Utility“), Ausführung als kleiner Zustandsautomat
//  6. Kampf: ballistische Wurf-/Schuss-Lösung mit Vorhalt, Schild-Blocken, Projektilen ausweichen (Idee: OpenClonk AI_Protection)
'use strict';
const AI_DIFF = {
  easy: { k: 'easy', n: 'Leicht', think: 34, react: 50, aimErr: 0.2, lead: 0, maxClonks: 3, reserve: 40, attackRatio: 2.4, attackAfter: 60 * 300, healAt: 22,
    throwP: 0.35, blockP: 0.25, evade: 0, fighterShare: 0, research: ['weapons', 'lorry', 'tower'], builds: ['tower'], vehicles: false, goldCap: 2, idleP: 0.12, pathExp: 1400, group: 1, bonus: 0 },
  normal: { k: 'normal', n: 'Mittel', think: 16, react: 22, aimErr: 0.08, lead: 0.6, maxClonks: 5, reserve: 25, attackRatio: 1.5, attackAfter: 60 * 180, healAt: 32,
    throwP: 0.65, blockP: 0.6, evade: 0.5, fighterShare: 0.34, research: ['weapons', 'lorry', 'tower', 'castle', 'knight', 'tnt'], builds: ['tower', 'castle'], vehicles: true, goldCap: 3, idleP: 0.04, pathExp: 2600, group: 1, bonus: 0 },
  hard: { k: 'hard', n: 'Schwer', think: 7, react: 8, aimErr: 0.025, lead: 1, maxClonks: 7, reserve: 15, attackRatio: 1.15, attackAfter: 60 * 110, healAt: 38,
    throwP: 0.92, blockP: 0.95, evade: 0.9, fighterShare: 0.45, research: ['lorry', 'weapons', 'tower', 'castle', 'knight', 'catapult', 'tnt', 'cannon'], builds: ['tower', 'castle'], vehicles: true, goldCap: 3, idleP: 0, pathExp: 3600, group: 2, bonus: 1 },
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
    this.c = new Uint8Array(n); this.gold = new Uint8Array(n); this.dirty = new Uint8Array(n); this.dl = [];
    this.goldSet = new Set();
    for (let i = 0; i < n; i++) this.calc(i);
    this.g = new Float32Array(n); this.par = new Int32Array(n); this.seen = new Uint32Array(n); this.closed = new Uint32Array(n); this.stamp = 0;
    this.pen = new Float32Array(n); this.penT = new Int32Array(n); this.now = 0;
  }
  mark(x, y) { const i = ((y / NC) | 0) * this.gw + ((x / NC) | 0); if (!this.dirty[i]) { this.dirty[i] = 1; this.dl.push(i); } }
  flush() { const d = this.dl; for (let k = 0; k < d.length; k++) { this.calc(d[k]); this.dirty[d[k]] = 0; } d.length = 0; }
  calc(i) {
    const w = this.w, W = w.W, mat = w.mat, gx = i % this.gw, gy = (i / this.gw) | 0;
    let hard = 0, dig = 0, water = 0, lava = 0, gold = 0;
    const y1 = Math.min(w.H, gy * NC + NC), x1 = Math.min(W, gx * NC + NC);
    for (let y = gy * NC; y < y1; y++) for (let x = gx * NC; x < x1; x++) {
      const m = mat[y * W + x];
      if (m === MAT.GOLD) { gold++; dig++; } else if (DIGGABLE[m]) dig++; else if (SOLID[m]) hard++; else if (m === MAT.WATER) water++; else if (m === MAT.LAVA) lava++;
    }
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
    if (a === NV_HARD || b === NV_HARD || a === NV_LAVA || b === NV_LAVA) return -1;
    if (dx && dy) { const s1 = this.cls(nx, cy) === NV_HARD || this.cls(nx, cy - 1) === NV_HARD, s2 = this.cls(cx, ny) === NV_HARD || this.cls(cx, ny - 1) === NV_HARD; if (s1 && s2) return -1; }
    const base = dx && dy ? 1.42 : 1;
    const lav = this.lavaNear(nx, ny) ? 25 : 0;
    const nd = (a === NV_DIG ? 1 : 0) + (b === NV_DIG ? 1 : 0);
    if (nd) { if (dx === 0 && dy < 0) return -1; let k = base * (1 + 1.7 * nd); if (dy < 0) k *= 1.4; return k + lav; }
    if (a === NV_WATER || b === NV_WATER) return base * (b === NV_WATER ? 3 : 1.8) + lav;
    const gb = this.groundBelow(nx, ny, 14);
    const wall = this.solidC(nx - 1, ny) || this.solidC(nx + 1, ny) || this.solidC(nx - 1, ny - 1) || this.solidC(nx + 1, ny - 1);
    const pen = this.penT[ny * this.gw + nx] > this.now ? this.pen[ny * this.gw + nx] : 0; // gelernte Problemstellen
    if (dy < 0) { if (!wall && gb > 5) return -1; return base * (wall && gb > 3 ? 3.0 : wall ? 1.6 : 2.2) + lav + pen; } // langes Klettern ist teurer als eine Rampe
    if (dy === 0) { if (gb === 1) return base + lav + pen; if (gb <= 5 || wall) return base * 1.3 + lav + pen; return -1; }
    return base * (gb > 12 ? 5 : 1) + lav + pen;
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
  aiDiff(t) { return AI_DIFF[t.diff] || AI_DIFF.normal; },
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
  aiBases(tid) { return this.structs.filter(s => s.team === tid && BUILD[s.type].base && s.prog >= 1 && !s.remove); },
  aiHome(c) { let best = null, bd = 1e9; for (const s of this.aiBases(c.team)) { const d = Math.abs(s.x - c.x) + Math.abs(s.y - c.y) * 2; if (d < bd) { bd = d; best = s; } } return best; },
  aiArmed(c) { return c.inv.includes('sword') || (c.inv.includes('bow') && c.arrows > 0) || c.inv.some(x => THROWABLE.has(x)); },
  aiStrength(tid) {
    let s = 0;
    for (const c of this.clonks) if (c.team === tid && c.act !== 'dead') s += (0.4 + c.hp / 100) * (1 + (c.knight ? 1.2 : 0) + (c.inv.includes('sword') ? 0.5 : 0) + (c.inv.includes('shield') ? 0.3 : 0) + c.inv.filter(x => THROWABLE.has(x)).length * 0.35 + (c.armor ? 0.3 : 0));
    for (const st of this.structs) if (st.team === tid && st.prog >= 1) s += st.type === 'castle' ? 1.5 : st.type === 'tower' ? 0.7 : 0.3;
    return s;
  },
  // Einkauf für einen bestimmten Buddler (geht über die normale Laden-Funktion)
  aiBuy(t, c, what) {
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
    c.inv = sellIt; this.sell(c); c.inv = keep.concat(c.inv); return true;
  },

  // ---------- Team-Planung (Hauptquartier) ----------
  aiPlan(t, B, D, helper) {
    const own = this.clonks.filter(c => c.team === t.id && c.act !== 'dead');
    const bases = this.aiBases(t.id);
    const enemies = this.clonks.filter(c => c.team !== t.id && c.act !== 'dead' && !this.teams[c.team].elim);
    // Bedrohung der Basis
    B.threat = enemies.filter(e => !e.inside && bases.some(s => Math.abs(e.x - s.x) < 230 && Math.abs(e.y - s.y) < 120));
    B.defend = B.threat.length > 0;
    // laufende Baustelle
    const site = this.structs.find(s => s.team === t.id && s.prog < 1 && !s.remove);
    B.buildId = site ? site.id : 0;
    // Rollen: Bergleute, Bauarbeiter, Kämpfer (Petra-artige Arbeitsteilung)
    const fighters = [], workers = [];
    for (const c of own) (c.knight ? fighters : workers).push(c);
    const want = helper ? 0 : (own.length < 3 && !B.defend && !B.attack) ? 0 : Math.round(own.length * (t.res.weapons || t.res.knight ? D.fighterShare : 0)) + (B.attack ? 1 : 0); // früh: alle bauen ab (Wirtschaft zuerst)
    workers.sort((a, b) => (b.inv.includes('sword') ? 1 : 0) - (a.inv.includes('sword') ? 1 : 0));
    while (fighters.length < want && workers.length > 1) fighters.push(workers.shift());
    B.roles.clear();
    for (const c of fighters) B.roles.set(c.id, 'fighter');
    for (const c of workers) B.roles.set(c.id, 'miner');
    // Bauarbeiter: nächster Arbeiter zur Baustelle bzw. zum geplanten Bauplatz
    const bpos = site || B.site;
    if (bpos && workers.length) { // Bauarbeiter bleibt derselbe, solange er lebt (kein Hin- und Herwechseln)
      let bw = workers.find(c => c.id === B.builder);
      if (!bw) { let bd = 1e9; for (const c of workers) { const d = Math.abs(c.x - bpos.x) + 2.5 * Math.abs(c.y - bpos.y) + golds(c) * 25; if (d < bd) { bd = d; bw = c; } } }
      if (bw) B.roles.set(bw.id, 'builder'); B.builder = bw ? bw.id : 0;
    } else B.builder = 0;
    if (site && workers.length >= 4) { const c2 = workers.find(c => B.roles.get(c.id) === 'miner'); if (c2) B.roles.set(c2.id, 'builder'); }
    if (helper) { this.aiStatusHelper(t, B, own); return; }
    // Angriff/Verteidigung nach Stärkevergleich (mit Hysterese)
    const my = this.aiStrength(t.id);
    let foeT = null, foeS = 1e9;
    for (const o of this.teams) if (o.id !== t.id && !o.elim) { const s = this.aiStrength(o.id); if (s < foeS) { foeS = s; foeT = o; } }
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
    else if (site) s = 'baut ' + BUILD[site.type].name;
    else if (B.site) s = 'plant ' + BUILD[B.site.type].name;
    else if (t.rq) s = 'forscht: ' + RES_BY[t.rq].name;
    else s = 'baut Gold ab';
    t.stat = s; B.stat = s;
  },
  aiSpend(t, B, D, own, bases, fighters) {
    const R = D.reserve, n = own.length, m = t.money;
    if (!bases.length) { // Basis verloren → neue Hütte hat Vorrang
      if (!B.site && !B.buildId && m >= BUILD.hut.price) this.aiPlanSite(t, B, 'hut');
      return;
    }
    if (n === 0) { if (m >= PRICE_CLONK) this.aiBuy(t, null, t.res.knight && m >= PRICE_KNIGHT ? 'knight' : 'clonk'); return; }
    const save = B.site ? BUILD[B.site.type].price : 0;
    const free = m - save;
    // 1) Grundversorgung: mindestens 2 Arbeiter
    if (n < 2 && free >= PRICE_CLONK) { this.aiBuy(t, null, 'clonk'); return; }
    // 2) Forschung nach Plan (Bauordnung)
    if (!t.rq) for (const k of D.research) {
      const r = RES_BY[k]; if (t.res[k]) continue;
      if (r.req && !r.req.every(q => t.res[q])) continue;
      if (free >= r.cost + R) { this.research(t, k); return; }
      break;
    }
    // 3) Gebäude
    if (!B.site && !B.buildId) for (const k of D.builds) {
      const Bd = BUILD[k]; if (Bd.res && !t.res[Bd.res]) continue;
      if (this.structs.some(s => s.team === t.id && s.type === k && !s.remove)) continue;
      if ((B.unbuild[k] || 0) > this.tick) continue;
      if (k === 'tower' && n < 3) continue;
      if (m >= Bd.price + R) { this.aiPlanSite(t, B, k); return; }
    }
    // Sparziel: nächste geplante Forschung bzw. nächstes Gebäude (sonst frisst der Buddler-Kauf alles auf)
    let goal = 0;
    if (n >= 3 && !B.defend) {
      if (!t.rq) for (const k of D.research) { const r = RES_BY[k]; if (t.res[k]) continue; if (r.req && !r.req.every(q => t.res[q])) continue; goal = r.cost; break; }
      if (!goal && !B.site && !B.buildId) for (const k of D.builds) { const Bd = BUILD[k]; if (Bd.res && !t.res[Bd.res]) continue; if (this.structs.some(s => s.team === t.id && s.type === k && !s.remove)) continue; if ((B.unbuild[k] || 0) > this.tick) continue; goal = Bd.price; break; }
    }
    // 4) mehr Buddler / Ritter
    const knights = own.filter(c => c.knight).length;
    if (t.res.knight && (B.attack || B.defend || knights < 1) && n < D.maxClonks + 2 && free >= PRICE_KNIGHT + R + goal) { this.aiBuy(t, null, 'knight'); return; }
    if (n < D.maxClonks && free >= PRICE_CLONK + R + goal) { this.aiBuy(t, null, 'clonk'); return; }
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
  // Bauplatz suchen (wie die Prüfung in build()); merkt unmögliche Gebäude eine Zeit lang (Petra: „unbuildables“)
  aiPlanSite(t, B, type) {
    const base = this.aiBases(t.id)[0] || this.structs.find(s => s.team === t.id) || { x: this.bases[t.id], y: this.surf[this.bases[t.id]] };
    const Bd = BUILD[type], hw = Bd.w >> 1;
    const offs = []; for (let o = 50; o <= 320; o += 10) offs.push(o, -o);
    for (const off of offs) {
      const x = Math.round(base.x + off); if (x - hw < 4 || x + hw > this.W - 4) continue;
      let y = 0; while (y < this.H - 1 && !this.solid(x, y + 1)) y++;
      if (y >= this.H - 2 || this.matAt(x, y) === MAT.WATER) continue;
      if (Math.abs(y - base.y) > 70) continue;
      let ground = 0; for (let xx = x - hw; xx <= x + hw; xx++) if (this.solid(xx, y + 1) || this.solid(xx, y + 2)) ground++;
      let free = true; for (let xx = x - hw; xx <= x + hw && free; xx += 2) for (let yy = y - Bd.h + 2; yy <= y - 1; yy += 3) if (this.solid(xx, yy)) { free = false; break; }
      if (ground < Bd.w * 0.85 || !free) continue;
      if (this.structs.some(s => Math.abs(s.x - x) < (s.w + Bd.w) / 2 + 6 && Math.abs(s.y - y) < 40)) continue;
      const dir = off > 0 ? 1 : -1;
      const sx = x - dir * (hw + 6);
      if (this.boxHit(sx, y) || !this.boxHit(sx, y + 2)) continue;
      B.site = { type, x, y, dir, sx, t0: this.tick };
      return true;
    }
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
    if (c.act === 'push') { this.aiPush(c, t, B, D, A, helper, k); return this.aiStuckTrack(c, t, A, A.moving); }
    if (!A.task || A.t >= A.nextThink) { A.nextThink = A.t + D.think + (c.id % 5); this.aiDecide(c, t, B, D, A, helper); }
    this.aiProtect(c, t, D, A, k);
    this.aiExec(c, t, B, D, A, helper, k);
    this.aiStuckTrack(c, t, A, A.moving);
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
    if (!helper) {
      if (B.defend && (role === 'fighter' || this.aiArmed(c))) { const e = this.aiPick(c, B.threat); if (e) add('fight', 0.9, { target: e, defend: 1 }); }
      if (role === 'fighter' && !this.aiArmedEnough(c) && home && t.money >= 22) add('arm', 0.86);
      if (role === 'fighter' && B.attack) add('attack', 0.8);
      else if (role === 'fighter' && this.aiArmedEnough(c)) add('guard', (B.threat.length || B.roles.size >= 5) ? 0.45 : 0.28); // ruhige Lage: Kämpfer helfen beim Abbau
      const gun = this.vehicles.find(v => v.team === t.id && VEH[v.type].gun && !v.pusher && !v.remove);
      if (gun && role === 'fighter' && B.attack && D.k === 'hard' && c.inv.some(x => AMMO.has(x)) && (!B.gun || B.gun === c.id)) add('gun', 0.83, { veh: gun.id });
    }
    // Wirtschaft
    if (golds >= D.goldCap || (c.inv.length >= INV_MAX && golds)) add('sell', 0.9);
    if (role === 'builder' || helper) {
      if (B.site && !helper && B.builder === c.id) add('build', 0.92);
      const s = this.structs.find(s => s.team === c.team && s.prog < 1 && !s.remove);
      if (s) add('help', role === 'builder' ? 0.9 : 0.55, { sid: s.id });
    }
    const lorry = this.vehicles.find(v => v.team === t.id && v.type === 'lorry' && !v.pusher && !v.remove && v.inv.filter(x => x === 'gold').length >= 6 && !(v.haulBlock > this.tick));
    if (lorry && role !== 'fighter') add('haul', 0.88, { veh: lorry.id });
    const it = this.aiFindItem(c, B);
    if (it && c.inv.length < INV_MAX) add('collect', 0.62, { item: it.id });
    const fullNoGold = c.inv.length >= INV_MAX && !golds; // Taschen voll mit Waffen: kann nicht abbauen → Wache halten
    if (fullNoGold) { if (home) add('guard', 0.42); }
    else if (role !== 'fighter' || !B.attack) add('mine', role === 'fighter' ? 0.3 : 0.5);
    // laufende Fahrzeug-/Turm-Aufgaben nicht ständig unterbrechen
    if (A.task && (A.task.type === 'park' || A.task.type === 'haul' || A.task.type === 'gun') && this.vehById(A.task.veh)) add(A.task.type, 0.87, { veh: A.task.veh, x: A.task.x });
    if (!helper && B.defend && this.aiArmed(c)) {
      const tw = this.structs.find(s => s.team === c.team && s.type === 'tower' && s.prog >= 1 && !s.remove && Math.abs(s.x - c.x) < 220);
      if (tw && B.threat.some(e => Math.abs(e.x - tw.x) < 200)) add('tower', 0.93, { sid: tw.id, until: A.t + 1200 });
    }
    if (D.idleP && golds < 2 && !foe && this.rand() < D.idleP) add('idle', 0.7, { until: A.t + 50 + (this.rand() * 70 | 0) }); // Leicht: trödelt ab und zu (aber nicht mit vollen Taschen oder im Kampf)
    if (A.wander && A.wander.until > A.t) add('wander', 1.05, A.wander);
    let best = null;
    for (const o of cand) { if (A.task && A.task.type === o.type) o.s += 0.08; if (!best || o.s > best.s) best = o; }
    if (!best) best = { type: 'idle', s: 0, until: A.t + 30 };
    if (A.task && A.task.type === best.type) { // gleiche Aufgabe: Parameter übernehmen (Ziel nicht ständig wechseln)
      if (best.target) A.task.target = best.target; if (best.item) A.task.item = best.item;
      return;
    }
    if (A.task && A.task.type === 'idle' && A.task.until > A.t && best.type !== 'heal' && best.type !== 'fight') return;
    if (best.type === 'idle' && !(best.until > A.t)) best.until = A.t + 40;
    if (A.task && A.task.item) B.itemClaims.delete(A.task.item);
    if (best.item) B.itemClaims.set(best.item, c.id);
    A.task = best; A.path = null;
  },
  aiArmedEnough(c) { return c.knight || c.inv.includes('sword') || c.inv.filter(x => THROWABLE.has(x)).length >= 1 || (c.inv.includes('bow') && c.arrows > 3); },
  aiNearestFoe(c, r, helper) {
    let best = null, bd = r;
    for (const o of this.clonks) { if (o.team === c.team || o.act === 'dead' || o.inside) continue; const d = Math.hypot(o.x - c.x, (o.y - c.y) * 1.6); if (d < bd) { bd = d; best = o; } }
    for (const m of this.monsters) { const d = Math.hypot(m.x - c.x, (m.y - c.y) * 1.6); if (d < Math.min(bd, helper ? 45 : 90)) { bd = d; best = m; } }
    return best;
  },
  aiPick(c, list) { let best = null, bd = 1e9; for (const o of list) { if (o.act === 'dead' || o.inside) continue; const d = Math.hypot(o.x - c.x, o.y - c.y) + o.hp * 0.6; if (d < bd) { bd = d; best = o; } } return best; },
  aiFindItem(c, B) {
    let best = null, bd = 160;
    for (const it of this.items) {
      if (it.remove || it.stuck || it.armed || it.fuse > 0 || it.chain || it.type === 'arrow') continue;
      if (it.type !== 'gold' && !THROWABLE.has(it.type) && it.type !== 'arrows') continue;
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
        const hs = this.aiBaseSpot(c, home); if (this.nearBase(c) || this.aiGoto(c, A, k, hs.x, hs.y, 3)) { if (golds(c)) this.aiSell(c); this.use(c); }
        return;
      case 'sell':
        if (!home) { A.task = null; return; }
        if (this.nearBase(c)) { this.aiSell(c); A.task = null; return; }
        { const sp = this.aiBaseSpot(c, home); if (this.aiGoto(c, A, k, sp.x, sp.y, 2) && !this.nearBase(c)) { A.arrived = false; A.moving = true; k[home.x > c.x ? 'r' : 'l'] = 1; } } return;
      case 'arm':
        if (!home) { A.task = null; return; }
        if (this.nearBase(c)) { this.aiArm(c, t, D); A.task = null; return; }
        { const sp = this.aiBaseSpot(c, home); if (this.aiGoto(c, A, k, sp.x, sp.y, 2) && !this.nearBase(c)) { A.arrived = false; A.moving = true; k[home.x > c.x ? 'r' : 'l'] = 1; } } return;
      case 'collect': {
        const it = this.items.find(i => i.id === T.item);
        if (!it || it.remove || it.stuck || c.inv.length >= INV_MAX) { B.itemClaims.delete(T.item); A.task = null; return; }
        if (this.aiGoto(c, A, k, it.x, it.y, 3)) { if (!this.grabNear(c)) { A.black.set('i' + it.id, this.tick + 1800); A.task = null; } }
        return;
      }
      case 'build': {
        const S = B.site; if (!S || B.builder !== c.id) { A.task = null; return; }
        if (this.tick - S.t0 > 60 * 60) { B.unbuild[S.type] = this.tick + 60 * 30; B.site = null; A.task = null; return; }
        if (this.aiGoto(c, A, k, S.sx, S.y, 2) && c.act === 'walk') {
          c.dir = S.dir; const n0 = this.structs.length; this.build(c, S.type);
          if (this.structs.length > n0) { B.buildId = this.structs[this.structs.length - 1].id; B.site = null; A.task = { type: 'help', sid: B.buildId, s: 0.9 }; }
          else { B.unbuild[S.type] = this.tick + 60 * 25; B.site = null; A.task = null; }
        }
        return;
      }
      case 'help': {
        const s = this.structs.find(o => o.id === T.sid);
        if (!s || s.prog >= 1 || s.remove) { A.task = null; return; }
        const off = ((c.id % 3) - 1) * 6;
        if (this.aiGoto(c, A, k, s.x + off, s.y, 4)) { if (c.act === 'dig') c.act = 'walk'; }
        return;
      }
      case 'mine': return this.aiMine(c, t, B, D, A, k, home);
      case 'haul': case 'park': return this.aiHaulStart(c, t, B, A, k);
      case 'tower': {
        const s = this.structById(T.sid); if (!s || s.remove) { A.task = null; return; }
        if (this.aiGoto(c, A, k, s.x, s.y, 4) && c.act === 'walk') { this.use(c); if (!c.inside) A.task = null; }
        return;
      }
      case 'gun': {
        const v = this.vehById(T.veh); if (!v || v.pusher) { A.task = null; return; }
        if (this.aiGoto(c, A, k, v.x, v.y, 5) && (c.act === 'walk')) { this.use(c); if (c.act === 'push') B.gun = c.id; else A.task = null; }
        return;
      }
      case 'fight': case 'attack': case 'guard': return this.aiCombat(c, t, B, D, A, k, home);
    }
  },
  aiStat0(c, s) { c.aiS = s; },
  aiArm(c, t, D) {
    const R = Math.max(0, D.reserve - 10);
    if (c.knight && c.arrows < 6 && t.money >= 6 + R) this.aiBuy(t, c, 'arrows');
    if (t.res.weapons && !c.inv.includes('sword') && c.inv.length < INV_MAX && t.money >= 15 + R) this.aiBuy(t, c, 'sword');
    if (t.res.weapons && c.inv.includes('sword') && !c.inv.includes('shield') && c.inv.length < INV_MAX && t.money >= 12 + R) this.aiBuy(t, c, 'shield');
    if (t.res.weapons && !c.armor && t.money >= 25 + R + 20) this.aiBuy(t, c, 'armor');
    let g = 0; while (c.inv.length < INV_MAX && g++ < 3) { const it = t.res.tnt && t.money >= 25 + R + 30 && this.rand() < 0.3 ? 'tnt' : 'flint'; if (t.money < ITEMS[it].price + R) break; this.aiBuy(t, c, it); }
  },
  // Bergbau: nächste Goldzelle wählen (mit Reservierung, damit sich die Bergleute verteilen), hingraben, voll → verkaufen
  aiMine(c, t, B, D, A, k, home) {
    const N = this.nav;
    if (A.mine >= 0 && !N.gold[A.mine]) { // Zelle abgebaut → Nachbarzelle derselben Ader bevorzugen
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
      if ((A.mineT = (A.mineT || 0) + 1) > 240) { A.black.set('g' + A.mine, this.tick + 3600); A.mine = -1; A.mineT = 0; }
    } else A.mineT = 0;
  },
  aiClaimedByOther(B, i, id) { for (const [cid, ci] of B.claims) if (cid !== id && ci >= 0 && Math.abs((ci % this.nav.gw) - (i % this.nav.gw)) < 6 && Math.abs(((ci / this.nav.gw) | 0) - ((i / this.nav.gw) | 0)) < 6) return true; return false; },
  aiChooseGold(c, t, B, home) {
    const N = this.nav, gw = N.gw; let best = -1, bs = 1e9;
    const hx = home ? home.x : c.x, hy = home ? home.y : c.y;
    let n = 0;
    for (const i of N.goldSet) {
      if (n++ > 4000) break;
      const x = (i % gw) * NC, y = ((i / gw) | 0) * NC;
      if (c.ai.black.get('g' + i) > this.tick) continue;
      if (N.lavaNear(i % gw, (i / gw) | 0)) continue;
      if (this.aiClaimedByOther(B, i, c.id)) continue;
      // Ader-Größe grob schätzen (viele Goldzellen in der Nähe = lohnend)
      let rich = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const j = i + dy * gw + dx; if (j >= 0 && j < N.gold.length && N.gold[j]) rich++; }
      const s = Math.abs(x - hx) * 1.0 + Math.max(0, y - hy) * 1.6 + Math.hypot(x - c.x, y - c.y) * 0.5 - rich * 9;
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
    for (const o of this.clonks) if (o.team !== t.id && o.act !== 'dead' && !o.inside) { const d = Math.abs(o.x - c.x); if (d < bd) { bd = d; best = { x: o.x, y: o.y - 5 }; } }
    for (const s of this.structs) if (s.team !== t.id && (tid === undefined || s.team === tid)) { const d = Math.abs(s.x - c.x) + 60; if (d < bd) { bd = d; best = { x: s.x, y: s.y - s.h / 2 }; } }
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
    if (A.blockT > 0) { A.blockT--; if (c.inv.includes('shield')) { k.b = 1; c.dir = A.blockDir || c.dir; } return; }
    if (!D.evade && !c.inv.includes('shield')) return;
    if ((A.t + c.id) % 3) return;
    for (const it of this.items) {
      if (!it.armed || it.remove) continue;
      const own = this.clonks.find(o => o.id === it.owner); if (own && own.team === c.team) continue;
      const sp = Math.hypot(it.vx, it.vy); if (sp < 1.4) continue;
      let x = it.x, y = it.y, vx = it.vx, vy = it.vy, hit = false;
      for (let s = 0; s < 18; s++) { vy += 0.1; x += vx; y += vy; if (Math.abs(x - c.x) < 7 && y > c.y - 13 && y < c.y + 3) { hit = true; break; } }
      if (!hit) continue;
      if (c.inv.includes('shield') && this.rand() < D.blockP && (c.act === 'walk' || c.act === 'fight')) { A.blockT = 16; A.blockDir = Math.sign(it.x - c.x) || c.dir; k.b = 1; c.dir = A.blockDir; }
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
      const gx = home.x + (B.target !== undefined && this.bases[B.target] < home.x ? -50 : 50);
      this.aiGoto(c, A, k, gx, home.y, 10); if (A.arrived && c.act === 'dig') c.act = 'walk';
      const e = this.aiNearestFoe(c, 160, false); if (e) { A.task = { type: 'fight', target: e, s: 0.9 }; }
      return;
    }
    if (T.type === 'attack') {
      const tid = B.target;
      if (!tgt || A.t % 30 === 0) { let best = null, bd = 1e9; for (const o of this.clonks) { if (o.team === t.id || o.act === 'dead' || o.inside) continue; const d = Math.abs(o.x - c.x) + Math.abs(o.y - c.y) * 2 + (o.team === tid ? 0 : 300); if (d < bd) { bd = d; best = o; } } tgt = best; T.target = best; }
      if (!tgt) { // niemand draußen: feindliche Gebäude angreifen
        const s = this.structs.filter(o => o.team !== t.id && !o.remove).sort((a, b) => Math.abs(a.x - c.x) - Math.abs(b.x - c.x))[0];
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
    const hasSword = c.inv.includes('sword'), hasBow = c.inv.includes('bow') && c.arrows > 0, ammo = c.inv.some(x => THROWABLE.has(x));
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
      if (c.inv.includes('shield') && tgt.swing > 0 && this.rand() < D.blockP) { A.blockT = 12; A.blockDir = Math.sign(dx) || c.dir; }
      if (!hasSword && c.act === 'walk') k[dx > 0 ? 'r' : 'l'] = 1; // hineinlaufen = Faustkampf
      return;
    }
    // Annähern (mit Abstand, wenn nur Fernwaffen)
    const keep = (ammo || hasBow) && !hasSword ? 60 : 0;
    if (keep && ad < keep && ad > 22 && Math.abs(dy) < 40) { if (c.act === 'dig') c.act = 'walk'; return; }
    if (T.type === 'fight' && home && T.defend && Math.abs(tgt.x - home.x) > 320) { A.task = null; return; }
    this.aiGoto(c, A, k, tgt.x, tgt.y, keep ? 50 : 3);
  },
  aiSlot(c, type) { const i = c.inv.indexOf(type); if (i >= 0) c.slot = i; },
  // Ballistisch zielen (mit Vorhalt) und werfen/schießen
  aiRanged(c, tgt, D, inside) {
    const hasBow = c.inv.includes('bow') && c.arrows > 0;
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
    if (!useBow && this.clonks.some(o => o.team === c.team && o !== c && o.act !== 'dead' && Math.hypot(o.x - tx, o.y - 5 - ty) < 24)) return false;
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
    if (A.ramp) { if (this.aiRamp(c, A, k, x, y)) return false; }
    else if (st > 160 && dyg < -24 && Math.abs(dxg) < 140 && !c.inside && !(A.rampCd > A.t)) { if (this.aiRampStart(c, A, dxg)) return false; }
    if (st > 90 && A.lvl < 1) { A.lvl = 1; A.path = null; if (c.act === 'walk') { k[dxg > 0 ? 'r' : 'l'] = 1; this.clonkAction(c, 'jump'); } }
    else if (st > 200 && A.lvl < 2) { // Problemstelle für die Wegsuche merken, dann freigraben
      if (A.path) for (let q = Math.max(0, A.pi - 1); q < Math.min(A.path.length, A.pi + 5); q++) N.penalize(A.path[q], 8, this.tick + 2400);
      A.lvl = 2; A.path = null; A.forceDig = 50;
    }
    else if (st > 360 && A.lvl < 3) { A.lvl = 3; A.black.set('c' + tx + ',' + ty, this.tick + 1800); if (A.task && A.task.type === 'mine' && A.mine >= 0) { A.black.set('g' + A.mine, this.tick + 3600); A.mine = -1; } A.wander = { type: 'wander', x: c.x + (this.rand() < 0.5 ? -1 : 1) * (40 + this.rand() * 60), y: c.y - 10, until: A.t + 180 }; A.task = A.wander; A.path = null; A.impT = A.t; return false; }
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
        const r = N.find(sx, sy, tx, ty, lim);
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
    const score = d => { let sc = 0; for (let i = 6; i <= 40; i += 2) { const m = this.matAt(c.x + d * i * 0.75, c.y - 5 - i * 0.66); if (SOLID[m] && !DIGGABLE[m]) sc -= 3; else if (m === MAT.LAVA || m === MAT.WATER) sc -= 4; else sc += 1; } return sc; };
    const pref = Math.sign(dxg) || c.dir, a = score(pref) + 2, b = score(-pref);
    if (Math.max(a, b) < 0) { A.rampCd = A.t + 400; return false; }
    A.ramp = { dir: a >= b ? pref : -pref, until: A.t + 1600, flips: 0, lastY: c.y, lastT: A.t };
    A.path = null; A.forceDig = 0; return true;
  },
  aiRamp(c, A, k, x, y) {
    const R = A.ramp;
    if (c.y <= y + 4 || A.t > R.until || R.flips > 3) { A.ramp = null; A.rampCd = A.t + 300; A.impT = A.t; A.lvl = 0; A.path = null; return false; }
    if (c.y < R.lastY - 2) { R.lastY = c.y; R.lastT = A.t; A.impT = A.t; }
    else if (c.y > R.lastY + 8) { R.lastY = c.y; R.lastT = A.t; } // in Hohlraum gefallen: von hier aus weiter
    if (c.act === 'dig') { // Serpentinen: nach ~40 px Rampe umdrehen (nur in die Richtung zurück, in der das Ziel liegt)
      if (R.zx === undefined) R.zx = c.x;
      if ((c.x - R.zx) * R.dir > 40 && (x - c.x) * R.dir < 0) { R.dir = -R.dir; R.zx = c.x; }
    }
    else if (A.t - R.lastT > 240) { R.dir = -R.dir; R.flips++; R.lastT = A.t; R.zx = undefined; } // kommt nicht höher (Fels): Richtung wechseln
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
  aiWallSide(c, pref) { for (let d = 1; d <= 7; d++) { if (this.boxHit(c.x + pref * d, c.y - 3)) return pref; if (this.boxHit(c.x - pref * d, c.y - 3)) return -pref; } return 0; },
  // Steckenbleib-Statistik: Buddler will sich bewegen, kommt aber nicht vom Fleck
  aiStuckTrack(c, t, A, wants) {
    const S = t.stats; if (!S) return;
    if (!wants || Math.hypot(c.x - A.anchorX, c.y - A.anchorY) > 8) {
      const dur = A.t - A.anchorT;
      if (A.stuckOn) { if (dur > S.maxStuck) S.maxStuck = dur; A.stuckOn = false; }
      A.anchorX = c.x; A.anchorY = c.y; A.anchorT = A.t; return;
    }
    const dur = A.t - A.anchorT;
    if (dur > 300 && !A.stuckOn) { A.stuckOn = true; S.stuckEv++; }
    if (A.stuckOn && dur > S.maxStuck) S.maxStuck = dur;
    if (dur > 1500 && (!A.hardReset || dur % 900 === 0)) { // letzte Stufe (wiederholt): Aufgabe verwerfen, loslassen, Feuerstein zum Freisprengen
      A.hardReset = true; A.task = null; A.path = null; A.mine = -1; A.lvl = 0; A.forceDig = 60;
      if (c.act === 'climb' || c.act === 'hangle') { c.act = 'jump'; c.vx = -c.dir * 0.7; c.vy = 0.2; c.dir = -c.dir; A.dropT = A.t + 40; }
      A.wander = { type: 'wander', x: c.x + (this.rand() < 0.5 ? -1 : 1) * (40 + this.rand() * 80), y: c.y + 20, until: A.t + 240 };
      const fl = c.inv.findIndex(x => THROWABLE.has(x));
      if (fl >= 0 && c.act === 'walk') { c.slot = fl; this.primary(c, [c.x + c.dir * 40, c.y - 20]); }
    }
    if (dur < 1500) A.hardReset = false;
  },
});
function golds(c) { return c.inv.filter(x => x === 'gold').length; }
