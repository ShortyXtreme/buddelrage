// BuddelRage – Weltstile / Biome (eigener Code). Inspiration: OpenClonk-Kartengenerator (Landscape.txt / Map.c):
// Schichten (Oberfläche → Erde → Fels → Granitboden), verwirbelte Rausch-Masken für Höhlen und Erze, Material je Tiefe.
// Alles ist deterministisch aus cfg.seed (+ this.rand) → Host, Clients (bekommen ohnehin die fertige Karte) und Spielstände stimmen überein.
'use strict';
// pal: m = Farbfaktor je Material [r,g,b], a = Zusatz je Material [r,g,b] (z. B. Erde → Sandstein), grass = [mr, ar, mg, ag, mb, ab] (Grasnarbe), sky = Tageshimmel [oben, Mitte, unten], snow = Schneegrenze (Anteil von H)
const WORLD_STYLES = {
  klassisch: { n: 'Klassisch', ic: '🌳', d: 'Wiesen, Seen und Höhlen – das bekannte BuddelRage-Land.',
    caveT: 0.685, rockT: 0.64, worms: 0.35, cLakes: 0.4, lavaN: 1, lakes: 1, goldPct: 4.25, minCave: 700 },
  huegel: { n: 'Hügelland', ic: '🌄', d: 'Sanfte Hügel, viele Seen und Erde – gut zum Graben.',
    surf: 'hills', caveT: 0.70, goldPct: 3.99, minCave: 700, rockT: 0.66, worms: 0.5, cLakes: 1.2, lavaN: 0.6, lakes: 2,
    pal: { m: { 2: [1.04, 1.02, 0.94] }, grass: [0.3, 38, 0.4, 122, 0.2, 18], sky: [[96, 170, 236], [190, 226, 246], [236, 246, 236]] } },
  berge: { n: 'Gebirge', ic: '🏔️', d: 'Hohe Gipfel mit Schnee, viel Fels, tiefe Täler und Bergseen.',
    surf: 'mountains', caveT: 0.69, goldPct: 5.07, minCave: 600, rockT: 0.60, rockF: 1500, worms: 0.6, cLakes: 0.8, lavaN: 1, lakes: 1.5, snow: 0.2,
    pal: { m: { 2: [0.92, 0.9, 0.9], 4: [0.95, 0.97, 1.05] }, grass: [0.3, 26, 0.4, 92, 0.25, 30], sky: [[64, 132, 226], [172, 210, 248], [228, 240, 252]] } },
  hoehlen: { n: 'Höhlenwelt', ic: '🦇', d: 'Geordnete Höhlengänge, unterirdische Seen und viele Goldbrocken.',
    surf: 'flat', caveT: 0.655, tunW: 0.035, goldPct: 4.61, minCave: 350, rockT: 0.66, worms: 2.2, cLakes: 3, lavaN: 1, lakes: 0.6,
    pal: { m: { 1: [0.85, 0.88, 0.95], 2: [0.95, 0.95, 0.98] }, grass: [0.3, 40, 0.4, 100, 0.2, 40], sky: [[100, 150, 210], [180, 208, 232], [222, 232, 236]] } },
  vulkan: { n: 'Vulkanland', ic: '🌋', d: 'Schroffes Aschegelände, Vulkankegel und Lavaseen tief unten – heiß, aber goldreich.',
    surf: 'volcano', caveT: 0.68, goldPct: 4.67, minCave: 600, rockT: 0.61, rockF: 1800, worms: 0.8, cLakes: 0.3, lavaN: 2.2, lavaY: 0.68, lavaT: 0.53, lavaBand: 0.88, lavaPools: 1.5, lakes: 0.4,
    pal: { m: { 2: [0.78, 0.7, 0.68], 3: [0.7, 0.66, 0.66], 4: [0.72, 0.68, 0.7], 1: [0.8, 0.7, 0.7] }, grass: [0.25, 62, 0.25, 58, 0.25, 54], sky: [[88, 96, 128], [196, 150, 128], [236, 168, 120]] } },
  wueste: { n: 'Wüste', ic: '🏜️', d: 'Dünen aus rieselndem Sand, wenig Wasser, eine Oase – Sand stützt Tunnel nicht!',
    surf: 'dunes', caveT: 0.69, goldPct: 4.43, minCave: 600, rockT: 0.66, worms: 0.6, cLakes: 0.2, lavaN: 1, lakes: 0.5, topSand: 26, sandT: 0.6,
    pal: { m: { 2: [0.62, 0.56, 0.5], 3: [1.08, 1.0, 0.86], 4: [1.12, 0.98, 0.84], 1: [1.1, 0.95, 0.8] }, a: { 2: [92, 70, 38] }, grass: [0.3, 150, 0.3, 124, 0.2, 52], sky: [[110, 168, 226], [232, 216, 182], [250, 232, 194]] } },
};
const WORLD_STYLE_KEYS = Object.keys(WORLD_STYLES);
const WORLD_STYLE_RANDOM = ['klassisch', 'huegel', 'berge', 'hoehlen', 'vulkan', 'wueste'];
function worldStyleName(k) { return k === 'zufall' ? 'Zufall' : (WORLD_STYLES[k] || WORLD_STYLES.klassisch).n; }
// „zufall“ → fester Stil aus dem Seed (gleich auf allen Rechnern); Ergebnis wird in cfg.style festgeschrieben, cfg.styleRnd merkt die Zufallswahl
function resolveWorldStyle(cfg) {
  let s = cfg.style;
  if (s === 'zufall') { s = WORLD_STYLE_RANDOM[Math.floor(hash2(cfg.seed | 0, 77, 4242) * WORLD_STYLE_RANDOM.length)]; cfg.styleRnd = 1; }
  if (!WORLD_STYLES[s]) s = 'klassisch';
  cfg.style = s; return s;
}

