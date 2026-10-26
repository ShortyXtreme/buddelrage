// BuddelRage – Menüs: Laden, Forschung, Bauen, Pause, Einstellungen, Hilfe, Credits
'use strict';
const MODALS = ['shop', 'buildmenu', 'research', 'pausemenu', 'help', 'settings', 'credits', 'saves'];
function openMenu(id) {
  if (input.listen) input.listen = null;
  for (const m of MODALS) $(m).style.display = 'none';
  $(id).style.display = 'block'; $('backdrop').style.display = 'block'; G.menu = id; G.menuSel = 0;
  document.body.classList.toggle('buildopen', id === 'buildmenu'); G.buildHover = null; G.buildPrev = null;
  if ((id === 'pausemenu' || id === 'help' || id === 'settings' || id === 'saves') && G.role === 'single') G.paused = true;
  if (G.world) { releaseAll(); pushKeys(true); }
  if (id === 'shop') renderShop(); else if (id === 'research') renderResearch(); else if (id === 'buildmenu') renderBuild();
  else if (id === 'settings') renderSettings(); else if (id === 'help') renderHelp(); else if (id === 'credits') renderCredits(); else if (id === 'saves') renderSaves();
  else {
    $('btnrestart').style.display = $('btnsaves').style.display = G.role === 'single' ? 'block' : 'none';
    const eb = $('btnescape'), ec = G.world && !G.spectate ? escapeInfo() : null;
    eb.style.display = ec ? 'block' : 'none'; if (ec) { eb.textContent = 'Notausgang' + (ec.ok ? ' (' + ec.cost + ')' : ' – ' + ec.why.replace(/^Notausgang (erst )?/, '').replace(' wieder möglich', '').replace(' – kein Notausgang!', '')); eb.disabled = !ec.ok; }
    const ph = $('pausehelperrow'), mt = G.world && !G.spectate && G.myTeam >= 0 ? G.world.teams[G.myTeam] : null;
    ph.style.display = mt && !mt.ai && G.world.mode !== undefined ? 'flex' : 'none'; if (mt) { $('pausehelper').value = mt.helper ? (mt.hdiff || 'normal') : 'off'; if ($('pausehelper')._segRender) $('pausehelper')._segRender(); }
    menuHL();
  }
  cv.classList.remove('ingame');
}
function closeAllMenus() {
  input.listen = null;
  for (const m of MODALS) $(m).style.display = 'none';
  $('backdrop').style.display = 'none'; G.menu = null; if (G.role === 'single') G.paused = false;
  document.body.classList.remove('buildopen'); G.buildPrev = null; G.buildHover = null;
  if (G.world) cv.classList.add('ingame');
}
function menuOpts() { return G.menu ? Array.from($(G.menu).querySelectorAll('.opt')).filter(e => e.offsetParent) : []; }
function menuHL() { const o = menuOpts(); if (G.menuSel >= o.length) G.menuSel = Math.max(0, o.length - 1); o.forEach((e, i) => e.classList.toggle('hl', i === G.menuSel)); const h = o[G.menuSel]; if (h && h.scrollIntoView && G.menuKb) h.scrollIntoView({ block: 'nearest' }); if (G.menu === 'buildmenu') { const k = G.buildHover || (h && h.dataset.build); G.buildPrev = BUILD[k] ? k : null; } }
function menuMove(d) { const o = menuOpts(); if (!o.length) return; G.menuKb = true; G.menuSel = (G.menuSel + d + o.length) % o.length; menuHL(); }
function menuPick() { const o = menuOpts()[G.menuSel]; if (o) o.click(); }
function head(title, sub) { return '<div class="phead"><div><h2>' + title + '</h2>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div><button class="x" onclick="closeAllMenus()" title="Schließen (Esc)">✕</button></div>'; }
function numBadge(i) { return i < 9 ? i + 1 : i === 9 ? 0 : ''; }
function keepSel(fn) { const s = G.menuSel; fn(); G.menuSel = s; menuHL(); }

