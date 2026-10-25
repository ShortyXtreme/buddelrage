# BuddelRage – ein Clonk-inspiriertes 2D-Sandbox-Spiel

Graben, Klettern, Gold verkaufen, Feuersteine werfen – plus Loren, Katapulte, Kanonen, Hütten, Wachtürme, Burgen,
Ritter mit Schwert/Schild/Bogen, Forschungsbaum, Lava, sich ausbreitendes Feuer, Tag/Nacht und Gamepad-Steuerung.
Alles funktioniert im Einzelspieler und online im Mehrspieler (Peer-to-Peer, Host-autoritativ) – **ohne eigenen Server**.

**Online spielen:** https://shortyxtreme.github.io/buddelrage/

## Einzelspieler
Seite öffnen (oder lokal `index.html`) → Siedeln / Melee. Keine Installation nötig.

## Mehrspieler (Peer-to-Peer über WebRTC)
1. **Host:** „Mehrspieler“ → Namen und **Raumpasswort** (mind. 4 Zeichen) eingeben → „Privaten Raum erstellen“.
2. In der Lobby erscheint ein **Einladungslink** (`…/buddelrage/#raum=<32 Zeichen Geheimnis>`) → „Link kopieren“
   und an Mitspieler schicken. Das Passwort am besten auf einem anderen Weg mitteilen.
3. **Mitspieler** öffnen den Link → das Mehrspielermenü öffnet sich mit eingefügtem Link → Passwort eingeben → „Beitreten“.
   Falsches Passwort: „Falsches Passwort – Beitritt abgelehnt.“
4. Host stellt KI-Gegner/Optionen ein und startet. Max. 6 Spieler pro Raum, plus KI-Teams.

