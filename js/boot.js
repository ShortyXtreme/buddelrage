// BuddelRage – Start: Knöpfe verdrahten, Symbole einsetzen, Texturen laden, Hauptschleife starten
'use strict';
const click = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', e => { uiSnd(); fn(e); }); };
// Hauptmenü
click('btnsp', () => showScreen('spmenu'));
click('btnmp', () => openMp());
click('btnset', () => openMenu('settings'));
click('btnhelpm', () => openMenu('help'));
click('btncred', () => openMenu('credits'));
for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', () => { uiSnd(); menuBack(); });
for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { uiSnd(); closeAllMenus(); });
$('backdrop').addEventListener('click', () => closeAllMenus());
click('btnsettle', () => startSingle('settle'));
click('btnmelee', () => startSingle('melee'));
click('btnmelee3', () => startSingle('melee3'));
// Mehrspieler
function openMp() { showScreen('mpmenu'); $('mpbusy').style.display = 'none'; const r = roomFromHash(); if (r) $('mplink').value = inviteLink(r); $('mperr').textContent = typeof Peer === 'undefined' ? 'PeerJS konnte nicht geladen werden.' : (location.protocol === 'file:' ? 'Hinweis: Per Doppelklick (file://) klappt WebRTC evtl. nicht – besser über https:// öffnen.' : ''); if (r) $('mpjoinpw').focus(); }
click('btnback', () => menuBack());
function mpName() { const name = cleanName($('mpname').value, 'Spieler'); localStorage.setItem('br_name', name); return name; }
function mpCname() { const n = cleanName($('mpcname').value, ''); localStorage.setItem('br_cname', n); $('spcname').value = n; return n; }
click('btncreate', () => {
  const pw = $('mppw').value; if (pw.length < 4) { $('mperr').textContent = 'Bitte ein Raumpasswort mit mindestens 4 Zeichen festlegen.'; $('mppw').focus(); return; }
  $('mperr').textContent = ''; $('mpbusy').textContent = 'Raum wird erstellt…'; $('mpbusy').style.display = 'block';
  p2pCreate(mpName(), pw, mpErr, mpCname()).catch(e => mpErr('Fehler: ' + e));
});
click('btnjoin', () => {
  const v = $('mplink').value.trim(); const mm = /raum=([A-Za-z0-9_-]{22,})/.exec(v) || /^([A-Za-z0-9_-]{22,})$/.exec(v);
  if (!mm) { $('mperr').textContent = 'Bitte den vollständigen Einladungslink einfügen.'; return; }
  const pw = $('mpjoinpw').value; if (!pw) { $('mperr').textContent = 'Bitte das Raumpasswort eingeben.'; $('mpjoinpw').focus(); return; }
  $('mperr').textContent = ''; $('mpbusy').textContent = 'Verbinde mit Host…'; $('mpbusy').style.display = 'block';
  p2pJoin(mm[1], mpName(), pw, mpErr, mpCname()).catch(e => mpErr('Fehler: ' + e));
});
$('mpjoinpw').onkeydown = e => { if (e.key === 'Enter') $('btnjoin').click(); };
$('mppw').onkeydown = e => { if (e.key === 'Enter') $('btncreate').click(); };
click('btncopy', () => { const i = $('invitelink'); const done = () => { $('btncopy').textContent = '✔ Kopiert'; setTimeout(() => $('btncopy').textContent = 'Link kopieren', 1800); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(i.value).then(done, () => { i.select(); document.execCommand('copy'); done(); }); else { i.select(); document.execCommand('copy'); done(); } });
click('btnstart', hostStart);
click('btnleave', () => toMenu());
// Pause & Spielende
click('btnresume', () => closeAllMenus());
click('btnsetp', () => openMenu('settings'));
click('btnsaves', () => openMenu('saves'));
click('btnloadm', () => openMenu('saves'));
click('btnescape', () => { closeAllMenus(); doEscape(); });
click('btnhelp', () => openMenu('help'));
click('btnrestart', () => { if (G.role === 'single') startSingle(G.spMode || 'melee'); });
click('btnquit', () => toMenu());
click('againbtn', () => { if (G.role === 'single') startSingle(G.spMode || 'melee'); });
click('menubtn', () => toMenu());
addEventListener('resize', () => R.resize());
R.want = Math.max(0.5, Math.min(2.5, +settings.zoom || 1)); setupChat();
// Start
$('mpname').value = localStorage.getItem('br_name') || ('Buddler' + ((Math.random() * 90 + 10) | 0));
// KI-Schwierigkeit & Buddler-Name (zuletzt gewählte Werte merken)
for (const sel of document.querySelectorAll('.diffsel')) sel.innerHTML = AI_LEVELS.map(k => '<option value="' + k + '">' + aiDiffName(k) + '</option>').join('');
const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
$('spcname').value = $('mpcname').value = cleanName(lsGet('br_cname', ''), '');
$('spdiff1').value = lsGet('br_diff1', 'normal'); $('spdiff2').value = lsGet('br_diff2', 'normal'); $('opttakeover').value = lsGet('br_takeover', 'normal');
$('opthelper').checked = $('opthelper2').checked = lsGet('br_helper', '0') === '1';
for (const [id, k] of [['spsize', 'br_size'], ['optsize', 'br_size2']]) { const v = lsGet(k, 'mittel'); $(id).value = MAP_SIZES[v] ? v : 'mittel'; $(id).addEventListener('change', () => { try { localStorage.setItem(k, $(id).value); } catch (e) {} }); }
for (const id of ['spcname', 'mpcname']) $(id).addEventListener('change', () => { const n = cleanName($(id).value, ''); $(id).value = n; $('spcname').value = $('mpcname').value = n; localStorage.setItem('br_cname', n); });
for (const [id, k] of [['spdiff1', 'br_diff1'], ['spdiff2', 'br_diff2'], ['opttakeover', 'br_takeover']]) $(id).addEventListener('change', () => localStorage.setItem(k, $(id).value));
for (const id of ['opthelper', 'opthelper2']) $(id).addEventListener('change', () => { localStorage.setItem('br_helper', $(id).checked ? '1' : '0'); $('opthelper').checked = $('opthelper2').checked = $(id).checked; });
for (const id of ['optanimals', 'optanimals2']) { $(id).checked = lsGet('br_animals', '1') === '1'; $(id).addEventListener('change', () => { localStorage.setItem('br_animals', $(id).checked ? '1' : '0'); $('optanimals').checked = $('optanimals2').checked = $(id).checked; }); }
$('optai').addEventListener('change', renderAiDiffs); renderAiDiffs();
fillIcons(); renderDock(); setupTouch();
for (const [id, ic] of [['btnsettle', 'goldnug'], ['btnmelee', 'sword'], ['btnmelee3', 'swords']]) { const m = $(id).querySelector('.mode-ico'); if (m) m.innerHTML = ICONS[ic]; }
hideAll(); $('loading').style.display = 'flex';
loadTextures().then(() => {
  $('loading').style.display = 'none'; R.resize(); startDemo(); $('mainmenu').style.display = 'flex';
  requestAnimationFrame(frame);
  if (roomFromHash()) openMp();
});
// für Tests
window.__G = G; window.__startSingle = startSingle; window.__pad = pad; window.__input = input;
