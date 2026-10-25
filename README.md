# BuddelRage – ein Clonk-inspiriertes 2D-Sandbox-Spiel

Graben, Klettern, Gold verkaufen, Feuersteine werfen – plus Loren, Katapulte, Kanonen, Hütten, Wachtürme, Burgen,
Ritter mit Schwert/Schild/Bogen, Forschungsbaum, Lava, sich ausbreitendes Feuer, Tag/Nacht und Gamepad-Steuerung.
Alles funktioniert im Einzelspieler und online im Mehrspieler (Peer-to-Peer, Host-autoritativ) – **ohne eigenen Server**.

**Online spielen:** https://shortyxtreme.github.io/buddelrage/

## Einzelspieler
Seite öffnen (oder lokal `index.html`) → „Einzelspieler“ → Siedeln / Melee / Freies Spiel. Keine Installation nötig.
Im Einzelspieler startet jedes Team (auch die KI) mit **einem Buddler**; weitere kauft man im Laden. Im Mehrspieler stellt der Host die Startzahl in der Lobby ein (Standard 3).
Beim ersten Start führt ein kurzes Tutorial durch die Steuerung (in den Einstellungen wiederholbar).

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
* **Ritter** (Laden): Schwert, Schild, Bogen + 15 Pfeile, Rüstung (−40 % Schaden). Nahkampf automatisch beim Gegeneinanderlaufen oder gezielt mit Linksklick/[F]; Blocken mit Schild (Rechtsklick halten, Schwert/Schild gewählt) gegen Hiebe, Pfeile, Würfe und Bisse von vorne.
* **Lava**: fließt langsam, verbrennt Buddler/Monster/Fahrzeuge, lässt Feuersteine explodieren, wird mit Wasser zu Fels (Wasser verdampft).
* **Feuer**: Gras, Holzbrücken, Holzhütten, Türme, Katapulte brennen; Feuer breitet sich aus, Explosionen und Lava entzünden, Wasser löscht.
* **Tag & Nacht** (4 Minuten pro Tag): Himmel, Sterne, Sonne/Mond, Dunkelheit mit Lichtquellen (Buddler, Gebäude, Feuer, Lava, Explosionen). Nachts sind Monster schneller und zahlreicher.
* **Gamepad** (Gamepad-API, Standardbelegung) – siehe unten und Hilfe [H].

## Oberfläche
* Modernes „Glas“-Design, Schriften Inter und Lilita One (OFL), alles responsiv (Desktop, Tablet, Handy quer).
* HUD: Geld mit Symbol, Uhrzeit/Tag, Gesundheits- und Luftbalken, **Schnellleiste mit 3 Inventarplätzen** (Symbole + Tasten 1–3),
  gerahmte Minikarte, Toast-Meldungen, Forschungsfortschritt.
* **Dock** (rechts) zum Anklicken: Kaufen, Verkaufen, Bauen, Forschung, Hilfe, Einstellungen, Pause – jeweils mit Tastenkürzel.
* **Kontext-Hinweise** mit Tastensymbolen („E Betreten“, „LMT Werfen“ …), Zielkreuz und **Wurfbahn-Vorschau**; abschaltbar.
* Laden als Kartenraster (Symbol, Name, Preis, Beschreibung, Besitz, gesperrt mit nötiger Forschung, ausgegraut wenn zu teuer).
* Hauptmenü mit animierter Spielwelt im Hintergrund, Hilfe mit Reitern Tastatur / Gamepad / Touch / Ziel, Credits.
* **Musik**: ruhige, prozedural erzeugte Ambient-Musik (WebAudio, keine Dateien); startet nach der ersten Eingabe,
  leise voreingestellt, eigener Lautstärkeregler und Ein/Aus in den Einstellungen.

## Steuerung (Tastatur + Maus) – in den Einstellungen frei belegbar
| Eingabe | Aktion |
|---|---|
| W A S D (oder Pfeiltasten) | Laufen · W halten: Klettern/Hangeln/Schwimmen · S: runter/loslassen |
| Leertaste | Springen (an der Wand halten = klettern) |
| Shift (halten) | Sprinten |
| **Linke Maustaste** | Aktion zum Mauszeiger: Werfen · Schwert · Bogen · Faust · Katapult/Kanone feuern · Lore beladen |
| **Rechte Maustaste (halten)** | In Richtung Mauszeiger graben · mit Schwert/Schild: Blocken |
| Maus bewegen | Zielen (auch Katapult-/Kanonenwinkel) |
| 1 / 2 / 3 oder Mausrad | Inventarplatz wählen |
| E | Benutzen: Fahrzeug anfassen/loslassen, Gebäude betreten/verlassen, Gegenstand aufheben |
| Q | Ablegen (TNT wird gezündet) · Lore ausladen |
| F / X | Nahkampf / Graben an-aus (ohne Maus) |
| Tab | Nächster Buddler |
| B / V / C / T | Laden / Verkaufen / Bauen / Forschung |
| H (F1) / O / M / Esc | Hilfe / Einstellungen / Ton / Pause |

## Steuerung (Gamepad, Twin-Stick)
| Knopf | Aktion |
|---|---|
| Linker Stick | Laufen, ↑ Klettern; ganz ausgelenkt = Sprinten |
| Rechter Stick | Zielen (Zielkreuz + Wurfbahn) |
| RT / LT (halten) | Aktion / Graben zum Ziel bzw. Blocken |
| A / B / X / Y | Springen / Graben an-aus / Benutzen / Ablegen |
| LB / RB | Inventarplatz wechseln |
| L3 / R3 | Nächster Buddler / Forschung |
| Select / Start | Laden / Pause |

## Touch
Virtueller Stick links, Knöpfe rechts (Aktion, Sprung, Graben, Benutzen, Ablegen, Platz, Buddler), Dock als Symbolleiste oben.
Tippen in die Welt = Aktion zu dieser Stelle, lange drücken = dorthin graben. In den Einstellungen: Touch Auto/An/Aus.

## Bekannte Einschränkungen
* Mitspieler (nicht Host) haben übers Internet eine kleine Verzögerung; wer mitten in ein Spiel kommt, schaut zu.
* Verlässt der Host das Spiel, endet die Runde für alle (kein Host-Wechsel).
* Ohne TURN-Server klappt die P2P-Verbindung bei manchen NAT-/Firewall-Kombinationen nicht. Die PeerJS-Cloud ist ein kostenloser Dienst ohne Garantie.
* Gamepad: es wird das erste verbundene Gamepad für den lokalen Spieler genutzt (kein Splitscreen).
* Touch-Steuerung ist eine einfache Grundversion (kein Zielen mit Wurfbahn per Finger, außer Tippen auf das Ziel).
* KI nutzt Schwert, Schild, Bogen, Ritter und Forschung, aber keine Fahrzeuge und baut keine Gebäude.

Credits und Lizenzen: siehe CREDITS.md.