Object.assign(World.prototype, {
  // Höhenprofil je Stil (y nach unten; kleinere Werte = höher)
  styleSurface(ST) {
    const { W, H, seed } = this, sf = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      let y;
      switch (ST.surf) {
        case 'hills': y = H * 0.29 + (fbm(x / 200, 0.5, seed, 3) - 0.5) * 210 + (fbm(x / 70, 1.7, seed + 5, 2) - 0.5) * 70 + (fbm(x / 22, 3.3, seed + 6, 2) - 0.5) * 8; break;
        case 'mountains': { const r = 1 - Math.abs(2 * fbm(x / 210, 0.5, seed, 3) - 1); y = H * 0.44 - Math.pow(r, 1.5) * H * 0.38 + (fbm(x / 34, 3.3, seed + 5, 2) - 0.5) * 16; break; }
        case 'flat': y = H * 0.24 + (fbm(x / 230, 0.5, seed, 3) - 0.5) * 150 + (fbm(x / 40, 3.3, seed + 5, 2) - 0.5) * 22; break;
        case 'volcano': y = H * 0.31 + (fbm(x / 210, 0.5, seed, 3) - 0.5) * 170 + (fbm(x / 26, 3.3, seed + 5, 3) - 0.5) * 40; break;
        case 'dunes': { const ph = x / 95 + fbm(x / 300, 1.1, seed + 2, 2) * 3; y = H * 0.31 + (fbm(x / 260, 0.5, seed, 3) - 0.5) * 150 - Math.pow(Math.sin(ph * Math.PI) ** 2, 1.3) * 18; break; }
        default: y = H * 0.27 + (fbm(x / 260, 0.5, seed, 3) - 0.5) * 260 + (fbm(x / 40, 3.3, seed + 5, 2) - 0.5) * 26;
      }
      sf[x] = y;
    }
    // Vulkankegel zwischen den Basen (Krater oben, Magmakammer darunter – siehe genStyled)
    this.cones = [];
    if (ST.surf === 'volcano') {
      const n = Math.max(1, Math.round(W / 1400)), bs = this.basePositions(this.nB);
      for (let k = 0; k < n; k++) {
        let cx = -1;
        for (let t = 0; t < 40; t++) { const c = 120 + Math.floor(this.rand() * (W - 240)); if (bs.every(b => Math.abs(b - c) > 330) && this.cones.every(o => Math.abs(o.x - c) > 300)) { cx = c; break; } }
        if (cx < 0) continue;
        const rw = 110 + this.rand() * 50, hg = 90 + this.rand() * 60; this.cones.push({ x: cx, rw, hg });
        for (let x = Math.max(0, Math.round(cx - rw)); x <= Math.min(W - 1, Math.round(cx + rw)); x++) {
          const t = Math.max(0, 1 - Math.abs(x - cx) / rw); let lift = hg * Math.pow(t, 1.4);
          if (t > 0.86) lift -= (t - 0.86) / 0.14 * 26; // Krater
          sf[x] -= lift;
        }
      }
    }
    return sf;
  },
  genStyled(nBases) {
    const ST = WORLD_STYLES[this.style], { W, H, seed } = this, surf = this.surf, mat = this.mat, R = this.rand;
    this.nB = nBases;
    const sf = this.styleSurface(ST);
    this.makePlateaus(sf, nBases, 60, H * 0.5);
    for (let x = 0; x < W; x++) surf[x] = Math.max(50, Math.min(H * 0.55, Math.round(sf[x])));
    this.castleSites = this.bases.map((bx, i) => ({ x: bx + this.baseDir[i] * CASTLE_OFF, y: surf[bx] - 1, d: this.baseDir[i] }));
    const near = x => this.plats.some(P => x > P.a - 40 && x < P.b + 40);
    const nearBase = (x, r) => this.bases.some(b => Math.abs(b - x) < r);
    // Unter den Startplateaus (±40 px, sanft auslaufend über 60 px) keine Felsbänder bis ~90 px Tiefe (ab 150 px wieder normal):
    // sonst kann ein durchgehendes Felsband die Basis vom Gold darunter abriegeln → Buddler graben seitlich weit hinaus (raidtest Seed 1)
    const baseRockW = new Float32Array(W);
    for (let x = 0; x < W; x++) { let dmin = 1e9; for (const P of this.plats) dmin = Math.min(dmin, Math.max(0, P.a - 40 - x, x - (P.b + 40))); baseRockW[x] = dmin <= 0 ? 1 : Math.max(0, 1 - dmin / 60); }
    // --- Schichten (gleiches Prioritätsschema wie Klassisch, Schwellen je Stil) ---
    const granY = new Float32Array(W); for (let x = 0; x < W; x++) granY[x] = H - 16 - fbm(x / 30, 0, seed + 10, 2) * 18;
    const topS = ST.topSand || 0, sandT = ST.sandT || 0.64, rockF = ST.rockF || 2500, lavaY = H * (ST.lavaY || 0.72), lavaT = ST.lavaT || 0.56, band = ST.lavaBand ? H * ST.lavaBand : H * 2;
    // Schichtung: Gesteinsbänder liegen waagrecht (leicht gewellt/verfaltet) und werden mit der Tiefe felsiger; Sand als flache Linsen
    const colW = this.strataWarp(); // je Spalte: sanfte Wellung der Schichten (auch fürs Rendern, siehe colorPixel)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, s = surf[x];
      if (y < s) { mat[i] = MAT.SKY; continue; }
      if (y > granY[x]) { mat[i] = MAT.GRANITE; continue; }
      const d = y - s; let m;
      // weiche Rauschmasken (wenige Oktaven) → klare Höhlen und kompakte Erd-/Felsflächen statt Zacken; Gold kommt danach als Erzbrocken (placeDeposits)
      const baseZone = d < 130 && near(x); // unter den Startplateaus keine großen Hallen (KI/Spieler kommen sonst schwer wieder hoch)
      if (d > 50 && !baseZone && fbm(x / 75, y / 46, seed + 7, 2) > ST.caveT) m = (y > H * 0.6 && fbm(x / 220, y / 220, seed + 9, 2) > 0.45) ? MAT.WATER : MAT.TUNNEL;
      else if (ST.tunW && d > 40 && !baseZone && Math.abs(fbm(x / 150, y / 50, seed + 6, 2) - 0.5) < ST.tunW) m = MAT.TUNNEL;
      else {
        const yy = y + colW[x] + (fbm(x / 140, y / 110, seed + 42, 2) - 0.5) * 30; // Schichtfläche (verfaltet)
        const bv = fbm(x / 150, yy / 24, seed + 3, 3) * 0.82 + vnoise(x / 26, yy / 7, seed + 43) * 0.18; // breite, waagrechte Bänder + feine Maserung am Rand
        const bzr = baseRockW[x] && d < 150 ? baseRockW[x] * (d < 90 ? 0.35 : (150 - d) / 60 * 0.35) : 0; // felsfreie Zone unter den Startbasen
        if (bv > ST.rockT + STRATA_OFF + bzr - Math.min(d, 320) * 1.25 / rockF) m = MAT.ROCK;
        else if (topS && d < topS + fbm(x / 50, 1.5, seed + 12, 2) * 18) m = MAT.SAND; // Wüste: Sanddecke
        else if (d > 25 && fbm(x / 210, yy / 13, seed + 8, 2) > SAND_LENS) m = MAT.SAND; // Sandlinsen zwischen den Schichten
        else if (d < 22 && fbm(x / 130, y / 60, seed + 2, 3) > sandT) m = MAT.SAND;
        else m = MAT.EARTH;
      }
      if ((m === MAT.TUNNEL || m === MAT.WATER) && d > 70 && (y > band || (y > lavaY && fbm(x / 160, y / 90, seed + 11, 2) > lavaT))) m = MAT.LAVA;
      mat[i] = m;
    }
    // --- Wurmhöhlen (verwinkelte Gänge wie in Clonk-Höhlenszenarien) ---
    const carve = (cx, cy, r, m) => {
      for (let y = Math.max(1, Math.floor(cy - r)); y <= Math.min(H - 22, Math.ceil(cy + r)); y++) for (let x = Math.max(1, Math.floor(cx - r)); x <= Math.min(W - 2, Math.ceil(cx + r)); x++) {
        const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy > r * r) continue;
        const i = y * W + x, o = mat[i]; if (o === MAT.GRANITE || o === MAT.SKY || o === MAT.WATER || o === MAT.LAVA || y < surf[x] + 14) continue;
        if (m === MAT.TUNNEL || o !== MAT.TUNNEL) mat[i] = m;
      }
    };
    const nW = Math.round(W / 1000 * (ST.worms || 0) * 3);
    for (let k = 0; k < nW; k++) {
      let x = 40 + R() * (W - 80), y = surf[x | 0] + 60 + R() * (H * 0.75 - surf[x | 0] - 60), a = R() * 6.283;
      const len = 120 + R() * 360, r0 = 3.5 + R() * 4;
      for (let s = 0; s < len; s += 2) {
        a += (R() - 0.5) * 0.5; x += Math.cos(a) * 2; y += Math.sin(a) * 1.4;
        if (x < 8 || x > W - 8 || y > H - 40) break;
        if (y < surf[x | 0] + 30) { a = Math.abs(a) % 3.1416; y += 2; } // nicht an die Oberfläche brechen
        if (near(x) && y < surf[x | 0] + 90) continue;
        carve(x, y, r0 + Math.sin(s / 23) * 1.5, MAT.TUNNEL);
      }
    }
    this.smoothUnderground(ST); // kleine Löcher/Zacken weg, Mini-Höhlen zuschütten
    // --- Lava-Höhlen (unten Lava, oben Hohlraum), Magmakammern unter Vulkankegeln ---
    const nLava = this.cfg.lava === false ? 0 : Math.max(1, Math.round(W / 800 * (ST.lavaN || 1)));
    const lavaCave = (cx, cy, rx, ry) => {
      for (let y = Math.round(cy - ry); y <= cy + ry; y++) for (let x = Math.round(cx - rx); x <= cx + rx; x++) {
        if (x < 1 || x >= W - 1 || y < 1 || y >= H - 20) continue;
        const dx = (x - cx) / rx, dy = (y - cy) / ry; if (dx * dx + dy * dy > 1 + (hash2(x, y, 4) - 0.5) * 0.2) continue;
        mat[y * W + x] = y > cy - ry * 0.1 ? MAT.LAVA : MAT.TUNNEL;
      }
    };
    for (let k = 0; k < nLava; k++) {
      let cx = -1; for (let t = 0; t < 30; t++) { const c = 60 + Math.floor(R() * (W - 120)); if (!nearBase(c, 170)) { cx = c; break; } }
      if (cx < 0) continue;
      lavaCave(cx, Math.round(H * 0.74 + R() * H * 0.1), 22 + R() * 16, 11 + R() * 5);
    }
    if (this.cfg.lava !== false) for (const C of this.cones || []) lavaCave(C.x, Math.round(Math.max(surf[C.x] + 120, H * 0.62)), 30 + R() * 14, 16 + R() * 5);
    // --- unterirdische Seen (Wasser) und Lavaseen: Becken von unten auffüllen (stabil, fließt zu Spielbeginn nicht) ---
    const pool = (sx, sy, depth, L, maxN) => {
      let y = sy; while (y < H - 22 && mat[y * W + sx] === MAT.TUNNEL) y++; // Beckenboden
      if (y >= H - 22 || !SOLID[mat[y * W + sx]]) return 0;
      const lvl = y - 1 - depth, seen = new Set(), st = [(y - 1) * W + sx], cells = [];
      while (st.length) {
        const i = st.pop(); if (seen.has(i)) continue; seen.add(i);
        const m = mat[i], yy = (i / W) | 0, xx = i % W;
        if (m === MAT.WATER || m === MAT.LAVA) return 0; // keine Mischung (Lava + Wasser = Fels)
        if (m !== MAT.TUNNEL || yy < lvl) continue;
        if (xx < 2 || xx > W - 3 || yy < surf[xx] + 20 || cells.length > maxN) return 0;
        cells.push(i); st.push(i - 1, i + 1, i - W, i + W);
      }
      if (cells.length < 30) return 0;
      for (const i of cells) mat[i] = L; return cells.length;
    };
    const tryPools = (n, L, yMin, yMax, maxN) => {
      for (let k = 0, made = 0; k < n * 25 && made < n; k++) {
        const x = 20 + Math.floor(R() * (W - 40)), y = Math.floor(yMin + R() * (yMax - yMin));
        if (nearBase(x, 160) || mat[y * W + x] !== MAT.TUNNEL || y < surf[x] + 50) continue;
        if (pool(x, y, 6 + Math.floor(R() * 18), L, maxN)) made++;
      }
    };
    tryPools(Math.round(W / 1000 * (ST.cLakes || 0) * 2), MAT.WATER, H * 0.3, H * 0.7, 2600);
    if (this.cfg.lava !== false && ST.lavaPools) tryPools(Math.round(W / 1000 * ST.lavaPools), MAT.LAVA, H * 0.6, H * 0.85, 2200);
    if (this.cfg.lava === false) for (let i = 0; i < W * H; i++) if (mat[i] === MAT.LAVA) mat[i] = MAT.TUNNEL;
    this.settleGen();
    // Boden unter Basen festigen
    for (const P of this.plats) for (let x = Math.max(0, P.a - 8); x <= Math.min(W - 1, P.b + 8); x++) {
      const depth = x >= P.a && x <= P.b ? 34 : 18;
      for (let y = surf[x]; y < Math.min(H - 20, surf[x] + depth); y++) { const i = y * W + x; if (mat[i] !== MAT.EARTH) mat[i] = MAT.EARTH; }
    }
    // --- Oberflächenseen / Oase (wie Klassisch, Anzahl je Stil) ---
    const nLakes = ST.lakes ? Math.max(1, Math.round(W / 1700 * ST.lakes)) : 0, lakes = [];
    for (let q = 0; q < nLakes; q++) {
      let lx = -1, best = 0;
      for (let x = 60; x < W - 60; x++) { if (nearBase(x, 200) || lakes.some(L => x > L[0] - 150 && x < L[1] + 150)) continue; if (surf[x] > best) { best = surf[x]; lx = x; } }
      if (lx < 0) break;
      const level = best - (ST.surf === 'dunes' ? 12 : 22); let a = lx, b = lx;
      while (a > 0 && surf[a] > level) a--; while (b < W - 1 && surf[b] > level) b++;
      lakes.push([a, b]);
      if (this.plats.some(P => b >= P.a - 12 && a <= P.b + 12)) continue;
      if (b - a < 360 && a > 2 && b < W - 3) for (let x = a; x <= b; x++) for (let y = level; y < surf[x]; y++) mat[y * W + x] = MAT.WATER;
    }
    // --- Golderz-Brocken (Menge je Stil: goldPct); danach Gold fair auf die Basis-Abschnitte verteilen ---
    this.reach = this.reachMask(); // Gold nur dort, wo man ohne Fels/Granit/Lava hingraben kann
    { // je Basis-Abschnitt anteilig verteilen (fair von Anfang an), Rest gleicht balanceGold aus
      const tgt = W * H * (ST.goldPct || 4.3) / 100, bs = this.bases, cut = [0]; for (let k = 1; k < bs.length; k++) cut.push(Math.round((bs[k - 1] + bs[k]) / 2)); cut.push(W);
      for (let k = 0; k + 1 < cut.length; k++) this.placeDeposits(Math.round(tgt * (cut[k + 1] - cut[k]) / W), Math.max(20, cut[k]), Math.min(W - 20, cut[k + 1]));
    }
    this.balanceGold();
    this.reach = null;
    this.dropIslands(320); // Fels-/Sand-Splitter, die Gold/Erdgänge abgetrennt haben → Erde
    // Sand, der in Hohlräume rieseln würde, nach den Goldbrocken nochmals festigen
    this.settleGen(true);
    // Eingebettete Objekte (Feuersteine, Gold, Steine)
    for (let k = 0; k < Math.round(W * H / (22 * 620)); k++) {
      const x = 10 + Math.floor(R() * (W - 20)); const y = surf[x] + 15 + Math.floor(R() * (H - surf[x] - 50));
      if (mat[y * W + x] !== MAT.EARTH) continue;
      const r = R(); const type = r < 0.55 ? 'flint' : r < 0.75 ? 'gold' : 'rock';
      const it = this.spawnItem(type, x, y); it.stuck = true;
    }
    this.genCastleFix = this.secureCastleSites(); // sollte 0 sein; > 0 = Generator hat nachgebessert
    this.buildOres();
    this.activeNext.fill(1);
    this.recolorAll();
  },
  // Golderz-Brocken mit natürlicher Form: zackige Klumpen, Bänder entlang der Schichten oder verzweigte Adern, dazu feine Ausläufer in den Fels.
  // Größe/Ausrichtung variieren je Brocken; alles bleibt 4er-zusammenhängend (1 Brocken = 1 Registereintrag). Rückgabe = gesetzte Goldpixel.
  goldDeposit(cx, cy, r) {
    const { W, H, mat, surf, seed } = this, R = this.rand, so = seed + 33 + ((R() * 1000) | 0), set = [], org = [], clip = this._oreClip, plats = this.plats;
    const put = (x, y, rock) => { // ein Goldpixel (Erde/Sand; Fels nur für Ausläufer/Adern)
      if (x < 2 || x > W - 3 || y < 2 || y > H - 26 || y < surf[x] + 40) return;
      if (clip && (x < clip[0] || x > clip[1])) return; // Brocken bleibt im eigenen Basis-Abschnitt (faire Erträge)
      if (y < surf[x] + 75 && plats.some(P => x > P.a - 50 && x < P.b + 50)) return; // Schutzzone unter Startbasen: auch Adern/Ausläufer nicht (sonst wird die Basis untergraben)
      const i = y * W + x, m = mat[i]; if (m === MAT.EARTH || m === MAT.SAND || (rock && m === MAT.ROCK)) { mat[i] = MAT.GOLD; set.push(i); org.push(m); }
    };
    const disc = (px, py, rr, rock) => { const r2 = rr * rr; for (let y = Math.floor(py - rr); y <= Math.ceil(py + rr); y++) for (let x = Math.floor(px - rr); x <= Math.ceil(px + rr); x++) if ((x - px) ** 2 + (y - py) ** 2 <= r2) put(x, y, rock); };
    // Weg (Ader/Band/Ausläufer): Schritte ≤ 1 px → durchgehend verbunden
    const walk = (x, y, a, len, w0, w1, curl, rock) => { for (let s = 0; s < len; s++) { const t = s / Math.max(1, len - 1); a += (vnoise(s / 9, 0.5, so + 7) - 0.5) * curl; x += Math.cos(a) * 0.9; y += Math.sin(a) * 0.9; disc(x, y, w0 + (w1 - w0) * t + (vnoise(s / 6, 3.1, so) - 0.5) * w0 * 0.6, rock); } return [x, y]; };
    const kind = R(), size = r * (0.6 + R() * R() * 1.5); // sehr unterschiedliche Größen
    if (kind < 0.42) { // zackiger, gedrehter Klumpen mit Lappen
      const th = R() * Math.PI, ca = Math.cos(th), sa = Math.sin(th), rx = size * (1.1 + R() * 0.9), ry = size * (0.55 + R() * 0.35), ext = Math.max(rx, ry) + 4;
      for (let y = Math.floor(cy - ext); y <= Math.ceil(cy + ext); y++) for (let x = Math.floor(cx - ext); x <= Math.ceil(cx + ext); x++) {
        const dx = x - cx, dy = y - cy, u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
        if (u * u + v * v <= 0.62 + vnoise(x / 9, y / 9, so) * 0.55 + vnoise(x / 3.5, y / 3.5, so + 1) * 0.28) put(x, y, false);
      }
    } else if (kind < 0.72) { // Band entlang der Schichten (fast waagrecht, leicht geneigt), mit Einschnürungen
      const a = (R() - 0.5) * 0.7 + (R() < 0.5 ? 0 : Math.PI), len = Math.round(size * (3.5 + R() * 3)), th = 2.2 + size * (0.25 + R() * 0.2);
      walk(cx - Math.cos(a) * len / 2, cy - Math.sin(a) * len / 2, a, len, th, th * (0.5 + R() * 0.7), 0.35, false);
    } else { // verzweigte Ader (schräg/steil, beliebige Richtung)
      const a = R() * Math.PI * 2, len = Math.round(size * (3 + R() * 3)), th = 1.8 + size * 0.18;
      const e = walk(cx, cy, a, len, th + 1.2, th * 0.7, 0.9, false);
      const nb = 1 + ((R() * 3) | 0); for (let k = 0; k < nb; k++) { const t = R(), bx = cx + (e[0] - cx) * t, by = cy + (e[1] - cy) * t; walk(bx, by, a + (R() < 0.5 ? 1 : -1) * (0.6 + R() * 0.9), Math.round(len * (0.3 + R() * 0.4)), th * 0.8, 1.2, 0.8, false); }
    }
    // feine Ausläufer (4–9 px) – nur sie dürfen in den Fels reichen; Klumpen/Bänder/Adern liegen in Erde/Sand (KI kann alles von der Erdseite erreichen)
    if (set.length) { const nOff = (R() * 3) | 0; for (let k = 0; k < nOff; k++) { const i = set[(R() * set.length) | 0]; walk(i % W, (i / W) | 0, R() * Math.PI * 2, 4 + ((R() * 6) | 0), 1.2, 0.8, 1.0, true); } }
    // nur der mit der Mitte (bzw. dem ersten Pixel) verbundene Teil bleibt – sonst würde ein Brocken in Splitter zerfallen
    if (!set.length) return 0;
    const mine = new Map(); set.forEach((i, k) => mine.set(i, org[k])); const s0 = cy * W + cx; if (!mine.has(s0)) { for (const [i, m] of mine) mat[i] = m; return 0; } // Mitte (erreichbar) muss dazugehören
    const keep = new Set([s0]), st = [s0];
    while (st.length) { const i = st.pop(); for (const j of [i - 1, i + 1, i - W, i + W]) if (mine.has(j) && !keep.has(j)) { keep.add(j); st.push(j); } }
    for (const [i, m] of mine) if (!keep.has(i)) mat[i] = m;
    return keep.size;
  },
  // Goldbrocken verteilen, bis „target“ Goldpixel liegen: tiefer = größere Brocken, Goldfelder (Rauschen) = dichter; nie direkt unter einer Startbasis
  placeDeposits(target, x0 = 20, x1 = this.W - 20) {
    const { W, H, mat, surf, seed } = this, R = this.rand; let placed = 0;
    { // Brocken bleiben im Basis-Abschnitt ihres Bereichs (3 px Abstand zur Grenze) → Erträge je Basis fair, Nachbar-Brocken verschmelzen nicht
      const b = this.bases || [], c = [0]; for (let k = 1; k < b.length; k++) c.push(Math.round((b[k - 1] + b[k]) / 2)); c.push(W);
      const mid = (x0 + x1) / 2; let k = 0; while (k + 2 < c.length && mid >= c[k + 1]) k++;
      this._oreClip = [c[k] + 3, c[k + 1] - 4];
    }
    // Durchgang 0: normal (Tiefe + Goldfelder); 1: ohne Wahrscheinlichkeitsfilter und höher; 2: auch hinter Fels – dann wird ein Erdgang zur Oberfläche gelegt
    for (let pass = 0; pass < 3 && placed < target * 0.97; pass++) for (let t = 0; placed < target && t < (pass ? 15000 : 40000); t++) {
      let x, y;
      if (pass === 0) { const s0 = this.oreSpot(x0, x1); x = s0[0]; y = Math.round(s0[1]); }
      else { x = Math.floor(x0 + R() * (x1 - x0)); y = Math.round(surf[x] + 45 + R() * Math.max(10, H * 0.84 - surf[x] - 45)); }
      if (y > H - 34) continue;
      if (this.plats.some(P => x > P.a - 50 && x < P.b + 50 && y < surf[x] + 75)) continue;
      const m = mat[y * W + x]; if (m !== MAT.EARTH && m !== MAT.SAND) continue; // Mitte immer in Erde/Sand (nie mitten im Fels)
      if (this.reach && !this.reach[y * W + x]) { if (pass < 2) continue; if (!this.oreTunnelUp(x, y)) continue; }
      const depth = Math.min(1, (y - surf[x]) / (H * 0.55)), field = fbm(x / 380, y / 300, seed + 21, 2);
      if (pass === 0 && R() > 0.3 + depth * 0.35 + (field - 0.5) * 1.2) continue; // reiche und arme Gegenden
      placed += this.goldDeposit(x, y, 6.5 + R() * 4 + depth * 5);
    }
    this._oreClip = null;
    return placed;
  },
  // Erdgang (schräg nach oben) von (x,y) bis in erreichbares Gebiet: Fels/Granit auf dem Weg → Erde; nur wenn kurz genug
  oreTunnelUp(x, y) {
    const { W, mat, surf } = this, R = this.reach, path = []; let cx = x, cy = y, dir = this.rand() < 0.5 ? -1 : 1;
    for (let s = 0; s < 260; s++) {
      if (R[cy * W + cx]) break;
      path.push(cy * W + cx);
      if (s % 3 === 2) { cx += dir; if (cx < 3 || cx > W - 4) return false; } else cy--;
      if (cy < surf[cx] + 2) break;
    }
    if (!R[cy * W + cx] && cy >= surf[cx] + 2) return false;
    for (const i of path) for (const d of [0, -1, 1, -W, W, -W - 1, -W + 1]) { const j = i + d, m = mat[j]; if (m === MAT.ROCK || m === MAT.GRANITE || m === MAT.LAVA) mat[j] = MAT.EARTH; R[j] = 1; }
    // Erde im Umkreis des Brockens ebenfalls erreichbar machen (Flutfüllung klein)
    const st = [y * W + x]; let n = 0; while (st.length && n < 6000) { const i = st.pop(); if (R[i] && i !== y * W + x) continue; R[i] = 1; n++; for (const j of [i - 1, i + 1, i - W, i + W]) { const m = mat[j]; if (!R[j] && m !== MAT.ROCK && m !== MAT.GRANITE && m !== MAT.LAVA) st.push(j); } }
    return true;
  },
  // Erreichbarkeit von der Oberfläche durch grabbares/offenes Material (Fels, Granit, Lava sperren)
  reachMask() {
    const { W, H, mat } = this, N = W * H, R = new Uint8Array(N), q = new Int32Array(N); let h = 0, t = 0;
    const ok = m => m !== MAT.ROCK && m !== MAT.GRANITE && m !== MAT.LAVA;
    for (let i = 0; i < N; i++) if (mat[i] === MAT.SKY) { R[i] = 1; q[t++] = i; }
    while (h < t) {
      const i = q[h++], x = i % W;
      if (x > 0 && !R[i - 1] && ok(mat[i - 1])) { R[i - 1] = 1; q[t++] = i - 1; }
      if (x < W - 1 && !R[i + 1] && ok(mat[i + 1])) { R[i + 1] = 1; q[t++] = i + 1; }
      if (i >= W && !R[i - W] && ok(mat[i - W])) { R[i - W] = 1; q[t++] = i - W; }
      if (i < N - W && !R[i + W] && ok(mat[i + W])) { R[i + W] = 1; q[t++] = i + W; }
    }
    return R;
  },
  // Untergrund glätten: Einzelpixel/Zacken an Material-Grenzen einebnen, Mini-Höhlen und Fels-/Sand-Krümel auffüllen
  smoothUnderground(ST) {
    const { W, H, mat, surf } = this, MS = [MAT.TUNNEL, MAT.EARTH, MAT.ROCK, MAT.SAND], CL = new Int8Array(16).fill(-1); MS.forEach((m, k) => { CL[m] = k; });
    const cnt = new Int32Array(4);
    for (let pass = 0; pass < 2; pass++) {
      const src = mat.slice();
      for (let y = 2; y < H - 22; y++) for (let x = 2; x < W - 2; x++) {
        const i = y * W + x, m = src[i], k = CL[m]; if (k < 0 || y < surf[x] + 6) continue;
        if (src[i - 1] === m && src[i + 1] === m && src[i - W] === m && src[i + W] === m) continue;
        cnt.fill(0);
        for (const j of [i - W - 1, i - W, i - W + 1, i - 1, i + 1, i + W - 1, i + W, i + W + 1]) { const c = CL[src[j]]; if (c >= 0) cnt[c]++; }
        if (cnt[k] >= 3) continue;
        let b = -1, bn = 0; for (let c = 0; c < 4; c++) if (cnt[c] > bn) { bn = cnt[c]; b = c; }
        if (bn >= 4) mat[i] = MS[b];
      }
    }
    // kleine zusammenhängende Flächen: Höhlen < minCave, Fels-/Sand-Inseln < 320 px → Erde (weniger Sprenkel in der Erde)
    const seen = new Uint8Array(W * H), st = [], comp = [], minCave = ST.minCave || 600;
    for (let i0 = W * 2; i0 < W * (H - 22); i0++) {
      const m = mat[i0]; if (seen[i0] || (m !== MAT.TUNNEL && m !== MAT.ROCK && m !== MAT.SAND)) continue;
      st.length = 0; comp.length = 0; st.push(i0); seen[i0] = 1; let open = false; const lim = m === MAT.TUNNEL ? minCave : 320;
      while (st.length) {
        const i = st.pop(), x = i % W; comp.push(i);
        for (const j of [i - 1, i + 1, i - W, i + W]) {
          const jx = j % W; if (Math.abs(jx - x) > 1) continue;
          const o = mat[j]; if (o === MAT.SKY) open = true;
          if (o === m && !seen[j]) { seen[j] = 1; st.push(j); }
        }
      }
      if (!open && comp.length < lim) for (const i of comp) mat[i] = MAT.EARTH;
    }
  },
  // kleine abgeschlossene Fels-/Sandinseln (< lim px) in Erde umwandeln
  dropIslands(lim) {
    const { W, H, mat } = this, seen = new Uint8Array(W * H), st = [], comp = []; let n = 0;
    for (let i0 = W * 2; i0 < W * (H - 22); i0++) {
      const m = mat[i0]; if (seen[i0] || (m !== MAT.ROCK && m !== MAT.SAND)) continue;
      st.length = 0; comp.length = 0; st.push(i0); seen[i0] = 1;
      while (st.length && comp.length <= lim) { const i = st.pop(), x = i % W; comp.push(i); for (const j of [i - 1, i + 1, i - W, i + W]) { if (Math.abs((j % W) - x) > 1 || seen[j] || mat[j] !== m) continue; seen[j] = 1; st.push(j); } }
      if (comp.length <= lim && !st.length) { for (const i of comp) mat[i] = MAT.EARTH; n += comp.length; }
      else while (st.length) { const i = st.pop(), x = i % W; for (const j of [i - 1, i + 1, i - W, i + W]) { if (Math.abs((j % W) - x) > 1 || seen[j] || mat[j] !== m) continue; seen[j] = 1; st.push(j); } }
    }
    return n;
  },
  // Schicht-Wellung je Spalte (deterministisch aus dem Seed; Generator und colorPixel nutzen dieselbe)
  strataWarp() {
    if (this._colW && this._colW.length === this.W) return this._colW;
    const { W, seed } = this, c = new Float32Array(W);
    for (let x = 0; x < W; x++) c[x] = (fbm(x / 340, 0.3, seed + 41, 2) - 0.5) * 90 + (fbm(x / 90, 2.7, seed + 44, 2) - 0.5) * 14;
    return (this._colW = c);
  },
  oreSpot(x0, x1) { const R = this.rand, x = Math.floor(x0 + R() * (x1 - x0)); return [x, this.surf[x] + 55 + R() * Math.max(10, this.H * 0.82 - this.surf[x] - 55)]; },
  // Goldpixel je Basis-Abschnitt (Mittelpunkte zwischen den Basen); fehlendes Gold mit Brocken auffüllen (≥ 92 % des reichsten Abschnitts)
  goldBySegment() {
    const { W, H, mat } = this, b = this.bases, cut = [0]; for (let k = 1; k < b.length; k++) cut.push(Math.round((b[k - 1] + b[k]) / 2)); cut.push(W);
    const out = new Array(b.length).fill(0);
    for (let s = 0; s < b.length; s++) for (let y = 0; y < H; y++) { const r = y * W; for (let x = cut[s]; x < cut[s + 1]; x++) if (mat[r + x] === MAT.GOLD) out[s]++; }
    return { cut, gold: out };
  },
  balanceGold() {
    if (this.bases.length < 2) return;
    for (let it = 0; it < 8; it++) {
      const { cut, gold } = this.goldBySegment(); const mx = Math.max(...gold); let ok = true;
      gold.forEach((g, s) => { if (g >= mx * 0.94) return; ok = false; this.placeDeposits(Math.ceil(mx * 0.96 - g), cut[s] + 20, cut[s + 1] - 20); });
      if (ok) break;
    }
  },
  // Generator-Nachlauf: Sand und Flüssigkeiten so setzen, dass zu Spielbeginn nichts rieselt/fließt (spart Rechenzeit, verhindert Startlawinen)
  settleGen(sandOnly) {
    const { W, H, mat } = this, EMP = m => m === MAT.TUNNEL || m === MAT.SKY;
    if (!sandOnly) for (let pass = 0; pass < 3; pass++) for (let y = H - 2; y >= 1; y--) {
      for (let x = 1; x < W - 1; x++) { const i = y * W + x, m = mat[i]; if ((m === MAT.LAVA || m === MAT.WATER) && (EMP(mat[i + W]) || EMP(mat[i - 1]) && EMP(mat[i - 1 + W]))) mat[i] = MAT.TUNNEL; }
      for (let x = W - 2; x >= 1; x--) { const i = y * W + x, m = mat[i]; if ((m === MAT.LAVA || m === MAT.WATER) && (EMP(mat[i + W]) || EMP(mat[i + 1]) && EMP(mat[i + 1 + W]))) mat[i] = MAT.TUNNEL; }
    }
    // Sand ohne Halt (unten frei oder seitlich+schräg frei) wird zu festem Sandstein-Ersatz (Erde) – nur Stützen kommt dazu, eine Runde reicht
    for (let y = H - 2; y >= 1; y--) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x; if (mat[i] !== MAT.SAND) continue;
      if (!SOLID[mat[i + W]] || (!SOLID[mat[i - 1]] && !SOLID[mat[i - 1 + W]]) || (!SOLID[mat[i + 1]] && !SOLID[mat[i + 1 + W]])) mat[i] = MAT.EARTH;
    }
  },
});
// Menü: Segment-Pillen (ui.js segify) mit Symbol + Beschreibung
function styleMeta(v, txt) { if (v === 'zufall') return { ic: '🎲', n: 'Zufall', d: 'Bei jedem Spiel ein anderer Weltstil (aus dem Karten-Seed, im Mehrspieler für alle gleich).' }; const S = WORLD_STYLES[v], short = { hoehlen: 'Höhlen', vulkan: 'Vulkan', huegel: 'Hügel' }; return S ? { ic: S.ic, n: short[v] || S.n, d: S.n + ': ' + S.d } : { n: txt }; }
function worldStyleLabel(cfg) { const s = WORLD_STYLES[cfg && cfg.style] ? cfg.style : 'klassisch'; return WORLD_STYLES[s].ic + ' ' + WORLD_STYLES[s].n + (cfg && cfg.styleRnd ? ' (Zufall)' : ''); }

