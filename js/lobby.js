// BuddelRage – Mehrspieler-Team-Lobby: Teams (Name/Farbe), Spieler wählen ihr Team selbst, Host fügt KI pro Team hinzu.
// Der Host hält den Lobby-Zustand (LB) und schickt ihn an alle ({t:'lobby'}); Clients senden nur ihren Teamwunsch ({t:'lteam'}).
'use strict';
const LOBBY_MAX_TEAMS = 6, LOBBY_MAX_UNITS = 9, LOBBY_MAX_AI = 8;
const COLOR_NAMES = ['Blau', 'Rot', 'Grün', 'Gelb', 'Lila', 'Türkis'];
let LB = null; // nur beim Host maßgeblich; Clients: net.lobby
function lbDefault() {
  let d = 'normal'; try { const s = JSON.parse(localStorage.getItem('br_lobbydiffs') || '[]'); if (AI_DIFF[s[0]]) d = s[0]; } catch (e) {}
  return { teams: [{ name: 'Team Blau', ci: 0, ai: [] }, { name: 'Team Rot', ci: 1, ai: [{ id: 1, diff: d }] }], seat: {}, nextAi: 2 };
}
function lbHumans(L, ti) { return net.players.filter(p => L.seat[p.id] === ti); }
function lbUnits(L) { return net.players.length + L.teams.reduce((n, t) => n + t.ai.length, 0); }
function lbAiCount(L) { return L.teams.reduce((n, t) => n + t.ai.length, 0); }
// Neue Spieler: Team mit den wenigsten Spielern (bei Gleichstand das mit den wenigsten Mitgliedern)
function lbAutoSeat(L) {
  const ids = new Set(net.players.map(p => p.id));
  for (const k of Object.keys(L.seat)) if (!ids.has(+k) || L.seat[k] >= L.teams.length) delete L.seat[k];
  for (const p of net.players) if (L.seat[p.id] === undefined) {
    let best = 0, bs = 1e9;
    L.teams.forEach((t, i) => { const h = lbHumans(L, i).length, s = h * 100 + h + t.ai.length; if (s < bs) { bs = s; best = i; } });
    L.seat[p.id] = best;
  }
}
function lbMsg(s, bad) { const e = $('lobbymsg'); if (!e) return; e.textContent = s || ''; e.className = 'lobbymsg' + (bad ? ' bad' : ''); }
// Host: Zustand prüfen, an alle senden, neu zeichnen
function lobbySync() {
  if (!net.host) return; if (!LB) LB = lbDefault();
  lbAutoSeat(LB); net.lobby = LB;
  netSend({ t: 'lobby', L: LB });
  renderLobbyTeams();
}
// Aktionen (Host direkt; Clients nur „Beitreten“ über das Netz)
function lobbyAct(a, ti, arg) {
  if (!net.host) { if (a === 'join') netSend({ t: 'lteam', team: ti }); return; }
  const L = LB, T = L.teams[ti]; lbMsg('');
  switch (a) {
    case 'join': if (T) L.seat[net.id] = ti; break;
    case 'move': if (L.teams[arg]) L.seat[ti] = arg; break; // ti = Spieler-ID
    case 'addai':
      if (!T) break;
      if (lbAiCount(L) >= LOBBY_MAX_AI) { lbMsg('Höchstens ' + LOBBY_MAX_AI + ' KI-Spieler.', true); break; }
      if (lbUnits(L) >= LOBBY_MAX_UNITS) { lbMsg('Höchstens ' + LOBBY_MAX_UNITS + ' Teilnehmer insgesamt (Spieler + KI).', true); break; }
      T.ai.push({ id: L.nextAi++, diff: AI_DIFF[arg] ? arg : 'normal' }); break;
    case 'delai': if (T) T.ai = T.ai.filter(x => x.id !== arg); break;
    case 'aidiff': if (T) { const x = T.ai.find(x => x.id === arg.id); if (x && AI_DIFF[arg.d]) x.diff = arg.d; } break;
    case 'name': if (T) T.name = cleanName(String(arg || ''), 'Team ' + COLOR_NAMES[T.ci]); break;
    case 'color': if (T && arg >= 0 && arg < TEAM_COLORS.length) { const o = L.teams.find(t => t !== T && t.ci === arg); if (o) o.ci = T.ci; T.ci = arg; } break;
    case 'addteam':
      if (L.teams.length >= LOBBY_MAX_TEAMS) { lbMsg('Höchstens ' + LOBBY_MAX_TEAMS + ' Teams.', true); break; }
      { const used = new Set(L.teams.map(t => t.ci)); let ci = 0; while (used.has(ci)) ci++; L.teams.push({ name: 'Team ' + COLOR_NAMES[ci], ci, ai: [] }); } break;
    case 'delteam': {
      if (L.teams.length <= 2) { lbMsg('Mindestens 2 Teams.', true); break; }
      const k = L.teams.length - 1; L.teams[0].ai.push(...L.teams[k].ai.splice(0)); // KI und Spieler des letzten Teams wandern in Team 1
      for (const id of Object.keys(L.seat)) if (L.seat[id] === k) L.seat[id] = 0;
      L.teams.pop(); break;
    }
    case 'coop': { // Freunde gegen KI: alle Spieler in Team 1, gewählte Anzahl KI in Team 2
      const n = Math.max(1, Math.min(LOBBY_MAX_UNITS - net.players.length, arg.n | 0)), d = AI_DIFF[arg.d] ? arg.d : 'normal';
      const t0 = L.teams[0], t1 = L.teams[1];
      L.teams = [{ name: t0.name, ci: t0.ci, ai: [] }, { name: t1.name, ci: t1.ci, ai: [] }];
      for (let k = 0; k < n; k++) L.teams[1].ai.push({ id: L.nextAi++, diff: d });
      for (const p of net.players) L.seat[p.id] = 0;
      lbMsg('Freunde gegen KI: alle Spieler in ' + t0.name + ', ' + n + ' KI (' + aiDiffName(d) + ') in ' + t1.name + '.'); break;
    }
    case 'ffa': { // Jeder gegen jeden: ein Team pro Spieler
      const n = Math.max(2, Math.min(LOBBY_MAX_TEAMS, net.players.length));
      L.teams = Array.from({ length: n }, (_, i) => ({ name: 'Team ' + COLOR_NAMES[i], ci: i, ai: [] }));
      net.players.slice(0, n).forEach((p, i) => { L.seat[p.id] = i; });
      net.players.slice(n).forEach((p, i) => { L.seat[p.id] = i % n; });
      if (net.players.length < 2) L.teams[1].ai.push({ id: L.nextAi++, diff: 'normal' });
      break;
    }
  }
  lobbySync();
}
// Host: Teamwunsch eines Clients
function lobbyJoinIn(from, ti) {
  if (!net.host || !LB || G.world) return;
  if (!Number.isInteger(ti) || !LB.teams[ti] || !net.players.some(p => p.id === from)) return;
  LB.seat[from] = ti; lobbySync();
}
function renderLobbyTeams() {
  const box = $('lobbyteams'); if (!box) return;
  const L = net.lobby; if (!L) { box.innerHTML = '<div class="muted small">Warte auf Lobby-Daten…</div>'; return; }
  const host = net.host, act = document.activeElement, focusTi = act && act.dataset && act.dataset.name !== undefined ? +act.dataset.name : -1, selS = act ? act.selectionStart : 0;
  const diffOpts = v => AI_LEVELS.map(l => '<option value="' + l + '"' + (l === v ? ' selected' : '') + '>' + aiDiffName(l) + '</option>').join('');
  box.innerHTML = L.teams.map((T, ti) => {
    const col = TEAM_COLORS[T.ci % TEAM_COLORS.length], hum = net.players.filter(p => L.seat[p.id] === ti), mine = L.seat[net.id] === ti;
    let h = '<div class="lteam' + (mine ? ' mine' : '') + '" style="--tc:' + col + '" data-ti="' + ti + '"><div class="lthead"><i style="background:' + col + '"></i>';
    if (host) h += '<input class="ltname" data-name="' + ti + '" maxlength="16" value="' + escapeHtml(T.name) + '">' + '<span class="ltsws" role="radiogroup" aria-label="Teamfarbe">' + COLOR_NAMES.map((n, i) => '<button type="button" class="ltsw' + (i === T.ci ? ' on' : '') + '" data-ti="' + ti + '" data-ci="' + i + '" style="--sw:' + TEAM_COLORS[i] + '" title="' + n + '" aria-label="Farbe ' + n + '" aria-checked="' + (i === T.ci) + '" role="radio"></button>').join('') + '</span>';
    else h += '<b>' + escapeHtml(T.name) + '</b>';
    h += '<span class="ltcount">' + (hum.length + T.ai.length) + '</span></div><ul class="ltmem">';
    for (const p of hum) {
      h += '<li><span>👤 ' + escapeHtml(p.name) + '</span><small>' + (p.id === net.hostId ? 'Host' : '') + (p.id === net.id ? (p.id === net.hostId ? ' · ' : '') + 'du' : '') + '</small>';
      if (host && L.teams.length > 1) h += '<select class="ltmove" data-pid="' + p.id + '" title="In anderes Team verschieben">' + L.teams.map((t2, k) => '<option value="' + k + '"' + (k === ti ? ' selected' : '') + '>' + (k === ti ? '↔ verschieben' : '→ ' + escapeHtml(t2.name)) + '</option>').join('') + '</select>';
      h += '</li>';
    }
    for (const x of T.ai) {
      h += '<li class="ai"><span>🤖 KI</span>' + (host ? '<span class="ltdiffs" role="radiogroup" aria-label="KI-Stufe">' + AI_LEVELS.map(l => '<button type="button" class="ltd c-' + (DIFF_META[l] || {}).cls + (l === x.diff ? ' on' : '') + '" data-ti="' + ti + '" data-ai="' + x.id + '" data-d="' + l + '" title="' + aiDiffName(l) + ' – ' + ((DIFF_META[l] || {}).d || '') + '" aria-checked="' + (l === x.diff) + '" role="radio">' + ((DIFF_META[l] || {}).ic || '') + '<b>' + aiDiffName(l) + '</b></button>').join('') + '</span><button class="btn sm ghost ltdel" data-ti="' + ti + '" data-ai="' + x.id + '" title="KI entfernen">✕</button>' : '<small class="ltdtag c-' + (DIFF_META[x.diff] || {}).cls + '">' + ((DIFF_META[x.diff] || {}).ic || '') + ' ' + aiDiffName(x.diff) + '</small>') + '</li>';
    }
    if (!hum.length && !T.ai.length) h += '<li class="empty muted">leer</li>';
    h += '</ul><div class="ltfoot">' + (mine ? '<span class="muted small">Dein Team</span>' : '<button class="btn sm ltjoin" data-ti="' + ti + '">Beitreten</button>') + (host ? '<button class="btn sm ltadd" data-ti="' + ti + '">+ KI</button>' : '') + '</div></div>';
    return h;
  }).join('');
  if (focusTi >= 0) { const inp = box.querySelector('[data-name="' + focusTi + '"]'); if (inp) { inp.focus(); try { inp.setSelectionRange(selS, selS); } catch (e) {} } }
  $('lobbyhostbar').style.display = host ? '' : 'none';
  // Spielerliste mit Teamzuordnung
  $('lobbyplayers').innerHTML = net.players.map(p => { const T = L.teams[L.seat[p.id]]; return '<li><i style="background:' + (T ? TEAM_COLORS[T.ci % 6] : '#777') + '"></i>' + escapeHtml(p.name) + (p.cname ? ' <span class="muted">· Buddler „' + escapeHtml(p.cname) + '“</span>' : '') + '<span class="muted">' + (T ? ' · ' + escapeHtml(T.name) : '') + '</span><small>' + (p.id === net.hostId ? 'Host' : '') + (p.id === net.id ? (p.id === net.hostId ? ' · ' : '') + 'du' : '') + '</small></li>'; }).join('');
  if (host) { const v = lobbyCheck(L); $('btnstart').classList.toggle('dis', !!v); $('btnstart').title = v || ''; }
}
function setupLobby() {
  const box = $('lobbyteams');
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const ti = +b.dataset.ti;
    if (b.classList.contains('ltjoin')) lobbyAct('join', ti);
    else if (b.classList.contains('ltadd')) lobbyAct('addai', ti, $('coopdiff').value);
    else if (b.classList.contains('ltdel')) lobbyAct('delai', ti, +b.dataset.ai);
    else if (b.classList.contains('ltd')) lobbyAct('aidiff', ti, { id: +b.dataset.ai, d: b.dataset.d });
    else if (b.classList.contains('ltsw')) lobbyAct('color', ti, +b.dataset.ci);
  });
  box.addEventListener('change', e => {
    const s = e.target;
    if (s.classList.contains('ltdiff')) lobbyAct('aidiff', +s.dataset.ti, { id: +s.dataset.ai, d: s.value });
    else if (s.classList.contains('ltmove')) lobbyAct('move', +s.dataset.pid, +s.value);
    else if (s.classList.contains('ltcol')) lobbyAct('color', +s.dataset.col, +s.value);
    else if (s.classList.contains('ltname')) lobbyAct('name', +s.dataset.name, s.value);
  });
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('ltname')) e.target.blur(); e.stopPropagation(); });
  $('btnaddteam').onclick = () => lobbyAct('addteam');
  $('btndelteam').onclick = () => lobbyAct('delteam');
  $('btncoop').onclick = () => lobbyAct('coop', 0, { n: +$('coopn').value, d: $('coopdiff').value });
  $('btnffa').onclick = () => lobbyAct('ffa');
}
// Startprüfung: mindestens zwei Teams mit Mitgliedern
function lobbyCheck(L) {
  const filled = L.teams.filter((t, i) => lbHumans(L, i).length + t.ai.length > 0);
  if (filled.length < 2) return 'Mindestens zwei Teams brauchen Mitglieder – tritt einem Team bei oder füge mit „+ KI“ Gegner hinzu.';
  if (lbUnits(L) > LOBBY_MAX_UNITS) return 'Zu viele Teilnehmer (höchstens ' + LOBBY_MAX_UNITS + ').';
  if (net.players.some(p => L.seat[p.id] === undefined)) return 'Nicht alle Spieler haben ein Team.';
  return '';
}
function hostStart() {
  if (!LB) LB = lbDefault(); lbAutoSeat(LB);
  const why = lobbyCheck(LB); if (why) { lbMsg(why, true); toast(why, 'warn'); return; }
  const cl = +$('optclonks').value, mon = $('optmon').checked, hv = $('opthelper2').value, helper = hv !== 'off';
  const teams = [], sides = [];
  let aiN = 0;
  LB.teams.forEach((T, ti) => {
    const hum = lbHumans(LB, ti); if (!hum.length && !T.ai.length) return; // leere Teams fallen weg
    const side = sides.length, color = TEAM_COLORS[T.ci % 6]; sides.push({ name: T.name, color });
    for (const p of hum) teams.push({ name: p.name, pid: p.id, color, cname: p.cname || '', helper, hdiff: helper ? hv : 'normal', side });
    for (const x of T.ai) teams.push({ name: 'KI ' + (++aiN), ai: true, diff: x.diff, color, side });
  });
  const allRes = $('optallres2').checked;
  const cfg = { mode: 'melee', W: 1100 + teams.length * 380, H: 620, seed: newSeed(), teams, sides, clonks: cl, money: allRes ? 120 : 60, monsters: mon, monsterCount: 2, allResearch: allRes, daynight: $('optday2').checked, animals: $('optanimals2').checked, lava: true, takeover: $('opttakeover').value };
  applySize(cfg, $('optsize').value);
  G.role = 'host'; G.myTeam = teams.findIndex(t => t.pid === net.id); G.spectate = G.myTeam < 0;
  launchWorld(cfg, false);
  netSend({ t: 'start', cfg }); sendMap();
  G.world.netDirty.clear(); G.chunkSent = new Map();
}