Technik:
* Transport: WebRTC-Datenkanäle über [PeerJS](https://peerjs.com) (`js/peerjs.min.js`, MIT, lokal eingebunden).
  Vermittlung (Signalisierung) über die kostenlose PeerJS-Cloud `0.peerjs.com`, NAT-Durchdringung über öffentliche STUN-Server
  (Google, Cloudflare, Twilio). Spieldaten laufen danach direkt zwischen den Browsern (DTLS-verschlüsselt).
* Der Browser des Hosts ist autoritativ (simuliert die Welt, schickt Schnappschüsse, Clients senden nur Eingaben).
* Private Räume: Die PeerJS-ID des Hosts ist ein SHA-256-Hash des Geheimnisses aus dem Link – es gibt keine Raumliste,
  das Geheimnis steht nur im `#`-Teil der URL (wird nie an einen Webserver geschickt).
* Passwort: Challenge-Response. Der Host speichert nur einen gesalzenen, gestreckten Hash; der Client beweist die Kenntnis des
  Passworts mit einem Hash über eine zufällige Nonce. Vor erfolgreicher Anmeldung wird nichts synchronisiert; falsche Versuche
  werden verzögert, nach 10 Fehlversuchen pro Minute sperrt der Host kurz.
* Hinter sehr strengen Firewalls/NAT (symmetrisches NAT, manche Firmen-/Mobilnetze) kann die Direktverbindung scheitern.
  Dann in `js/netconfig.js` einen TURN-Server eintragen (Beispiel in der Datei).

## GitHub Pages
`.github/workflows/pages.yml` veröffentlicht die Seite bei jedem Push auf `main` (Repo → Settings → Pages → Source: „GitHub Actions“).
Alle Pfade sind relativ, die Seite läuft daher auch unter `/buddelrage/`.

Der Ordner `server/` ist nur noch ein optionaler lokaler Webserver (`cd server && npm install && node server.js` → http://localhost:8080);
für den Mehrspieler wird er nicht mehr gebraucht. Lokal geht auch `python3 -m http.server`.

## Neue Spielelemente
* **Forschung [T]**: Lore → Katapult → Kanone, Wachturm → Burg, Waffenschmiede (Schwert, Schild, Bogen, Pfeile, Rüstung), Ritter, Sprengstoff (TNT). Kostet Geld und Zeit, braucht Hütte/Burg, ein Projekt gleichzeitig. Option „Alles erforscht“ im Hauptmenü/in der Lobby.
* **Fahrzeuge** (im Laden [B]): *Lore* sammelt herumliegende Objekte ein (25 Plätze), wird geschoben, an der Basis mit [V] samt Inhalt verkauft; beim Graben mit vollem Inventar landet Gold in einer nahen Lore. *Katapult* (Bogenwurf) und *Kanone* (flach, Steine werden zu Kanonenkugeln) feuern Steine, Gold, Feuersteine, TNT – aus dem Inventar des Schiebenden.
* **Gebäude** [C] als Baustelle: *Hütte*, *Wachturm* (betretbar, man wirft/schießt von oben, sicher, Heilung), *Burg* (Stein, Heimatbasis mit Laden/Verkauf/Forschung, viel Struktur, schnelle Heilung, gibt Rüstung beim Betreten). Gebäude können brennen (Holz) und gesprengt werden.
* **Ritter** (Laden): Schwert, Schild, Bogen + 15 Pfeile, Rüstung (−40 % Schaden). Nahkampf automatisch beim Gegeneinanderlaufen oder gezielt mit [F]; Blocken mit Schild [Shift] gegen Hiebe, Pfeile, Würfe und Bisse von vorne.
* **Lava**: fließt langsam, verbrennt Buddler/Monster/Fahrzeuge, lässt Feuersteine explodieren, wird mit Wasser zu Fels (Wasser verdampft).
* **Feuer**: Gras, Holzbrücken, Holzhütten, Türme, Katapulte brennen; Feuer breitet sich aus, Explosionen und Lava entzünden, Wasser löscht.
* **Tag & Nacht** (4 Minuten pro Tag): Himmel, Sterne, Sonne/Mond, Dunkelheit mit Lichtquellen (Buddler, Gebäude, Feuer, Lava, Explosionen). Nachts sind Monster schneller und zahlreicher.
* **Gamepad** (Gamepad-API, Standardbelegung) – siehe unten und Hilfe [H].

## Steuerung (Tastatur)
| Taste | Aktion |
|---|---|
| ←/→ oder A/D | Laufen (in Gegner hineinlaufen = Nahkampf) |
| ↑ oder W | Springen · Klettern · Hangeln (↑ halten) · Schwimmen · Katapult/Kanone: Winkel |
| ↓ oder S | Herunterklettern / Loslassen / Grabwinkel / Geschützwinkel |
| X oder ↓↓ | Graben an/aus |
| Leertaste | Werfen · Lore: einladen · Katapult/Kanone: feuern |
| F | Waffe: Schwert (nah) oder Bogen (↑/↓ halten zum Zielen) · sonst Faust |
| Shift (halten) | Mit Schild blocken |
| R oder G | Benutzen: Fahrzeug anfassen/loslassen, Gebäude betreten/verlassen |
| E | Ablegen (TNT wird gezündet) · Lore: ausladen |
| Q | Inventar wechseln |
| Tab / 1–9 | Buddler wechseln |
| B / V | Laden / Verkaufen (an Hütte oder Burg) |
| T | Forschung |
| C | Bauen (Hütte, Holzbrücke, Wachturm, Burg) |
| M / H / Esc | Ton / Hilfe / Pause · in Menüs ↑↓ + Enter oder Ziffern |

## Steuerung (Gamepad)
| Knopf | Aktion |
|---|---|
| Linker Stick / Steuerkreuz | Laufen, ↑ Springen/Klettern, ↓↓ senkrecht graben |
| A | Springen (halten = klettern) · Menü: auswählen |
| B | Graben · Menü: schließen |
| X | Werfen / Lore einladen / Geschütz feuern |
| Y | Waffe (Schwert/Bogen) |
| LB / RB | Inventar / nächster Buddler |
| LT (halten) / RT | Blocken / Benutzen |
| L3 / R3 | Ablegen bzw. Lore ausladen / Forschung |
| Select / Start | Laden / Pause-Menü (mit Bauen & Forschung) |

## Bekannte Einschränkungen
* Mitspieler (nicht Host) haben übers Internet eine kleine Verzögerung; wer mitten in ein Spiel kommt, schaut zu.
* Verlässt der Host das Spiel, endet die Runde für alle (kein Host-Wechsel).
* Ohne TURN-Server klappt die P2P-Verbindung bei manchen NAT-/Firewall-Kombinationen nicht. Die PeerJS-Cloud ist ein kostenloser Dienst ohne Garantie.
* Gamepad: es wird das erste verbundene Gamepad für den lokalen Spieler genutzt (kein Splitscreen).
* KI nutzt Schwert, Schild, Bogen, Ritter und Forschung, aber keine Fahrzeuge und baut keine Gebäude.

Credits und Lizenzen: siehe CREDITS.md.
