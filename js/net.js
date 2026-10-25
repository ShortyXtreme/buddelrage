// BuddelRage – Peer-to-Peer-Mehrspieler über WebRTC (PeerJS). Kein eigener Server nötig.
// Der Browser des Hosts ist autoritativ und übernimmt die Rolle des früheren Relay-Servers.
// Signalisierung: PeerJS-Cloud (0.peerjs.com), Verbindungsaufbau: öffentliche STUN-Server.
// Räume sind privat: Peer-ID = Hash eines langen Zufallsgeheimnisses aus dem Einladungslink (#raum=…).
// Zusätzlich Raumpasswort: Challenge-Response mit gesalzenem Hash, vor der Anmeldung wird nichts synchronisiert.
'use strict';
const NETCFG = Object.assign({
  peerHost: '0.peerjs.com', peerPort: 443, peerPath: '/', secure: true,
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ],
  maxPlayers: 6
}, window.BR_NETCFG || {}); // eigene TURN-Server o. Ä. können per window.BR_NETCFG = { iceServers: [...] } ergänzt werden
const PEER_PREFIX = 'buddelrage-v1-';
const HOST_TYPES = new Set(['start', 'map', 'snap', 'chunks', 'chat', 'mig']);
const CHUNK = 16000;

// ---------- Hilfsfunktionen: Zufall & SHA-256 ----------
function randSecret(bytes) {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  return btoa(String.fromCharCode.apply(null, a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function sha256js(str) { // Rückfall, falls crypto.subtle fehlt (kein sicherer Kontext)
  const K = [], H = [];
  const isP = n => { for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
  for (let n = 2, c = 0; c < 64; n++) if (isP(n)) { if (c < 8) H[c] = (Math.pow(n, 1 / 2) * 4294967296) | 0; K[c++] = (Math.pow(n, 1 / 3) * 4294967296) | 0; }
  const b = Array.from(new TextEncoder().encode(str)); const l = b.length * 8;
  b.push(0x80); while (b.length % 64 !== 56) b.push(0);
  for (let i = 7; i >= 0; i--) b.push(i >= 4 ? 0 : (l >>> (i * 8)) & 255);
  const r = (x, n) => (x >>> n) | (x << (32 - n)); const w = new Array(64);
  for (let o = 0; o < b.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = (b[o + i * 4] << 24) | (b[o + i * 4 + 1] << 16) | (b[o + i * 4 + 2] << 8) | b[o + i * 4 + 3];
    for (let i = 16; i < 64; i++) { const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
    let [a, bb, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) { const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0, t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0; h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0; }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
async function sha256(str) {
  if (window.crypto && crypto.subtle) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); return Array.from(new Uint8Array(d)).map(x => x.toString(16).padStart(2, '0')).join(''); }
  return sha256js(str);
}
async function pwKey(salt, pw) { let h = salt + '|' + pw; for (let i = 0; i < 2000; i++) h = await sha256(salt + h); return h; } // gesalzen + gestreckt
async function peerIdFor(secret) { return PEER_PREFIX + (await sha256('buddelrage-raum|' + secret)).slice(0, 40); }
function roomFromHash() { const m = /[#&]raum=([A-Za-z0-9_-]{22,})/.exec(location.hash); return m ? m[1] : null; }
function inviteLink(secret) { return location.href.split('#')[0] + '#raum=' + secret; }

// ---------- Transport: Strings, große Nachrichten in Stücken ----------
function pSend(conn, s) {
  if (!conn || !conn.open) return;
  if (s.length <= CHUNK) { conn.send(s); return; }
  const id = Math.random().toString(36).slice(2, 9), n = Math.ceil(s.length / CHUNK);
  for (let i = 0; i < n; i++) conn.send('\u0001' + id + '|' + i + '|' + n + '|' + s.slice(i * CHUNK, (i + 1) * CHUNK));
}
function pRecv(conn, data, cb) {
  if (typeof data !== 'string') return;
  conn._rx = Date.now();
  if (data.charCodeAt(0) === 1) {
    const p1 = data.indexOf('|'), p2 = data.indexOf('|', p1 + 1), p3 = data.indexOf('|', p2 + 1);
    const id = data.slice(1, p1), i = +data.slice(p1 + 1, p2), n = +data.slice(p2 + 1, p3);
    if (!(n > 0 && n < 5000 && i >= 0 && i < n)) return;
    const asm = conn._asm || (conn._asm = {}); const a = asm[id] || (asm[id] = { n, got: 0, parts: [] });
    if (a.parts[i] === undefined) { a.parts[i] = data.slice(p3 + 1); a.got++; }
    if (a.got === a.n) { delete asm[id]; data = a.parts.join(''); } else return;
  }
  let m; try { m = JSON.parse(data); } catch (e) { return; }
  if (m && typeof m === 'object') cb(m);
}

// ---------- Netz-Zustand ----------
const P2P = { peer: null, isHost: false, secret: null, salt: null, key: null, conns: new Map(), hostConn: null, nextId: 2, started: false, fails: [], onErr: null, closing: false, myId: 1 };
// Zugangsdaten des Clients für einen Host-Wechsel (bleiben über p2pClose hinweg erhalten, nur im Arbeitsspeicher)
const MIGKEY = { secret: null, salt: null, key: null, pw: null, name: '', cname: '' };
function newPeer(id) {
  const opts = { host: NETCFG.peerHost, port: NETCFG.peerPort, path: NETCFG.peerPath, secure: NETCFG.secure, config: { iceServers: NETCFG.iceServers }, debug: (typeof G !== 'undefined' && G.migrating) ? 0 : 1 }; // beim Host-Wechsel sind Fehlversuche erwartet
  return id ? new Peer(id, opts) : new Peer(opts);
}
function peerErrText(e) {
  const t = e && e.type;
  if (t === 'peer-unavailable') return 'Raum nicht gefunden – ist der Host noch online und der Link vollständig?';
  if (t === 'unavailable-id') return 'Diese Raum-ID ist schon belegt. Bitte neuen Raum erstellen.';
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'Keine Verbindung zum Vermittlungsdienst (PeerJS). Internet prüfen und erneut versuchen.';
  if (t === 'browser-incompatible') return 'Dieser Browser unterstützt kein WebRTC.';
  if (t === 'webrtc') return 'WebRTC-Verbindung fehlgeschlagen (evtl. blockiert eine Firewall/NAT die direkte Verbindung).';
  return 'Netzwerkfehler: ' + (t || e);
}
function p2pClose() {
  P2P.closing = true;
  for (const c of P2P.conns.values()) try { c.conn.close(); } catch (e) { }
  if (P2P.hostConn) try { P2P.hostConn.close(); } catch (e) { }
  if (P2P.peer) try { P2P.peer.destroy(); } catch (e) { }
  Object.assign(P2P, { peer: null, isHost: false, secret: null, salt: null, key: null, conns: new Map(), hostConn: null, nextId: 2, started: false, fails: [], myId: 1 });
  setTimeout(() => { P2P.closing = false; }, 0);
}

// ---------- Host ----------
function hostPlayers() { return [{ id: P2P.myId, name: P2P.hostName, cname: P2P.hostCname || '' }].concat([...P2P.conns.values()].filter(c => c.auth).map(c => ({ id: c.id, name: c.name, cname: c.cname || '' }))); }
function hostBroadcastPlayers() { const m = { t: 'players', players: hostPlayers(), hostId: P2P.myId }; const s = JSON.stringify(m); for (const c of P2P.conns.values()) if (c.auth) pSend(c.conn, s); onNet(m); }
async function p2pCreate(name, pw, onErr, cname) {
  p2pClose(); P2P.closing = false;
  P2P.isHost = true; P2P.hostName = name; P2P.hostCname = cleanName(cname || '', ''); P2P.onErr = onErr; P2P.myId = 1;
  P2P.secret = randSecret(24); // 32 Zeichen, 192 Bit
  P2P.salt = randSecret(16);
  P2P.key = await pwKey(P2P.salt, pw);
  const pid = await peerIdFor(P2P.secret);
  const peer = newPeer(pid); P2P.peer = peer;
  peer.on('open', () => {
    if (peer !== P2P.peer) return;
    history.replaceState(null, '', '#raum=' + P2P.secret);
    onNet({ t: 'joined', code: 'Privatraum', id: 1, host: true, players: hostPlayers(), hostId: 1, link: inviteLink(P2P.secret) });
  });
  peer.on('connection', conn => hostAccept(conn));
  peer.on('disconnected', () => { if (peer === P2P.peer && !P2P.closing && !peer.destroyed) setTimeout(() => { try { peer.reconnect(); } catch (e) { } }, 1000); });
  peer.on('error', e => { if (peer === P2P.peer) onErr(peerErrText(e)); });
}
function hostAccept(conn) {
  const c = { conn, id: 0, name: '', auth: false, nonce: randSecret(24), tries: 0 };
  conn.on('open', () => {
    const now = Date.now(); P2P.fails = P2P.fails.filter(t => now - t < 60000);
    if (P2P.fails.length >= 10) { pSend(conn, JSON.stringify({ t: 'err', s: 'Zu viele falsche Passwörter – bitte in einer Minute erneut versuchen.' })); setTimeout(() => conn.close(), 500); return; }
    if (hostPlayers().length >= NETCFG.maxPlayers) { pSend(conn, JSON.stringify({ t: 'err', s: 'Raum ist voll (max. 6).' })); setTimeout(() => conn.close(), 500); return; }
    pSend(conn, JSON.stringify({ t: 'chal', salt: P2P.salt, nonce: c.nonce }));
  });
  const authTimer = setTimeout(() => { if (!c.auth) try { conn.close(); } catch (e) { } }, 30000);
  conn.on('data', d => pRecv(conn, d, m => hostOnMsg(c, m)));
  c.drop = () => {
    clearTimeout(authTimer);
    if (P2P.conns.get(c.id) !== c) return;
    P2P.conns.delete(c.id);
    if (c.auth && P2P.isHost) { hostBroadcastPlayers(); onNet({ t: 'left', id: c.id }); }
  };
  conn.on('close', c.drop);
  conn.on('error', () => { });
}
async function hostOnMsg(c, m) {
  if (!c.auth) { // vor der Anmeldung wird nur 'auth' akzeptiert, nichts wird synchronisiert
    if (m.t !== 'auth' || c.tries++ > 0) return;
    const expect = await sha256(P2P.key + '|' + c.nonce);
    if (typeof m.r !== 'string' || m.r !== expect) {
      P2P.fails.push(Date.now());
      setTimeout(() => { pSend(c.conn, JSON.stringify({ t: 'err', s: 'Falsches Passwort – Beitritt abgelehnt.' })); setTimeout(() => { try { c.conn.close(); } catch (e) { } }, 500); }, 800);
      return;
    }
    if (hostPlayers().length >= NETCFG.maxPlayers) { pSend(c.conn, JSON.stringify({ t: 'err', s: 'Raum ist voll (max. 6).' })); setTimeout(() => c.conn.close(), 500); return; }
    // Wiederverbinden (oder nach Host-Wechsel): alte Spieler-ID übernehmen, wenn ihr Team existiert und gerade niemand damit verbunden ist
    const old = Number.isInteger(m.old) ? m.old : 0, cfgT = (typeof G !== 'undefined' && G.cfg && G.world && G.cfg.teams) || [];
    const prev = old > 0 ? P2P.conns.get(old) : null;
    if (prev && prev.conn._rx && Date.now() - prev.conn._rx > 2500 && prev.drop) { try { prev.conn.close(); } catch (e) { } prev.drop(); } // alte, stumme Verbindung ersetzen
    c.auth = true; c.id = (old > 0 && old !== P2P.myId && !P2P.conns.has(old) && cfgT.some(t => t.pid === old)) ? old : P2P.nextId++;
    P2P.nextId = Math.max(P2P.nextId, c.id + 1);
    c.name = cleanName(String(m.name || ''), 'Spieler'); c.cname = cleanName(String(m.cname || ''), '');
    P2P.conns.set(c.id, c);
    pSend(c.conn, JSON.stringify({ t: 'joined', code: 'Privatraum', id: c.id, host: false, players: hostPlayers(), hostId: P2P.myId }));
    hostBroadcastPlayers();
    if (P2P.started) onNet({ t: 'late', id: c.id, name: c.name });
    return;
  }
  if (m.t === 'ping') return;
  if (m.t === 'in') { m.from = c.id; onNet(m); }
  else if (m.t === 'chat') onNet({ t: 'chatin', from: c.id, s: typeof m.s === 'string' ? m.s.slice(0, 200) : '', e: m.e });
}
function hostSend(o) {
  if (o.t === 'start' && !o.to) P2P.started = true;
  if (!HOST_TYPES.has(o.t)) return;
  const to = o.to; const s = JSON.stringify(o);
  if (to) { const c = P2P.conns.get(to); if (c && c.auth) pSend(c.conn, s); }
  else for (const c of P2P.conns.values()) if (c.auth) pSend(c.conn, s);
}

// ---------- Client ----------
async function p2pJoin(secret, name, pw, onErr, cname, old) {
  p2pClose(); P2P.closing = false;
  P2P.isHost = false; P2P.secret = secret; P2P.onErr = onErr;
  Object.assign(MIGKEY, { secret, pw, name, cname: cname || '' });
  const pid = await peerIdFor(secret);
  const peer = newPeer(null); P2P.peer = peer;
  let joined = false, gotErr = false;
  peer.on('open', () => {
    if (peer !== P2P.peer) return;
    const conn = peer.connect(pid, { reliable: true, serialization: 'raw' }); P2P.hostConn = conn;
    const to = setTimeout(() => { if (!joined && !gotErr && peer === P2P.peer) onErr('Zeitüberschreitung – Host nicht erreichbar.'); }, 25000);
    conn.on('data', d => pRecv(conn, d, async m => {
      if (m.t === 'chal') { const k = await pwKey(String(m.salt), pw); MIGKEY.salt = String(m.salt); MIGKEY.key = k; pSend(conn, JSON.stringify({ t: 'auth', r: await sha256(k + '|' + m.nonce), name, cname: cname || '', old: old || 0 })); return; }
      if (m.t === 'err') { gotErr = true; clearTimeout(to); onErr(m.s); return; }
      if (m.t === 'joined') { joined = true; clearTimeout(to); conn._joined = true; }
      if (!joined || m.t === 'ping') return;
      onNet(m);
    }));
    conn._lost = () => { if (conn._gone) return; conn._gone = true; clearTimeout(to); if (peer !== P2P.peer || P2P.closing) return; if (joined) onNet({ t: 'hostleft' }); else if (!gotErr) onErr('Verbindung zum Host getrennt.'); };
    conn.on('close', conn._lost);
    conn.on('error', e => { if (peer === P2P.peer && !joined) onErr(peerErrText(e)); });
  });
  peer.on('error', e => { if (peer === P2P.peer && !gotErr) onErr(peerErrText(e)); });
}
function clientSend(o) { if (o.t === 'in' || o.t === 'chat') pSend(P2P.hostConn, JSON.stringify(o)); }
// Host-Wechsel: dieser Client übernimmt die Raum-ID des alten Hosts (wird frei, sobald dessen Browser getrennt ist)
async function p2pPromote(myId, nextId, onOpen, onFail, maxMs) {
  const K = MIGKEY; if (!K.secret || !K.key) { onFail('keine Zugangsdaten'); return; }
  p2pClose(); P2P.closing = false;
  Object.assign(P2P, { isHost: true, hostName: K.name, hostCname: K.cname, secret: K.secret, salt: K.salt, key: K.key, myId, nextId, started: true, onErr: () => { } });
  const pid = await peerIdFor(K.secret), t0 = Date.now();
  const attempt = () => {
    if (!P2P.isHost || P2P.secret !== K.secret) return;
    const peer = newPeer(pid); P2P.peer = peer; let opened = false;
    peer.on('open', () => { if (peer !== P2P.peer) return; opened = true; onOpen(); });
    peer.on('connection', conn => { if (peer === P2P.peer) hostAccept(conn); });
    peer.on('disconnected', () => { if (peer === P2P.peer && !P2P.closing && !peer.destroyed && opened) setTimeout(() => { try { peer.reconnect(); } catch (e) { } }, 1000); });
    peer.on('error', e => {
      if (peer !== P2P.peer || opened) return;
      try { peer.destroy(); } catch (x) { }
      if (Date.now() - t0 < (maxMs || 25000)) setTimeout(attempt, 1500); else onFail(peerErrText(e));
    });
  };
  attempt();
}
// Lebenszeichen: beide Seiten pingen jede Sekunde; bleibt die Gegenseite stumm, gilt sie als getrennt
// (das „close“-Ereignis von WebRTC kommt beim Schließen eines Tabs oft erst sehr spät oder gar nicht)
const NET_TIMEOUT = { host: 6000, client: 8000 };
setInterval(() => {
  const now = Date.now();
  if (P2P.isHost) {
    for (const c of [...P2P.conns.values()]) {
      if (!c.auth) continue;
      if (c.conn._rx && now - c.conn._rx > NET_TIMEOUT.client) { try { c.conn.close(); } catch (e) { } if (c.drop) c.drop(); continue; }
      pSend(c.conn, '{"t":"ping"}');
    }
  } else if (P2P.hostConn && P2P.hostConn._joined && !P2P.hostConn._gone) {
    const hc = P2P.hostConn;
    if (hc._rx && now - hc._rx > NET_TIMEOUT.host) { try { hc.close(); } catch (e) { } if (hc._lost) hc._lost(); return; }
    pSend(hc, '{"t":"ping"}');
  }
}, 1000);
function p2pSend(o) { if (P2P.isHost) hostSend(o); else clientSend(o); }
window.__P2P = P2P;
