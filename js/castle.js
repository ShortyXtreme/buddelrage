'use strict';
// ---------- Burg-Ausbau: 3 Stufen (Mauern & Tor → Schützentürme → Balliste) + gekaufter Munitionsvorrat ----------
// Ideen: Kingdom (Mauer-/Turmstufen, Balliste, Reparatur durch Arbeiter), Stronghold (Torhaus, Balliste gegen Belagerung),
// Age of Empires II (Hoardings = mehr Burg-HP, Burg schießt selbst), OpenClonk (automatischer Verteidigungsturm).
const CUP = [
  { k: 'walls', n: 'Mauern & Tor', price: 80, time: 15, desc: 'Burg +300 Struktur · zwei Steinmauern halten Gegner auf, dein Team geht durchs Tor · Reparaturtrupp flickt Burg und Mauern' },
  { k: 'archers', n: 'Schützentürme', price: 110, time: 20, desc: 'Zwei Bogenschützen auf den Türmen schießen selbst auf Gegner (Reichweite 230) · verbrauchen Pfeile aus dem Burgvorrat' },
  { k: 'ballista', n: 'Balliste', price: 150, time: 25, desc: 'Schweres Bolzengeschütz auf dem Bergfried: weite Reichweite, stark gegen Ritter und Fahrzeuge · verbraucht Bolzen' },
];
const CAMMO = { arrows: { n: 'Pfeilvorrat', add: 20, price: 12, max: 60, lvl: 2 }, bolts: { n: 'Ballistenbolzen', add: 4, price: 16, max: 12, lvl: 3 } };
const CUP_HP = 300, WALL_HP = 300, WALL_H = 26, WALL_OFF = 48;
const ARCH_R = 230, ARCH_CD = 80, BAL_R = 380, BAL_CD = 210;
function castleLevel(s) { return s && s.type === 'castle' ? Math.max(0, (s.up | 0) - (s.upT > 0 ? 1 : 0)) : 0; }
function structMax(s) { return BUILD[s.type].hp + (castleLevel(s) >= 1 ? CUP_HP : 0); }
Object.assign(World.prototype, {
  castleOf(tid, near) {
    let best = null, bd = 1e9;
    for (const s of this.structs) if (s.type === 'castle' && s.prog >= 1 && !s.remove && this.ally(s.team, tid)) { const d = (s.team === tid ? 0 : 5000) + (near ? Math.abs(s.x - near.x) : 0); if (d < bd) { bd = d; best = s; } }
    return best;
  },
  castleUpgrade(t, sid) {
    const c = this.selClonk ? this.selClonk(t) : null;
    const s = (sid && this.structs.find(o => o.id === sid && o.type === 'castle' && o.prog >= 1 && this.ally(o.team, t.id))) || this.castleOf(t.id, c);
    if (!s) { if (!t.ai) this.msg('Keine fertige Burg – erst eine Burg bauen.', t.id); return false; }
    if (s.upT > 0) { if (!t.ai) this.msg('Der Ausbau läuft noch.', t.id); return false; }
    const lvl = s.up | 0; if (lvl >= CUP.length) { if (!t.ai) this.msg('Burg ist voll ausgebaut.', t.id); return false; }
    const U = CUP[lvl];
    if (t.money < U.price) { if (!t.ai) { this.msg('Zu wenig Geld für ' + U.n + ' (' + U.price + ').', t.id); this.snd('error', s.x, s.y); } return false; }
    t.money -= U.price; s.up = lvl + 1; s.upT = U.time * 60;
    this.msgSide('Burg-Ausbau begonnen: ' + U.n + ' (' + U.time + ' s)', t.id); this.snd('build', s.x, s.y);
    return true;
  },
  castleAmmo(t, kind, sid) {
    const A = CAMMO[kind]; if (!A) return false;
    const c = this.selClonk ? this.selClonk(t) : null;
    const s = (sid && this.structs.find(o => o.id === sid && o.type === 'castle' && this.ally(o.team, t.id))) || this.castleOf(t.id, c);
    if (!s || (s.up | 0) < A.lvl) { if (!t.ai) this.msg(A.n + ': erst ' + CUP[A.lvl - 1].n + ' ausbauen.', t.id); return false; }
    if ((s[kind] | 0) >= A.max) { if (!t.ai) this.msg(A.n + ' ist voll (' + A.max + ').', t.id); return false; }
    if (t.money < A.price) { if (!t.ai) { this.msg('Zu wenig Geld für ' + A.n + '.', t.id); this.snd('error', s.x, s.y); } return false; }
    t.money -= A.price; s[kind] = Math.min(A.max, (s[kind] | 0) + A.add);
    if (!t.ai) this.msg(A.n + ': ' + s[kind] + '/' + A.max, t.id); this.snd('grab', s.x, s.y);
    return true;
  },
  castleWalls(s) {
    const W = [];
    for (const d of [-1, 1]) {
      const x = Math.round(s.x + d * WALL_OFF); if (x < 4 || x >= this.W - 4) continue;
      let y = Math.round(s.y - 30); while (y < this.H - 2 && !this.solid(x, y + 1)) y++;
      W.push({ x, y, hp: WALL_HP, d, br: 0 });
    }
    return W;
  },
  // Mauern: Gegner kommen nicht durch (oben drüber nur mit großem Sprung, unten durch Graben schon); Schaden durch Anrennen/Explosionen
  castleWallTick(s) {
    for (const wl of s.walls) {
      if (wl.br) continue;
      for (const c of this.clonks) {
        if (c.act === 'dead' || c.inside || this.ally(c.team, s.team)) continue;
        if (Math.abs(c.x - wl.x) >= 5 || c.y <= wl.y - WALL_H || c.y > wl.y + 2) continue;
        const side = c.x === wl.x ? wl.d : Math.sign(c.x - wl.x);
        c.x = wl.x + side * 5; if (Math.sign(c.vx) === -side) c.vx = 0;
        if (c.act === 'push') { const v = this.vehById(c.veh); if (v) { v.x = c.x + side * 6; v.vx = 0; } }
        const dmg = c.knight ? 0.12 : hasG(c, 'sword') ? 0.08 : 0.03; wl.hp -= dmg; s.hitT = this.tick;
        if (this.tick % 30 === 0) this.snd('metalhit', wl.x, wl.y - 10);
      }
      for (const v of this.vehicles) if (!this.ally(v.team, s.team) && Math.abs(v.x - wl.x) < VEH[v.type].w / 2 + 3 && v.y > wl.y - WALL_H && v.y <= wl.y + 3) { const side = Math.sign(v.x - wl.x) || wl.d; v.x = wl.x + side * (VEH[v.type].w / 2 + 3); v.vx = 0; }
      if (wl.hp <= 0) { wl.hp = 0; wl.br = 1; this.msgSide('Eine Burgmauer wurde zerstört!', s.team); this.ev({ e: 'boom', x: wl.x, y: wl.y - 10, r: 5 }); this.snd('blast', wl.x, wl.y); }
    }
  },
  castleFoes(s, x, y, R, pref) {
    let best = null, bs = -1e9;
    for (const c of this.clonks) {
      if (c.act === 'dead' || c.inside || this.ally(c.team, s.team)) continue;
      const d = Math.hypot(c.x - x, c.y - 6 - y); if (d > R || d < 12) continue;
      if (!this.castleLOS(x, y, c.x, c.y - 6)) continue;
      const sc = -d + (pref && c.knight ? 120 : 0) + (pref && c.act === 'push' ? 60 : 0);
      if (sc > bs) { bs = sc; best = c; }
    }
    if (pref) for (const v of this.vehicles) {
      if (this.ally(v.team, s.team)) continue; const d = Math.hypot(v.x - x, v.y - 4 - y); if (d > R || d < 20) continue;
      if (!this.castleLOS(x, y, v.x, v.y - 4)) continue; const sc = -d + 200; if (sc > bs) { bs = sc; best = v; }
    }
    return best;
  },
  castleLOS(x0, y0, x1, y1) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4); for (let i = 2; i < n - 1; i++) { const t = i / n; if (this.solid(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; } return true; },
  castleFire(s, x, y, tg, k) {
    const sp = k ? 7 : 5.2, g = k ? 0.035 : 0.07;
    const d = Math.hypot(tg.x - x, tg.y - 6 - y), t = d / sp;
    const tx = tg.x + (tg.vx || 0) * t * 0.8, ty = tg.y - 6 - 0.5 * g * t * t;
    const a = Math.atan2(ty - y, tx - x) + (this.rand() - 0.5) * (k ? 0.03 : 0.07);
    (this.cshots || (this.cshots = [])).push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, k, team: s.team, age: 0, g });
    this.snd(k ? 'catapult' : 'bow', x, y);
  },
  castleShotTick() {
    const L = this.cshots; if (!L || !L.length) return;
    for (const p of L) {
      p.age++; p.vy = Math.min(p.vy + p.g, 6);
      const steps = Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy)));
      for (let i = 0; i < steps && !p.rm; i++) {
        p.x += p.vx / steps; p.y += p.vy / steps;
        if (p.x < 0 || p.x >= this.W || p.y >= this.H || p.age > 300) { p.rm = 1; break; }
        if (this.solid(p.x, p.y)) { p.rm = 1; this.snd('arrowhit', p.x, p.y); break; }
        for (const c of this.clonks) {
          if (c.act === 'dead' || c.inside || this.ally(c.team, p.team)) continue;
          if (Math.abs(p.x - c.x) <= 4 && p.y >= c.y - 11 && p.y <= c.y + 1) {
            p.rm = 1;
            if (this.blocks(c, Math.sign(p.vx) || 1)) { this.snd('shield', c.x, c.y); c.blockT = 10; if (p.k) this.hurt(c, 8, { team: p.team, id: 0 }); break; }
            this.hurt(c, p.k ? 30 : 11, { team: p.team, id: 0 }); this.snd('hitliving', c.x, c.y);
            if (p.k && c.act !== 'dead') this.fling(c, Math.sign(p.vx) * 2, -1.6);
            break;
          }
        }
        if (p.rm) break;
        for (const v of this.vehicles) {
          if (this.ally(v.team, p.team)) continue; const d = VEH[v.type];
          if (Math.abs(p.x - v.x) <= d.w / 2 && p.y >= v.y - d.h && p.y <= v.y + 1) { p.rm = 1; v.hp -= p.k ? 45 : 2; this.snd('metalhit', v.x, v.y); break; }
        }
      }
    }
    this.cshots = L.filter(p => !p.rm);
  },
  castleTick() {
    for (const s of this.structs) {
      if (s.type !== 'castle' || s.prog < 1 || s.remove || !(s.up > 0)) continue;
      if (s.upT > 0) {
        s.upT--;
        if (s.upT === 0) {
          const U = CUP[s.up - 1];
          if (s.up === 1) { s.hp += CUP_HP; s.walls = this.castleWalls(s); }
          this.msgSide('Burg-Ausbau fertig: ' + U.n + '!' + (s.up >= 2 ? ' Munition im Laden kaufen.' : ''), s.team); this.snd('build', s.x, s.y);
        }
      }
      const L = castleLevel(s); if (!L) continue;
      if (!s.walls) s.walls = this.castleWalls(s);
      this.castleWallTick(s);
      // Reparaturtrupp: flickt Burg und Mauern, wenn 5 s kein Gegner angreift
      if (this.tick - (s.hitT || -1e9) > 300 && this.tick % 4 === 0) {
        let foeNear = false; for (const c of this.clonks) if (c.act !== 'dead' && !this.ally(c.team, s.team) && Math.abs(c.x - s.x) < 160 && Math.abs(c.y - s.y) < 80) { foeNear = true; break; }
        if (!foeNear) { const mx = structMax(s); if (s.hp < mx && !s.fire) s.hp = Math.min(mx, s.hp + 0.12); for (const wl of s.walls) if (wl.hp < WALL_HP) { wl.hp = Math.min(WALL_HP, wl.hp + 0.2); if (wl.br && wl.hp >= WALL_HP * 0.4) { wl.br = 0; this.msgSide('Burgmauer wieder aufgebaut.', s.team); } } }
      }
      if (s.hitBy && this.tick - s.hitBy.t < 5) s.hitT = this.tick;
      if (L >= 2) {
        if (!s.aCd) s.aCd = [0, 37];
        for (let i = 0; i < 2; i++) {
          if (s.aCd[i] > 0) { s.aCd[i]--; continue; }
          if (!(s.arrows > 0)) continue;
          const x = s.x + (i ? 26 : -26), y = s.y - 51, tg = this.castleFoes(s, x, y, ARCH_R, false);
          if (!tg) { s.aCd[i] = 10; continue; }
          this.castleFire(s, x, y, tg, 0); s.arrows--; s.aCd[i] = ARCH_CD + (this.rand() * 20 | 0);
          if (s.arrows === 0) this.msgSide('Burg: Pfeilvorrat leer – im Laden nachkaufen!', s.team);
        }
      }
      if (L >= 3) {
        if (s.bCd > 0) s.bCd--;
        else if (s.bolts > 0) {
          const x = s.x, y = s.y - 41, tg = this.castleFoes(s, x, y, BAL_R, true);
          if (tg) { this.castleFire(s, x, y, tg, 1); s.bolts--; s.bCd = BAL_CD; s.bDir = Math.sign(tg.x - x) || 1; if (s.bolts === 0) this.msgSide('Burg: keine Ballistenbolzen mehr – im Laden nachkaufen!', s.team); }
          else s.bCd = 12;
        }
      }
    }
    this.castleShotTick();
  },
});
// Explosionen beschädigen Mauern
{
  const _ex = World.prototype.explode;
  World.prototype.explode = function (x, y, r, owner) {
    _ex.call(this, x, y, r, owner);
    for (const s of this.structs) if (s.walls) for (const wl of s.walls) if (!wl.br && Math.abs(wl.x - x) < r + 6 && y > wl.y - WALL_H - r && y < wl.y + r) { if (typeof owner === 'number' && owner && this.friendlyTeam(owner, s.team)) continue; wl.hp -= r * 2.5; s.hitT = this.tick; if (wl.hp <= 0) { wl.hp = 0; wl.br = 1; this.msgSide('Eine Burgmauer wurde zerstört!', s.team); } }
  };
}
