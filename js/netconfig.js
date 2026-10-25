// Optionale Netzwerk-Einstellungen für den Peer-to-Peer-Mehrspieler.
// Standard: PeerJS-Cloud (0.peerjs.com) zur Vermittlung + öffentliche STUN-Server.
// Hinter strengen Firewalls/NAT (z. B. manche Mobilfunknetze) klappt die Direktverbindung evtl. nicht.
// Dann hier einen TURN-Server eintragen (z. B. kostenloses Kontingent bei metered.ca, Cloudflare Calls TURN
// oder ein eigener coturn). Achtung: TURN-Zugangsdaten in einem öffentlichen Repo sind für jeden sichtbar.
//
// window.BR_NETCFG = {
//   iceServers: [
//     { urls: 'stun:stun.l.google.com:19302' },
//     { urls: 'turn:DEIN-TURN-SERVER:443?transport=tcp', username: 'NAME', credential: 'PASSWORT' }
//   ]
// };
