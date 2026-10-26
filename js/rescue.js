// BuddelRage – Rettung festsitzender Buddler: ein KI-Teamkollege gräbt eine Rampe zum Eingeschlossenen.
// Erkennung: KI-Buddler über die bestehende Feststeck-Erkennung, Spieler-Buddler: unter der Erde, drückt Tasten, kommt aber nicht vom Fleck.
'use strict';
const RESCUE_SCAN = 30, RESCUE_PLAYER_T = 900, RESCUE_AI_T = 600, RESCUE_TIMEOUT = 2700;
Object.assign(World.prototype, {
  rescueTick() {
    if (this.tick % RESCUE_SCAN !== 0 || this.remote) return;
    for (const c of this.clonks) {
      if (c.act === 'dead') { c.help = 0; continue; }
      const t = this.teams[c.team]; if (!t) continue;
      const ctrl = !t.ai && t.sel === c.id; // vom Menschen gesteuert
      const under = c.y > this.surf[Math.max(0, Math.min(this.W - 1, Math.round(c.x)))] + 12;
      let stuck = false;
      if (ctrl) {
        const k = t.keys || {}, trying = k.l || k.r || k.u;
        const moved = c.stkX === undefined || Math.hypot(c.x - c.stkX, c.y - c.stkY) > 6;
        if (moved || c.inside) { c.stkX = c.x; c.stkY = c.y; c.stkT = 0; } else if (trying) c.stkT = (c.stkT || 0) + RESCUE_SCAN;
        stuck = under && c.stkT >= RESCUE_PLAYER_T && !c.inside;
      } else if (c.ai) {
        const A = c.ai; stuck = under && A.stuckOn && A.t - A.anchorT > RESCUE_AI_T && !c.inside;
      }
      if (!stuck) { if (c.help && !this.rescuerOf(c)) c.help = 0; continue; }
      if (!c.help) c.help = this.tick;
      if (!this.rescuerOf(c) && !((c.rescueCd || 0) > this.tick)) this.rescueAssign(c, ctrl);
    }
  },
  rescuerOf(s) { const r = s.rescuer && this.clonks.find(o => o.id === s.rescuer && o.act !== 'dead'); return r && r.ai && r.ai.task && r.ai.task.type === 'rescue' && r.ai.task.id === s.id ? r : null; },
  rescueAssign(s, ctrl) {
    let best = null, bd = 520;
    for (const o of this.clonks) {
      if (o === s || o.act === 'dead' || o.inside || !this.ally(o.team, s.team)) continue;
      const ot = this.teams[o.team]; if (!ot || (!ot.ai && !ot.helper) || (!ot.ai && ot.sel === o.id)) continue; // nur KI-gesteuerte Teamkollegen
      if (o.help) continue; // selbst eingeschlossen
      const T = o.ai && o.ai.task; if (T && (T.type === 'fight' || T.type === 'attack' || T.type === 'heal' || T.type === 'rescue' || T.type === 'flee' || T.type === 'tower' || T.type === 'gun')) continue;
      if (this.clonks.some(x => x.rescuer === o.id && x !== s && x.help)) continue; // rettet schon jemanden
      const d = Math.abs(o.x - s.x) + Math.abs(o.y - s.y) * 0.5; if (d < bd) { bd = d; best = o; }
    }
    if (!best) {
      if (ctrl && !s.helpMsg) { s.helpMsg = 1; this.msg(s.name + ' steckt fest – kein Helfer frei. Halte ' + 'N' + ' für den Notausgang.', s.team); }
      return;
    }
    const A = this.aiAgent(best);
    if (A.task && A.task.item && this.teams[best.team].brain) this.teams[best.team].brain.itemClaims.delete(A.task.item);
    A.task = { type: 'rescue', id: s.id, s: 2, until: A.t + RESCUE_TIMEOUT, ph: 'go' }; A.path = null; A.nextThink = A.t + RESCUE_TIMEOUT;
    s.rescuer = best.id; s.helpMsg = 1;
    if (s.lastRescuer !== best.id) { // nicht bei jeder Neuzuweisung erneut melden
      this.msg(s.name + ' steckt fest – ' + best.name + ' kommt und gräbt einen Ausweg.', s.team);
      if (s.team !== best.team) this.msg(best.name + ' hilft ' + s.name + ' aus der Grube.', best.team);
    }
    s.lastRescuer = best.id;
  },
  // Aufgabe des Retters: zum Einstieg an der Oberfläche gehen, dann eine schräge Rampe zum Eingeschlossenen graben
  aiRescue(c, A, k) {
    const T = A.task, s = this.clonks.find(o => o.id === T.id);
    const done = why => { if (s) { s.rescuer = 0; if (why === 'ok') { s.lastRescuer = 0; s.help = 0; s.stkT = 0; s.helpMsg = 0; if (s.ai) { s.ai.anchorT = s.ai.t; s.ai.stuckOn = false; s.ai.path = null; } } } if (c.act === 'dig') c.act = 'walk'; c.digHold = 0; A.task = null; A.nextThink = A.t; };
    if (!s || s.act === 'dead') return done('gone');
    if (!s.help) return done('ok'); // kam selbst frei
    const dist = Math.hypot(s.x - c.x, s.y - c.y);
    if (dist < 11 || (T.ph === 'dig' && Math.abs(s.x - c.x) < 14 && Math.abs(s.y - c.y) < 12)) { // Durchbruch
      this.msg('Ausweg für ' + s.name + ' gegraben!', s.team); s.help = 0;
      return done('ok');
    }
    if (A.t > T.until) { // Zeit abgelaufen: KI-Buddler nimmt den Notausgang
      const st = this.teams[s.team];
      if (s.ai && st && (st.ai || (st.helper && st.sel !== s.id)) && this.escapeCheck(s) === '') { this.escape(s); this.msg(s.name + ' nimmt den Notausgang.', s.team); }
      else this.msg('Rettung von ' + s.name + ' gescheitert – Notausgang (N) hilft.', s.team);
      s.rescueCd = this.tick + 3000; s.lastRescuer = 0;
      return done('fail');
    }
    if (T.ph === 'go') {
      if (T.ex === undefined) {
        const sx = Math.round(s.x), depth = Math.max(0, s.y - this.surf[Math.max(0, Math.min(this.W - 1, sx))]);
        const dx = Math.max(24, Math.min(170, depth * 1.45)); let side = Math.sign(c.x - s.x) || 1;
        let ex = Math.round(s.x + side * dx); if (ex < 8 || ex > this.W - 8) { side = -side; ex = Math.round(s.x + side * dx); }
        T.ex = Math.max(8, Math.min(this.W - 8, ex)); T.ey = this.surf[T.ex] - 1;
        if (c.y > this.surf[Math.round(c.x)] + 12 && Math.abs(c.y - s.y) < 40 && Math.abs(c.x - s.x) < 160) { T.ex = Math.round(c.x); T.ey = Math.round(c.y); } // schon unten in der Nähe: direkt hingraben
      }
      const there = Math.abs(c.x - T.ex) < 8 && Math.abs(c.y - T.ey) < 14;
      if (there || this.aiGoto(c, A, k, T.ex, T.ey, 6) || (A.t - (T.t0 || (T.t0 = A.t)) > 900)) { T.ph = 'dig'; T.dt = A.t; }
      return;
    }
    if (T.ph === 'path') { // Wegsuche (gräbt Treppen/Rampen um harten Fels herum) bis kurz vor den Eingeschlossenen
      if (this.aiGoto(c, A, k, s.x, s.y, 5) || A.t - T.pt0 > 900) { T.ph = 'dig'; T.dt = A.t; T.lx = c.x; T.ly = c.y; }
      return;
    }
    // Graben: Richtung Eingeschlossener zielen (ergibt eine begehbare Rampe)
    if (c.act === 'walk' || c.act === 'fight') { c.dir = Math.sign(s.x - c.x) || c.dir; c.act = 'dig'; c.digIdle = 0; c.vx = 0; }
    if (c.act === 'dig') { // schräg nach unten graben (begehbare Rampe, max. ~45°), Richtung Eingeschlossener
      const dx = s.x - c.x, dy = (s.y - 5) - (c.y - 5); if (Math.abs(dx) > 1) c.dir = Math.sign(dx);
      c.digIdle = 0; c.digA = (T.biasT || 0) > A.t ? T.bias : Math.max(-1.1, Math.min(1.1, Math.atan2(dy, Math.max(1.5, Math.abs(dx))))); A.moving = true;
      // Körper passt nicht durch den Gang (Kante an Kopf/Füßen): Gang an der Vorderkante auf volle Höhe erweitern
      if (A.t % 20 === 0) { if (T.sx !== undefined && Math.hypot(c.x - T.sx, c.y - T.sy) < 0.6) {
        const fx = c.x + c.dir * 4; this.digCircle(fx, c.y - 3, 4.6, c); this.digCircle(fx, c.y - 8, 4.6, c);
        // harter Fels an Kopf oder Füßen: darunter bzw. darüber vorbeigraben
        let up = 0, lo = 0; const xi = Math.round(c.x + c.dir * 0.6), yi = Math.round(c.y);
        for (let yy = yi - 10; yy <= yi; yy++) for (let xx = xi - 3; xx <= xi + 3; xx++) if (SOLID[this.matAt(xx, yy)] && !DIGGABLE[this.matAt(xx, yy)]) { if (yy < yi - 5) up++; else lo++; }
        if (up || lo) { T.bias = up >= lo ? 1.35 : -1.0; T.biasT = A.t + (up >= lo ? 24 : 30); }
      } T.sx = c.x; T.sy = c.y; }
    }
    else if (c.act === 'jump' || c.act === 'tumble') { }
    else if (c.act === 'climb' || c.act === 'hangle' || c.act === 'swim') { this.aiGoto(c, A, k, s.x, s.y, 4); }
    if (A.t - T.dt > 240 && Math.hypot(c.x - (T.lx || 0), c.y - (T.ly || 0)) < 3) { T.ph = 'path'; T.pt0 = A.t; A.path = null; if (c.act === 'dig') c.act = 'walk'; } // Grabung hängt (harter Fels): Wegsuche gräbt außen herum
    if (A.t % 60 === 0) { T.lx = c.x; T.ly = c.y; }
  },
});
