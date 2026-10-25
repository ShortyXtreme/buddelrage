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
const HOST_TYPES = new Set(['start', 'map', 'snap', 'chunks']);
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
const P2P = { peer: null, isHost: false, secret: null, salt: null, key: null, conns: new Map(), hostConn: null, nextId: 2, started: false, fails: [], onErr: null, closing: false };
function newPeer(id) {
  const opts = { host: NETCFG.peerHost, port: NETCFG.peerPort, path: NETCFG.peerPath, secure: NETCFG.secure, config: { iceServers: NETCFG.iceServers }, debug: 1 };
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
  Object.assign(P2P, { peer: null, isHost: false, secret: null, salt: null, key: null, conns: new Map(), hostConn: null, nextId: 2, started: false, fails: [] });
  setTimeout(() => { P2P.closing = false; }, 0);
}

// ---------- Host ----------
function hostPlayers() { return [{ id: 1, name: P2P.hostName }].concat([...P2P.conns.values()].filter(c => c.auth).map(c => ({ id: c.id, name: c.name }))); }
function hostBroadcastPlayers() { const m = { t: 'players', players: hostPlayers(), hostId: 1 }; const s = JSON.stringify(m); for (const c of P2P.conns.values()) if (c.auth) pSend(c.conn, s); onNet(m); }
async function p2pCreate(name, pw, onErr) {
  p2pClose(); P2P.closing = false;
  P2P.isHost = true; P2P.hostName = name; P2P.onErr = onErr;
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
  conn.on('close', () => {
    clearTimeout(authTimer);
    if (!P2P.conns.has(c.id)) return;
    P2P.conns.delete(c.id);
    if (c.auth && P2P.isHost) { hostBroadcastPlayers(); onNet({ t: 'left', id: c.id }); }
  });
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
    c.auth = true; c.id = P2P.nextId++; c.name = String(m.name || 'Spieler').slice(0, 16);
    P2P.conns.set(c.id, c);
    pSend(c.conn, JSON.stringify({ t: 'joined', code: 'Privatraum', id: c.id, host: false, players: hostPlayers(), hostId: 1 }));
    hostBroadcastPlayers();
    if (P2P.started) onNet({ t: 'late', id: c.id, name: c.name });
    return;
  }
  if (m.t === 'in') { m.from = c.id; onNet(m); }
}
function hostSend(o) {
  if (o.t === 'start' && !o.to) P2P.started = true;
  if (!HOST_TYPES.has(o.t)) return;
  const to = o.to; const s = JSON.stringify(o);
  if (to) { const c = P2P.conns.get(to); if (c && c.auth) pSend(c.conn, s); }
  else for (const c of P2P.conns.values()) if (c.auth) pSend(c.conn, s);
}

// ---------- Client ----------
async function p2pJoin(secret, name, pw, onErr) {
  p2pClose(); P2P.closing = false;
  P2P.isHost = false; P2P.secret = secret; P2P.onErr = onErr;
  const pid = await peerIdFor(secret);
  const peer = newPeer(null); P2P.peer = peer;
  let joined = false, gotErr = false;
  peer.on('open', () => {
    if (peer !== P2P.peer) return;
    const conn = peer.connect(pid, { reliable: true, serialization: 'raw' }); P2P.hostConn = conn;
    const to = setTimeout(() => { if (!joined && !gotErr && peer === P2P.peer) onErr('Zeitüberschreitung – Host nicht erreichbar.'); }, 25000);
    conn.on('data', d => pRecv(conn, d, async m => {
      if (m.t === 'chal') { const k = await pwKey(String(m.salt), pw); pSend(conn, JSON.stringify({ t: 'auth', r: await sha256(k + '|' + m.nonce), name })); return; }
      if (m.t === 'err') { gotErr = true; clearTimeout(to); onErr(m.s); return; }
      if (m.t === 'joined') { joined = true; clearTimeout(to); }
      if (!joined) return;
      onNet(m);
    }));
    conn.on('close', () => { clearTimeout(to); if (peer !== P2P.peer || P2P.closing) return; if (joined) onNet({ t: 'hostleft' }); else if (!gotErr) onErr('Verbindung zum Host getrennt.'); });
    conn.on('error', e => { if (peer === P2P.peer && !joined) onErr(peerErrText(e)); });
  });
  peer.on('error', e => { if (peer === P2P.peer && !gotErr) onErr(peerErrText(e)); });
}
function clientSend(o) { if (o.t === 'in') pSend(P2P.hostConn, JSON.stringify(o)); }
function p2pSend(o) { if (P2P.isHost) hostSend(o); else clientSend(o); }
window.__P2P = P2P;
