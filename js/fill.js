'use strict';
// ---------- Löcher füllen: Erdklumpen (werfen = platscht beim Aufprall, ablegen = füllt vorne/unten) ----------
const EARTH_R = 8;
Object.assign(World.prototype, {
  // Hindernisse, in die nie Erde gesetzt wird (damit niemand eingeschlossen wird)
  fillBlockers() {
    const B = [];
    for (const c of this.clonks) if (c.act !== 'dead' && !c.inside) B.push([c.x - 5, c.y - 13, c.x + 5, c.y + 1]);
    for (const m of this.monsters) B.push([m.x - 7, m.y - 9, m.x + 7, m.y + 1]);
    for (const a of this.animals) B.push([a.x - 6, a.y - 8, a.x + 6, a.y + 1]);
    for (const v of this.vehicles) { const d = VEH[v.type]; B.push([v.x - d.w / 2 - 2, v.y - d.h - 3, v.x + d.w / 2 + 2, v.y + 1]); }
    for (const s of this.structs) { const d = BUILD[s.type]; B.push([s.x - d.w / 2 - 1, s.y - d.h - 2, s.x + d.w / 2 + 1, s.y + 1]); }
    return B;
  },
  fillable(x, y) {
    if (x < 1 || x >= this.W - 1 || y < 3 || y >= this.H - 1) return false;
    const m = this.mat[y * this.W + x];
    if (m === MAT.TUNNEL || m === MAT.WATER) return true;
    return m === MAT.SKY && y >= this.surf[x] - 1; // nur Krater/Löcher unter der alten Oberfläche, keine schwebenden Hügel
  },
  // füllt eine Scheibe mit Erde; gibt die Zahl der gesetzten Pixel zurück (dry = nur zählen)
  fillEarth(cx, cy, r, dry) {
    const B = this.fillBlockers(), x0 = Math.round(cx), y0 = Math.round(cy);
    let n = 0;
    for (let y = y0 - r; y <= y0 + r; y++) for (let x = x0 - r; x <= x0 + r; x++) {
      const dx = x - x0, dy = y - y0; if (dx * dx + dy * dy > r * r + r) continue;
      if (!this.fillable(x, y)) continue;
      let hit = false; for (const b of B) if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) { hit = true; break; }
      if (hit) continue;
      if (!dry) this.setMat(x, y, MAT.EARTH);
      n++;
    }
    return n;
  },
  // Q mit Erdklumpen: füllt das Loch vor/unter dem Buddler (Alternative: werfen)
  placeEarth(c) {
    const d = c.dir || 1, C = [[d * 10, 5], [d * 10, -3], [0, 9], [d * 16, 8], [-d * 10, 5]];
    let best = null, bn = 14;
    for (const [ox, oy] of C) { const n = this.fillEarth(c.x + ox, c.y + oy, EARTH_R, true); if (n > bn) { bn = n; best = [c.x + ox, c.y + oy]; } }
    if (!best) { if (!this.teams[c.team].ai) this.msg('Hier ist kein Loch zum Füllen – Erdklumpen werfen geht auch.', c.team); this.snd('error', c.x, c.y); return true; }
    c.inv.splice(actIdx(c), 1);
    this.fillEarth(best[0], best[1], EARTH_R);
    this.snd('dump', c.x, c.y); c.punch = 10; c.cd = 12;
    if (c.team === undefined) return true;
    const t = this.teams[c.team]; if (t.stats) t.stats.filled = (t.stats.filled || 0) + 1;
    return true;
  },
  // geworfener Klumpen trifft Boden → platscht
  splatEarth(it) {
    const n = this.fillEarth(it.x, it.y, EARTH_R);
    if (n < 6) return false; // nichts zu füllen (oder alles blockiert): bleibt als Gegenstand liegen
    it.remove = true; this.snd('dump', it.x, it.y);
    return true;
  },
});