// ---------- Golderz: Brocken mit Restmenge, Abbau per Hieb (Host rechnet, Clients bekommen den Stand per Schnappschuss) ----------
// Ein Brocken = zusammenhängende Goldpixel (4er-Nachbarschaft). Seine „HP“ sind die verbleibenden Goldpixel (px), Ertrag = 1 Gold je ORE_HIT_PX Pixel.
// Wer gräbt und mit der Schaufel Gold berührt, schlägt alle ORE_HIT_T Ticks einen Hieb: ORE_HIT_PX Pixel des Brockens (vom Treffpunkt aus) → 1 Gold.
const STRATA_OFF = 0.032, SAND_LENS = 0.715; // Kalibrierung Schichtung (Felsanteil wie vorher)
const ORE_HIT_T = 18, ORE_HIT_PX = 36, ORE_MIN_PX = 8;
Object.assign(World.prototype, {
  // Brocken aus der Karte bestimmen (Generator, Laden alter Spielstände, Host-Wechsel); Ids neu ab 1
  buildOres() {
    const { W, H, mat } = this, seen = new Uint8Array(W * H), st = [];
    this.ores = []; this.oreGrid = new Map(); this.oreDirty = new Set(); this.oreChg = new Set(); this.oreFull = true;
    let id = 1;
    for (let i0 = 0; i0 < W * H; i0++) {
      if (mat[i0] !== MAT.GOLD || seen[i0]) continue;
      const px = []; st.length = 0; st.push(i0); seen[i0] = 1;
      while (st.length) {
        const i = st.pop(), x = i % W; px.push(i);
        if (x > 0 && !seen[i - 1] && mat[i - 1] === MAT.GOLD) { seen[i - 1] = 1; st.push(i - 1); }
        if (x < W - 1 && !seen[i + 1] && mat[i + 1] === MAT.GOLD) { seen[i + 1] = 1; st.push(i + 1); }
        if (i >= W && !seen[i - W] && mat[i - W] === MAT.GOLD) { seen[i - W] = 1; st.push(i - W); }
        if (i < W * (H - 1) && !seen[i + W] && mat[i + W] === MAT.GOLD) { seen[i + W] = 1; st.push(i + W); }
      }
      if (px.length < ORE_MIN_PX) continue; // Krümel (alte Karten): abbaubar, aber nicht als Brocken gelistet
      const o = { id: id++, p: Int32Array.from(px), px: 0, x: 0, y: 0, x0: W, y0: H, x1: 0, y1: 0 };
      for (const i of o.p) { const x = i % W, y = (i / W) | 0; if (x < o.x0) o.x0 = x; if (x > o.x1) o.x1 = x; if (y < o.y0) o.y0 = y; if (y > o.y1) o.y1 = y; }
      this.oreCount(o); this.ores.push(o);
      for (let cy = (o.y0 / CH) | 0; cy <= (o.y1 / CH) | 0; cy++) for (let cx = (o.x0 / CH) | 0; cx <= (o.x1 / CH) | 0; cx++) { const k = cy * this.cw + cx; let a = this.oreGrid.get(k); if (!a) this.oreGrid.set(k, a = []); a.push(o); }
    }
    return this.ores;
  },
  // Restmenge + Schwerpunkt neu zählen (nur Host: kennt die Pixelliste)
  oreCount(o) {
    const { W, mat } = this; let n = 0, sx = 0, sy = 0;
    for (const i of o.p) if (mat[i] === MAT.GOLD) { n++; sx += i % W; sy += (i / W) | 0; }
    o.px = n; if (n) { o.x = Math.round(sx / n); o.y = Math.round(sy / n); }
    return n;
  },
  // setMat-Haken: ein Goldpixel ist verschwunden (Graben, Sprengen, Einebnen …) → Brocken am Tick-Ende neu zählen
  oreTouch(x, y) {
    if (!this.oreGrid) return;
    const a = this.oreGrid.get(((y / CH) | 0) * this.cw + ((x / CH) | 0)); if (!a) return;
    for (const o of a) if (x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1) this.oreDirty.add(o);
  },
  refreshOres() {
    for (const o of this.oreDirty) { const n0 = o.px; if (this.oreCount(o) !== n0) this.oreChg.add(o.id); }
    this.oreDirty.clear();
  },
  oreAt(x, y) {
    if (!this.ores) return null;
    const a = this.oreGrid ? this.oreGrid.get(((y / CH) | 0) * this.cw + ((x / CH) | 0)) : this.ores;
    if (!a) return null;
    const i = y * this.W + x;
    for (const o of a) if (o.px > 0 && x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1 && (!o.p || o.p.includes(i))) return o;
    return null;
  },
  // Ein Hieb auf Gold bei (x,y): bis zu ORE_HIT_PX zusammenhängende Goldpixel ab dem Treffpunkt abbauen; Rückgabe = abgebaute Pixel
  mineGold(x, y) {
    const { W, H, mat } = this, s0 = y * W + x; if (mat[s0] !== MAT.GOLD) return 0;
    const q = [s0], seen = new Set(q); let h = 0, k = 0;
    while (h < q.length && k < ORE_HIT_PX) {
      const i = q[h++], ix = i % W, iy = (i / W) | 0;
      this.setMat(ix, iy, this.bg(ix, iy)); k++;
      for (const j of [i - 1, i + 1, i - W, i + W]) { if (j < 0 || j >= W * H || Math.abs((j % W) - ix) > 1 || seen.has(j) || mat[j] !== MAT.GOLD) continue; seen.add(j); q.push(j); }
    }
    return k;
  },
  // ---- API für die KI (ki boti) ----
  // Alle Brocken mit Restertrag ≥ minYield: { id, x, y (Schwerpunkt), x0, y0, x1, y1 (Rahmen), px (Rest-Goldpixel), yield (Rest-Gold) }
  goldDeposits(minYield = 1) {
    const out = []; for (const o of this.ores || []) { const y = Math.floor(o.px / ORE_HIT_PX); if (y >= minYield) out.push({ id: o.id, x: o.x, y: o.y, x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1, px: o.px, yield: y }); }
    return out;
  },
  // Nächster Brocken zu (x,y) (Abstand zum Rahmen, y doppelt gewichtet) mit Zielpunkt = nächstes Goldpixel; skip(o) filtert z. B. von Teamkollegen belegte Brocken
  nearestGold(x, y, maxD = 1e9, skip = null) {
    let best = null, bd = maxD;
    for (const o of this.ores || []) {
      if (o.px < ORE_HIT_PX || (skip && skip(o))) continue;
      const dx = x < o.x0 ? o.x0 - x : x > o.x1 ? x - o.x1 : 0, dy = y < o.y0 ? o.y0 - y : y > o.y1 ? y - o.y1 : 0, d = dx + 2 * dy;
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) return null;
    let tx = best.x, ty = best.y;
    if (best.p) { let md = 1e18; for (const i of best.p) if (this.mat[i] === MAT.GOLD) { const px = i % this.W, py = (i / this.W) | 0, d = (px - x) ** 2 + 4 * (py - y) ** 2; if (d < md) { md = d; tx = px; ty = py; } } }
    return { id: best.id, x: tx, y: ty, d: bd, px: best.px, yield: Math.floor(best.px / ORE_HIT_PX) };
  },
  // ---- Netz/Speicher: kompakte Liste [id, px, x, y, x0, y0, x1, y1] ----
  oresEncode() { return (this.ores || []).map(o => [o.id, o.px, o.x, o.y, o.x0, o.y0, o.x1, o.y1]); },
  oresDecode(L) { this.ores = (L || []).map(a => ({ id: a[0], px: a[1], x: a[2], y: a[3], x0: a[4], y0: a[5], x1: a[6], y1: a[7] })); this.oreGrid = null; },
  oresApplyDelta(D) { if (!this.ores) return; const m = new Map(this.ores.map(o => [o.id, o])); for (const a of D) { const o = m.get(a[0]); if (o) { o.px = a[1]; o.x = a[2]; o.y = a[3]; } } },
});

