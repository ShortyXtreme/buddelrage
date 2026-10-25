// BuddelRage – HUD (DOM), Symbole, Hinweise, Toasts, Dock, Ziel-Overlay und Tutorial
'use strict';
const SV = (p, extra) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' + (extra || '') + '>' + p + '</svg>';
const ICONS = {
  coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f5b81c"/><circle cx="12" cy="12" r="7.2" fill="#ffd458" stroke="#c98a0c" stroke-width="1.4"/><path d="M10 8.5h3.2a2 2 0 0 1 0 4H10m0 0h3.6a2 2 0 0 1 0 4H10V8.5" fill="none" stroke="#a86a06" stroke-width="1.6"/></svg>',
  cart: SV('<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2L21 8H6"/>'),
  sell: SV('<path d="M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5 9 9.3 12 10s5 1.7 5 3.8-2.2 3.2-5 3.2-5-1.2-5-3"/>'),
  hammer: SV('<path d="M14.5 6.5 3 18l3 3 11.5-11.5"/><path d="m12.5 4.5 4-3 6 6-3 4z"/>'),
  flask: SV('<path d="M9 2h6M10 2v6.5L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8.5V2"/><path d="M7.5 15h9"/>'),
  help: SV('<circle cx="12" cy="12" r="10"/><path d="M9.2 9a3 3 0 0 1 5.8 1c0 2-3 2.6-3 4.5"/><circle cx="12" cy="18" r=".6" fill="currentColor"/>'),
  gear: SV('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  pause: SV('<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'),
  pick: SV('<path d="M14 6 3 17l2 2L16 8"/><path d="M8 3c4-1 9 0 13 4l-2 1c-3-2.5-6-3.5-10-3.5z"/>'),
  globe: SV('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>'),
  star: SV('<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>'),
  heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.2 3 4 7 4c2.2 0 3.6 1.2 5 3 1.4-1.8 2.8-3 5-3 4 0 6.2 4.2 4.6 7.8C19.5 16.4 12 21 12 21z" fill="#ff5a6a"/></svg>',
  air: '<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="5" fill="none" stroke="#7cc4ff" stroke-width="2"/><circle cx="16.5" cy="7" r="3.5" fill="none" stroke="#7cc4ff" stroke-width="2"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#ffd34a"/><g stroke="#ffd34a" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v2.5M12 20v2.5M1.5 12H4M20 12h2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/></g></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" fill="#c8d4ff"/></svg>',
  sword: SV('<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/>'),
  swords: SV('<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 6.5 18 3h3v3l-3.5 8.5M5 14l2.5 2.5M3 19l2 2"/>'),
  goldnug: '<svg viewBox="0 0 24 24"><path d="M4 16l3-7 6-2 6 4 1 6-6 3H8z" fill="#f5c823" stroke="#9a7010" stroke-width="1.5"/><path d="M8 10l4-1" stroke="#fff3a0" stroke-width="2" stroke-linecap="round"/></svg>',
  trophy: SV('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
  skull: SV('<path d="M12 2a8 8 0 0 0-8 8c0 3 1.5 5 3 6v3h10v-3c1.5-1 3-3 3-6a8 8 0 0 0-8-8z"/><circle cx="9" cy="11" r="1.5"/><circle cx="15" cy="11" r="1.5"/><path d="M10 19v-2M14 19v-2"/>'),
  lock: SV('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  user: SV('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
};
function fillIcons(root) { for (const el of (root || document).querySelectorAll('.ico, .ico-s')) { if (el.dataset.done) continue; for (const c of el.classList) if (ICONS[c]) { el.innerHTML = ICONS[c]; el.dataset.done = 1; break; } } }
function icon(n, cls) { return '<span class="' + (cls || 'ico') + '">' + (ICONS[n] || '') + '</span>'; }

// ---------- Pixel-Symbole aus den Spielgrafiken ----------
const ICON_CACHE = {};
function pixIcon(key, w, h, draw) {
  if (ICON_CACHE[key]) return ICON_CACHE[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  try { draw(g); } catch (e) { }
  // auf sichtbare Pixel zuschneiden (quadratisch, 1 px Rand)
  const d = g.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return (ICON_CACHE[key] = c.toDataURL());
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, sz = Math.max(bw, bh) + 2, o = document.createElement('canvas'); o.width = sz; o.height = sz;
  o.getContext('2d').drawImage(c, x0, y0, bw, bh, Math.floor((sz - bw) / 2), Math.floor((sz - bh) / 2), bw, bh);
  return (ICON_CACHE[key] = o.toDataURL());
}
function itemIcon(t) { return pixIcon('it_' + t, 12, 12, g => { if (t === 'arrow') { g.fillStyle = '#ddd'; g.fillRect(1, 5, 7, 1); g.fillStyle = '#c33'; g.fillRect(1, 4, 2, 3); return; } ITEM_DRAW[t](g, 5, 8, null); }); }
function fakeClonk(o) { return Object.assign({ act: 'walk', dir: 1, anim: 0.5, inv: [], hp: 100, knight: 0, armor: 0, block: 0, swing: 0, bowT: 0, punch: 0, fire: 0, digA: 0, breath: 100, inside: 0, blockT: 0, team: 0, x: 0, y: 0 }, o); }
function entIcon(k, col) {
  col = col || '#2f5fe0';
  if (k === 'clonk') return pixIcon('cl' + col, 16, 22, g => drawClonk(g, fakeClonk({}), col, 8, 20));
  if (k === 'knight') return pixIcon('kn' + col, 16, 22, g => drawClonk(g, fakeClonk({ knight: 1, armor: 1, inv: ['sword', 'shield', 'bow'] }), col, 8, 20));
  if (VEH[k]) return pixIcon('v_' + k + col, 26, 18, g => drawVehicle(g, { type: k, dir: 1, ang: VEH[k].ang || 0.6, inv: k === 'lorry' ? ['gold', 'gold', 'gold', 'gold', 'gold'] : [], cd: 0, fire: 0, hp: VEH[k].hp, id: 1 }, col, 13, 16));
  if (BUILD[k]) { const B = BUILD[k]; return pixIcon('b_' + k + col, B.w + 6, B.h + 22, g => drawStruct(g, { type: k, x: (B.w + 6) / 2, y: B.h + 20, w: B.w, h: B.h, prog: 1, hp: B.hp, id: 1, fire: 0 }, col)); }
  if (k === 'bridge') return pixIcon('bridge', 30, 10, g => { g.fillStyle = '#8a6038'; g.fillRect(1, 4, 28, 3); g.fillStyle = '#a07040'; for (let x = 2; x < 29; x += 4) g.fillRect(x, 4, 2, 1); g.fillStyle = '#5a3a1a'; g.fillRect(1, 7, 28, 1); });
  return itemIcon(k);
}

// ---------- Toasts ----------
function toast(s, kind) {
  const box = $('toasts'); if (!box) return;
  if (!G.world && kind !== 'force' && $('hud').style.display === 'none') { box.dataset.last = s; }
  const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.textContent = s; box.appendChild(el);
  while (box.children.length > 5) box.firstChild.remove();
  setTimeout(() => el.classList.add('out'), 4600); setTimeout(() => el.remove(), 5100);
}
function addMsg(s) {
  const kind = /Nicht genug|zu hart|Keine |voll|tot|verloren|ausgeschieden|Fehl|leer|nichts/i.test(s) ? 'warn' : /Geld|angekommen|bereit|erforscht|fertig|Gold gefunden|Rüstung|gewonnen/i.test(s) ? 'good' : '';
  toast(s, kind);
}

// ---------- Dock ----------
const DOCK = [['shop', 'cart', 'Kaufen'], ['sell', 'sell', 'Verkaufen'], ['build', 'hammer', 'Bauen'], ['research', 'flask', 'Forschung'], ['help', 'help', 'Hilfe'], ['settings', 'gear', 'Einstellungen'], ['pause', 'pause', 'Pause']];
function renderDock() {
  $('dock').innerHTML = DOCK.map(([k, ic, n]) => '<button class="dk" data-dk="' + k + '" title="' + n + '">' + icon(ic) + '<span class="lbl">' + n + '</span>' + (k === 'pause' ? keyCap('Escape') : bindCap(k)) + '</button>').join('');
  for (const b of $('dock').querySelectorAll('.dk')) b.onclick = e => {
    e.stopPropagation(); uiSnd(); const k = b.dataset.dk; b.blur();
    if (k === 'sell') { act('sell'); return; }
    if (k === 'pause') { openMenu('pausemenu'); return; }
    const id = { shop: 'shop', build: 'buildmenu', research: 'research', help: 'help', settings: 'settings' }[k]; toggleMenu(id);
  };
}
function refreshKeyTexts() { renderDock(); HUD.sig = {}; if (G.menu === 'help') renderHelp(); }

// ---------- HUD-Aktualisierung ----------
const HUD = { sig: {}, money: null };
function setHTML(id, html) { if (HUD.sig[id] === html) return; HUD.sig[id] = html; $(id).innerHTML = html; }
const ACT_DE = { walk: 'Läuft', jump: 'Springt', climb: 'Klettert', hangle: 'Hangelt', dig: 'Gräbt', swim: 'Schwimmt', fight: 'Kämpft', tumble: 'Taumelt', dead: 'Tot', push: 'Schiebt' };
function myClonk() { const w = G.world; if (!w || G.myTeam < 0) return null; const t = w.teams[G.myTeam]; return t ? w.clonks.find(o => o.id === t.sel && o.act !== 'dead') : null; }
function nearVehicle(w, c) { let v = null; for (const o of w.vehicles) if (!o.pusher && Math.abs(o.x - c.x) < VEH[o.type].w / 2 + 5 && Math.abs(o.y - c.y) < 8 && (!v || Math.abs(o.x - c.x) < Math.abs(v.x - c.x))) v = o; return v; }
function nearDoor(w, c) { return w.structs.find(s => s.team === c.team && s.prog >= 1 && Math.abs(c.x - s.x) < Math.min(14, s.w / 2) && c.y > s.y - 10 && c.y < s.y + 5); }
function nearItem(w, c) { let best = null, bd = 14; for (const it of w.items) { if (it.fuse > 0 || it.type === 'arrow' || it.stuck) continue; const d = Math.hypot(it.x - c.x, (it.y - c.y + 4) * 1.5); if (d < bd) { bd = d; best = it; } } return best; }
function interactTarget(w, c) {
  if (c.inside || c.act !== 'walk' && c.act !== 'fight') return null;
  const v = nearVehicle(w, c), s = nearDoor(w, c);
  if (v && !(s && Math.abs(s.x - c.x) < Math.abs(v.x - c.x))) return { kind: 'veh', o: v, label: VEH[v.type].name + (VEH[v.type].gun ? ' bedienen' : ' schieben') };
  if (s) return { kind: 'door', o: s, label: BUILD[s.type].name + ' betreten' };
  const it = nearItem(w, c); if (it) return { kind: 'item', o: it, label: (ITEMS[it.type] ? ITEMS[it.type].name : it.type) + ' aufheben' };
  return null;
}
function pr(cap, txt, main) { return '<span class="pr' + (main ? ' main' : '') + '">' + cap + txt + '</span>'; }
function primaryLabel(c) {
  const it = actItem(c);
  if (it === 'bow' && c.arrows > 0) return 'Pfeil schießen';
  if (it === 'sword') return 'Schwerthieb';
  if (!it || it === 'shield' || it === 'bow') return 'Schlagen';
  return (THROWABLE.has(it) ? 'Werfen: ' : 'Werfen: ') + ITEMS[it].name;
}
function buildPrompts(w, c) {
  const P = [], prim = bindCap('primary'), sec = bindCap('secondary'), E = bindCap('interact');
  const near = w.nearBase(c);
  if (c.inside) {
    const s = w.structs.find(o => o.id === c.inside);
    P.push(pr(E, 'Verlassen', true));
    P.push(pr(prim, actItem(c) === 'bow' && c.arrows > 0 ? 'Von oben schießen' : c.inv.length ? 'Von oben werfen' : 'Hände leer'));
    if (s && BUILD[s.type].base) { P.push(pr(bindCap('shop'), 'Laden')); P.push(pr(bindCap('sell'), 'Verkaufen')); }
    return P;
  }
  if (c.act === 'push') {
    const v = w.vehicles.find(o => o.id === c.veh); if (!v) return P;
    if (VEH[v.type].gun) { P.push(pr(prim, 'Feuern', true)); P.push(pr('', 'Maus zielt · Winkel ' + Math.round(v.ang * 57) + '°')); }
    else { P.push(pr(prim, 'Einladen (' + v.inv.length + '/' + VEH.lorry.cap + ')', true)); P.push(pr(bindCap('drop'), 'Ausladen')); if (near) P.push(pr(bindCap('sell'), 'Alles verkaufen')); }
    P.push(pr(E, 'Loslassen'));
    return P;
  }
  if (c.act === 'dig') { P.push(pr(sec, 'Halten = graben · Maus = Richtung', true)); P.push(pr(bindCap('dig'), 'Graben aus')); return P; }
  if (c.act === 'climb') { P.push(pr(bindCap('up'), 'Hochklettern', true)); P.push(pr(bindCap('down'), 'Runter')); return P; }
  if (c.act === 'hangle') { P.push(pr(bindCap('left') + bindCap('right'), 'Hangeln', true)); P.push(pr(bindCap('down'), 'Loslassen')); return P; }
  if (c.act === 'swim') { P.push(pr(bindCap('up'), 'Auftauchen', true)); return P; }
  const tg = interactTarget(w, c); if (tg) P.push(pr(E, tg.label, true));
  if (near) { P.push(pr(bindCap('shop'), 'Kaufen', !tg)); if (c.inv.length) P.push(pr(bindCap('sell'), 'Verkaufen')); }
  P.push(pr(prim, primaryLabel(c), !tg && !near));
  const blk = c.inv.includes('shield') && BLOCK_SLOT.has(actItem(c));
  P.push(pr(sec, blk ? 'Blocken (halten)' : 'Graben (halten)'));
  return P;
}
function updateHUD() {
  const w = G.world; if (!w) return;
  const me = G.myTeam >= 0 ? w.teams[G.myTeam] : null;
  $('spectate').style.display = G.spectate ? 'block' : 'none';
  if (me) {
    if (HUD.money !== me.money) { if (HUD.money !== null && me.money > HUD.money) { const m = $('h-money').parentNode; m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump'); } HUD.money = me.money; $('h-money').textContent = me.money; }
    setHTML('h-team', escapeHtml(me.name) + (w.mode === 'settle' ? ' · Ziel: ' + w.goal + ' Geld' : ' · Melee'));
    if (me.rq) { $('h-res').style.display = 'block'; setHTML('h-resname', RES_BY[me.rq].name); setHTML('h-respct', Math.floor(me.rp * 100) + '%'); $('h-resfill').style.width = (me.rp * 100).toFixed(1) + '%'; } else $('h-res').style.display = 'none';
    // Buddlerliste
    const own = w.clonks.filter(c => c.team === me.id && c.act !== 'dead');
    const html = own.length > 1 ? own.map((c, i) => '<div class="cl' + (c.id === me.sel ? ' sel' : '') + '" data-i="' + i + '"><span class="nm">' + (c.knight ? '⚔ ' : '') + escapeHtml(c.name) + '</span><span class="mini"><i style="width:' + Math.max(0, c.hp) + '%;background:' + (c.hp > 50 ? '#5fd47a' : c.hp > 25 ? '#e8b02c' : '#e0402c') + '"></i></span><span class="st' + (c.fire ? ' hot' : '') + '">' + (c.fire ? 'Brennt!' : c.inside ? 'Drinnen' : c.block ? 'Blockt' : (ACT_DE[c.act] || '')) + '</span></div>').join('') + '<div class="muted small" style="padding-left:4px">' + bindCap('nextclonk') + ' wechseln</div>' : '';
    if (HUD.sig.cl !== html) { HUD.sig.cl = html; $('hud-clonks').innerHTML = html; for (const el of $('hud-clonks').querySelectorAll('.cl')) el.onclick = e => { e.stopPropagation(); act('sel', +el.dataset.i); }; }
  }
  // Uhr
  if (w.cfg.daynight !== false) { const p = w.dayPhase(), hh = Math.floor(p * 24), mm = Math.floor((p * 24 - hh) * 6) * 10, day = w.daylight() > 0.5; setHTML('h-clock', icon(day ? 'sun' : 'moon', 'ico-s') + (day ? 'Tag ' : 'Nacht ') + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0')); $('h-clock').className = 'clock' + (day ? '' : ' night'); } else setHTML('h-clock', '');
  // Teams
  if (w.teams.length > 1) setHTML('hud-teams', w.teams.map(t => { const alive = w.clonks.filter(c => c.team === t.id && c.act !== 'dead').length; return '<div class="' + (t.elim ? 'el' : '') + '"><i style="background:' + t.color + '"></i>' + escapeHtml(t.name.slice(0, 14)) + '<span class="muted" style="margin-left:auto">' + (t.elim ? '✝' : alive) + '</span></div>'; }).join('')); else $('hud-teams').style.display = 'none';
  // Unten: Leisten, Hotbar, Hinweise
  const c = myClonk();
  $('hud-bottom').style.visibility = c ? 'visible' : 'hidden';
  if (c) {
    const hp = Math.max(0, c.hp), bar = $('h-hp').parentNode;
    $('h-hp').style.width = hp + '%'; setHTML('h-hpt', Math.ceil(hp)); bar.className = 'bar hp' + (hp < 25 ? ' low' : hp < 50 ? ' mid' : '');
    $('h-airrow').style.display = c.breath < 99 ? 'flex' : 'none'; $('h-air').style.width = c.breath + '%';
    const sl = actIdx(c), hb = [];
    for (let s = 0; s < INV_MAX; s++) { const it = c.inv[s]; hb.push('<div class="slot' + (it && s === sl ? ' sel' : '') + (it ? '' : ' empty') + '" data-s="' + s + '">' + bindCap('slot' + (s + 1)) + (it ? '<img src="' + itemIcon(it) + '" alt="">' : '') + '<span class="nm">' + (it ? ITEMS[it].name : 'leer') + '</span></div>'); }
    const hbs = hb.join('');
    if (HUD.sig.hb !== hbs) { HUD.sig.hb = hbs; $('hotbar').innerHTML = hbs; for (const el of $('hotbar').querySelectorAll('.slot')) el.onclick = e => { e.stopPropagation(); act('slot', +el.dataset.s); }; }
    const ex = []; if (c.knight) ex.push('<span>⚔ Ritter</span>'); if (c.armor) ex.push('<span>🛡 Rüstung</span>'); if (c.arrows || c.inv.includes('bow')) ex.push('<span>➶ Pfeile: ' + c.arrows + '</span>'); if (c.fire) ex.push('<span style="color:#ff9a6a">Brennt! Ins Wasser!</span>');
    setHTML('h-extra', ex.join(''));
    setHTML('prompts', settings.hints ? buildPrompts(w, c).join('') : '');
  } else if (me && w.state === 'run' && !G.spectate && !w.clonks.some(o => o.team === me.id && o.act !== 'dead')) {
    setHTML('prompts', pr(bindCap('shop'), me.money >= PRICE_CLONK ? 'Alle Buddler tot – neuen Buddler kaufen!' : 'Alle Buddler tot!', true)); $('hud-bottom').style.visibility = 'visible';
  }
  setHTML('h-net', net.code && G.role !== 'single' ? escapeHtml(net.code) + (G.role === 'host' ? ' · Host' : '') + (pad.had ? ' · 🎮' : '') : (pad.had ? '🎮 Gamepad' : ''));
  document.body.classList.toggle('touchui', touchWanted());
  if (G.world && touchWanted() && $('touch').style.display !== 'block') updateTouchUI();
}

// ---------- Ziel-Overlay im Spielfeld: Fadenkreuz, Flugbahn, Interaktions-Marker ----------
function drawAimOverlay() {
  const w = G.world, v = R.view; if (!w || !v || G.spectate) return;
  const g = cv.getContext('2d'), S = v.S, c = myClonk();
  const toS = (x, y) => [(x - v.cx) * S, (y - v.cy) * S];
  if (c && !G.menu) {
    const tg = settings.hints && interactTarget(w, c);
    if (tg) { // E-Marker über dem Ziel
      const o = tg.o, top = tg.kind === 'door' ? o.y - Math.min(o.h, 30) : o.y - 14; const [sx, sy] = toS(o.x, top - 6 + Math.sin(performance.now() / 250) * 1.5);
      const lbl = bindLabel('interact'); g.font = '700 12px Inter, sans-serif'; const tw = Math.max(20, g.measureText(lbl).width + 10);
      g.fillStyle = 'rgba(255,250,240,.95)'; roundRect(g, sx - tw / 2, sy - 11, tw, 20, 6); g.fill(); g.fillStyle = '#1d1a16'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(lbl, sx, sy - 0.5); g.textAlign = 'left';
    }
    const aim = aimPoint();
    if (aim && settings.traj) drawTrajectory(g, w, c, aim, toS);
  }
  if (input.mode === 'mouse' && input.mouse.in && !G.menu && w.state === 'run') { // Fadenkreuz
    const x = input.mouse.x, y = input.mouse.y;
    g.save(); g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.stroke();
    g.beginPath(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.moveTo(x + dx * 5, y + dy * 5); g.lineTo(x + dx * 13, y + dy * 13); } g.stroke();
    g.fillStyle = '#ffc24a'; g.fillRect(x - 1, y - 1, 2, 2); g.restore();
  }
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function drawTrajectory(g, w, c, aim, toS) {
  let px, py, vx, vy, grav, col = 'rgba(255,255,255,', maxV = 5;
  const cx = c.rx !== undefined && w.remote ? c.rx : c.x, cy = c.ry !== undefined && w.remote ? c.ry : c.y;
  if (c.act === 'push') {
    const v = w.vehicles.find(o => o.id === c.veh); if (!v || !VEH[v.type].gun) return; const d = VEH[v.type];
    px = v.x + v.dir * Math.cos(v.ang) * d.w * 0.55; py = v.y - d.h + 1 - Math.sin(v.ang) * 5; vx = v.dir * Math.cos(v.ang) * d.speed; vy = -Math.sin(v.ang) * d.speed; grav = 0.1; col = 'rgba(255,190,90,';
  } else {
    const it = actItem(c);
    if (c.act === 'climb' || c.act === 'hangle' || c.act === 'tumble') return;
    const dir = Math.abs(aim[0] - cx) > 2 ? Math.sign(aim[0] - cx) : c.dir;
    if (c.inside) { const s = w.structs.find(o => o.id === c.inside); if (!s) return; px = s.type === 'hut' ? s.x + dir * 16 : s.x + dir * (s.w / 2 - 3); py = s.type === 'hut' ? s.y - 6 : s.y - s.h - 2; }
    else { px = cx + dir * 4; py = cy - 8; }
    if (it === 'bow' && c.arrows > 0) { const v2 = arrowVel(px, py + 1, aim[0], aim[1], dir); vx = v2[0]; vy = v2[1]; grav = 0.07; col = 'rgba(200,230,255,'; }
    else if (it && it !== 'sword' && it !== 'shield' && it !== 'bow') { const v2 = throwVel(px, py, aim[0], aim[1]); vx = v2[0]; vy = v2[1]; grav = 0.1; if (THROWABLE.has(it)) col = 'rgba(255,160,90,'; }
    else return;
  }
  g.save();
  for (let t = 0; t < 140; t++) {
    vy = Math.min(vy + grav, maxV); px += vx; py += vy;
    if (px < 0 || px >= w.W || py >= w.H) break;
    if (py > 0 && w.solid(px, py)) { const [sx, sy] = toS(px, py); g.strokeStyle = col + '0.9)'; g.lineWidth = 2; g.beginPath(); g.arc(sx, sy, 5, 0, 7); g.stroke(); break; }
    if (t % 3 === 0) { const [sx, sy] = toS(px, py); const a = Math.max(0.15, 0.85 - t / 160); g.fillStyle = col + a.toFixed(2) + ')'; g.beginPath(); g.arc(sx, sy, 2.2, 0, 7); g.fill(); }
  }
  g.restore();
}

// ---------- Tutorial (Einzelspieler, erster Start) ----------
const TUT = [
  { id: 'move', t: () => 'Laufe mit ' + bindCap('left') + ' ' + bindCap('right') + ' – halte ' + bindCap('sprint') + ' zum Sprinten.' },
  { id: 'jump', t: () => 'Springe mit ' + bindCap('jump') + '. An Wänden ' + bindCap('jump') + ' oder ' + bindCap('up') + ' halten, um zu klettern.' },
  { id: 'dig', t: () => 'Halte ' + bindCap('secondary') + ', um zu graben – die Maus bestimmt die Richtung. Grabe nach Gold!' },
  { id: 'slot', t: () => 'Wähle einen Inventarplatz mit ' + bindCap('slot1') + ' ' + bindCap('slot2') + ' ' + bindCap('slot3') + ' oder dem Mausrad.' },
  { id: 'primary', t: () => bindCap('primary') + ' wirft, schlägt oder schießt in Richtung Mauszeiger. Die Punkte zeigen die Flugbahn.' },
  { id: 'shop', t: () => 'Öffne den Laden mit ' + bindCap('shop') + ' oder dem Knopf „Kaufen“ rechts. Gold verkaufst du an der Hütte mit ' + bindCap('sell') + '.' },
  { id: 'end', t: () => bindCap('interact') + ' benutzt Fahrzeuge und Gebäude. Alles Weitere unter ' + bindCap('help') + ' Hilfe. Viel Spaß!' },
];
const tut = { on: false, i: 0, x0: 0 };
function tutStart() { if (settings.tutDone || G.role !== 'single') { tut.on = false; $('tutorial').style.display = 'none'; return; } tut.on = true; tut.i = 0; const c = myClonk(); tut.x0 = c ? c.x : 0; tutRender(); }
function tutRender() {
  const el = $('tutorial'); if (!tut.on) { el.style.display = 'none'; return; }
  const s = TUT[tut.i]; el.style.display = 'flex';
  el.innerHTML = '<div style="flex:1"><div class="step">Tutorial · Schritt ' + (tut.i + 1) + ' von ' + TUT.length + '</div><div class="txt">' + s.t() + '</div><div class="prog">' + TUT.map((_, k) => '<i class="' + (k <= tut.i ? 'on' : '') + '"></i>').join('') + '</div></div><div class="btns">' + (s.id === 'end' ? '<button class="btn sm primary" id="tutok">Fertig</button>' : '<button class="btn sm" id="tutnext">Weiter</button>') + '<button class="btn sm ghost" id="tutskip">Überspringen</button></div>';
  const done = () => { tut.on = false; settings.tutDone = true; saveSettings(); el.style.display = 'none'; };
  if ($('tutok')) $('tutok').onclick = e => { e.stopPropagation(); done(); };
  if ($('tutnext')) $('tutnext').onclick = e => { e.stopPropagation(); tutAdvance(); };
  $('tutskip').onclick = e => { e.stopPropagation(); done(); };
}
function tutAdvance() { if (!tut.on) return; if (tut.i < TUT.length - 1) { tut.i++; playSnd('ding', 0, 0, 0.5); tutRender(); } }
function tutNote(a) { if (!tut.on) return; const id = TUT[tut.i].id; if ((id === 'slot' && (a === 'slot' || a === 'slotd')) || (id === 'primary' && a === 'primary')) setTimeout(tutAdvance, 500); }
function tutTick() {
  if (!tut.on || !G.world) return; const c = myClonk(); if (!c) return; const id = TUT[tut.i].id;
  if (id === 'move' && Math.abs(c.x - tut.x0) > 30) tutAdvance();
  else if (id === 'jump' && (c.act === 'jump' || c.act === 'climb') && !tut.wait) { tut.wait = 1; setTimeout(() => { tut.wait = 0; tutAdvance(); }, 600); }
  else if (id === 'dig' && c.act === 'dig' && !tut.wait) { tut.wait = 1; setTimeout(() => { tut.wait = 0; tutAdvance(); }, 1200); }
  else if (id === 'shop' && G.menu === 'shop') tutAdvance();
}