// ---------- Laden ----------
const SHOP_DESC = { flint: 'Explodiert beim Aufprall', superflint: 'Große Explosion beim Aufprall', tnt: 'Lunte – zündet nach 2,5 s, sehr stark', rock: 'Wurfgeschoss & Katapult-Munition', clonk: 'Neuer Arbeiter für dein Team', lorry: 'Sammelt Gegenstände ein (25 Plätze)', catapult: 'Schleudert Munition im hohen Bogen', cannon: 'Schießt flach und hart', sword: 'Nahkampf · eigener Ausrüstungsplatz (Taste 4)', shield: 'Blocken: Schwert wählen (4), Rechtsklick halten', bow: 'Fernkampf (Taste 5), braucht Pfeile', earth: 'Füllt Löcher: ablegen (Q) oder werfen', arrows: '+10 Pfeile', armor: 'Nimmt 40 % weniger Schaden', knight: 'Schwert, Schild, Bogen & Rüstung', hook: 'Seil schießen, schwingen, hochziehen (Taste 6)', balloon: 'Schwebt langsam nach oben' };
function shopTitle(k) { return k === 'clonk' ? 'Buddler' : k === 'knight' ? 'Ritter' : VEH[k] ? VEH[k].name : ITEMS[k].name; }
function ownedCount(w, t, k) {
  const own = w.clonks.filter(c => c.team === t.id && c.act !== 'dead');
  if (k === 'clonk') return own.length; if (k === 'knight') return own.filter(c => c.knight).length;
  if (VEH[k]) return w.vehicles.filter(v => v.team === t.id && v.type === k).length;
  if (k === 'arrows') return own.reduce((s, c) => s + (c.arrows || 0), 0);
  if (k === 'armor') return own.filter(c => c.armor).length;
  return own.reduce((s, c) => s + c.inv.concat(c.gear || []).filter(x => x === k).length, 0);
}
function renderShop() {
  const w = G.world; if (!w || G.myTeam < 0) return;
  const t = w.teams[G.myTeam], c = myClonk();
  const near = c && w.nearBase(c), hasBase = w.hasBase(t.id);
  const v = c && c.act === 'push' ? w.vehicles.find(o => o.id === c.veh && o.type === 'lorry') : null;
  const inv = c ? c.inv.concat(v ? v.inv : []) : [];
  let h = head('Laden', hasBase ? 'Waren landen im Inventar oder vor der Hütte · Fahrzeuge neben der Basis' : '<span class="lockinfo">Keine fertige Hütte/Burg – Einkauf nicht möglich</span>');
  h += '<div class="cards">';
  SHOP_ALL.forEach((e, i) => {
    const p = shopPrice(e.k), locked = e.res && !t.res[e.res], poor = t.money < p;
    const cls = locked ? 'locked dis' : (poor || !hasBase) ? 'dis' : '';
    const ow = ownedCount(w, t, e.k), unit = e.k === 'arrows' ? ' Pfeile' : '';
    h += '<div class="card opt ' + cls + '" data-buy="' + e.k + '" title="' + shopName(e.k) + '"><span class="num">' + numBadge(i) + '</span><div class="icon"><img src="' + entIcon(e.k, t.color) + '" style="height:' + (VEH[e.k] ? 40 : e.k === 'clonk' || e.k === 'knight' ? 54 : 44) + 'px"></div><h3>' + shopTitle(e.k) + '</h3><p>' + SHOP_DESC[e.k] + '</p>' +
      '<div class="foot">' + (locked ? '<span class="lockinfo">' + icon('lock', 'ico-s') + ' ' + RES_BY[e.res].name + '</span>' : '<span class="price' + (poor ? ' no' : '') + '">' + icon('coin', 'ico-s') + p + '</span>') + '<span class="owned">' + (ow ? 'Besitz: ' + ow + unit : '') + '</span></div></div>';
  });
  h += '</div>';
  // Burg-Ausbau (eigene oder verbündete Burg, bezahlt aus der (Team-)Kasse)
  const cs = w.castleOf ? w.castleOf(t.id, c) : null;
  if (cs) {
    const L = cs.up | 0, Lv = castleLevel(cs);
    h += '<div class="sellbox cupbox"><div class="sellhd"><b>🏰 Burg-Ausbau</b><span class="muted small">Stufe ' + Lv + '/3' + (cs.upT > 0 ? ' · Ausbau läuft noch ' + Math.ceil(cs.upT / 60) + ' s' : '') + ' · Struktur ' + Math.ceil(cs.hp) + '/' + structMax(cs) + '</span></div><div class="cuprow">';
    CUP.forEach((U, i) => {
      const done = i < L, cur = i === L - 1 && cs.upT > 0, next = i === L && !(cs.upT > 0), poor = t.money < U.price;
      const st = done ? (cur ? '<span class="runinfo">im Bau</span>' : '<span class="okinfo">✔ ausgebaut</span>') : next ? '<span class="price' + (poor ? ' no' : '') + '">' + icon('coin', 'ico-s') + U.price + '</span><span class="owned">' + U.time + ' s</span>' : '<span class="lockinfo">' + icon('lock', 'ico-s') + ' erst Stufe ' + i + '</span>';
      h += '<div class="card opt cup' + (next && !poor ? '' : ' dis') + (done ? ' done' : '') + '" data-cup="' + i + '"><h3>' + (i + 1) + '. ' + U.n + '</h3><p>' + U.desc + '</p><div class="foot">' + st + '</div></div>';
    });
    h += '</div><div class="sellrow"><span class="muted small">Munition (Burgvorrat):</span>';
    for (const k in CAMMO) { const A = CAMMO[k], ok = L >= A.lvl, full = (cs[k] | 0) >= A.max; h += '<button class="schip opt' + (ok && !full && t.money >= A.price ? '' : ' dis') + '" data-cam="' + k + '">' + A.n + ' +' + A.add + ' <small>' + A.price + ' Geld</small> · <b>' + (cs[k] | 0) + '/' + A.max + '</b>' + (ok ? '' : ' <small>(ab Stufe ' + A.lvl + ')</small>') + '</button>'; }
    h += '</div></div>';
  } else if (t.res.castle) h += '<div class="sellbox cupbox"><div class="sellhd"><b>🏰 Burg-Ausbau</b><span class="muted small">Baue zuerst eine Burg (' + bindCap('build') + ') – dann Mauern, Schützentürme und Balliste.</span></div></div>';
  // Verkaufen: Automatik je Typ (Taste/Knopf „Verkaufen“) + einzelne Gegenstände
  const AS = t.autoSell || AUTO_SELL_DEFAULT, selInv = inv.filter(x => AS[x]), val = selInv.reduce((s, x) => s + ITEMS[x].sell, 0);
  h += '<div class="sellbox"><div class="sellhd"><b>' + icon('sell', 'ico-s') + ' Verkaufen</b><span class="muted small">' + (near ? 'Taste ' + bindCap('sell') + ' verkauft nur die markierten Sorten' : 'Verkaufen geht nur an der eigenen Hütte oder Burg.') + '</span></div>';
  h += '<div class="sellrow"><span class="muted small">Automatisch:</span>' + SELLABLE.map(k => '<button class="schip opt' + (AS[k] ? ' on' : '') + '" data-as="' + k + '" title="' + (AS[k] ? 'wird verkauft' : 'wird behalten') + '"><img src="' + itemIcon(k) + '" alt="">' + ITEMS[k].name + ' <small>+' + ITEMS[k].sell + '</small>' + (AS[k] ? ' ✔' : '') + '</button>').join('') + '</div>';
  if (c) {
    const one = [];
    c.inv.forEach((x, i) => one.push('<button class="schip opt' + (near && ITEMS[x].sell > 0 ? '' : ' dis') + '" data-so="' + i + '"><img src="' + itemIcon(x) + '" alt="">' + ITEMS[x].name + ' <small>+' + ITEMS[x].sell + '</small></button>'));
    for (const q of EQ_SLOTS) { const has = q.k === 'armor' ? c.armor && !c.knight : hasG(c, q.k); if (has) one.push('<button class="schip eqc opt' + (near ? '' : ' dis') + '" data-so="' + q.k + '"><img src="' + itemIcon(q.k) + '" alt="">' + ITEMS[q.k].name + ' <small>+' + ITEMS[q.k].sell + '</small></button>'); }
    h += '<div class="sellrow"><span class="muted small">Einzeln:</span>' + (one.length ? one.join('') : '<span class="muted small">' + c.name + ' trägt nichts.</span>') + '</div>';
  }
  h += '</div>';
  h += '<div class="shopfoot"><span class="moneybig">' + icon('coin') + t.money + '</span><span class="muted small">' + (inv.length ? inv.length + ' Objekte' + (v ? ' (mit Lore)' : '') + ' · markiert: ' + selInv.length + ' · Wert ' + val : 'Nichts zu verkaufen') + '</span>' +
    '<button class="btn sm primary opt' + (near && selInv.length ? '' : ' dis') + '" id="sellbtn">' + icon('sell', 'ico-s') + ' Markierte verkaufen (+' + val + ') ' + bindCap('sell') + '</button></div>';
  keepSel(() => { $('shop').innerHTML = h; });
  const re = () => setTimeout(() => { if (G.menu === 'shop') renderShop(); }, 120);
  for (const el of $('shop').querySelectorAll('[data-cup]')) el.onclick = () => { if (el.classList.contains('dis')) return; uiSnd(); act('cup', cs ? cs.id : 0); re(); };
  for (const el of $('shop').querySelectorAll('[data-cam]')) el.onclick = () => { uiSnd(); act('cammo', el.dataset.cam); re(); };
  for (const el of $('shop').querySelectorAll('[data-as]')) el.onclick = () => { uiSnd(); act('autosell', [el.dataset.as, AS[el.dataset.as] ? 0 : 1]); re(); };
  for (const el of $('shop').querySelectorAll('[data-so]')) el.onclick = () => { if (!near) { toast('Verkaufen geht nur an der Hütte/Burg', 'warn'); return; } const d = el.dataset.so; uiSnd(); act('sellone', /^[0-9]+$/.test(d) ? +d : d); re(); };
  for (const el of $('shop').querySelectorAll('[data-buy]')) el.onclick = () => { const k = el.dataset.buy, e = SHOP_ALL.find(x => x.k === k); if (e.res && !t.res[e.res]) { toast('Erst erforschen: ' + RES_BY[e.res].name, 'warn'); playSnd('error'); return; } uiSnd(); act('buy', k); setTimeout(() => { if (G.menu === 'shop') renderShop(); }, 120); };
  $('sellbtn').onclick = () => { act('sell'); setTimeout(() => { if (G.menu === 'shop') renderShop(); }, 120); };
}

