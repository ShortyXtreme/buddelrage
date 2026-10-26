// BuddelRage – Chat & Emotes (Sprechblasen über dem Buddler, Chatverlauf), Emote-Rad
'use strict';
const EMOTES = [['👋', 'Hallo!'], ['👍', 'Gut gemacht!'], ['😂', 'Haha!'], ['😮', 'Oha!'], ['😠', 'Grrr!'], ['❤️', 'Danke!'], ['🆘', 'Hilfe!'], ['💰', 'Gold!']];
const CHAT = { log: [], bubbles: {}, open: false, wheel: null, rate: new Map() };
function chatClean(s) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120); }
function myChatName() { const w = G.world, t = w && G.myTeam >= 0 ? w.teams[G.myTeam] : null; return t ? t.name : (typeof mpName === 'function' ? cleanName($('mpname').value, 'Zuschauer') : 'Zuschauer'); }
// senden: Client → Host, Host/Einzelspieler → direkt anzeigen (+ an alle verteilen)
function sendChat(text, emo) {
  const s = chatClean(text), e = Number.isInteger(emo) && emo >= 0 && emo < EMOTES.length ? emo : -1;
  if (!s && e < 0) return;
  if (G.role === 'client') { netSend({ t: 'chat', s, e }); return; }
  const m = { t: 'chat', team: G.myTeam, n: myChatName(), s, e };
  if (G.role === 'host') netSend(m);
  chatDeliver(m);
}
// Host: Nachricht eines Clients prüfen (Länge, Rate) und an alle verteilen
function hostChatIn(from, s, e) {
  const now = Date.now(), r = (CHAT.rate.get(from) || []).filter(t => now - t < 5000);
  if (r.length >= 6) return; r.push(now); CHAT.rate.set(from, r);
  const w = G.world, ti = w ? w.teams.findIndex(t => t.pid === from) : -1;
  const p = (net.players || []).find(p => p.id === from);
  const m = { t: 'chat', team: ti, n: ti >= 0 ? w.teams[ti].name : cleanName(p ? p.name : '', 'Zuschauer'), s: chatClean(s), e: Number.isInteger(e) && e >= 0 && e < EMOTES.length ? e : -1 };
  if (!m.s && m.e < 0) return;
  netSend(m); chatDeliver(m);
}
function chatDeliver(m) {
  const s = chatClean(m.s), e = Number.isInteger(m.e) && m.e >= 0 && m.e < EMOTES.length ? m.e : -1, n = cleanName(m.n, 'Spieler');
  const team = Number.isInteger(m.team) ? m.team : -1;
  const txt = e >= 0 ? EMOTES[e][0] + ' ' + (s || EMOTES[e][1]) : s;
  CHAT.log.push({ n, team, txt, t: performance.now() }); if (CHAT.log.length > 40) CHAT.log.shift();
  if (team >= 0) CHAT.bubbles[team] = { txt, emo: e >= 0 ? EMOTES[e][0] : '', until: performance.now() + (e >= 0 && !s ? 3200 : 5500) };
  playSnd('chat', 0, 0, 1);
  renderChatLog();
}
function renderChatLog() {
  const box = $('chatlog'); if (!box) return;
  const now = performance.now(), w = G.world;
  const lines = CHAT.log.filter(l => CHAT.open || now - l.t < 12000).slice(CHAT.open ? -12 : -6);
  box.innerHTML = lines.map(l => { const col = w && l.team >= 0 && w.teams[l.team] ? w.teams[l.team].color : '#bbb'; return '<div class="cl' + (now - l.t > 10000 && !CHAT.open ? ' old' : '') + '"><b style="color:' + col + '">' + escapeHtml(l.n) + ':</b> ' + escapeHtml(l.txt) + '</div>'; }).join('');
  box.style.display = lines.length ? 'block' : 'none';
}
function chatOpen() {
  if (!G.world || CHAT.open) return;
  CHAT.open = true; releaseAll();
  const b = $('chatbox'); b.style.display = 'flex'; const i = $('chatin'); i.value = ''; setTimeout(() => i.focus(), 0);
  renderChatLog();
}
function chatClose() { CHAT.open = false; $('chatbox').style.display = 'none'; $('chatin').blur(); renderChatLog(); }
function setupChat() {
  const i = $('chatin'); if (!i) return;
  i.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); const v = i.value; chatClose(); if (v.trim()) sendChat(v, -1); }
    else if (e.key === 'Escape') { e.preventDefault(); chatClose(); }
  });
  i.addEventListener('blur', () => { if (CHAT.open) setTimeout(() => { if (document.activeElement !== i && CHAT.open) chatClose(); }, 150); });
  $('chatemos').innerHTML = EMOTES.map((e, k) => '<button class="emo" data-emo="' + k + '" title="' + e[1] + '">' + e[0] + '</button>').join('');
  for (const b of $('chatemos').querySelectorAll('[data-emo]')) b.addEventListener('pointerdown', ev => { ev.preventDefault(); const v = i.value; chatClose(); sendChat(v, +b.dataset.emo); });
  setInterval(() => { if (G.world && CHAT.log.length) renderChatLog(); }, 1000);
}
// ---------- Emote-Rad (Taste halten, zur Auswahl zeigen, loslassen) ----------
function wheelOpen() {
  if (!G.world || CHAT.wheel || G.spectate && G.role !== 'client') return;
  const x = Math.max(110, Math.min(cv.width - 110, input.mouse.in ? input.mouse.x : cv.width / 2)), y = Math.max(110, Math.min(cv.height - 110, input.mouse.in ? input.mouse.y : cv.height / 2));
  CHAT.wheel = { x, y, sel: -1 };
  const el = $('emotewheel'); el.style.display = 'block'; el.style.left = x + 'px'; el.style.top = y + 'px';
  el.innerHTML = EMOTES.map((e, k) => { const a = -Math.PI / 2 + k * Math.PI * 2 / EMOTES.length; return '<div class="we" data-k="' + k + '" style="left:' + Math.round(Math.cos(a) * 78) + 'px;top:' + Math.round(Math.sin(a) * 78) + 'px"><span>' + e[0] + '</span><small>' + (k + 1) + ' · ' + e[1] + '</small></div>'; }).join('') + '<div class="wc">Emote</div>';
  for (const d of el.querySelectorAll('.we')) d.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); CHAT.wheel.sel = +d.dataset.k; wheelClose(true); });
}
function wheelMove(mx, my) {
  const W = CHAT.wheel; if (!W) return; const dx = mx - W.x, dy = my - W.y;
  W.sel = Math.hypot(dx, dy) < 26 ? -1 : ((Math.round((Math.atan2(dy, dx) + Math.PI / 2) / (Math.PI * 2 / EMOTES.length)) % EMOTES.length) + EMOTES.length) % EMOTES.length;
  for (const d of $('emotewheel').querySelectorAll('.we')) d.classList.toggle('on', +d.dataset.k === W.sel);
}
function wheelClose(send) {
  const W = CHAT.wheel; if (!W) return; CHAT.wheel = null; $('emotewheel').style.display = 'none';
  if (send && W.sel >= 0) sendChat('', W.sel);
}
// Sprechblasen über dem ausgewählten Buddler eines Teams (Bildschirmkoordinaten, gestochen scharf)
function drawBubbles() {
  const w = G.world, v = R.view; if (!w || !v) return;
  const g = cv.getContext('2d'), now = performance.now();
  // „Hilfe!“ über festsitzenden Buddlern des eigenen Teams/der Verbündeten
  for (const c of w.clonks) {
    const hs = w.remote ? c.helpS : (c.help ? (w.rescuerOf(c) ? 2 : 1) : 0); if (!hs || c.act === 'dead' || c.inside) continue;
    if (G.myTeam >= 0 && !w.ally(c.team, G.myTeam)) continue;
    const x = c.rx !== undefined && w.remote ? c.rx : c.x, y = c.ry !== undefined && w.remote ? c.ry : c.y;
    const sx = (x - v.cx) * v.S, sy = (y - 30 - v.cy) * v.S + Math.sin(now / 200) * 2; if (sx < -60 || sx > cv.width + 60 || sy < -30 || sy > cv.height + 30) continue;
    const txt = hs === 2 ? 'Hilfe kommt…' : 'Hilfe!';
    g.save(); g.font = '700 12px Inter, system-ui, sans-serif'; const tw = g.measureText(txt).width + 12;
    g.fillStyle = hs === 2 ? 'rgba(80,200,120,.92)' : 'rgba(240,80,60,.92)'; roundRect(g, sx - tw / 2, sy - 18, tw, 18, 7); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, sx, sy - 8.5); g.restore();
  }
  for (const k in CHAT.bubbles) {
    const B = CHAT.bubbles[k]; if (now > B.until) { delete CHAT.bubbles[k]; continue; }
    const t = w.teams[k]; if (!t) continue;
    const c = w.clonks.find(o => o.id === t.sel && o.act !== 'dead') || w.clonks.find(o => o.team === t.id && o.act !== 'dead'); if (!c) continue;
    const x = c.rx !== undefined && w.remote ? c.rx : c.x, y = c.ry !== undefined && w.remote ? c.ry : c.y;
    if (c.inside) continue;
    const sx = (x - v.cx) * v.S, sy = (y - (c.bl ? 38 : 26) - v.cy) * v.S;
    if (sx < -100 || sx > cv.width + 100 || sy < -40 || sy > cv.height + 40) continue;
    const a = Math.min(1, (B.until - now) / 400);
    g.save(); g.globalAlpha = a;
    g.font = '600 ' + (B.emo && B.txt.length < 20 ? 15 : 13) + 'px Inter, system-ui, sans-serif';
    let txt = B.txt; if (txt.length > 46) txt = txt.slice(0, 44) + '…';
    const tw = Math.min(320, g.measureText(txt).width) + 16, th = 24;
    g.fillStyle = 'rgba(255,252,244,.96)'; roundRect(g, sx - tw / 2, sy - th, tw, th, 8); g.fill();
    g.beginPath(); g.moveTo(sx - 5, sy); g.lineTo(sx + 5, sy); g.lineTo(sx, sy + 6); g.closePath(); g.fill();
    g.strokeStyle = t.color; g.lineWidth = 2; roundRect(g, sx - tw / 2, sy - th, tw, th, 8); g.stroke();
    g.fillStyle = '#1d1a16'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, sx, sy - th / 2 + 0.5, 300);
    g.restore();
  }
}
