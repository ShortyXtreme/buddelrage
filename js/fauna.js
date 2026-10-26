// BuddelRage – Tiere: Wipfe, Vögel, Fische, Fledermäuse, Haie (eigener Code, prozedurale Grafik)
// Tiere verändern die Landschaft nicht (keine Auswirkung auf die KI-Wegsuche) und werden wie Monster per Schnappschuss synchronisiert.
'use strict';
const ANIMAL_KINDS = ['wipf', 'bird', 'fish', 'bat', 'shark'];
const ANIMAL = {
  wipf: { hp: 20, n: 'Wipf' }, bird: { hp: 6, n: 'Vogel' }, fish: { hp: 6, n: 'Fisch' }, bat: { hp: 6, n: 'Fledermaus' }, shark: { hp: 80, n: 'Hai' },
};
Object.assign(World.prototype, {
  // eigener Zufallsgenerator für Tiere: die übrige Simulation (Karte, KI) bleibt unverändert
  frnd() { if (!this.frng) this.frng = mulberry32(((this.cfg.seed | 0) ^ 0x5f3759df) | 0); return this.frng(); },
  // Anzahl je Art wächst mit der Kartenfläche (Mittel ≈ Faktor 1,2)
  faunaTargets() {
    if (this.faunaT) return this.faunaT;
    const f = this.W / 1800 * (this.H / 640);
    const water = this.faunaWater(), deep = this.faunaDeep();
    const T = { wipf: Math.max(2, Math.round(3.5 * f)), bird: Math.max(2, Math.round(4 * f)), bat: Math.max(1, Math.round(3 * f)),
      fish: water.length ? Math.max(2, Math.min(Math.round(9 * f), Math.round(water.length / 40))) : 0,
      shark: deep.length ? Math.max(1, Math.min(Math.round(f * 0.9), Math.round(deep.length / 60))) : 0 };
    this.faunaT = T; return T;
  },
  // Stichproben: Wasserpunkte (mit Wasser darüber und darunter) und tiefe Wasserpunkte (≥ 18 px Wassersäule)
  faunaWater() {
    const L = [], W = this.W, mat = this.mat;
    for (let y = 8; y < this.H - 8; y += 6) for (let x = 8; x < W - 8; x += 6) { const i = y * W + x; if (mat[i] === MAT.WATER && mat[i - 3 * W] === MAT.WATER && mat[i + 3 * W] === MAT.WATER) L.push(x, y); }
    const out = []; for (let k = 0; k < L.length; k += 2) out.push([L[k], L[k + 1]]); return out;
  },
  faunaDeep() {
    const out = [], W = this.W, mat = this.mat;
    for (let x = 10; x < W - 10; x += 6) {
      let run = 0;
      for (let y = 1; y < this.H - 4; y++) {
        if (mat[y * W + x] === MAT.WATER) { run++; if (run === 20) out.push([x, y - 6]); }
        else run = 0;
      }
    }
    return out;
  },
  spawnFauna() {
    const T = this.faunaTargets();
    for (const k of ANIMAL_KINDS) for (let n = 0; n < T[k]; n++) this.spawnAnimalSomewhere(k);
  },
  spawnAnimal(k, x, y, carried) {
    const A = ANIMAL[k] || ANIMAL.wipf;
    const a = { id: this.id(), k, x, y, vx: 0, vy: 0, dir: this.frnd() < 0.5 ? -1 : 1, anim: this.frnd() * 4, hp: A.hp, t: 0, think: 0, flee: 0, cd: 0, bite: 0, flop: 0, air: 0, perch: 0 };
    if (carried) { a.flee = 90; a.pickCd = 60; a.air = 1; }
    this.animals.push(a); return a;
  },
  spawnAnimalSomewhere(k) {
    const R = () => this.frnd(), W = this.W;
    for (let tries = 0; tries < 40; tries++) {
      let x = 20 + Math.floor(R() * (W - 40)), y;
      if (k === 'wipf') {
        if (this.bases.some(b => Math.abs(b - x) < 40)) continue;
        y = this.surf[x] - 1; if (this.matAt(x, y) !== MAT.SKY || this.matAt(x, y + 2) === MAT.WATER || !this.solid(x, y + 2)) continue;
        let g = 0; while (this.solid(x, y) && g++ < 8) y--;
      } else if (k === 'bird') {
        y = this.surf[x] - 40 - R() * 70; if (y < 12) y = 12 + R() * 20; if (this.solid(x, y)) continue;
      } else if (k === 'fish' || k === 'shark') {
        const L = k === 'fish' ? this.faunaWater() : this.faunaDeep(); if (!L.length) return null;
        const p = L[Math.floor(R() * L.length)]; x = p[0]; y = p[1];
      } else if (k === 'bat') {
        y = this.surf[x] + 45 + Math.floor(R() * (this.H * 0.75 - this.surf[x] - 45)); if (y >= this.H - 30) continue;
        let ok = true; for (let dy = -4; dy <= 4 && ok; dy += 2) for (let dx = -4; dx <= 4; dx += 2) if (this.mat[(y + dy) * W + x + dx] !== MAT.TUNNEL) { ok = false; break; }
        if (!ok) continue;
      }
      return this.spawnAnimal(k, x, y);
    }
    return null;
  },
  nearWipf(c, r) {
    let best = null, bd = r || 14;
    for (const a of this.animals) { if (a.k !== 'wipf' || a.remove || a.pickCd > 0) continue; const d = Math.hypot(a.x - c.x, (a.y - c.y + 3) * 1.5); if (d < bd) { bd = d; best = a; } }
    return best;
  },
  aSolid(x, y) { return this.solid(x, y); },
  aWater(x, y) { return this.matAt(x, y) === MAT.WATER; },
  animalDie(a, quiet) { if (a.remove) return; if (a.gold) this.birdDropGold(a, 'hit'); a.remove = true; if (!quiet) this.ev({ e: 'poof', x: Math.round(a.x), y: Math.round(a.y - 2), k: a.k }); },
  // Gefahr für Wipfe/Vögel: Monster, Haie, Feuer, Explosionen, Lava, schnelle Geschosse, nahe kämpfende Buddler
  faunaDanger(a, r) {
    let best = null, bd = r;
    const consider = (x, y, w) => { const d = Math.hypot(x - a.x, (y - a.y) * 1.3) / (w || 1); if (d < bd) { bd = d; best = [x, y]; } };
    for (const m of this.monsters) if (m.bite > 0 || m.chg > 0) consider(m.x, m.y); // nur stürmende Wildschweine
    for (const b of this.recentBooms || []) if (this.tick - b.t < 90) consider(b.x, b.y, 2);
    for (const it of this.items) if ((it.armed && Math.hypot(it.vx, it.vy) > 1.5) || it.fuse > 0) consider(it.x, it.y, 1.3);
    for (const c of this.clonks) if (c.act !== 'dead' && !c.inside && (c.fire > 0 || c.act === 'fight' || c.swing > 0 || Math.abs(c.vx) > 1.2 || c.act === 'tumble')) consider(c.x, c.y, a.k === 'bird' ? 1.6 : 0.8);
    if (a.k === 'bird') for (const c of this.clonks) if (c.act !== 'dead' && !c.inside) consider(c.x, c.y, 0.9);
    if (this.fires.length) for (let k = 0; k < this.fires.length; k += 3) consider(this.fires[k].x, this.fires[k].y, 1.2);
    return best;
  },
  updFauna() {
    if (this.recentBooms && this.recentBooms.length && this.tick % 60 === 0) this.recentBooms = this.recentBooms.filter(b => this.tick - b.t < 120);
    for (const a of this.animals) {
      if (a.remove) continue;
      a.t++; if (a.cd > 0) a.cd--; if (a.bite > 0) a.bite--; if (a.flee > 0) a.flee--; if (a.pickCd > 0) a.pickCd--;
      if (a.y > this.H + 10 || a.x < -10 || a.x > this.W + 10) { a.remove = true; continue; }
      const m = this.matAt(a.x, a.y - 1);
      if (m === MAT.LAVA) { a.hp -= 2; if (a.hp <= 0) { this.animalDie(a); continue; } }
      if (a.hp <= 0) { this.animalDie(a); continue; }
      if (a.k === 'wipf') this.updWipf(a, m);
      else if (a.k === 'bird') this.updBird(a);
      else if (a.k === 'bat') this.updBat(a);
      else this.updFish(a, m);
    }
    if (this.animals.some(a => a.remove)) this.animals = this.animals.filter(a => !a.remove);
    // Nachwuchs: alle 30 s fehlt eine Art → ein Tier taucht irgendwo auf (Wipfe nie direkt an Basen)
    if (this.cfg.animals !== false && this.tick % 1800 === 900) {
      const T = this.faunaTargets();
      for (const k of ANIMAL_KINDS) { const n = this.animals.filter(a => a.k === k).length + (k === 'wipf' ? this.clonks.reduce((s, c) => s + c.inv.filter(x => x === 'wipf').length, 0) : 0); if (n < T[k]) { this.spawnAnimalSomewhere(k); break; } }
    }
  },
  // Wipf: läuft, hüpft, flieht; schwimmt an die Oberfläche
  updWipf(a, m) {
    const inW = m === MAT.WATER;
    if (a.t % 10 === a.id % 10) { const d = this.faunaDanger(a, 70); if (d) { a.flee = 70; a.dir = Math.sign(a.x - d[0]) || a.dir; } }
    const ground = this.aSolid(a.x, a.y + 1) || this.aSolid(a.x - 2, a.y + 1) || this.aSolid(a.x + 2, a.y + 1);
    if (inW) { a.vy += (-0.35 - a.vy) * 0.1; a.vx += (a.dir * 0.4 - a.vx) * 0.1; a.air = 0; if (a.t % 90 === 0 && this.frnd() < 0.4) a.dir = -a.dir; }
    else if (a.air || !ground) { a.vy = Math.min(a.vy + 0.11, 4); if (ground && a.vy >= 0) { a.air = 0; a.vy = 0; a.vx = 0; } }
    else {
      a.vy = 0;
      if (a.think-- <= 0 && !a.flee) { a.think = 60 + (this.frnd() * 160 | 0); a.idle = this.frnd() < 0.35; if (this.frnd() < 0.4) a.dir = -a.dir; }
      const sp = a.flee ? 1.05 : a.idle ? 0 : 0.32;
      a.vx = a.dir * sp;
      if (sp) {
        const nx = a.x + a.vx;
        let moved = false;
        for (let up = 0; up <= 3; up++) if (!this.aSolid(nx, a.y - up) && !this.aSolid(nx, a.y - up - 3) && !this.aSolid(nx + a.dir * 2, a.y - up - 2)) { a.x = nx; a.y -= up; moved = true; break; }
        if (!moved) { if (a.flee || this.frnd() < 0.5) { a.vy = -1.9; a.vx = a.dir * 0.8; a.air = 1; } else a.dir = -a.dir; }
        else { let g = 0; while (!this.aSolid(a.x, a.y + 1) && g++ < 3) a.y++; if (!this.aSolid(a.x, a.y + 1)) a.air = 1; }
        if (this.matAt(a.x + a.dir * 4, a.y + 2) === MAT.WATER && !a.flee) a.dir = -a.dir; // nicht freiwillig ins Wasser
        if (this.matAt(a.x + a.dir * 4, a.y + 2) === MAT.LAVA || this.matAt(a.x + a.dir * 5, a.y) === MAT.LAVA) a.dir = -a.dir;
        a.anim += a.flee ? 0.35 : 0.16;
      }
      if (a.flee && this.frnd() < 0.02) { a.vy = -1.6; a.vx = a.dir * 1.1; a.air = 1; }
      return;
    }
    this.aMove(a);
    a.anim += 0.2;
  },
  // einfache Bewegung mit Kollision (Punktkörper, 4 px hoch)
  aMove(a, bounce) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(a.vx), Math.abs(a.vy))));
    for (let s = 0; s < steps; s++) {
      const nx = a.x + a.vx / steps, ny = a.y + a.vy / steps;
      if (this.aSolid(nx, a.y) || this.aSolid(nx, a.y - 3)) { a.vx = bounce ? -a.vx * 0.6 : 0; a.dir = -a.dir; } else a.x = nx;
      if (this.aSolid(a.x, ny) || this.aSolid(a.x, ny - 3)) { if (a.vy > 0) { a.y = Math.round(a.y); } a.vy = bounce ? -a.vy * 0.5 : 0; break; } else a.y = ny;
    }
  },
  // Goldklau: selten stürzt ein Vogel auf offen an der Oberfläche liegendes Gold, packt es und fliegt weit weg (lässt es dort fallen)
  goldOpen(it) {
    if (it.type !== 'gold' || it.remove || it.stuck || it.armed || it.fuse > 0 || it.age < 300 || Math.hypot(it.vx, it.vy) > 0.05) return false;
    const x = Math.round(it.x), y = Math.round(it.y); if (x < 30 || x > this.W - 30) return false;
    if (y < this.surf[x] - 3 || y > this.surf[x] + 3) return false; // nur an der Oberfläche
    for (let yy = y - 3; yy > Math.max(0, y - 60); yy -= 2) if (this.matAt(x, yy) !== MAT.SKY) return false; // freier Himmel darüber
    if (this.structs.some(s => !s.remove && Math.abs(s.x - x) < s.w / 2 + 6 && y > s.y - s.h - 4 && y < s.y + 6)) return false; // nicht an/unter Gebäuden
    return true;
  },
  birdTheft() {
    if (this.animals.some(a => a.steal)) return; // höchstens ein Diebstahl gleichzeitig
    if ((this.theftCd || 0) > this.tick || this.frnd() > 0.06) return;
    const golds = this.items.filter(it => this.goldOpen(it)); if (!golds.length) return;
    const it = golds[Math.floor(this.frnd() * golds.length)];
    let bird = null, bd = 420; for (const a of this.animals) if (a.k === 'bird' && !a.remove && !a.flee) { const d = Math.hypot(a.x - it.x, a.y - it.y); if (d < bd) { bd = d; bird = a; } }
    if (!bird) return;
    bird.steal = { it: it.id, ph: 'dive', t0: this.tick }; this.theftCd = this.tick + 60 * 75;
  },
  birdDropGold(a, why) {
    if (!a.gold) return; a.gold = 0; a.steal = null;
    const g = this.spawnItem('gold', a.x, a.y + 2); g.vx = a.vx * 0.5; g.vy = 0.5; g.pickCd = why === 'hit' ? 0 : 20;
    if (why === 'hit') this.msg('Der Vogel hat das Gold fallen lassen!');
  },
  updBird(a) {
    if (a.gold && a.hpG !== undefined && a.hp < a.hpG) { this.birdDropGold(a, 'hit'); a.flee = 120; } // getroffen → Beute fällt
    a.hpG = a.hp;
    if (a.steal) {
      const S = a.steal;
      if (S.ph === 'dive') {
        const it = this.items.find(i => i.id === S.it);
        if (!it || !this.goldOpen(it) || this.tick - S.t0 > 900 || this.clonks.some(c => c.act !== 'dead' && Math.abs(c.x - it.x) < 30 && Math.abs(c.y - it.y) < 20)) { a.steal = null; return this.updBirdFly(a); } // Buddler direkt daneben: lieber nicht
        a.flee = 0;
        const dx = it.x - a.x, dy = it.y - 3 - a.y, d = Math.hypot(dx, dy) || 1;
        a.dir = Math.sign(dx) || a.dir; a.vx += (dx / d * 1.7 - a.vx) * 0.12; a.vy += (dy / d * 1.7 - a.vy) * 0.12;
        if (d < 4) { it.remove = true; a.gold = 1; S.ph = 'away'; S.x0 = a.x; S.dir = Math.sign(this.W / 2 - a.x) || 1; this.msg('Ein Vogel klaut Gold!'); this.snd('grab', a.x, a.y); }
        this.aMove(a, true); a.anim += 0.45; return;
      }
      // wegfliegen: weit über die Karte, dann irgendwo auf freier Fläche fallen lassen
      a.dir = S.dir; a.flee = 0;
      const xi = Math.max(0, Math.min(this.W - 1, Math.round(a.x))), want = Math.max(10, this.surf[xi] - 70);
      a.vx += (a.dir * 1.4 - a.vx) * 0.06; a.vy += ((want - a.y) * 0.01 - a.vy) * 0.08;
      if (this.aSolid(a.x + a.dir * 10, a.y) || this.aSolid(a.x + a.dir * 10, a.y + 6)) a.vy = Math.min(a.vy, -0.9);
      if (a.x < 20 || a.x > this.W - 20) S.dir = a.dir = -a.dir;
      this.aMove(a, true); a.anim += 0.5;
      if (Math.abs(a.x - S.x0) > Math.min(700, this.W * 0.4) && this.tick % 20 === 0 && this.frnd() < 0.3 && !this.structs.some(s => Math.abs(s.x - a.x) < 60)) this.birdDropGold(a, 'far');
      return;
    }
    if (this.tick % 120 === a.id % 120) this.birdTheft();
    return this.updBirdFly(a);
  },
  updBirdFly(a) {
    if (a.t % 8 === a.id % 8) { const d = this.faunaDanger(a, 45); if (d) { a.flee = 80; a.dir = Math.sign(a.x - d[0]) || a.dir; } }
    const xi = Math.max(0, Math.min(this.W - 1, Math.round(a.x)));
    const want = Math.max(10, this.surf[xi] - (a.flee ? 110 : 55 + 25 * Math.sin(a.id + a.t / 300)));
    const sp = a.flee ? 1.5 : 0.7;
    a.vx += (a.dir * sp - a.vx) * 0.06;
    a.vy += ((want - a.y) * 0.01 + Math.sin(a.t / 18 + a.id) * 0.05 - a.vy) * 0.08;
    // Gelände voraus → steigen
    if (this.aSolid(a.x + a.dir * 10, a.y) || this.aSolid(a.x + a.dir * 10, a.y + 6)) { a.vy = Math.min(a.vy, -0.8); if (this.aSolid(a.x + a.dir * 4, a.y)) a.dir = -a.dir; }
    if (a.x < 15) a.dir = 1; else if (a.x > this.W - 15) a.dir = -1;
    if (a.y < 6) a.vy = Math.abs(a.vy);
    this.aMove(a, true);
    a.anim += a.flee ? 0.5 : 0.3;
    if (this.matAt(a.x, a.y) === MAT.WATER) { a.vy = -1; a.y -= 1; }
  },
  updBat(a) {
    const night = this.daylight() < 0.35;
    a.vx += (this.frnd() - 0.5) * 0.25 + (a.dir * 0.5 - a.vx) * 0.03; a.vy += (this.frnd() - 0.5) * 0.25 - a.vy * 0.04;
    const vmax = 1.1; a.vx = Math.max(-vmax, Math.min(vmax, a.vx)); a.vy = Math.max(-vmax, Math.min(vmax, a.vy));
    const xi = Math.max(0, Math.min(this.W - 1, Math.round(a.x)));
    if (!night && a.y < this.surf[xi] + 14) a.vy = Math.abs(a.vy) + 0.2; // bei Tag nicht ins Freie
    if (a.y < 8) a.vy = Math.abs(a.vy);
    if (this.matAt(a.x, a.y) === MAT.WATER || this.matAt(a.x, a.y + 4) === MAT.WATER) a.vy = -0.8;
    if (this.aSolid(a.x + a.vx * 6, a.y + a.vy * 6)) { a.vx = -a.vx; a.vy = -a.vy; a.dir = -a.dir; }
    if (this.frnd() < 0.005) a.dir = -a.dir;
    this.aMove(a, true);
    a.anim += 0.45;
  },
  // Fisch und Hai: bleiben im Wasser; an Land zappeln (Fische sterben nach einer Weile)
  updFish(a, m) {
    const shark = a.k === 'shark', inW = m === MAT.WATER || this.aWater(a.x, a.y);
    if (!inW) {
      a.flop = 1; a.vy = Math.min(a.vy + 0.11, 4); a.vx *= 0.95;
      if ((this.aSolid(a.x, a.y + 1)) && a.t % 25 === 0) { a.vy = -1.3; a.vx = (this.frnd() - 0.5) * 1.6; }
      this.aMove(a); a.anim += 0.3; a.air = (a.air || 0) + 1;
      if (a.air > (shark ? 900 : 420)) this.animalDie(a);
      return;
    }
    a.flop = 0; a.air = 0;
    let tgt = null;
    if (shark) {
      let bd = 95;
      for (const c of this.clonks) { if (c.act === 'dead' || c.inside) continue; if (!this.aWater(c.x, c.y - 4)) continue; const d = Math.hypot(c.x - a.x, c.y - 5 - a.y); if (d < bd) { bd = d; tgt = c; } }
    } else if (a.t % 12 === a.id % 12) {
      for (const c of this.clonks) if (c.act !== 'dead' && Math.abs(c.x - a.x) < 22 && Math.abs(c.y - 5 - a.y) < 14) { a.flee = 40; a.dir = Math.sign(a.x - c.x) || a.dir; }
    }
    let sp = shark ? (tgt ? 1.15 : 0.45) : (a.flee ? 0.9 : 0.35), ty = a.y;
    if (tgt) { a.dir = Math.sign(tgt.x - a.x) || a.dir; ty = tgt.y - 5; }
    else { if (a.think-- <= 0) { a.think = 80 + (this.frnd() * 200 | 0); if (this.frnd() < 0.35) a.dir = -a.dir; a.ty = a.y + (this.frnd() - 0.5) * 14; } ty = a.ty != null ? a.ty : a.y; }
    a.vx += (a.dir * sp - a.vx) * 0.08;
    a.vy += (Math.max(-0.8, Math.min(0.8, (ty - a.y) * 0.05)) - a.vy) * 0.1;
    // nicht aus dem Wasser schwimmen
    const ahead = a.x + a.dir * (shark ? 9 : 4);
    if (!this.aWater(ahead, a.y)) { a.dir = -a.dir; a.vx *= -0.3; a.ty = a.y + 4; }
    if (!this.aWater(a.x, a.y + a.vy * 3 - 2)) a.vy = Math.abs(a.vy) * 0.5 + 0.05;
    if (!this.aWater(a.x, a.y + a.vy * 3 + 2)) a.vy = -Math.abs(a.vy) * 0.5;
    const nx = a.x + a.vx, ny = a.y + a.vy;
    if (this.aWater(nx, ny)) { a.x = nx; a.y = ny; } else if (this.aWater(nx, a.y)) a.x = nx; else if (this.aWater(a.x, ny)) a.y = ny;
    a.anim += shark ? 0.15 : 0.25;
    if (shark && tgt && a.cd <= 0 && Math.abs(tgt.x - a.x) < 9 && Math.abs(tgt.y - 5 - a.y) < 8) {
      a.cd = 70; a.bite = 12; this.snd('growl', a.x, a.y);
      if (this.blocks(tgt, a.dir)) { this.snd('shield', tgt.x, tgt.y); tgt.blockT = 10; a.vx = -a.dir; }
      else { this.hurt(tgt, 13, null); tgt.aHit = { t: this.tick, k: 'shark', id: a.id }; this.snd('hitliving', tgt.x, tgt.y); if (tgt.act !== 'dead' && this.frnd() < 0.5) this.fling(tgt, a.dir * 1.4, -1.2); }
    }
  },
  // Explosionen: Tiere nehmen Schaden, fliehen; Ballons in der Nähe platzen
  faunaBlast(x, y, r, R) {
    (this.recentBooms || (this.recentBooms = [])).push({ x, y, t: this.tick });
    for (const a of this.animals) {
      const dx = a.x - x, dy = a.y - y, d = Math.hypot(dx, dy) || 1;
      if (d < R) { const f = 1 - d / R; a.hp -= f * r * 2.6; a.vx = dx / d * f * 3; a.vy = -2 * f - 0.5; a.air = 1; a.flee = 120; }
      else if (d < R * 3) { a.flee = 120; a.dir = Math.sign(dx) || a.dir; }
    }
    for (const c of this.clonks) if (c.bl && c.act !== 'dead') { const d = Math.hypot(c.x - x, c.y - 24 - y); if (d < R + 8) this.popBalloon(c); }
  },
  // Treffer durch Geschosse (Pfeile, Würfe) und Nahkampf gegen Tiere
  faunaHit(it, sp) {
    for (const a of this.animals) {
      if (a.remove || a.k === 'wipf' && !it.armed) continue;
      const big = a.k === 'shark';
      if (Math.abs(it.x - a.x) <= (big ? 7 : 3) && Math.abs(it.y - a.y + (big ? 1 : 1)) <= (big ? 4 : 3)) {
        if (it.type === 'flint' || it.type === 'superflint') { it.remove = true; this.explode(it.x, it.y, ITEMS[it.type].blast, it.owner); return true; }
        a.hp -= it.type === 'arrow' ? 16 : (ITEMS[it.type].dmg || 5) * sp / 2; a.flee = 120; this.snd('hitliving', a.x, a.y);
        if (it.type === 'arrow') { it.remove = true; return true; }
        it.vx *= -0.3; it.armed = false; return false;
      }
    }
    return false;
  },
  faunaMelee(c, reach, dmg) {
    for (const a of this.animals) if ((a.k === 'shark' || (a.k === 'bird' && a.steal)) && Math.abs(a.x - c.x) < reach + 4 && Math.abs(a.y - (c.y - 5)) < 10 && Math.sign(a.x - c.x) === c.dir) { a.hp -= dmg; a.flee = 60; a.vx = c.dir * 1.2; this.snd('hitliving', a.x, a.y); }
  },
});
if (typeof module !== 'undefined') module.exports = { ANIMAL_KINDS };