// ---------- Forschung ----------
function renderResearch() {
  const w = G.world; if (!w || G.myTeam < 0) return;
  const t = w.teams[G.myTeam];
  let h = head('Forschung', t.rq ? 'Aktuell: <b>' + RES_BY[t.rq].name + '</b> · ' + Math.floor(t.rp * 100) + '%' : 'Kostet Geld und Zeit · braucht Hütte oder Burg · ein Projekt gleichzeitig');
  h += '<div class="cards">';
  RESEARCH.forEach((r, i) => {
    const done = t.res[r.k], cur = t.rq === r.k, reqOk = !r.req || r.req.every(q => t.res[q]);
    const dis = done || !reqOk || (t.rq && !cur) || (t.money < r.cost && !cur);
    let st;
    if (done) st = '<span class="okinfo">✔ erforscht</span>';
    else if (cur) st = '<span class="runinfo">läuft · ' + Math.floor(t.rp * 100) + '%</span>';
    else if (!reqOk) st = '<span class="lockinfo">' + icon('lock', 'ico-s') + ' ' + r.req.filter(q => !t.res[q]).map(q => RES_BY[q].name).join(', ') + '</span>';
    else st = '<span class="price' + (t.money < r.cost ? ' no' : '') + '">' + icon('coin', 'ico-s') + r.cost + '</span><span class="owned">' + r.time + ' s</span>';
    const ik = { lorry: 'lorry', tower: 'tower', tnt: 'tnt', weapons: 'sword', catapult: 'catapult', castle: 'castle', cannon: 'cannon', knight: 'knight', balloon: 'balloon' }[r.k];
    h += '<div class="card opt ' + (dis ? 'dis' : '') + (!reqOk && !done ? ' locked' : '') + '" data-res="' + r.k + '"><span class="num">' + numBadge(i) + '</span><div class="icon"><img src="' + entIcon(ik, t.color) + '" style="height:' + (BUILD[ik] ? 50 : 40) + 'px"></div><h3>' + r.name + '</h3><p>' + r.desc + '</p>' +
      (cur ? '<div class="bar thin"><i style="width:' + (t.rp * 100).toFixed(1) + '%"></i></div>' : '') + '<div class="foot">' + st + '</div></div>';
  });
  h += '</div><div class="shopfoot"><span class="moneybig">' + icon('coin') + t.money + '</span><span class="muted small">' + (w.hasBase(t.id) ? '' : 'Ohne Hütte/Burg ruht die Forschung.') + '</span></div>';
  keepSel(() => { $('research').innerHTML = h; });
  for (const el of $('research').querySelectorAll('[data-res]')) el.onclick = () => { uiSnd(); act('research', el.dataset.res); setTimeout(() => { if (G.menu === 'research') renderResearch(); }, 120); };
}

