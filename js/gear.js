// BuddelRage – Ausrüstung: Enterhaken (Seil schwingen, ein-/ausholen), Ballon (langsam aufsteigen), Notausgang (eigener Code)
'use strict';
const HOOK_MAX = 130, HOOK_SPEED = 6.2, HOOK_G = 0.05, BALLOON_GAS = 60 * 24, ESCAPE_CD = 60 * 60, ESCAPE_COST = 10, ESCAPE_HP = 20;
function hookVel(px, py, ax, ay, dir) { const dx = ax - px, dy = ay - py, d = Math.hypot(dx, dy); if (d < 2) return [dir * HOOK_SPEED * 0.7, -HOOK_SPEED * 0.7]; return [dx / d * HOOK_SPEED, dy / d * HOOK_SPEED]; }
Object.assign(World.prototype, {
  hand(c) { return [c.x + c.dir * 1, c.y - 7]; },
  // Enterhaken abschießen (Richtung Zielpunkt; ohne Ziel schräg nach oben)
  fireHook(c, aim) {
    if (c.cd > 0 || c.act === 'dead' || c.act === 'push' || c.inside || c.act === 'climb' || c.act === 'hangle') return;
    if (c.hk) { c.hk = null; if (c.act === 'rope') { c.act = 'jump'; } return; }
    if (c.act === 'dig') c.act = 'walk';
    const [px, py] = this.hand(c);
    const v = aim ? hookVel(px, py, aim[0], aim[1], c.dir) : [c.dir * HOOK_SPEED * 0.6, -HOOK_SPEED * 0.8];
    if (aim && Math.abs(aim[0] - c.x) > 2) c.dir = Math.sign(aim[0] - c.x);
    c.hk = { st: 1, x: px, y: py, vx: v[0], vy: v[1], t: 0 };
    c.cd = 14; c.punch = 8; this.snd('throw', c.x, c.y);
  },
  hookAnchored(h) { // Haken hält, solange fester Stoff am Ankerpunkt ist
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.solid(h.x + dx, h.y + dy)) return true;
    return false;
  },
  ropeRelease(c, jump) {
    c.hk = null; if (c.act !== 'rope') return;
    c.act = 'jump';
    if (jump) { const k = this.keysFor(c), mv = k.r - k.l; c.vy = Math.min(c.vy, -2.1); c.vx = c.vx * 0.7 + mv * 0.8; if (mv) c.dir = mv; }
  },
  // Ballon aufblasen: Buddler schwebt langsam hoch
  inflate(c) {
    if (c.cd > 0 || c.act === 'dead' || c.act === 'push' || c.inside || c.act === 'climb' || c.act === 'hangle' || c.bl) return;
    const i = c.inv.indexOf('balloon'); if (i < 0) return;
    if (this.solid(c.x, c.y - 14) || this.solid(c.x, c.y - 20)) { if (!this.teams[c.team].ai) this.msg('Kein Platz für den Ballon (Decke zu niedrig).', c.team); this.snd('error', c.x, c.y); return; }
    c.inv.splice(i, 1); c.hk = null;
    c.bl = { gas: BALLOON_GAS }; c.act = 'float'; c.vy = Math.min(c.vy, 0); c.cd = 12; this.snd('fuse', c.x, c.y);
  },
  popBalloon(c) {
    if (!c.bl) return; c.bl = null;
    this.ev({ e: 'pop', x: Math.round(c.x), y: Math.round(c.y - 24), col: (this.teams[c.team] || {}).color || '#e33' }); this.snd('pop', c.x, c.y - 20);
    if (c.act === 'float') { c.act = 'jump'; c.vy = Math.max(c.vy, 0); }
  },
  // Ballon einpacken (am Boden) bzw. loslassen (in der Luft – er fliegt davon)
  packBalloon(c, onGround) {
    if (!c.bl) return;
    const gas = c.bl.gas; c.bl = null; if (c.act === 'float') { c.act = onGround ? 'walk' : 'jump'; }
    if (onGround && gas > 0) { if (c.inv.length < INV_MAX) c.inv.push('balloon'); else { const it = this.spawnItem('balloon', c.x, c.y - 4); it.pickCd = 60; } this.snd('grab', c.x, c.y); }
    else this.ev({ e: 'away', x: Math.round(c.x), y: Math.round(c.y - 24), col: (this.teams[c.team] || {}).color || '#e33' });
  },
  // Aktionen während Seil/Ballon: Springen = loslassen, Benutzen/Aktion = Seil lösen bzw. Ballon einpacken/loslassen
  gearAction(c, a, aim) {
    if (c.act === 'rope') {
      if (a === 'jump') { this.ropeRelease(c, true); return true; }
      if (a === 'use' || a === 'primary') { this.ropeRelease(c, false); c.cd = 8; return true; }
      if (a === 'drop' && actItem(c) === 'hook') { this.ropeRelease(c, false); return false; }
      if (a === 'dig' || a === 'digdown' || a === 'build') return true;
      return false;
    }
    if (c.act === 'float') {
      const ground = this.boxHit(c.x, c.y + 1);
      if (a === 'jump' || a === 'use' || a === 'primary') { this.packBalloon(c, ground); c.cd = 8; return true; }
      if (a === 'dig' || a === 'digdown' || a === 'build') return true;
      return false;
    }
    return false;
  },
  // pro Tick: Hakenflug, Seilphysik, Ballonflug
  updGear(c, k, inWater, inLava) {
    const h = c.hk;
    if (h && h.st === 1) {
      h.t++;
      for (let s = 0; s < 3 && c.hk; s++) {
        h.vy += HOOK_G / 3; h.x += h.vx / 3; h.y += h.vy / 3;
        if (h.x < 1 || h.x > this.W - 2 || h.y > this.H - 2) { c.hk = null; break; }
        if (h.y > 0 && this.solid(h.x, h.y)) {
          h.x = Math.round(h.x - h.vx / 6); h.y = Math.round(h.y - h.vy / 6);
          if (!this.solid(h.x, h.y)) { h.x = Math.round(h.x + h.vx / 6); h.y = Math.round(h.y + h.vy / 6); }
          h.st = 2; const [px, py] = this.hand(c); h.len = Math.max(8, Math.min(HOOK_MAX, Math.hypot(px - h.x, py - h.y)));
          this.snd('arrowhit', h.x, h.y);
          if (c.act !== 'dead' && c.act !== 'push' && !c.inside) { if (c.act === 'dig' || c.act === 'climb' || c.act === 'hangle' || c.act === 'fight') c.vx = c.vy = 0; if (c.act === 'float') this.packBalloon(c, false); c.act = 'rope'; }
          break;
        }
      }
      if (c.hk && c.hk.st === 1) { const [px, py] = this.hand(c); if (h.t > 50 || Math.hypot(h.x - px, h.y - py) > HOOK_MAX) c.hk = null; }
    } else if (h && h.st === 2) {
      if (!this.hookAnchored(h)) { this.ropeRelease(c, false); }
      else if (c.act !== 'rope') { if (c.act === 'walk' || c.act === 'jump' || c.act === 'swim' || c.act === 'tumble') c.act = 'rope'; else c.hk = null; }
    }
    if (c.act === 'rope' && !(c.hk && c.hk.st === 2)) { c.act = 'jump'; c.hk = null; }
    if (c.bl) {
      if (c.fire > 0 || inLava) { this.popBalloon(c); }
      else if (c.act !== 'float') { if (c.act === 'walk' || c.act === 'jump' || c.act === 'swim' || c.act === 'tumble') c.act = 'float'; else this.packBalloon(c, false); }
    }
    if (c.act === 'float' && !c.bl) c.act = 'jump';
    if (c.act === 'rope') this.ropePhysics(c, k);
    else if (c.act === 'float') this.floatPhysics(c, k, inWater);
  },
  // Körper bewegen (x, dann y) mit Kollision; liefert Bodenkontakt
  moveBody(c) {
    let ground = false;
    if (c.vx) {
      const steps = Math.ceil(Math.abs(c.vx) * 2);
      for (let s = 0; s < steps; s++) { const nx = c.x + c.vx / steps; if (this.boxHit(nx, c.y)) { if (!this.boxHit(nx, c.y - 1) && c.vy >= 0) { c.x = nx; c.y -= 1; continue; } c.vx *= -0.15; break; } c.x = nx; }
    }
    if (c.vy) {
      const steps = Math.ceil(Math.abs(c.vy) * 2);
      for (let s = 0; s < steps; s++) {
        const ny = c.y + c.vy / steps;
        if (this.boxHit(c.x, ny)) { if (c.vy > 0) { ground = true; if (c.vy > 3.7) this.hurt(c, (c.vy - 3.7) * 30, null); c.y = Math.round(c.y); let g = 0; while (!this.boxHit(c.x, c.y + 1) && g++ < 2) c.y++; } c.vy = 0; break; }
        c.y = ny;
      }
    }
    if (!ground && this.boxHit(c.x, c.y + 1)) ground = true;
    return ground;
  },
  ropePhysics(c, k) {
    const h = c.hk, mv = k.r - k.l;
    if (k.u) h.len = Math.max(7, h.len - 1.15);
    else if (k.d) h.len = Math.min(HOOK_MAX, h.len + 1.3);
    c.vy = Math.min(c.vy + 0.11, 4.2);
    if (mv) { c.vx += mv * 0.045; c.dir = mv; }
    c.vx *= 0.995;
    const ground0 = this.boxHit(c.x, c.y + 1);
    if (ground0 && c.vy >= 0 && !k.u) c.vx *= 0.8;
    // Seil-Bedingung (Hand am Kreis um den Anker), dann bewegen
    const [px, py] = this.hand(c);
    let dx = px - h.x, dy = py - h.y, d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    if (d >= h.len - 0.5) { const vr = c.vx * nx + c.vy * ny; if (vr > 0) { c.vx -= vr * nx; c.vy -= vr * ny; } }
    if (d > h.len) { const pull = Math.min(2.5, d - h.len); c.vx -= nx * pull * 0.5; c.vy -= ny * pull * 0.5; }
    const sp = Math.hypot(c.vx, c.vy); if (sp > 4.5) { c.vx *= 4.5 / sp; c.vy *= 4.5 / sp; }
    this.moveBody(c);
    // harte Korrektur, falls immer noch zu lang (Kollision verhinderte die Bewegung)
    const [qx, qy] = this.hand(c); dx = qx - h.x; dy = qy - h.y; d = Math.hypot(dx, dy) || 1;
    if (d > h.len + 3) { const tx = c.x - dx / d * (d - h.len), ty = c.y - dy / d * (d - h.len); if (!this.boxHit(tx, ty)) { c.x = tx; c.y = ty; } else if (!this.boxHit(tx, c.y)) c.x = tx; else if (!this.boxHit(c.x, ty)) c.y = ty; }
    if (d > HOOK_MAX + 25) this.ropeRelease(c, false);
    c.anim += Math.abs(c.vx) * 0.1 + (k.u || k.d ? 0.12 : 0);
    this.pickup(c);
  },
  floatPhysics(c, k, inWater) {
    const b = c.bl, mv = k.r - k.l;
    if (b.gas > 0) b.gas--;
    if (b.gas === 0 && !b.empty) { b.empty = 1; if (!this.teams[c.team].ai) this.msg('Der Ballon verliert Luft…', c.team); }
    const sink = k.d || b.gas === 0;
    const tv = sink ? (k.d ? 0.7 : 0.32) : (k.u ? -0.6 : -0.42);
    c.vy += (tv - c.vy) * 0.05;
    c.vx += (mv * 0.5 - c.vx) * 0.04; if (mv) c.dir = mv;
    // Decke: Ballon stößt an (Ballon sitzt ~24 px über den Füßen)
    if (c.vy < 0 && (this.solid(c.x, c.y - 30) || this.solid(c.x - 3, c.y - 29) || this.solid(c.x + 3, c.y - 29))) c.vy = Math.max(0, c.vy);
    if (inWater) c.vy = Math.min(c.vy, -0.3);
    const ground = this.moveBody(c);
    if (ground && c.vy >= 0 && sink) { // gelandet
      if (b.gas === 0) { c.bl = null; c.act = 'walk'; if (!this.teams[c.team].ai) this.msg('Ballon ist leer.', c.team); }
      else this.packBalloon(c, true);
      c.vx = 0; c.vy = 0;
    }
    c.anim += 0.05;
    this.pickup(c);
  },
  // Pfeile und Würfe lassen Ballons platzen
  gearHit(it) {
    for (const c of this.clonks) {
      if (!c.bl || c.act === 'dead' || c.id === it.owner && it.age < 25) continue;
      if (Math.abs(it.x - c.x) <= 5 && it.y >= c.y - 31 && it.y <= c.y - 17) { this.popBalloon(c); if (it.type === 'arrow') { it.remove = true; return true; } it.armed = false; return false; }
    }
    return false;
  },
  // Notausgang: Buddler unter der Erde → zur eigenen Basis (oder an die Oberfläche darüber); kostet Geld (oder Lebensenergie), Abklingzeit
  escapeCheck(c) {
    if (!c || c.act === 'dead') return 'Kein Buddler ausgewählt.';
    if (c.inside) return 'Erst das Gebäude verlassen.';
    if ((c.escCd || 0) > this.tick) return 'Notausgang erst in ' + Math.ceil((c.escCd - this.tick) / 60) + ' s wieder möglich.';
    const xi = Math.max(0, Math.min(this.W - 1, Math.round(c.x)));
    if (c.y < this.surf[xi] + 16) return 'Notausgang nur unter der Erde möglich.';
    if (this.clonks.some(o => !this.ally(o.team, c.team) && o.act !== 'dead' && !o.inside && Math.hypot(o.x - c.x, o.y - c.y) < 70)) return 'Gegner in der Nähe – kein Notausgang!';
    return '';
  },
  escape(c) {
    const why = this.escapeCheck(c), t = this.teams[c.team];
    if (why) { if (!t.ai) this.msg(why, c.team); this.snd('error', c.x, c.y); return false; }
    if (c.act === 'push') this.release(c);
    c.hk = null; if (c.bl) this.packBalloon(c, true);
    const base = this.aiHome ? this.aiHome(c) : null;
    let x, y;
    if (base) { x = base.x; y = base.y - 2; }
    else {
      x = Math.round(c.x); let best = -1;
      for (let o = 0; o < 200 && best < 0; o += 4) for (const s of [1, -1]) { const xx = Math.max(6, Math.min(this.W - 7, x + s * o)); const yy = this.surf[xx] - 1; if (this.matAt(xx, yy + 2) !== MAT.WATER && this.matAt(xx, yy + 2) !== MAT.LAVA) { best = xx; break; } }
      x = best < 0 ? x : best; y = this.surf[x] - 2;
    }
    this.ev({ e: 'poof', x: Math.round(c.x), y: Math.round(c.y - 5), k: 'esc' });
    let cost;
    if (t.money >= ESCAPE_COST) { t.money -= ESCAPE_COST; cost = '−' + ESCAPE_COST + ' Geld'; } else { c.hp = Math.max(1, c.hp - ESCAPE_HP); cost = '−' + ESCAPE_HP + ' Leben'; }
    c.x = x; c.y = y; c.vx = c.vy = 0; c.act = 'jump'; c.fire = 0; c.fight = 0;
    let g = 0; while (this.boxHit(c.x, c.y) && g++ < 40) c.y--;
    c.escCd = this.tick + ESCAPE_CD;
    if (t.stats) t.stats.escapes = (t.stats.escapes || 0) + 1;
    this.ev({ e: 'poof', x: Math.round(c.x), y: Math.round(c.y - 5), k: 'esc' }); this.snd('door', c.x, c.y);
    if (!t.ai) this.msg('Notausgang: ' + c.name + ' ist ' + (base ? 'zurück an der Basis' : 'an der Oberfläche') + ' (' + cost + ').', c.team);
    if (c.ai) { c.ai.path = null; c.ai.task = null; }
    return true;
  },
});

