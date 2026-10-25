// BuddelRage Mehrspieler-Server: liefert das Spiel aus und vermittelt Räume (Host-autoritativ).
// Start: npm install && node server.js   (Port über PORT=… änderbar, Standard 8080)
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const ROOT = path.resolve(__dirname, '..');
const PORT = +process.env.PORT || 8080;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ogg': 'audio/ogg', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.resolve(ROOT, '.' + p);
  if (!file.startsWith(ROOT + path.sep) || file.includes(path.sep + 'server' + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 * 1024 });
const rooms = new Map();
let nextId = 1;
const HOST_TYPES = new Set(['start', 'map', 'snap', 'chunks']);
function send(ws, o) { if (ws && ws.readyState === 1) ws.send(typeof o === 'string' ? o : JSON.stringify(o)); }
function code() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let c; do { c = ''; for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)]; } while (rooms.has(c)); return c; }
function playersMsg(room) { return { t: 'players', players: room.players, hostId: room.hostId }; }
function broadcast(room, o, exceptId) { const s = JSON.stringify(o); for (const [id, ws] of room.clients) if (id !== exceptId) send(ws, s); }

wss.on('connection', ws => {
  ws.id = nextId++; ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    const room = ws.room;
    if (m.t === 'create' && !room) {
      const r = { code: code(), hostId: ws.id, clients: new Map([[ws.id, ws]]), players: [{ id: ws.id, name: String(m.name || 'Host').slice(0, 16) }], started: false };
      rooms.set(r.code, r); ws.room = r;
      send(ws, { t: 'joined', code: r.code, id: ws.id, host: true, players: r.players, hostId: r.hostId });
      console.log('Raum', r.code, 'erstellt');
      return;
    }
    if (m.t === 'join' && !room) {
      const r = rooms.get(String(m.code || '').toUpperCase());
      if (!r) return send(ws, { t: 'err', s: 'Raum nicht gefunden.' });
      if (r.players.length >= 6) return send(ws, { t: 'err', s: 'Raum ist voll (max. 6).' });
      const name = String(m.name || 'Spieler').slice(0, 16);
      r.clients.set(ws.id, ws); r.players.push({ id: ws.id, name }); ws.room = r;
      send(ws, { t: 'joined', code: r.code, id: ws.id, host: false, players: r.players, hostId: r.hostId });
      broadcast(r, playersMsg(r), ws.id);
      if (r.started) send(r.clients.get(r.hostId), { t: 'late', id: ws.id, name });
      return;
    }
    if (!room) return;
    if (ws.id === room.hostId && HOST_TYPES.has(m.t)) {
      if (m.t === 'start' && !m.to) room.started = true;
      if (m.to) send(room.clients.get(m.to), raw.toString());
      else { const s = raw.toString(); for (const [id, c] of room.clients) if (id !== ws.id) send(c, s); }
      return;
    }
    if (ws.id !== room.hostId && m.t === 'in') { m.from = ws.id; send(room.clients.get(room.hostId), m); }
  });
  ws.on('close', () => {
    const r = ws.room; if (!r) return;
    r.clients.delete(ws.id); r.players = r.players.filter(p => p.id !== ws.id);
    if (ws.id === r.hostId) { broadcast(r, { t: 'hostleft' }); rooms.delete(r.code); console.log('Raum', r.code, 'geschlossen'); }
    else { broadcast(r, playersMsg(r)); send(r.clients.get(r.hostId), { t: 'left', id: ws.id }); }
  });
});
setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 30000);
server.listen(PORT, () => console.log('BuddelRage-Server läuft: http://localhost:' + PORT));