// ---------- Bauen ----------
function renderBuild() {
  const w = G.world; if (!w || G.myTeam < 0) return;
  const t = w.teams[G.myTeam];
  const rows = [['hut', 'Hütte', BUILD.hut.price, 'Heimatbasis: Kaufen, Verkaufen, Forschen'], ['bridge', 'Holzbrücke', PRICE_BRIDGE, '40 Pixel in Blickrichtung – brennbar!'], ['tower', 'Wachturm', BUILD.tower.price, 'Betretbar: von oben werfen & schießen, Heilung'], ['castle', 'Burg', BUILD.castle.price, 'Stein-Basis mit Laden, Rüstung & schneller Heilung']];
  let h = head('Bauen', 'Baustelle entsteht vor deinem Buddler (Vorschau: grün = frei, gelb = wird planiert, rot = unmöglich)') + '<div class="cards">';
  rows.forEach(([k, n, p, d], i) => {
    const B = BUILD[k], lock = B && B.res && !t.res[B.res];
    const I = B && !lock ? buildPreviewInfo(w, k) : null, lc = I && I.pc.st === 'level' ? I.pc.cost : 0, poor = t.money < p + lc;
    const ps = !I ? '' : I.pc.st === 'ok' ? '<div class="pstat ok">✓ Platz frei</div>' : I.pc.st === 'level' ? '<div class="pstat lvl">⚒ Planieren nötig: +' + lc + ' ' + icon('coin', 'ico-s') + '</div>' : '<div class="pstat no">✗ ' + I.pc.why + '</div>';
    h += '<div class="card opt ' + (lock ? 'locked dis' : poor || (I && I.pc.st === 'no') ? 'dis' : '') + '" data-build="' + k + '"><span class="num">' + (i + 1) + '</span><div class="icon" style="height:84px"><img src="' + entIcon(k, t.color) + '" style="' + (k === 'bridge' ? 'width:70px' : 'height:76px') + '"></div><h3>' + n + '</h3><p>' + d + '</p>' + ps + '<div class="foot">' +
      (lock ? '<span class="lockinfo">' + icon('lock', 'ico-s') + ' ' + RES_BY[B.res].name + '</span>' : '<span class="price' + (poor ? ' no' : '') + '">' + icon('coin', 'ico-s') + p + '</span>') + '</div></div>';
  });
  h += '</div>';
  keepSel(() => { $('buildmenu').innerHTML = h; });
  for (const el of $('buildmenu').querySelectorAll('[data-build]')) el.onclick = () => { const k = el.dataset.build, B = BUILD[k]; if (B && B.res && !t.res[B.res]) { toast('Erst erforschen: ' + RES_BY[B.res].name, 'warn'); return; } uiSnd(); act('build', k); closeAllMenus(); };
  for (const el of $('buildmenu').querySelectorAll('[data-build]')) { el.onmouseenter = () => { G.buildHover = el.dataset.build; G.buildPrev = BUILD[G.buildHover] ? G.buildHover : null; }; el.onmouseleave = () => { G.buildHover = null; menuHL(); }; }
}

