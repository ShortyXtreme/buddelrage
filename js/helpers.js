// BuddelRage – kaufbare Spezialisten-Buddler, die selbstständig arbeiten (Host rechnet, Clients sehen sie per Schnappschuss).
// Zeugmeister: füllt Munition von Burg/Wachturm nach (Teamkasse) und repariert Burg, Mauern und Turm.
// Sanitäter: gräbt eingeschlossene/verschüttete Buddler des eigenen Teams frei und heilt Verletzte langsam.
// Goldgräber: baut selbst Gold ab (auch Golderz-Brocken) und verkauft es an der Hütte/Burg.
// Wegfindung, Abbau, Rettung und Verkaufen nutzen die vorhandenen Funktionen (aiGoto, aiMine, aiRescue, aiExec …) – ai.js bleibt unverändert.
'use strict';
const SPEC = {
  zeug: { n: 'Zeugmeister', price: 95, max: 1, desc: 'Füllt Pfeile, Bolzen und Pech für Burg und Wachtürme aus der Kasse nach (nie während eines Ausbaus, lässt 20 Geld übrig) und repariert Burg, Mauern und Türme.' },
  medic: { n: 'Sanitäter', price: 85, max: 1, desc: 'Gräbt eingeschlossene oder verschüttete Buddler deines Teams frei und heilt Verletzte in seiner Nähe langsam (3 LP/s).' },
  gold: { n: 'Goldgräber', price: 70, max: 2, desc: 'Sucht sich selbst Gold (auch Golderz-Brocken), gräbt es ab und verkauft es an der Hütte oder Burg.' },
};
const SPEC_KEYS = Object.keys(SPEC);
const SPEC_RESERVE = 20, SPEC_REP = 0.15, SPEC_HEAL = 0.05, SPEC_SCAN = 30, SPEC_BUY_CD = 90, SPEC_HEAL_R = 16;
// true, wenn mindestens ein menschlicher Spieler das Team t steuert (Einzelspieler: dein Team; Mehrspieler: jedes Team mit
// verbundenem oder auf Rückkehr wartendem Spieler). Reine KI-Teams und Teams, die die KI nach einem Verbindungsabbruch
// übernommen hat, liefern false. Gilt auf Host und Clients gleich (t.ai kommt per Schnappschuss).
function teamHasHuman(t) { return !!t && typeof t === 'object' && !t.ai; }
function specCount(w, tid, kind) { let n = 0; for (const c of w.clonks) if (c.team === tid && c.spec === kind && c.act !== 'dead') n++; return n; }
Object.assign(World.prototype, {
  teamHasHuman(tid) { return teamHasHuman(typeof tid === 'number' ? this.teams[tid] : tid); },
  // Kauf eines Spezialisten. by = 'human' (Laden/Netz-Aktion eines Spielers) oder 'ai' (KI-Code). KI darf in Teams mit Mensch nicht kaufen.
  specBuy(t, kind, by) {
    const S = SPEC[kind]; if (!t || !S || t.elim) return false;
    const human = by === 'human';
    if (!human && teamHasHuman(t)) return false;
    if (human && t.ai) return false; // Ladenaktion von außen für ein reines KI-Team
    const tell = m => { if (!t.ai) this.msg(m, t.id); };
    let bases = this.structs.filter(s => BUILD[s.type].base && s.team === t.id && s.prog >= 1 && !s.remove);
    if (!bases.length) bases = this.structs.filter(s => BUILD[s.type].base && this.ally(s.team, t.id) && s.prog >= 1 && !s.remove);
    if (!bases.length) { tell('Keine Hütte – kein Einkauf möglich!'); return false; }
    if (specCount(this, t.id, kind) >= S.max) { tell(S.n + ': höchstens ' + S.max + ' pro Team.'); return false; }
    if (t.money < S.price) { tell('Zu wenig Geld für ' + S.n + ' (' + S.price + ').'); this.ev({ e: 'snd', n: 'error', x: bases[0].x, y: bases[0].y, team: t.id }); return false; }
    t.money -= S.price;
    const sc = this.selClonk(t), base = (sc && this.nearBase(sc)) || bases[0];
    const c = this.spawnClonk(t.id, base.x, base.y - 2);
    c.spec = kind; const n = specCount(this, t.id, kind); c.name = S.n + (n > 1 ? ' ' + n : '');
    c.sp = { job: 0, buyT: 0 };
    if (!this.selClonk(t)) t.sel = c.id;
    this.msg(c.name + ' ist angekommen und macht sich an die Arbeit.', t.id);
    if (t.stats) t.stats.bought = (t.stats.bought || 0) + 1;
    return true;
  },
  // vom Menschen gerade gesteuert → keine Automatik
  specManual(c) { const t = this.teams[c.team]; return !!t && !t.ai && t.sel === c.id; },
  specTick() {
    if (this.remote) return;
    let any = false; for (const c of this.clonks) if (c.spec && c.act !== 'dead') { any = true; break; }
    if (!any) return;
    this.aiInit(); if (this.tick % 2 === 0 || this.nav.dl.length > 400) this.nav.flush();
    for (const c of this.clonks) {
      if (!c.spec || c.act === 'dead') continue;
      if (this.specManual(c)) { if (c.ai) this.aiForget(c); continue; }
      const t = this.teams[c.team]; if (!t) continue;
      if (!c.sp) c.sp = { job: 0, buyT: 0 };
      this.specClonk(c, t);
    }
  },
  specClonk(c, t) {
    const B = this.aiBrain(t), D = this.aiDiff(t), A = this.aiAgent(c); A.t++;
    if (A.jumpCd > 0) A.jumpCd--;
    const k = c.aiKeys = { ...NOKEYS }; A.moving = false;
    if (c.act === 'tumble') return this.aiStuckTrack(c, t, A, false);
    if (c.inside) { this.aiInside(c, t, B, D, A, true); return this.aiStuckTrack(c, t, A, false); }
    if ((c.act === 'rope' || c.act === 'float') && this.aiGearCtl(c, A, k)) return this.aiStuckTrack(c, t, A, false);
    if (c.act === 'push') { this.aiPush(c, t, B, D, A, true, k); return this.aiStuckTrack(c, t, A, A.moving); }
    const T = A.task;
    if (this.specUnstick(c, A, k)) return this.aiStuckTrack(c, t, A, true);
    if (A.wander && A.wander.until > A.t && !(T && (T.type === 'rescue' || T.type === 'wander'))) { A.task = Object.assign({}, A.wander); A.path = null; } // Ausweg der Feststeck-Erkennung (aiStuckTrack)
    if (c.spec === 'medic' && A.task && A.task.type === 'rescue' && A.task.own) {
      if (this.specMedicDone(c, A)) return this.aiStuckTrack(c, t, A, false);
      if (this.specMedicCut(c, A)) return this.aiStuckTrack(c, t, A, true);
    }
    if (A.task && (A.task.type === 'rescue' || A.task.type === 'heal' || A.task.type === 'sell' || A.task.type === 'park' || A.task.type === 'haul' || A.task.type === 'wander')) { this.aiExec(c, t, B, D, A, true, k); return this.aiStuckTrack(c, t, A, A.moving); }
    if (c.hp < 30 && this.aiHome(c)) { A.task = { type: 'heal', s: 1 }; A.path = null; return this.aiStuckTrack(c, t, A, false); }
    if (c.spec === 'zeug') this.specZeug(c, t, A, k);
    else if (c.spec === 'medic') this.specMedic(c, t, B, D, A, k);
    else if (c.spec === 'gold') { if (!A.task || A.task.type !== 'mine') { A.task = { type: 'mine', s: 0.5 }; A.path = null; } if (!this.specLeaveFoot(c, A, k)) this.aiExec(c, t, B, D, A, true, k); }
    this.aiStuckTrack(c, t, A, A.moving);
  },
  // Spezialist kommt auf dem Weg (Verkaufen, zur Mine, Heilen) 10 s nicht aus einem kleinen Bereich heraus (z. B. springt in einer Höhle
  // immer wieder gegen die Decke): kurz landen und eine schräge Rampe Richtung Ziel/Heimat graben, dann neu planen
  specUnstick(c, A, k) {
    const P = c.sp || (c.sp = { job: 0, buyT: 0 }), T = A.task;
    if (P.unT > this.tick) {
      if (c.act === 'walk' || c.act === 'fight') { c.act = 'dig'; c.digIdle = 0; c.vx = 0; }
      if (c.act === 'dig') { c.dir = P.unD || c.dir; c.digA = -0.75; c.digIdle = 0; }
      if (c.act === 'climb' || c.act === 'hangle') k.d = 1;
      return true;
    }
    const travel = T && (T.type === 'sell' || T.type === 'heal' || T.type === 'wander' || (T.type === 'mine' && !A.arrived) || (c.spec === 'zeug' && P.job) || T.type === 'rescue');
    if (!travel || c.inside) { P.stT = this.tick; P.stX = c.x; P.stY = c.y; return false; }
    if (P.stT === undefined || Math.hypot(c.x - P.stX, c.y - P.stY) > 30) { P.stT = this.tick; P.stX = c.x; P.stY = c.y; return false; }
    if (this.tick - P.stT < 600 || T.type === 'rescue') return false;
    const h = this.aiHome(c), gx = T.type === 'mine' && A.mine >= 0 ? (A.mine % this.nav.gw) * NC : h ? h.x : c.x;
    P.unD = Math.sign(gx - c.x) || (this.rand() < 0.5 ? -1 : 1); P.unT = this.tick + 200; P.stT = this.tick; A.path = null;
    return true;
  },
  // Goldgräber gräbt nicht unter eigenen/verbündeten Gebäuden und Mauern los: erst seitlich aus dem Fundament heraus (+10 px)
  specFootAt(x, y) {
    for (const s of this.structs) {
      if (s.remove) continue;
      if (Math.abs(x - s.x) < s.w / 2 + 8 && y > s.y - 30 && y < s.y + 26) return { x: s.x, h: s.w / 2 + 12 };
      if (s.walls) for (const q of s.walls) if (Math.abs(x - q.x) < 11 && y > q.y - 30 && y < q.y + 26) return { x: q.x, h: 14 };
    }
    return null;
  },
  specLeaveFoot(c, A, k) {
    const f = this.specFootAt(c.x, c.y); if (!f) return false;
    if (c.act === 'dig') { c.act = 'walk'; c.vx = 0; }
    const N = this.nav, tx = A.mine >= 0 && N ? (A.mine % N.gw) * NC : c.x + (c.dir || 1) * 30;
    let side = Math.sign(tx - f.x) || 1; const ex = f.x + side * f.h;
    if (ex < 6 || ex > this.W - 6) side = -side;
    k[side > 0 ? 'r' : 'l'] = 1; A.moving = true; A.path = null; A.arrived = false;
    if (c.act === 'climb' || c.act === 'hangle') { k.u = 1; }
    return true;
  },
  // ---------- Zeugmeister ----------
  specAmmoNeed(s, t) { // [Art, Preis] des nächsten sinnvollen Munitionskaufs oder null
    if (!(s.upT > 0)) {
      const L = s.type === 'castle' ? castleLevel(s) : towerLevel(s), M = s.type === 'castle' ? CAMMO : TAMMO;
      for (const kd in M) { const a = M[kd]; if (L >= a.lvl && (s[kd] | 0) <= a.max - a.add && t.money >= a.price + SPEC_RESERVE) return kd; }
    }
    return null;
  },
  specRepNeed(s) { if (s.fire) return false; if (s.hp < structMax(s) - 0.5) return true; return !!(s.walls && s.walls.some(q => q.hp < WALL_HP - 0.5)); },
  specZeugJobs(c, t) {
    const L = [];
    for (const s of this.structs) {
      if ((s.type !== 'castle' && s.type !== 'tower') || s.team !== c.team || s.prog < 1 || s.remove) continue;
      const am = this.specAmmoNeed(s, t), rp = this.specRepNeed(s);
      if (am || rp) L.push({ s, d: Math.abs(s.x - c.x) + Math.abs(s.y - c.y) * 2 - (am ? 40 : 0) });
    }
    L.sort((a, b) => a.d - b.d); return L.length ? L[0].s : null;
  },
  specAt(c, s) { return Math.abs(c.x - s.x) < s.w / 2 + 14 && Math.abs(c.y - s.y) < 26; },
  specZeug(c, t, A, k) {
    const P = c.sp; let s = P.job && this.structs.find(o => o.id === P.job && !o.remove && o.prog >= 1);
    if (!s || A.t % SPEC_SCAN === 0) { const stay = s && this.specAt(c, s) && (this.specAmmoNeed(s, t) || this.specRepNeed(s)); if (!stay) s = this.specZeugJobs(c, t); P.job = s ? s.id : 0; }
    if (!s) { this.aiStat0 && this.aiStat0(c, 'wartet'); const h = this.aiHome(c); if (h && Math.abs(c.x - h.x) > 40) this.aiGoto(c, A, k, h.x, h.y - 1, 10); else if (c.act === 'dig') c.act = 'walk'; return; }
    if (!this.specAt(c, s)) { this.aiStat0 && this.aiStat0(c, 'geht zur ' + (s.type === 'castle' ? 'Burg' : 'Turm')); this.aiGoto(c, A, k, s.x, s.y - 1, 8); return; }
    if (c.act === 'dig') c.act = 'walk';
    // Munition: ein Paket alle 1,5 s, nie während eines Ausbaus, Limits und Rücklage beachten
    const kd = this.specAmmoNeed(s, t);
    if (kd && this.tick >= (P.buyT || 0)) {
      P.buyT = this.tick + SPEC_BUY_CD;
      if (s.type === 'castle') this.castleAmmo(t, kd, s.id); else this.towerAmmo(t, kd, s.id);
    }
    // Reparatur: Gebäude und Mauern (nicht bei Feuer, nicht mitten im Kampf)
    let foe = false; for (const o of this.clonks) if (o.act !== 'dead' && !this.ally(o.team, c.team) && Math.abs(o.x - c.x) < 60 && Math.abs(o.y - c.y) < 40) { foe = true; break; }
    if (!foe && !s.fire) {
      let did = false; const mx = structMax(s);
      if (s.hp < mx) { s.hp = Math.min(mx, s.hp + SPEC_REP); did = true; }
      if (s.walls) for (const q of s.walls) if (q.hp < WALL_HP) { q.hp = Math.min(WALL_HP, q.hp + SPEC_REP); did = true; }
      if (did) { c.punch = (this.tick % 24) < 6 ? 4 : 0; if (this.tick % 48 === 0) this.snd('build', c.x, c.y); this.aiStat0 && this.aiStat0(c, 'repariert'); P.rep = this.tick; }
    }
  },
  // ---------- Sanitäter ----------
  specBuried(o) { // eingeschlossen/verschüttet oder von der Feststeck-Erkennung (rescue.js) gemeldet
    if (o.act === 'dead' || o.inside) return false;
    return !!o.help || this.specEnclosed(o);
  },
  specEnclosed(o) { // unter der Oberfläche und kann weder seitlich noch nach oben
    if (o.act === 'dead' || o.inside) return false;
    const x = Math.round(o.x), y = Math.round(o.y);
    if (y <= this.surf[Math.max(0, Math.min(this.W - 1, x))] + 4) return false;
    if (!this.boxHit(x, y - 2)) return false;
    for (const dx of [-2, 2]) for (let up = 0; up <= 3; up++) if (!this.boxHit(x + dx, y - up)) return false;
    return true;
  },
  specMedicDone(c, A) { const T = A.task, o = this.clonks.find(q => q.id === T.id); if (o && o.act !== 'dead' && this.specEnclosed(o)) return false; if (o) { o.help = 0; o.rescuer = 0; o.lastRescuer = 0; o.helpMsg = 0; o.stkT = 0; if (o.act !== 'dead') this.msg(o.name + ' ist wieder frei.', c.team); } if (c.act === 'dig') c.act = 'walk'; A.task = null; A.path = null; return true; },
  // letzter Durchbruch zum Verschütteten: Gang vom Sanitäter bis zur Kammer graben und die Kammer seitlich weiten (digCircle)
  specMedicCut(c, A) {
    const T = A.task, o = this.clonks.find(q => q.id === T.id); if (!o) return false;
    const ax = c.x, ay = c.y - 5, bx = o.x, by = o.y - 5;
    if (!(T.cut >= 0) && Math.hypot(bx - ax, by - ay) > 22) return false;
    if (!(T.cut >= 0)) { T.cut = 0; T.cx = ax; T.cy = ay; }
    c.dir = Math.sign(bx - c.x) || c.dir; if (c.act === 'walk' || c.act === 'fight') { c.act = 'dig'; c.digIdle = 0; c.vx = 0; } c.digA = 0; c.digIdle = 0; A.moving = true;
    if (this.tick % 3 === 0) {
      T.cut = Math.min(1, T.cut + 0.08);
      const px = T.cx + (bx - T.cx) * T.cut, py = T.cy + (by - T.cy) * T.cut;
      this.digCircle(px, py, 4.6, c); this.digCircle(px, py - 4, 4.6, c);
      if (T.cut >= 1) { this.digCircle(o.x - 4, o.y - 4, 5, c); this.digCircle(o.x + 4, o.y - 4, 5, c); this.digCircle(o.x, o.y - 9, 5, c); T.cut = 0.999; }
    }
    return true;
  },
  specMedic(c, t, B, D, A, k) {
    // Heilen: Verletzte des eigenen Teams in der Nähe (auch sich selbst nicht, nur andere)
    let healing = false;
    for (const o of this.clonks) if (o !== c && o.team === c.team && o.act !== 'dead' && o.hp < 100 && Math.abs(o.x - c.x) < SPEC_HEAL_R && Math.abs(o.y - c.y) < 14) { o.hp = Math.min(100, o.hp + SPEC_HEAL); healing = true; }
    c.healT = healing ? 1 : 0;
    // Eingeschlossene Teamkollegen suchen
    if (A.t % SPEC_SCAN === 0) {
      let best = null, bd = 700;
      for (const o of this.clonks) { if (o === c || o.team !== c.team || !this.specBuried(o)) continue; const r = this.rescuerOf(o); if (r && r !== c) continue; const d = Math.abs(o.x - c.x) + Math.abs(o.y - c.y) * 0.5; if (d < bd) { bd = d; best = o; } }
      if (best) {
        const own = !best.help; if (own) best.help = this.tick;
        best.rescuer = c.id; best.helpMsg = 1;
        A.task = { type: 'rescue', id: best.id, s: 2, until: A.t + RESCUE_TIMEOUT, ph: 'go', own }; A.path = null;
        if (best.lastRescuer !== c.id) this.msg(c.name + ' gräbt ' + best.name + ' frei.', c.team);
        best.lastRescuer = c.id;
        return this.aiExec(c, t, B, D, A, true, k);
      }
    }
    // zum am schwersten Verletzten gehen, sonst an der Basis warten
    let pat = null, ph = 75;
    for (const o of this.clonks) if (o !== c && o.team === c.team && o.act !== 'dead' && !o.inside && o.hp < ph && Math.abs(o.x - c.x) < 400 && Math.abs(o.y - c.y) < 200) { ph = o.hp; pat = o; }
    if (pat) { this.aiStat0 && this.aiStat0(c, 'heilt ' + pat.name); if (Math.abs(pat.x - c.x) > 8 || Math.abs(pat.y - c.y) > 10) this.aiGoto(c, A, k, pat.x, pat.y, 5); else if (c.act === 'dig') c.act = 'walk'; return; }
    if (c.act === 'dig') c.act = 'walk';
    const h = this.aiHome(c); if (h && Math.abs(c.x - h.x) > 50) this.aiGoto(c, A, k, h.x, h.y - 1, 12);
  },
});
// KI-Steuerung der Teams: Spezialisten arbeiten nach eigener Logik (specTick), die normale KI lässt sie in Ruhe
{
  const _aic = World.prototype.aiClonk;
  World.prototype.aiClonk = function (c, t, B, D, helper) { if (c.spec) return; return _aic.call(this, c, t, B, D, helper); };
  const _kf = World.prototype.keysFor;
  World.prototype.keysFor = function (c) { if (c.spec && !this.specManual(c)) return c.aiKeys || NOKEYS; return _kf.call(this, c); };
  // Teams mit Mensch: die Helfer-KI kauft keine Buddler/Ritter/Spezialisten (nur der Spieler selbst)
  const _ab = World.prototype.aiBuy;
  if (_ab) World.prototype.aiBuy = function (t, c, what) { if ((what === 'clonk' || what === 'knight' || SPEC[what]) && teamHasHuman(t)) return false; if (SPEC[what]) return this.specBuy(t, what, 'ai'); return _ab.call(this, t, c, what); };
  // automatische Rettung (rescue.js) teilt Spezialisten außer dem Sanitäter nicht ein
  const _ra = World.prototype.rescueAssign;
  if (_ra) World.prototype.rescueAssign = function (s, ctrl) { const keep = []; for (const o of this.clonks) if (o.spec && o.spec !== 'medic' && !o.help) { keep.push(o); o.help = 1; } try { return _ra.call(this, s, ctrl); } finally { for (const o of keep) o.help = 0; } };
}
