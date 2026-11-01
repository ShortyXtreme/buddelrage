// BuddelRage – Nebel des Krieges für Infos: Was der Gegner tut, sieht man nur in Sichtweite eigener/verbündeter Buddler und Gebäude.
// Rein lokal (jeder Client filtert für sein Team aus dem Snapshot), Spiellogik und KI bleiben unberührt. Zuschauer sehen alles.
'use strict';
const FOG_R = { clonk: 250, base: 280, building: 100, other: 180, tower: 380, towerStep: 70, castle: 320, castleStep: 30 };
const FOG_EVERY = 10; // Sicht nur alle 10 Ticks neu berechnen
const FOG = { on: false, key: '', tick: -1e9, lastTick: 0, world: null, view: [], vc: new Set(), vv: new Set(), vs: new Set(), mem: new Map(), updates: 0 };
function fogActive(w) { w = w || G.world; return !!w && w === G.world && G.myTeam >= 0 && !G.spectate && w.teams.length > 1 && !!w.teams[G.myTeam]; }
function fogAlly(team, w) { w = w || G.world; return team === G.myTeam || (!!w && typeof w.ally === 'function' && team >= 0 && w.ally(team, G.myTeam)); }
// Infos (Statuszeile, Anzahl) über ein Team zeigen? Eigenes Team, Verbündete und Zuschauer: ja
function fogIntel(tid) { return !fogActive() || fogAlly(tid); }
// Sichtweite eines eigenen Gebäudes: Wachturm am weitesten (je Ausbaustufe mehr), Burg/Hütte mittel, Baustellen klein
function fogStructRange(s) {
  if (!(s.prog >= 1)) return FOG_R.building;
  if (s.type === 'tower') return FOG_R.tower + FOG_R.towerStep * towerLevel(s);
  if (s.type === 'castle') return FOG_R.castle + FOG_R.castleStep * castleLevel(s);
  return BUILD[s.type] && BUILD[s.type].base ? FOG_R.base : FOG_R.other;
}
function fogKey(w) { const c = w.cfg || {}; return [c.seed, w.W, w.H, c.mode, G.myTeam, (c.teams || []).map(t => t && t.name).join(',')].join('|'); }
function fogSeesPoint(x, y, extra) {
  if (!FOG.on) return true; const V = FOG.view, e = extra || 0;
  for (let i = 0; i < V.length; i += 3) { const dx = V[i] - x, dy = V[i + 1] - y, r = V[i + 2] + e; if (dx * dx + dy * dy <= r * r) return true; }
  return false;
}
const fogPX = (w, o) => w.remote && o.rx !== undefined ? o.rx : o.x, fogPY = (w, o) => w.remote && o.ry !== undefined ? o.ry : o.y;
function fogUpdate(force) {
  const w = G.world;
  if (!fogActive(w)) { FOG.on = false; return; }
  FOG.on = true;
  const key = fogKey(w);
  // neues Spiel → Erinnerung löschen; Host-Wechsel/Neuverbindung (gleiches Spiel, Tick läuft weiter) → Erinnerung bleibt
  if (key !== FOG.key || w.tick < FOG.lastTick - 600) { FOG.key = key; FOG.mem.clear(); FOG.world = null; FOG.tick = -1e9; }
  if (!force && FOG.world === w && w.tick >= FOG.tick && w.tick - FOG.tick < FOG_EVERY) return;
  FOG.world = w; FOG.tick = w.tick; FOG.lastTick = w.tick; FOG.updates++;
  const V = [];
  for (const c of w.clonks) if (c.act !== 'dead' && fogAlly(c.team, w)) V.push(fogPX(w, c), fogPY(w, c) - 6, FOG_R.clonk);
  for (const s of w.structs) if (!s.remove && fogAlly(s.team, w)) V.push(s.x, s.y - s.h / 2, fogStructRange(s));
  FOG.view = V; FOG.vc.clear(); FOG.vv.clear(); FOG.vs.clear();
  for (const c of w.clonks) if (c.act !== 'dead' && !fogAlly(c.team, w) && fogSeesPoint(fogPX(w, c), fogPY(w, c) - 6, 0)) FOG.vc.add(c.id);
  for (const v of w.vehicles) if (v.team >= 0 && !fogAlly(v.team, w) && fogSeesPoint(fogPX(w, v), fogPY(w, v) - 4, 0)) FOG.vv.add(v.id);
  const live = new Map();
  for (const s of w.structs) {
    if (fogAlly(s.team, w)) continue; live.set(s.id, s); if (s.remove) continue;
    if (fogSeesPoint(s.x, s.y - s.h / 2, Math.max(s.w, s.h) / 2)) { // gesehen: Stand merken (eingefroren, auch Mauern)
      FOG.vs.add(s.id); const m = Object.assign({}, s, { fogSeen: w.tick }); if (s.walls) m.walls = s.walls.map(q => Object.assign({}, q)); FOG.mem.set(s.id, m);
    }
  }
  // zerstörte/verschwundene Gebäude bleiben, bis man die Stelle wieder sieht
  for (const [id, m] of FOG.mem) { const s = live.get(id); if ((!s || s.remove) && fogSeesPoint(m.x, m.y - m.h / 2, 0)) FOG.mem.delete(id); }
}
function fogClonk(c) { return !FOG.on || fogAlly(c.team) || FOG.vc.has(c.id); }
function fogVehicle(v) { return !FOG.on || !(v.team >= 0) || fogAlly(v.team) || FOG.vv.has(v.id); }
function fogStructSeen(s) { return !FOG.on || fogAlly(s.team) || FOG.vs.has(s.id); }
// Gebäude für Karten: eigene/verbündete live, gegnerische live wenn gerade gesehen, sonst zuletzt bekannter Stand
function fogStructs(w) {
  if (!FOG.on || w !== G.world) return w.structs;
  const out = [];
  for (const s of w.structs) if (fogAlly(s.team, w) || (FOG.vs.has(s.id) && !s.remove)) out.push(s);
  for (const [id, m] of FOG.mem) if (!FOG.vs.has(id)) out.push(m);
  return out;
}
// gefilterte Sicht auf die Welt (nur zum Zeichnen; Methoden und übrige Felder kommen unverändert von der echten Welt)
function fogWorld(w) {
  if (!FOG.on || w !== G.world) return w;
  const f = Object.create(w); f.clonks = w.clonks.filter(fogClonk); f.vehicles = w.vehicles.filter(fogVehicle); f.structs = fogStructs(w); return f;
}
{
  const _draw = R.draw;
  R.draw = function (world, focus, myTeam, dt) { if (world === G.world) fogUpdate(); else if (!G.world) FOG.on = false; return _draw.call(this, world, focus, myTeam, dt); };
  const _mini = R.drawMinimap;
  R.drawMinimap = function (world, cx, cy, vw, vh, myTeam) { return _mini.call(this, FOG.on ? fogWorld(world === G.world ? world : G.world) : world, cx, cy, vw, vh, myTeam); };
  // Meldungen über gegnerische Verluste (Buddler gestorben, Gebäude/Fahrzeug zerstört) nur, wenn man es sehen konnte
  const _ev = handleEvents;
  handleEvents = function (evs) {
    if (fogActive()) { fogUpdate(); evs = evs.filter(e => !(e.e === 'msg' && e.at && !fogAlly(e.at.t) && !fogSeesPoint(e.at.x, e.at.y, 30))); }
    return _ev(evs);
  };
}
