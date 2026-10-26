// BuddelRage – KI-Verteidigung: Bedrohungen erkennen (Angreifer auf eigene Buddler, Gegner an Hütte/Burg/Turm),
// Verteidiger zuteilen (Rollenwechsel), sammeln statt allein kämpfen, Fokusfeuer, Schild, Rückzug zum Heilen,
// Türme/Burg als Schussposten, Basiswache beim Angriff, Konter nach abgewehrtem Überfall. Stufe skaliert alles.
'use strict';
const AI_DEF = {
  easy: { r: 170, need: 1.0, share: 0.34, group: 0, retreat: 0, focus: 0, counter: 0, guards: 0, hitMem: 120, block: 0, post: 0, buy: 0, shelter: 0, leash: 0, armedOnly: 0 },
  normal: { r: 240, need: 1.7, share: 0.8, group: 2, retreat: 0, focus: 0.65, counter: 1, guards: 1, hitMem: 300, block: 0.45, post: 1, buy: 1, shelter: 1, leash: 170, armedOnly: 1 },
  hard: { r: 300, need: 2.2, share: 1.0, group: 2, retreat: 35, focus: 1, counter: 1, guards: 1, hitMem: 420, block: 0.85, post: 1, buy: 1, shelter: 1, leash: 210, armedOnly: 1 },
};
function aiDefP(D) { return AI_DEF[D && D.k] || AI_DEF.normal; }
(function () {
  const P0 = World.prototype;
  const _plan = P0.aiPlan, _decide = P0.aiDecide, _exec = P0.aiExec, _protect = P0.aiProtect, _inside = P0.aiInside;
  Object.assign(P0, {
    aiThreatVal(e) { return (0.45 + Math.max(0, e.hp) / 100) * (e.knight ? 2 : 1) * (this.aiArmed(e) ? 1.35 : 0.6) * (e.armor ? 1.2 : 1); },
    aiDefPosts(tid) { return this.structs.filter(s => this.ally(s.team, tid) && (s.type === 'tower' || s.type === 'castle') && s.prog >= 1 && !s.remove); },
    aiPlan(t, B, D, helper) {
      _plan.call(this, t, B, D, helper);
      this.aiDefPlan(t, B, D, helper);
    },
    aiDefPlan(t, B, D, helper) {
      const P = aiDefP(D), tick = this.tick;
      const own = this.clonks.filter(c => c.team === t.id && c.act !== 'dead');
      const defS = this.aiAllyBases(t.id).concat(this.aiDefPosts(t.id).filter(s => !BUILD[s.type].base));
      const th = new Set((B.threat || []).filter(e => e.act !== 'dead'));
      if (defS.length) for (const e of this.clonks) {
        if (e.act === 'dead' || e.inside || this.ally(e.team, t.id) || (this.teams[e.team] || {}).elim) continue;
        if (defS.some(s => { const dx = Math.abs(e.x - s.x), dy = Math.abs(e.y - s.y); return dy < 130 && (dx < 90 || (dx < P.r && (e.knight || this.aiArmed(e)))); })) th.add(e);
      }
      // wer gerade eigene/verbündete Buddler oder Gebäude angreift, ist eine Bedrohung (im erweiterten Basisumkreis)
      for (const v of this.clonks) {
        if (v.act === 'dead' || !this.ally(v.team, t.id) || !v.hitBy || tick - v.hitBy.t > P.hitMem) continue;
        const e = this.clonks.find(o => o.id === v.hitBy.id);
        if (e && e.act !== 'dead' && !e.inside && !this.ally(e.team, t.id) && Math.hypot(e.x - v.x, e.y - v.y) < 300 && defS.some(s => Math.abs(e.x - s.x) < P.r + 80 && Math.abs(e.y - s.y) < 160)) th.add(e); // nur in Basisnähe – sonst wehrt sich der Buddler selbst (nicht alle hinterherlaufen)
      }
      for (const s of defS) if (s.hitBy && tick - s.hitBy.t < P.hitMem) { const e = this.clonks.find(o => o.id === s.hitBy.id); if (e && e.act !== 'dead' && !e.inside && !this.ally(e.team, t.id)) th.add(e); }
      B.threat = [...th]; B.defend = B.threat.length > 0;
      B.threatS = B.threat.reduce((a, e) => a + this.aiThreatVal(e), 0);
      if (B.defend) { B.lastDefT = tick; B.lastFoe = B.threat[0].team; B.raidKill = B.raidKill || 0; }
      // Fokusziel: schwächster/nächster Angreifer an der Basis, bleibt bis er fällt
      const home = defS[0];
      const fv = e => e.hp * 0.7 + (home ? Math.min(400, Math.abs(e.x - home.x)) * 0.25 : 0);
      if (!B.focus || B.focus.act === 'dead' || !th.has(B.focus)) B.focus = B.threat.length ? B.threat.reduce((a, e) => (fv(e) < fv(a) ? e : a)) : null;
      B.defenders = new Set(); B.guardId = 0;
      if (helper) return;
      if (B.defend) {
        // Verteidiger zuteilen: genug Kampfkraft gegen die Bedrohung, bewaffnete/gesunde zuerst, Rest arbeitet weiter
        const cap = Math.max(1, Math.round(own.length * P.share));
        let need = Math.min(cap, Math.max(1, Math.ceil(B.threatS * P.need)));
        const cx = B.threat.reduce((a, e) => a + e.x, 0) / B.threat.length;
        const sc = c => (c.knight ? 3 : 0) + (this.aiArmedEnough(c) ? 2 : 0) + (hasG(c, 'shield') ? 0.5 : 0) + c.hp / 60 - Math.abs(c.x - cx) / 300 - (B.roles.get(c.id) === 'builder' ? 1.5 : 0);
        const cand = own.filter(c => !c.inside || (this.structById(c.inside) || {}).type !== 'hut' || c.hp > 50).sort((a, b) => sc(b) - sc(a));
        const canArm = t.res.weapons && t.money >= 15;
        let armBudget = Math.floor(t.money / 20);
        for (const c of cand) {
          if (need <= 0) break; if (P.retreat && c.hp < P.retreat) continue;
          const armed = c.knight || this.aiArmedEnough(c);
          if (P.armedOnly && !armed) { if (!canArm || armBudget <= 0 || !home || Math.abs(c.x - home.x) > 260) continue; armBudget--; }
          B.defenders.add(c.id); B.roles.set(c.id, 'defender'); need--;
        }
        // Unbewaffnete in Gefahr: in Hütte/Burg Schutz suchen (Mittel/Schwer), statt mit Fäusten gegen Ritter zu kämpfen
        if (P.shelter && home) for (const c of own) {
          if (B.defenders.has(c.id) || c.knight || this.aiArmedEnough(c)) continue;
          const dz = Math.min(...B.threat.map(e => Math.hypot(e.x - c.x, (e.y - c.y) * 1.5)));
          if (dz < 170 && Math.abs(c.x - home.x) < 320 && Math.abs(c.y - home.y) < 90) B.roles.set(c.id, 'shelter');
        }
        B.rally = home ? { x: Math.round(home.x + (Math.sign(cx - home.x) || 1) * 26), y: home.y } : null;
        // Notkauf (Mittel/Schwer): bei Übermacht einen Ritter bzw. Buddler nachkaufen
        if (P.buy && (B.emBuy || 0) < tick && home) {
          let myS = 0; for (const id of B.defenders) { const c = own.find(o => o.id === id); if (c) myS += this.aiThreatVal(c); }
          const Pl = this.poolOf && this.poolOf(t.id), lead = !Pl || Pl.members.find(id => this.teams[id].ai && !this.teams[id].elim) === t.id;
          if (lead && myS < B.threatS * 1.2 && own.length < D.maxClonks + 2) {
            if (t.res.knight && t.money >= PRICE_KNIGHT) { if (this.aiBuy(t, null, 'knight')) this.msg('KI ' + t.name + ' ruft einen Ritter zur Verteidigung.', t.id); }
            else if (t.money >= PRICE_CLONK + 15 && own.length < 3) this.aiBuy(t, null, 'clonk');
            B.emBuy = tick + 60 * 12;
          }
        }
      } else {
        // Konter: kurz nach einem abgewehrten Überfall angreifen, wenn man stark genug ist
        if (P.counter && B.lastDefT && tick - B.lastDefT < 60 * 25 && !B.attack && B.lastFoe !== undefined) {
          const foe = this.teams[B.lastFoe];
          if (foe && !foe.elim && !this.ally(foe.id, t.id)) {
            const my = this.aiStrength(t.id), fs = this.aiStrength(foe.id);
            const armed = own.filter(c => c.knight || this.aiArmedEnough(c)).length;
            if (my > fs * (D.k === 'hard' ? 0.85 : 1.1) && armed >= 2) { B.attack = true; B.target = foe.id; B.counterT = tick; for (const c of own) if (this.aiArmedEnough(c) && B.roles.get(c.id) === 'miner' && armed > 2) { B.roles.set(c.id, 'fighter'); break; } }
          }
        }
        if (B.counterT && B.attack && tick - B.counterT > 60 * 90) { B.counterT = 0; }
      }
      // Basis nie leer lassen: beim Angriff bleibt eine Wache zu Hause (Mittel/Schwer)
      if (B.attack && P.guards && home) {
        const fs = own.filter(c => B.roles.get(c.id) === 'fighter');
        if (fs.length >= 2) { let g = null, bd = 1e9; for (const c of fs) { const d = Math.abs(c.x - home.x); if (d < bd) { bd = d; g = c; } } if (g) { B.guardId = g.id; B.roles.set(g.id, 'guard'); } }
      }
    },
    aiDecide(c, t, B, D, A, helper) {
      _decide.call(this, c, t, B, D, A, helper);
      this.aiDefAdjust(c, t, B, D, A, helper);
    },
    aiDefAdjust(c, t, B, D, A, helper) {
      const P = aiDefP(D), T = A.task, role = B.roles.get(c.id), home = this.aiHome(c);
      const set = task => { if (A.task && A.task.item) B.itemClaims.delete(A.task.item); A.task = task; A.path = null; };
      const keep = T && (T.type === 'heal' || T.type === 'flee' || T.type === 'rescue' || T.type === 'wander' || (T.type === 'fight' && T.animal) || T.type === 'gun');
      // Rückzug: angeschlagen im Kampf → zur Hütte/Burg heilen
      const tg0 = T && T.target && T.target.hp !== undefined ? T.target : null;
      if (P.retreat && home && c.hp < P.retreat && T && (T.type === 'fight' || T.type === 'attack' || T.type === 'guard' || T.type === 'rally') && !T.animal && Math.abs(home.x - c.x) < 700 && (!tg0 || tg0.hp > c.hp * 1.5 + 10)) { /* nur wenn das Duell verloren geht */ set({ type: 'heal', s: 1.05, retreat: 1 }); return; }
      if (helper) return;
      if (role === 'shelter' && B.defend && home && !keep) { set({ type: 'heal', s: 1.0, shelter: 1 }); return; }
      // Unbewaffnet gegen bewaffneten Gegner (Mittel/Schwer): nicht mit Fäusten angreifen – Schutz suchen oder ausweichen
      if (P.shelter && T && T.type === 'fight' && !T.animal && T.target && T.target.team !== undefined && !c.knight && !this.aiArmedEnough(c) && (T.target.knight || this.aiArmed(T.target))) {
        if (home && Math.abs(home.y - c.y) < 60 && Math.abs(home.x - c.x) < 320) { set({ type: 'heal', s: 1.0, shelter: 1 }); return; }
        const dir = Math.sign(c.x - T.target.x) || 1; set({ type: 'flee', x: Math.round(c.x + dir * 120), y: c.y, until: A.t + 240, why: 'foe' }); return;
      }
      if (role === 'guard' && T && T.type === 'attack') { set({ type: 'guard', s: 0.6 }); return; }
      if (!B.defend || role !== 'defender' || keep) return;
      if (T && T.type === 'tower' && this.structById(T.sid)) return;
      // Ziel: Fokus (mit Stufen-Wahrscheinlichkeit), sonst nächster Angreifer
      const near = B.threat.filter(e => e.act !== 'dead' && !e.inside && !(B.unreach && (B.unreach.get(e.id) || 0) > this.tick));
      if (!near.length) return;
      let tgt = B.focus && near.includes(B.focus) && this.rand() < P.focus ? B.focus : this.aiPick(c, near);
      if (!tgt) return;
      // unbewaffnet, aber Geld und Hütte nah: erst ausrüsten
      if (!this.aiArmedEnough(c) && !c.knight && home && t.res.weapons && t.money >= 15 && Math.abs(home.x - c.x) < 260 && (A.armT || 0) < A.t) { A.armT = A.t + 900; set({ type: 'arm', s: 0.95 }); return; }
      // Fernkämpfer besetzen Turm/Burg nahe der Bedrohung
      if (P.post && hasG(c, 'bow') && c.arrows > 2 && !hasG(c, 'sword')) {
        const busy = id => this.clonks.some(o => o !== c && o.inside === id);
        const post = this.aiDefPosts(t.id).find(s => Math.abs(s.x - tgt.x) < 200 && Math.abs(s.x - c.x) < 260 && Math.abs(s.y - c.y) < 40 && !busy(s.id));
        if (post) { set({ type: 'tower', sid: post.id, s: 0.95, until: A.t + 1500 }); return; }
      }
      // sammeln: nicht allein in eine Übermacht laufen
      if (P.group && B.rally && B.defenders.size >= 2 && B.threat.length >= 2) {
        const mates = this.clonks.filter(o => o !== c && B.defenders.has(o.id) && o.act !== 'dead' && Math.hypot(o.x - c.x, o.y - c.y) < 70).length;
        const dT = Math.hypot(tgt.x - c.x, tgt.y - c.y), tHome = home ? Math.abs(tgt.x - home.x) : 0;
        if (mates + 1 < P.group && dT > 80 && tHome > 50 && (A.rallyCd || 0) < A.t) { A.rallyCd = A.t + 600; set({ type: 'rally', s: 0.94, until: A.t + 240 }); return; }
      }
      if (T && T.type === 'fight' && T.target === tgt) { T.defend = 1; return; }
      set({ type: 'fight', target: tgt, defend: 1, s: 0.93 });
    },
    aiExec(c, t, B, D, A, helper, k) {
      const T = A.task;
      if (T && T.type === 'rally') {
        const R = B.rally; if (!R || !B.defend) { A.task = null; return; }
        this.aiStat0(c, 'sammelt sich');
        this.aiGoto(c, A, k, R.x + ((c.id % 3) - 1) * 8, R.y, 8); if (A.arrived && c.act === 'dig') c.act = 'walk';
        const g = this.clonks.filter(o => B.defenders.has(o.id) && o.act !== 'dead' && Math.hypot(o.x - R.x, o.y - R.y) < 50).length;
        const e = this.aiNearestFoe(c, 80, false);
        if (g >= aiDefP(D).group || e || A.t > T.until) { A.task = e ? { type: 'fight', target: e, defend: 1, s: 0.93 } : null; A.path = null; }
        return;
      }
      if (T && T.type === 'fight' && !T.animal && T.target && T.target.team !== undefined) {
        const P = aiDefP(D), tg = T.target, home = this.aiHome(c);
        if (tg.act === 'dead' || tg.remove) { A.task = null; return; }
        // nicht erreichbar (z. B. unter der Erde): nach 8 s ohne Annäherung aufgeben
        const d = Math.hypot(tg.x - c.x, tg.y - c.y);
        if (T.bestD === undefined || d < T.bestD - 4) { T.bestD = d; T.bestT = A.t; }
        else if (A.t - T.bestT > 480 && d > 30) { (B.unreach || (B.unreach = new Map())).set(tg.id, this.tick + 900); A.task = null; return; }
        // Leine: nicht weit aus der Basis locken lassen – zurück zum Sammelpunkt, von dort Fernkampf
        if (T.defend && P.leash && home && Math.abs(tg.x - home.x) > P.leash && Math.abs(c.x - home.x) > P.leash - 40) {
          const R = B.rally || home;
          this.aiGoto(c, A, k, R.x + ((c.id % 3) - 1) * 8, R.y, 10); if (A.arrived && c.act === 'dig') c.act = 'walk';
          if ((hasG(c, 'bow') && c.arrows > 0 || c.inv.some(x => THROWABLE.has(x))) && Math.abs(tg.x - c.x) < 200 && c.cd <= 0 && (c.act === 'walk' || c.act === 'fight') && A.t >= A.react) { A.react = A.t + D.react; if (this.rand() < D.throwP) this.aiRanged(c, tg, D, false); }
          return;
        }
      }
      if (T && T.type === 'heal' && T.retreat && hasG(c, 'shield')) { // Rückzug mit Schild: Rücken decken
        const e = this.aiNearestFoe(c, 40, false); if (e && e.swing > 0 && this.rand() < aiDefP(D).block) { A.blockT = 8; A.blockDir = Math.sign(e.x - c.x) || c.dir; }
      }
      return _exec.call(this, c, t, B, D, A, helper, k);
    },
    aiInside(c, t, B, D, A, helper) {
      const T = A.task;
      if (T && T.type === 'heal' && (T.shelter || T.retreat)) {
        if (golds(c)) this.aiSell(c);
        const home = this.structById(c.inside), danger = home && B.defend && B.threat.some(e => e.act !== 'dead' && Math.abs(e.x - home.x) < 200 && Math.abs(e.y - home.y) < 100);
        if (T.shelter) { if (!danger || (this.aiArmedEnough(c) && c.hp > 70)) { this.leave(c); A.task = null; } return; }
        if (c.hp < 92 && !(danger && c.hp > 65 && (this.aiArmed(c) || c.knight))) return; // Rückzug: heilen, bei Gefahr ab 65 % bewaffnet zurück in den Kampf
        this.leave(c); A.task = null; return;
      }
      return _inside.call(this, c, t, B, D, A, helper);
    },
    // Schild im Nahkampf (Mittel/Schwer): decken, solange das eigene Schwert nachlädt – Treffer kommen sofort beim Schlag, Reagieren auf das Ausholen ist zu spät
    aiProtect(c, t, D, A, k) {
      const r = _protect.call(this, c, t, D, A, k), P = aiDefP(D);
      if (!P.block || !hasG(c, 'shield') || (c.act !== 'walk' && c.act !== 'fight')) return r;
      let e = null;
      for (const o of this.clonks) { if (o.act === 'dead' || o.inside || this.ally(o.team, c.team) || !hasG(o, 'sword')) continue; if (Math.abs(o.x - c.x) < 18 && Math.abs(o.y - c.y) < 10) { e = o; break; } }
      if (!e) return r;
      if (!A.mcyc || A.mcyc.t < A.t) A.mcyc = { t: A.t + 90, on: this.rand() < P.block };
      if (A.mcyc.on && (c.cd > 2 || !hasG(c, 'sword'))) { k.b = 1; c.dir = Math.sign(e.x - c.x) || c.dir; }
      return r;
    },
  });
})();