// ---------- Einstellungen ----------
G.setTab = 'audio';
function renderSettings() {
  const tab = G.setTab;
  let h = head('Einstellungen') + '<div class="tabs">' + [['audio', '🔊 Ton & Musik'], ['ctl', '🎮 Steuerung'], ['view', '🖥️ Anzeige']].map(([k, n]) => '<button class="tab' + (tab === k ? ' on' : '') + '" data-tab="' + k + '">' + n + '</button>').join('') + '</div>';
  const range = (id, lbl, v) => '<div class="setrow"><label for="' + id + '">' + lbl + '</label><input type="range" id="' + id + '" min="0" max="100" value="' + Math.round(v * 100) + '" style="--p:' + Math.round(v * 100) + '%"><span class="val" id="' + id + 'v">' + Math.round(v * 100) + '%</span></div>';
  const sw = (id, lbl, v) => '<div class="setrow"><label>' + lbl + '</label><label class="switch"><input type="checkbox" id="' + id + '"' + (v ? ' checked' : '') + '><i></i></label></div>';
  if (tab === 'audio') h += range('s_sfx', 'Effekte', settings.sfx) + range('s_music', 'Musik', settings.music) + sw('s_musicon', 'Hintergrundmusik (fröhlich, prozedural erzeugt)', settings.musicOn) + sw('s_muted', 'Alles stumm', settings.muted) + '<div class="muted small" style="margin-top:8px">Die Musik startet nach dem ersten Klick oder Tastendruck.</div>';
  else if (tab === 'ctl') {
    h += '<div class="muted small" style="margin-bottom:6px">Feld anklicken und neue Taste oder Maustaste drücken · <kbd class="k">Entf</kbd> löscht · <kbd class="k">Esc</kbd> bricht ab</div><div class="scroll">';
    let grp = '';
    for (const a of ACTIONS) {
      if (a.g !== grp) { grp = a.g; h += '<div class="ctlgrp">' + grp + '</div>'; }
      const b = binds[a.k];
      h += '<div class="bindrow"><span>' + a.n + '</span>' + [0, 1].map(i => { const L = input.listen && input.listen.action === a.k && input.listen.idx === i; return '<button class="chip' + (L ? ' listen' : '') + '" data-bind="' + a.k + '" data-i="' + i + '">' + (L ? 'Taste drücken…' : b[i] ? keyCap(b[i]) : '<span class="muted small">frei</span>') + '</button>'; }).join('') + '</div>';
    }
    h += '<div class="ctlgrp">Fest</div><div class="bindrow"><span>Pause / Menü schließen</span>' + keyCap('Escape') + '<span></span></div><div class="bindrow"><span>Mausrad</span>' + keyCap('WheelUp') + keyCap('WheelDown') + '<span class="muted small">' + (settings.wheel === 'slot' ? 'Inventar · Shift = Zoom' : 'Zoom · Shift = Inventar') + '</span></div></div>' +
      '<div class="setrow"><label>Mausrad</label><select id="s_wheel" style="width:auto"><option value="zoom"' + (settings.wheel !== 'slot' ? ' selected' : '') + '>Zoomen (Shift = Inventarplatz)</option><option value="slot"' + (settings.wheel === 'slot' ? ' selected' : '') + '>Inventarplatz (Shift = Zoomen)</option></select></div>';
    h += sw('s_traj', 'Flugbahn-Vorschau beim Zielen', settings.traj) + '<button class="btn sm" id="s_reset" style="margin-top:10px">Standardbelegung wiederherstellen</button>';
  } else {
    h += sw('s_hints', 'Hinweise & Tastensymbole im Spiel anzeigen', settings.hints) +
      '<div class="setrow"><label>Touch-Steuerung</label><select id="s_touch" style="width:auto">' + [['auto', 'Automatisch'], ['on', 'Immer an'], ['off', 'Aus']].map(([k, n]) => '<option value="' + k + '"' + (settings.touch === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
      '<div class="setrow"><label>Tutorial</label><button class="btn sm" id="s_tut">Erneut zeigen</button></div>';
  }
  $('settings').innerHTML = h;
  for (const b of $('settings').querySelectorAll('[data-tab]')) b.onclick = () => { G.setTab = b.dataset.tab; uiSnd(); renderSettings(); };
  const bindR = (id, key) => { const el = $(id); if (!el) return; el.oninput = () => { settings[key] = el.value / 100; $(id + 'v').textContent = el.value + '%'; el.style.setProperty('--p', el.value + '%'); saveSettings(); Music.apply(); }; el.onchange = () => { if (key === 'sfx') uiSnd(); }; };
  bindR('s_sfx', 'sfx'); bindR('s_music', 'music');
  const bindS = (id, key, fn) => { const el = $(id); if (el) el.onchange = () => { settings[key] = el.checked; saveSettings(); Music.apply(); if (fn) fn(); }; };
  bindS('s_musicon', 'musicOn', () => { if (settings.musicOn) Music.start(); }); bindS('s_muted', 'muted'); bindS('s_traj', 'traj'); bindS('s_hints', 'hints', () => { HUD.sig = {}; });
  if ($('s_wheel')) $('s_wheel').onchange = () => { settings.wheel = $('s_wheel').value; saveSettings(); renderSettings(); };
  if ($('s_touch')) $('s_touch').onchange = () => { settings.touch = $('s_touch').value; saveSettings(); updateTouchUI(); };
  if ($('s_tut')) $('s_tut').onclick = () => { settings.tutDone = false; saveSettings(); if (G.world && G.role === 'single') { closeAllMenus(); tutStart(); } else toast('Das Tutorial startet beim nächsten Einzelspiel.', 'info'); };
  if ($('s_reset')) $('s_reset').onclick = () => { resetBinds(); toast('Standardbelegung wiederhergestellt.', 'good'); refreshKeyTexts(); renderSettings(); };
  for (const b of $('settings').querySelectorAll('[data-bind]')) b.onclick = e => { e.stopPropagation(); const a = b.dataset.bind, i = +b.dataset.i; setTimeout(() => startListen(a, Math.min(i, binds[a].length)), 0); };
}

// ---------- Hilfe ----------
G.helpTab = 'kb';
function renderHelp() {
  const tab = G.helpTab;
  let h = head('Hilfe & Steuerung') + '<div class="tabs">' + [['kb', 'Tastatur & Maus'], ['pad', 'Gamepad'], ['touch', 'Touch'], ['goal', 'Spielziel & Tipps'], ['ai', 'KI & Namen']].map(([k, n]) => '<button class="tab' + (tab === k ? ' on' : '') + '" data-htab="' + k + '">' + n + '</button>').join('') + '</div>';
  if (tab === 'kb') {
    const B = a => bindCap(a);
    h += '<div class="kbdviz"><div class="grp"><div class="rowk">' + B('up') + '</div><div class="rowk">' + B('left') + B('down') + B('right') + '</div><small>Laufen · Klettern</small></div>' +
      '<div class="grp"><div class="rowk">' + B('jump') + '</div><small>Springen</small></div><div class="grp"><div class="rowk">' + B('sprint') + '</div><small>Sprinten</small></div>' +
      '<div class="grp"><div class="rowk">' + B('primary') + B('secondary') + '</div><small>Aktion · Graben/Blocken</small></div><div class="grp"><div class="rowk">' + B('interact') + B('drop') + '</div><small>Benutzen · Ablegen</small></div>' +
      '<div class="grp"><div class="rowk">' + B('slot1') + B('slot2') + B('slot3') + '</div><small>Inventar (3 Plätze)</small></div>' +
      '<div class="grp"><div class="rowk">' + B('slot4') + B('slot5') + B('slot6') + '</div><small>Ausrüstung: Schwert · Bogen · Haken</small></div></div>';
    h += '<div class="helpgrid">';
    let grp = '';
    const items = ACTIONS.map(a => ({ a, cap: bindCap(a.k, true) }));
    const col = list => '<div class="ctl">' + list.map(({ a, cap }) => { let s = ''; if (a.g !== grp) { grp = a.g; s += '<div class="ctlgrp">' + grp + '</div>'; } return s + '<div class="keys">' + cap + '</div><div class="d">' + a.n + '</div>'; }).join('') + '</div>';
    h += col(items.slice(0, 12)); grp = ''; h += col(items.slice(12).concat([{ a: { g: 'Menüs', n: 'Pause' }, cap: keyCap('Escape') }, { a: { g: 'Ansicht', n: 'Zoomen' }, cap: keyCap('WheelUp') + keyCap('WheelDown') }, { a: { g: 'Ansicht', n: 'Inventarplatz wechseln' }, cap: kbdShift() + keyCap('WheelUp') }]));
    h += '</div><div class="muted small" style="margin-top:10px">Die Maus zielt: Würfe, Pfeile, Graben und Geschütze folgen dem Mauszeiger. Alle Tasten lassen sich unter Einstellungen › Steuerung neu belegen.</div>';
  } else if (tab === 'pad') {
    const rows = [['LS', 'Laufen · hoch = klettern · ganz durchdrücken = sprinten'], ['RS', 'Zielen (Twin-Stick)'], ['RT', 'Aktion: werfen / schlagen / schießen / feuern'], ['LT', 'Halten: graben in Zielrichtung · mit gewähltem Schwert + Schild blocken'], ['A', 'Springen · in Menüs: auswählen'], ['B', 'Graben an/aus · in Menüs: zurück'], ['X', 'Benutzen (Fahrzeug, Tür, Aufheben)'], ['Y', 'Ablegen · Lore ausladen'], ['LB', 'Inventar-/Ausrüstungsplatz links'], ['RB', 'Inventar-/Ausrüstungsplatz rechts'], ['L3', 'Nächster Buddler'], ['R3', 'Forschung'], ['Select', 'Laden'], ['Start', 'Pause (dort: Bauen über Dock/Maus)'], ['DP', 'Laufen · in Menüs navigieren']];
    h += '<div class="ctl">' + rows.map(([b, d]) => '<div class="keys">' + padCap(b) + '</div><div class="d">' + d + '</div>').join('') + '</div><div class="muted small" style="margin-top:10px">Xbox-/PlayStation-Standardbelegung (✕ = A, ◯ = B, ▢ = X, △ = Y). Wird automatisch erkannt.</div>';
  } else if (tab === 'touch') {
    h += '<ul class="tips"><li><b>Linker Stick</b>: laufen, nach oben schieben = springen/klettern.</li><li><b>Ins Spielfeld tippen</b>: Aktion (werfen, schlagen, schießen) in Richtung des Fingers.</li><li><b>Ins Spielfeld lange drücken</b>: dorthin graben (Finger bewegen = Richtung).</li><li><b>Knöpfe rechts</b>: Sprung, Aktion, Graben, Benutzen, Ablegen, Inventarplatz, Buddler wechseln.</li><li><b>Zwei Finger</b> auf dem Spielfeld auseinander/zusammen ziehen = zoomen.</li><li><b>💬 oben</b> (Mehrspieler): Chat und Emotes.</li><li><b>Oben</b>: Laden und Menü. Das Dock rechts öffnet Bauen, Forschung, Hilfe und Einstellungen.</li></ul><div class="muted small">Touch-Steuerung lässt sich unter Einstellungen › Anzeige erzwingen oder abschalten.</div>';
  } else if (tab === 'ai') {
    h += '<ul class="tips"><li><b>Drei Stufen</b> pro KI-Team (Einzelspieler-Menü bzw. Lobby): <b>Leicht</b> – langsam, ungenau, passiv, greift erst spät an. <b>Mittel</b> – ausgewogen, forscht, baut Wachturm und Burg, nutzt Loren. <b>Schwer</b> – reagiert schnell, zielt mit Vorhalt, blockt mit dem Schild, wirtschaftet effizient, nutzt Fahrzeuge und greift koordiniert an.</li>' +
      '<li>Die KI <b>arbeitet wie ein Spieler</b>: Gold abbauen und an der Hütte verkaufen, Buddler, Waffen und Feuersteine kaufen, forschen, bauen, verteidigen. Ihr Weg wird mit einer Wegsuche geplant (Laufen, Springen, Klettern, Hangeln, Schwimmen, Graben); bleibt ein Buddler hängen, gräbt er sich frei oder eine Treppe nach oben.</li>' +
      '<li><b>Bauen</b>: Jede KI baut ihre Burg auf dem ebenen Plateau ihrer Startbasis (die Fläche hält sie frei) und planiert unebenen Boden genauso wie du.</li>' +
      '<li>Was ein KI-Team gerade tut, steht in der <b>Teamübersicht</b> oben rechts (z. B. „baut Gold ab“, „forscht: Burg“, „greift an“).</li>' +
      '<li><b>Fair</b>: Die KI sieht und kann nicht mehr als ein Spieler. Einzige Ausnahme: <b>Schwer</b> erhält wie das bisherige Grundeinkommen +1 Geld alle 2 Sekunden.</li>' +
      '<li><b>KI-Helfer</b> (Stufe Aus/Leicht/Mittel/Schwer im Menü und in der Pause): Deine nicht ausgewählten Buddler arbeiten selbstständig (Gold abbauen, verkaufen, beim Bauen helfen, sich wehren, festsitzende Kameraden befreien). Sie geben nie Geld aus.</li>' +
      '<li><b>Team-Lobby</b>: KI im eigenen Team ist verbündet – kein Eigenbeschuss, gemeinsame Gebäude, hilft beim Bauen und Verteidigen. „Freunde gegen KI“ setzt alle Spieler in ein Team gegen die KI.</li>' +
      '<li><b>Teamkasse</b>: Im Team teilt ihr eine Hütte, das Geld und die Forschung – jeder Verkauf füllt die gemeinsame Kasse, Kaufen, Bauen und Forschen bezahlt daraus.</li>' +
      '<li>Verliert im Mehrspieler jemand die Verbindung, übernimmt eine KI mit der in der Lobby gewählten Stufe sein Team.</li>' +
      '<li><b>Buddler-Name</b>: Im Einzelspieler-Menü bzw. Mehrspieler-Menü kannst du deinem Buddler einen Namen geben (max. 16 Zeichen). Er steht über dem Buddler und in der Buddlerliste; weitere gekaufte Buddler heißen „Name 2“, „Name 3“ … Leer lassen = zufällige Namen.</li></ul>';
  } else {
    h += '<ul class="tips"><li><b>Goldrausch</b>: Grabe Gold, verkaufe es an der Hütte (' + bindCap('sell') + ') und erreiche das Geldziel.</li><li><b>Melee</b>: Das letzte überlebende Team gewinnt. Ritter, Katapulte und Burgen helfen.</li><li><b>Forschung</b> (' + bindCap('research') + ') schaltet Lore, Katapult, Kanone, Wachturm, Burg, Waffen, Ritter und TNT frei.</li><li><b>Bauen</b> (' + bindCap('build') + '): Gebäude entstehen als Baustelle vor deinem Buddler – Buddler in der Nähe bauen sie auf. Die Vorschau zeigt den Platz: <b style="color:#7ee69a">grün</b> = frei, <b style="color:#ffd36b">gelb</b> = wird zuerst planiert (Erde/Sand abtragen, Lücken auffüllen, kostet etwas Geld und Zeit), <b style="color:#ff8a80">rot</b> = unmöglich (z. B. Fels im Weg – erst sprengen).</li><li>Jede Startbasis liegt auf einem ebenen Plateau mit Platz für Hütte, Wachturm und Burg. Die Kartengröße (Klein bis Riesig) wählst du im Menü bzw. der Host in der Lobby.</li><li><b>Burg-Ausbau</b> (im Laden): 1 Mauern &amp; Tor (+Struktur, Mauern halten Gegner auf, Reparaturtrupp) → 2 Schützentürme (schießen selbst, brauchen Pfeilvorrat) → 3 Balliste (gegen Ritter &amp; Fahrzeuge, braucht Bolzen). Munition kaufst du im Laden nach – leer heißt: die Burg schweigt.</li><li>Feuersteine explodieren beim Aufprall, TNT nach kurzer Zeit.</li><li>Lava verbrennt alles und wird mit Wasser zu Fels. Feuer breitet sich über Gras und Holz aus – ins Wasser springen löscht.</li><li>Nachts ist es dunkel – Gebäude, Fackeln und Feuer spenden Licht.</li><li>Du startest im Einzelspieler mit einem Buddler – weitere kaufst du im Laden; sie arbeiten als KI-Helfer. Stirbt dein Buddler, übernimmst du automatisch einen Helfer.</li><li><b>Goldziel</b>: im Einzelspieler-Menü 100–1000 oder eigenes Ziel; der Fortschritt steht oben links.</li><li><b>Vögel klauen Gold</b>, das offen an der Oberfläche liegt – schnell aufsammeln oder den Vogel treffen, dann lässt er es fallen.</li><li>Steckt ein Buddler fest, erscheint „Hilfe!“ – ein KI-Kamerad gräbt einen Ausweg.</li>' +
      '<li><b>Ausrüstung</b>: Schwert, Schild, Bogen, Rüstung und Enterhaken haben eigene Plätze (rechts neben dem Inventar) und belegen keinen der 3 Inventarplätze. ' + bindCap('slot4') + ' Schwert, ' + bindCap('slot5') + ' Bogen, ' + bindCap('slot6') + ' Enterhaken; mit leerer Hand kämpft der Buddler mit der besten Waffe. Schild und Rüstung wirken automatisch – Blocken: Schwert wählen und ' + bindCap('secondary') + ' halten.</li>' +
      '<li><b>Verkaufen</b> (' + bindCap('sell') + '): verkauft nur die markierten Sorten – anfangs nur Gold. Im Laden (' + bindCap('shop') + ') unter „Verkaufen“ schaltest du weitere Sorten zu oder verkaufst einzelne Gegenstände (auch Ausrüstung).</li>' +
      '<li><b>Erdklumpen</b> (Laden, 2 Geld): ' + bindCap('drop') + ' füllt das Loch vor/unter dir mit Erde, werfen lässt ihn beim Aufprall platschen. Niemand wird dabei eingeschlossen.</li>' +
      '<li><b>Tiere</b>: <b>Wipfe</b> laufen über die Wiesen – mit ' + bindCap('interact') + ' fangen, tragen (belegt einen Inventarplatz), mit ' + bindCap('drop') + ' freilassen oder an der Hütte verkaufen. Vögel, Fische und Fledermäuse sind harmlos. <b>Haie</b> leben in tiefem Wasser und beißen Schwimmer – schnell raus!</li>' +
      '<li><b>Wildschweine</b> grasen friedlich. Greifst du eines an (oder bedrängst es lange), stürmt es höchstens zweimal los und flieht dann. Erlegt lässt es Gold fallen.</li>' +
      '<li><b>KI-Helfer</b>: Gekaufte Buddler arbeiten selbstständig (abbauen, verkaufen, beim Bauen helfen, verteidigen); Stufe im Startmenü oder in der Pause. Stirbt dein Buddler, übernimmst du automatisch den besten Helfer; mit ' + bindCap('nextclonk') + ' wechselst du selbst.</li>' +
      '<li><b>Team-Lobby</b> (Mehrspieler): Teams wählen per „Beitreten“, der Host fügt mit „+ KI“ KI-Spieler hinzu. „Freunde gegen KI“ setzt alle Spieler gegen KI-Gegner. Verbündete können sich nicht verletzen, starten an einer gemeinsamen Hütte und teilen Teamkasse und Forschung.</li>' +
      '<li><b>Enterhaken</b> (Laden): ' + bindCap('primary') + ' schießt den Haken zum Mauszeiger, er hält an festem Material. ' + bindCap('up') + '/' + bindCap('down') + ' holt das Seil ein/lässt ab, ' + bindCap('left') + '/' + bindCap('right') + ' schwingt, ' + bindCap('jump') + ' springt ab, ' + bindCap('primary') + ' löst das Seil.</li>' +
      '<li><b>Ballon</b> (Forschung „Ballonbau“, dann Laden): ' + bindCap('primary') + ' bläst ihn auf, du schwebst langsam nach oben (~24 s). ' + bindCap('down') + ' sinkt, ' + bindCap('jump') + ' packt ihn am Boden ein bzw. lässt ihn in der Luft los. Pfeile, Würfe, Explosionen und Feuer lassen ihn platzen.</li>' +
      '<li><b>Notausgang</b>: Unter der Erde steckengeblieben? ' + bindCap('rescue') + ' 1,5 s halten (oder Pause › Notausgang) bringt den Buddler zur Basis bzw. an die Oberfläche. Kostet ' + ESCAPE_COST + ' Geld (ohne Geld ' + ESCAPE_HP + ' Leben), danach 60 s Abklingzeit, nicht mit Gegnern in der Nähe.</li>' +
      '<li>Nach einem Treffer blinkt dein Buddler kurz und ist ~1 s unverwundbar (Feuer und Lava wirken weiter).</li>' +
      '<li><b>Speichern</b>: Im Einzelspieler über Pause › Speichern / Laden (3 Plätze, im Browser). Laden auch im Hauptmenü.</li>' +
      '<li><b>Mehrspieler</b>: ' + bindCap('chat') + ' öffnet den Chat, ' + bindCap('emote') + ' halten öffnet das Emote-Rad (oder 1–8 drücken). Verlässt der Host das Spiel, übernimmt automatisch ein Mitspieler – das Spiel läuft nach ein paar Sekunden weiter.</li></ul>';
  }
  $('help').innerHTML = h;
  for (const b of $('help').querySelectorAll('[data-htab]')) b.onclick = () => { G.helpTab = b.dataset.htab; uiSnd(); renderHelp(); };
}
function renderCredits() {
  $('credits').innerHTML = head('Credits') + '<div class="credits">' +
    '<p><b>BuddelRage</b> ist ein inoffizielles Fan-Spiel im Stil der Clonk-Reihe. Es enthält keine Dateien aus Clonk Rage und ist nicht mit RedWolf Design oder dem OpenClonk-Projekt verbunden.</p>' +
    '<p><b>Texturen & Sounds</b>: OpenClonk-Team, CC-BY 3.0 (<a href="https://www.openclonk.org" target="_blank" rel="noopener">openclonk.org</a>).</p>' +
    '<p><b>Musik</b>: prozedural im Browser erzeugt (WebAudio) – eigener Code, keine Fremddateien.</p>' +
    '<p><b>Schriften</b>: Inter (The Inter Project Authors) und Lilita One (Juan Montoreano) – SIL Open Font License 1.1.</p>' +
    '<p><b>Netzwerk</b>: PeerJS (MIT), Vermittlung über die PeerJS-Cloud, STUN von Google, Cloudflare und Twilio.</p>' +
    '<p class="muted small">Details: CREDITS.md im Repository.</p></div>';
}