// ---------- KI: Enterhaken / Ballon / Notausgang zum Befreien aus Gruben ----------
Object.assign(World.prototype, {
  // Ankerpunkt für den Haken suchen: Strahlen nach oben (zur Zielseite geneigt), erster fester Punkt mit freier Flugbahn
  aiGearStat(c, k) { const S = this.teams[c.team].stats; if (S) { S.gear = S.gear || {}; S.gear[k] = (S.gear[k] || 0) + 1; } },
  aiHookAnchor(c, gx, gy) {
    const [px, py] = this.hand(c), side = Math.sign(gx - c.x) || c.dir;
    let best = null, bs = -1e9;
    for (const deg of [90, 75, 60, 105, 45, 120, 35]) {
      const a = (side > 0 ? deg : 180 - deg) * Math.PI / 180, dx = Math.cos(a), dy = -Math.sin(a);
      for (let d = 10; d < HOOK_MAX - 12; d += 3) {
        const x = px + dx * d, y = py + dy * d;
        if (y < 1 || x < 2 || x > this.W - 3) break;
        if (this.solid(x, y)) {
          if (d < 22) break;
          const sc = (py - y) * 1.0 - Math.abs(x - gx) * 0.25 + (y > gy ? 0 : 20);
          if (sc > bs) { bs = sc; best = [Math.round(x + dx * 2), Math.round(y + dy * 2)]; }
          break;
        }
      }
    }
    return best && (py - best[1]) > 18 ? best : null;
  },
  // aus aiGoto: Ziel liegt hoch über dem Buddler und er kommt nicht weiter → Haken oder Ballon
  aiGearUp(c, A, x, y) {
    if ((A.gearCd || 0) > A.t || !['walk', 'jump', 'swim', 'climb', 'hangle'].includes(c.act) || c.inside || c.hk || c.bl) return false;
    const hi = c.inv.indexOf('hook'), bi = c.inv.indexOf('balloon');
    if (hi >= 0) {
      const anc = this.aiHookAnchor(c, x, y);
      if (anc) { if (c.act === 'climb' || c.act === 'hangle') { c.act = 'jump'; c.vx = 0; c.vy = 0; } c.slot = hi; c.cd = 0; this.fireHook(c, anc); this.aiGearStat(c, 'hook'); A.gear = { k: 'rope', t0: A.t, gx: x, gy: y }; A.gearCd = A.t + 150; return true; }
    }
    if (bi >= 0 && c.act === 'walk') {
      let free = true; for (let yy = c.y - 14; yy > Math.max(2, y - 30); yy -= 3) if (this.solid(c.x, yy) || this.solid(c.x - 3, yy) || this.solid(c.x + 3, yy)) { free = false; break; }
      if (free) { this.inflate(c); if (c.bl) { this.aiGearStat(c, 'balloon'); A.gear = { k: 'float', t0: A.t, gx: x, gy: y }; A.gearCd = A.t + 400; return true; } }
    }
    A.gearCd = A.t + 120; return false;
  },
  // pro Tick, solange am Seil / im Ballon: einholen bzw. lenken, oben abspringen / landen
  aiGearCtl(c, A, k) {
    const G2 = A.gear || { gx: c.x, gy: c.y - 60, t0: A.t };
    if (c.act === 'rope' && c.hk) {
      const h = c.hk, side = Math.sign(G2.gx - c.x) || c.dir;
      if (h.len > 9) k.u = 1;
      if (A.t - G2.t0 > 40 && Math.abs(c.vx) < 0.6) k[side > 0 ? 'r' : 'l'] = 1; // etwas Schwung zur Zielseite
      const top = h.len <= 9 || c.y <= G2.gy + 2;
      if (top || A.t - G2.t0 > 300) { k[side > 0 ? 'r' : 'l'] = 1; this.clonkAction(c, 'jump'); A.gear = null; A.path = null; A.impT = A.t; }
      return true;
    }
    if (c.act === 'float' && c.bl) {
      const dx = G2.gx - c.x;
      if (c.y < G2.gy - 4 || A.t - G2.t0 > 1100) G2.down = true; // oben angekommen: zur Zielseite lenken und landen
      if (G2.down) { if (Math.abs(dx) > 4) k[dx > 0 ? 'r' : 'l'] = 1; k.d = 1; }
      if (this.boxHit(c.x, c.y + 1) && (c.y < G2.gy + 10 || A.t - G2.t0 > 200)) { this.packBalloon(c, true); A.gear = null; A.path = null; A.impT = A.t; }
      return true;
    }
    A.gear = null; return false;
  },
});