// ---------- Untergrund-Optik (nur Darstellung, World.colorPixel): Schichtstreifen + gekörnte Übergänge zwischen Erde/Fels/Sand ----------
// Ändert keine Grundfarben/Texturen: nur Helligkeit ±≈6 % in waagrechten (gewellten) Streifen und ein Pixel-Dither 1–2 px tief an Materialgrenzen.
const SHADE_MAT = new Uint8Array(16); SHADE_MAT[MAT.EARTH] = 1; SHADE_MAT[MAT.ROCK] = 1; SHADE_MAT[MAT.SAND] = 1;
const SHADE_AMP = { [MAT.EARTH]: 0.065, [MAT.ROCK]: 0.05, [MAT.SAND]: 0.055 };
Object.assign(World.prototype, {
  // Material, dessen Textur an (x,y) gezeigt wird: an Grenzen zu einem anderen Erd-/Fels-/Sandpixel mal das Nachbarmaterial (Körnung statt harter Kante)
  ditherMat(x, y, m) {
    if (!SHADE_MAT[m] || x < 2 || y < 2 || x > this.W - 3 || y > this.H - 3) return m;
    const W = this.W, mat = this.mat, i = y * W + x, h = hash2(x, y, 61);
    if (h < 0.3) { const n = mat[i + ((h * 100 | 0) & 1 ? 1 : W) * (h < 0.15 ? 1 : -1)]; if (n !== m && SHADE_MAT[n]) return n; }
    if (h < 0.1) { const n = mat[i + (h < 0.05 ? 2 : -2) * ((h * 1000 | 0) & 1 ? 1 : W)]; if (n !== m && SHADE_MAT[n]) return n; }
    return m;
  },
  // Helligkeitsfaktor der Schichtstreifen (deterministisch aus Seed/Position, gleich auf Host und Clients)
  strataShade(x, y, m) {
    const a = SHADE_AMP[m]; if (!a) return 1;
    let L = this._strL; if (!L) { L = this._strL = new Float32Array(this.H + 256); const sd = this.seed + 45; for (let k = 0; k < L.length; k++) L[k] = (vnoise(k / 7, 0.5, sd) - 0.5) * 1.3 + (vnoise(k / 2.5, 1.5, sd + 1) - 0.5) * 0.7; }
    const k = (y + this.strataWarp()[x] + 128) | 0; return 1 + a * L[k < 0 ? 0 : k >= L.length ? L.length - 1 : k];
  },
});

// ---------- Burgplätze: harte Prüfung + Absicherung im Generator ----------
// Burg (64 px) + Mauern (± WALL_OFF) müssen auf ebenem, festem Plateauboden stehen: gleiche Höhe über die ganze Breite,
// darunter ≥ 20 px festes Material (kein Wasser/Lava/Hohlraum), darüber freier Himmel für Burghöhe + Luft.
const CASTLE_FOOT = 54, CASTLE_SOLID = 20;
Object.assign(World.prototype, {
  castleSiteReport(i) {
    const cs = this.castleSites && this.castleSites[i]; if (!cs) return { ok: false, why: 'kein Burgplatz' };
    const { W, H, mat } = this, B = BUILD.castle, y0 = cs.y + 1;
    for (let x = cs.x - CASTLE_FOOT; x <= cs.x + CASTLE_FOOT; x++) {
      if (x < 2 || x > W - 3) return { ok: false, why: 'Kartenrand', x };
      for (let y = Math.max(0, cs.y - B.h - 6); y <= cs.y; y++) { const m = mat[y * W + x]; if (m !== MAT.SKY) return { ok: false, why: m === MAT.WATER ? 'Wasser' : m === MAT.LAVA ? 'Lava' : SOLID[m] ? 'Hang/Hindernis' : 'Hohlraum', x, y }; }
      for (let y = y0; y < Math.min(H - 1, y0 + CASTLE_SOLID); y++) { const m = mat[y * W + x]; if (!SOLID[m]) return { ok: false, why: m === MAT.WATER ? 'Wasser darunter' : m === MAT.LAVA ? 'Lava darunter' : 'Hohlraum/Überhang darunter', x, y }; }
      if (this.surf[x] !== y0) return { ok: false, why: 'nicht eben (surf)', x, s: this.surf[x], y0 };
    }
    const pc = this.placeCheck('castle', cs.x, cs.y); if (pc.st !== 'ok') return { ok: false, why: 'placeCheck ' + pc.st + (pc.why ? ':' + pc.why : '') };
    return { ok: true };
  },
  // Generator-Nachlauf: Burgfläche (inkl. Mauern) eben, darüber Himmel, darunter Erde – Sicherheitsnetz für alle Stile
  secureCastleSites() {
    const { W, H, mat, surf } = this; let fixed = 0;
    for (const cs of this.castleSites || []) {
      const y0 = cs.y + 1;
      for (let x = Math.max(2, cs.x - CASTLE_FOOT - 2); x <= Math.min(W - 3, cs.x + CASTLE_FOOT + 2); x++) {
        for (let y = 0; y < y0; y++) { const i = y * W + x; if (mat[i] !== MAT.SKY) { mat[i] = MAT.SKY; fixed++; } }
        for (let y = y0; y < Math.min(H - 2, y0 + CASTLE_SOLID + 4); y++) { const i = y * W + x; if (!SOLID[mat[i]] || mat[i] === MAT.GOLD) { mat[i] = MAT.EARTH; fixed++; } }
        surf[x] = y0;
      }
    }
    return fixed;
  },
});
