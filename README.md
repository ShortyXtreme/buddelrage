# BuddelRage – ein Clonk-inspiriertes 2D-Sandbox-Spiel

Graben, Klettern, Gold verkaufen, Feuersteine werfen – plus Loren, Katapulte, Kanonen, Hütten, Wachtürme, Burgen,
Ritter mit Schwert/Schild/Bogen, Forschungsbaum, Lava, sich ausbreitendes Feuer, Tag/Nacht und Gamepad-Steuerung.
Alles funktioniert im Einzelspieler und online im Mehrspieler (Peer-to-Peer, Host-autoritativ) – **ohne eigenen Server**.

**Online spielen:** https://shortyxtreme.github.io/buddelrage/

## Einzelspieler
Seite öffnen (oder lokal `index.html`) → „Einzelspieler“ → Einstellungen wählen (Name, KI-Helfer, Gegner-Stufe, Kartengröße,
Goldziel, Optionen) → Modus starten: **Goldrausch**, **Melee · 1 KI** oder **Melee · 2 KI**. Keine Installation nötig.
Im Einzelspieler startet jedes Team (auch die KI) mit **einem Buddler**; weitere kauft man im Laden. Im Mehrspieler stellt der Host die Startzahl in der Lobby ein (Standard 3).
Beim ersten Start führt ein kurzes Tutorial durch die Steuerung (in den Einstellungen wiederholbar).

## KI-Teams, Schwierigkeit und Buddler-Name
* **Drei Stufen pro KI-Team:** Leicht 🌱 / Mittel ⚔️ / Schwer 🔥 – im Einzelspieler-Menü (KI Rot, bei „Melee · 2 KI“ auch KI Grün)
  und in der Team-Lobby (pro KI-Spieler, dazu die Stufe für die KI-Übernahme bei Verbindungsabbruch). Die letzte Wahl wird gespeichert.
  * *Leicht:* denkt/reagiert langsam, wirft ungenau, blockt selten, kauft wenig, greift erst nach ~5 Minuten und nur bei großer Übermacht an.
  * *Mittel:* ausgewogen; forscht (Waffen, Lore, Wachturm, Burg, Ritter, TNT), baut Wachturm und Burg, nutzt Loren.
  * *Schwer:* schnelle Reaktion, Würfe/Pfeile mit Vorhalt, Schildblock gegen anfliegende Geschosse, effizientere Wirtschaft,
    Katapult/Kanone, koordinierte Angriffe in Gruppen.
  * Keine Schummelei: Die KI nutzt dieselben Aktionen wie Spieler. Einzige Ausnahme: **Schwer** erhält +1 Geld alle 2 Sekunden
    (früher bekam jede KI diesen Bonus; jetzt nur noch Schwer).
* **Verteidigung (je Stufe stärker):** Die KI erkennt Angreifer auf ihre Buddler (auch fern der Basis) und Gegner an Hütte, Burg
  und Türmen, teilt passend zur Bedrohung **Verteidiger** ein (Rollenwechsel: Bergleute legen die Arbeit nieder), rüstet Unbewaffnete
  an der Hütte aus, schickt Unbewaffnete in Mittel/Schwer zum Schutz in die Hütte, **sammelt** sich an der Basis statt einzeln
  anzugreifen, lässt sich nicht weit weglocken, **deckt mit dem Schild**, während das eigene Schwert nachlädt, zieht sich angeschlagen
  zum **Heilen** zurück, besetzt Wachturm/Burg mit Bogenschützen, nimmt ein gemeinsames **Fokusziel**, kauft im Notfall einen Ritter,
  lässt beim Angriff eine **Wache** zu Hause und **kontert** nach einem abgewehrten Überfall. *Leicht* verteidigt nur mit wenigen
  Buddlern ohne diese Taktiken; *Mittel* und *Schwer* nutzen alles (Schwer: größerer Radius, mehr Verteidiger, häufiger Schildblock).
  Verbündete KI verteidigt die gemeinsame Basis ebenso.
* Die KI **arbeitet wie ein Spieler**: Gold abbauen → zur Hütte tragen oder per Lore holen → verkaufen → Buddler, Waffen,
  Feuersteine kaufen → forschen → Gebäude bauen → verteidigen/angreifen. Status steht in der Teamübersicht (z. B. „baut Gold ab“, „forscht: Burg“).
* **Wegsuche:** grobes Navigationsraster (5 px) mit A* über Laufen/Springen/Klettern/Hangeln/Schwimmen/Graben (Erde/Sand kosten mehr,
  Fels/Granit/Lava gesperrt), gestufte Steckenbleib-Erkennung (neu planen → freigraben → Ziel sperren → Treppe nach oben graben).
* **KI-Helfer (Einzel- und Mehrspieler):** Gekaufte Buddler arbeiten als Helfer in deinem Team – Gold abbauen, verkaufen, beim Bauen
  helfen, verteidigen (wenn bewaffnet), festsitzende Kameraden befreien. Stufe Aus / Leicht / Mittel / Schwer im Einzelspieler-Menü,
  in der Lobby (Host) und jederzeit im **Pause-Menü**. Helfer geben nie Geld aus. Du steuerst nur deinen eigenen Buddler;
  mit **Tab** (Gamepad L3, Touch „Buddler“) wechselst du – der vorherige arbeitet dann als Helfer weiter.
* **Übernahme beim Tod:** Stirbt dein Buddler, übernimmst du automatisch den besten Helfer (nah + gesund, Ritter bevorzugt) –
  Meldung „Du steuerst jetzt …“, die Kamera springt hin. Verloren ist erst, wenn kein eigener Buddler mehr lebt (und kein Geld für einen neuen).
* **Ausrüstung getrennt vom Inventar:** Schwert, Schild, Bogen, Rüstung und Enterhaken liegen in eigenen **Ausrüstungsplätzen**
  (HUD rechts neben den 3 Inventarplätzen; je Sorte einer). Das 3er-Inventar bleibt für Verbrauchsgüter: Steine, Feuersteine,
  Superflint, TNT, Gold, Wipf, Ballon, Erdklumpen. Wählen: **1–3** Inventar, **4** Schwert, **5** Bogen, **6** Enterhaken
  (Shift+Mausrad / LB·RB / Touch „Platz ⟳“ wechseln durch alles). Leere Hand = beste Waffe (Schwert, sonst Bogen).
  Schild und Rüstung wirken automatisch; **Blocken** = Schwert wählen (4) + Rechtsklick halten. Pfeile stehen am Bogen-Platz.
  **Q** mit gewählter Ausrüstung legt sie ab; beim Tod fällt alles heraus. Alte Spielstände werden automatisch umsortiert.
* **Steuerbares Verkaufen:** [V] / „Verkaufen“ verkauft nur die im Laden markierten Sorten – Standard: **nur Gold**
  (Wertgegenstände). Im Laden unter „Verkaufen“: Automatik-Schalter je Sorte (Stein, Feuerstein, TNT, Wipf …) und
  Einzelverkauf jedes getragenen Gegenstands **inkl. Ausrüstung**. Die Einstellung gilt pro Spieler, auch im Mehrspieler.
  Die KI verkauft Gold/Steine und behält Werkzeug und Waffen.
* **Erdklumpen – Löcher wieder schließen:** im Laden für 2 Geld (ohne Forschung). **Q** (Ablegen) füllt das Loch vor bzw.
  unter dem Buddler mit Erde, **Werfen** lässt ihn beim Aufprall platschen. Ein Klumpen füllt etwa eine Scheibe mit 8 px Radius
  (Tunnel, Wasser, Krater unter der Oberfläche). Buddler, Tiere, Fahrzeuge und Gebäude werden nie eingeschlossen – dort bleibt frei.
* **Inventar gehört jedem Buddler:** Plätze, gewählter Platz, gefangener Wipf, Enterhaken/Ballon bleiben beim Buddler – beim Wechseln,
  bei der Übernahme, bei KI-Übernahme nach Verbindungsabbruch, beim Host-Wechsel und im Spielstand. Die KI nutzt, was ihr Buddler trägt.
* **Rettung:** Sitzt ein Buddler (Spieler oder KI) unter der Erde fest, erscheint „Hilfe!“ über ihm, ein freier KI-Teamkollege in der
  Nähe bekommt die Aufgabe „Rettung“, läuft zum Einstieg und gräbt eine schräge Rampe zu ihm („Hilfe kommt…“). Klappt es nicht
  rechtzeitig, nimmt ein KI-Buddler den Notausgang; Spieler bekommen den Hinweis auf **N**.
* **Wehrhaft gegen Tiere:** Die KI flieht vor Haien aus dem Wasser, wehrt sich gegen anstürmende Wildschweine (oder weicht aus,
  wenn unbewaffnet/schwach) und arbeitet danach weiter; bewaffnete KI jagt gelegentlich ein Wildschwein (Gold) oder schießt
  einen Gold-Dieb-Vogel ab – ohne endlose Jagden.
* **Buddler-Name:** im Einzelspieler- und Mehrspieler-Menü einstellbar (max. 16 Zeichen, Sonderzeichen werden entfernt, wird gespeichert),
  steht über dem Buddler und in der Buddlerliste, wird im Mehrspieler synchronisiert. Weitere Buddler heißen „Name 2“, „Name 3“ …
* Details, Quellen und Testergebnisse: [AI_NOTES.md](AI_NOTES.md).

## Goldziel und Fahrzeuge
* **Goldrausch-Ziel:** 100 / 200 / 300 (Standard) / 500 / 1000 Geld oder „Eigenes“ (Schieberegler 50–5000) im Einzelspieler-Menü.
  Fortschritt im HUD („Ziel: 120 / 300“ mit Balken); wird im Spielstand gespeichert. (Im Mehrspieler gibt es keinen Gold-Modus.)
* **Fahrzeuge (Lore, Katapult, Kanone):** steigen kleine Stufen (bis 5 px) hoch, folgen Hängen und neigen sich dabei, bleiben nicht an
  einzelnen Pixeln hängen und sinken nicht ein. Zu steile Hänge (über ca. 50°) schaffen sie nicht – dann rollen sie sanft zurück.
  Auf Gefälle rollen sie leicht von selbst. Gilt beim Schieben durch Spieler und KI, im Mehrspieler synchron.

## Karten, Burgplatz und Planieren
* **Kartengröße:** Klein / Mittel (Standard, ca. 20 % größer als früher) / Groß / Riesig, im Einzelspieler-Menü bzw. vom Host in der Lobby
  (wird mit der Spielkonfiguration an alle übertragen und gespeichert). Breite: Faktor 0,85 / 1,2 / 1,6 / 2,2 der Grundbreite, Höhe 580 / 660 / 760 / 880 px.
  Höhlen, Gold, Gestein, Lava-Höhlen, Seen, Gegenstände, Tiere und Startabstände wachsen mit.
* **Garantierter Burgplatz:** Die Karten bleiben zufällig, aber jede Startbasis liegt auf einem ebenen, festen Plateau
  (Hütte in der Mitte, Platz für den Wachturm auf der einen und für die Burg auf der anderen Seite, freier Himmel darüber).
  Das Plateau geht mit sanften Hängen ins Gelände über; darunter liegt eine feste Erdschicht, Seen werden dort nicht angelegt.
* **Planieren:** Ist der Boden uneben, kann trotzdem gebaut werden: Erde/Sand im Bauraum wird abgetragen, Lücken bis 14 px darunter
  werden mit Erde aufgefüllt (über Schächten nur eine Abdeckung). Das kostet 1 Geld pro 60 Pixel und Arbeitszeit der Buddler (erste Bauphase).
  Fels, Granit, Wasser oder Lava im Bauraum, zu steile Hänge oder fehlender Boden machen den Platz unmöglich (Fels erst sprengen).
* **Vorschau** im Bau-Menü: Rahmen vor dem Buddler und Hinweis auf jeder Karte, grün = frei, gelb = wird planiert (+ Kosten), rot = unmöglich (mit Grund).
* **KI:** reserviert die Burgfläche ihres Plateaus (Wachturm kommt auf die andere Seite), nutzt dieselbe Platzprüfung und dasselbe Planieren,
  spart für ein erforschtes, aber noch nicht gebautes Gebäude, bevor sie weiter forscht.

## Mehrspieler (Peer-to-Peer über WebRTC)
1. **Host:** „Mehrspieler“ → Namen und **Raumpasswort** (mind. 4 Zeichen) eingeben → „Privaten Raum erstellen“.
2. In der Lobby erscheint ein **Einladungslink** (`…/buddelrage/#raum=<32 Zeichen Geheimnis>`) → „Link kopieren“
   und an Mitspieler schicken. Das Passwort am besten auf einem anderen Weg mitteilen.
3. **Mitspieler** öffnen den Link → das Mehrspielermenü öffnet sich mit eingefügtem Link → Passwort eingeben → „Beitreten“.
   Falsches Passwort: „Falsches Passwort – Beitritt abgelehnt.“
4. **Team-Lobby:** Der Host legt 2–6 Teams an (Name und Farbe per Farbtupfer), jeder Spieler wählt sein Team mit **„Beitreten“**,
   der Host kann Spieler verschieben (↔-Auswahl) und mit **„+ KI“** KI-Spieler in jedes Team setzen (Stufe je KI per Pille, ✕ entfernt).
   * **Gemeinsame Basis & Teamkasse:** Jedes Team startet an *einer* gemeinsamen Hütte (ein Startplatz mit Burgplatz je Team),
     alle Mitglieder – Menschen und KI – erscheinen dort zusammen. Geld liegt in der **Teamkasse** (HUD-Abzeichen „Teamkasse“):
     Verkaufen füllt sie, Kaufen, Bauen und Forschen bezahlt jedes Mitglied daraus; Forschung gilt für das ganze Team
     (ein Projekt gleichzeitig). Startgeld = Summe der Mitglieder. Verbündete KI plant Forschung/Bauten nur einmal pro Team
     und lässt Menschen mindestens ~40 % der Kasse übrig. Gilt auch für „Freunde gegen KI“, Host-Wechsel, KI-Übernahme und Spielstände.
     „Jeder gegen jeden“ bleibt wie bisher (jeder eigenes Team, eigene Basis und Kasse).
   * **KI im eigenen Team ist verbündet:** kein Eigenbeschuss (Waffen, Würfe, Explosionen), gemeinsame Gebäude (Hütte/Burg betreten,
     verkaufen, kaufen), hilft beim Bauen und Verteidigen. Gegnerische KI greift alle Menschen an.
   * **Schnellstart:** „🤝 Freunde gegen KI“ (alle Spieler in Team 1, 1–5 KI in Team 2, Stufe wählbar) oder „⚔️ Jeder gegen jeden“.
   * Startprüfung: mindestens zwei Teams mit Mitgliedern, max. 9 Einheiten (Spieler + KI), jeder Spieler hat ein Team – sonst klare Meldung.
   * Ein Team gewinnt, wenn alle anderen Teams ausgeschieden sind („Sieg! Euer Team Blau hat gewonnen!“).
   * Host-Wechsel und KI-Übernahme bei Verbindungsabbruch behalten Teams, Bündnisse und KI-Stufen.
   Max. 6 Spieler pro Raum.

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
* **Forschung [T]**: Lore → Katapult → Kanone, Wachturm → Burg, Waffenschmiede (Schwert, Schild, Bogen, Pfeile, Rüstung), Ritter, Sprengstoff (TNT). Kostet Geld und Zeit (Lore 35/18 s, Wachturm 60/27 s, Sprengstoff 50/22 s, Waffenschmiede 80/30 s, Katapult 70/30 s, Burg 120/45 s, Kanone 125/45 s, Ritter 105/38 s, Ballonbau 45/18 s), braucht Hütte/Burg, ein Projekt gleichzeitig. Option „Alles erforscht“ im Hauptmenü/in der Lobby.
* **Fahrzeuge** (im Laden [B]): *Lore* sammelt herumliegende Objekte ein (25 Plätze), wird geschoben, an der Basis mit [V] verkauft (nur markierte Sorten, der Rest bleibt in der Lore); beim Graben mit vollem Inventar landet Gold in einer nahen Lore. *Katapult* (Bogenwurf) und *Kanone* (flach, Steine werden zu Kanonenkugeln) feuern Steine, Gold, Feuersteine, TNT – aus dem Inventar des Schiebenden.
* **Gebäude** [C] als Baustelle: *Hütte*, *Wachturm* (betretbar, man wirft/schießt von oben, sicher, Heilung), *Burg* (Stein, Heimatbasis mit Laden/Verkauf/Forschung, viel Struktur, schnelle Heilung, gibt Rüstung beim Betreten). Gebäude können brennen (Holz) und gesprengt werden.
* **Ritter** (Laden): Schwert, Schild, Bogen + 15 Pfeile, Rüstung (−40 % Schaden). Nahkampf automatisch beim Gegeneinanderlaufen oder gezielt mit Linksklick/[F]; Blocken mit Schild (Schwert wählen, Rechtsklick halten) gegen Hiebe, Pfeile, Würfe und Bisse von vorne.
* **Lava**: fließt langsam, verbrennt Buddler/Tiere/Fahrzeuge, lässt Feuersteine explodieren, wird mit Wasser zu Fels (Wasser verdampft).
* **Feuer**: Gras, Holzbrücken, Holzhütten, Türme, Katapulte brennen; Feuer breitet sich aus, Explosionen und Lava entzünden, Wasser löscht.
* **Tag & Nacht** (4 Minuten pro Tag): Himmel, Sterne, Sonne/Mond, Dunkelheit mit Lichtquellen (Buddler, Gebäude, Feuer, Lava, Explosionen).
* **Gamepad** (Gamepad-API, Standardbelegung) – siehe unten und Hilfe [H].

## Tiere, Enterhaken, Ballon, Notausgang
* **Tiere** (Schalter „Tiere“ im Einzelspieler-Menü bzw. in der Lobby, Standard an; Anzahl wächst mit der Kartengröße,
  im Mehrspieler vom Host synchronisiert, fehlende Tiere tauchen nach und nach wieder auf):
  * **Wipfe** laufen und hüpfen über die Wiesen, fliehen vor Gefahr (Wildschweine, Explosionen, Kämpfe, Feuer). Mit **E** fangen
    (belegt einen der 3 Inventarplätze), mit **Q** freilassen, werfen oder an der Hütte für 6 Geld verkaufen.
  * **Vögel** am Himmel (setzen sich auch mal hin, fliegen vor Buddlern weg), **Fische** in Seen, **Fledermäuse** in Höhlen.
  * **Gold-Diebe:** Selten stürzt ein Vogel auf ein Goldstück, das **offen an der Oberfläche** liegt (freier Himmel, nicht in Tunneln,
    Höhlen, an/unter Gebäuden, nie aus Inventaren), packt es (Nugget in den Krallen) und fliegt weit weg – „Ein Vogel klaut Gold!“.
    Trifft man ihn (Pfeil, Wurf, Schlag), lässt er das Gold fallen; sonst legt er es weit entfernt an der Oberfläche ab. Höchstens ein
    Diebstahl gleichzeitig, mit langer Pause dazwischen. Tipp: Gold schnell aufsammeln oder in die Hütte bringen.
  * **Haie** in tiefem Wasser: jagen schwimmende Buddler und beißen (13 Schaden). Mit Pfeilen, Würfen, Schwert oder Sprengstoff zu besiegen.
* **Wildschweine** (ersetzen das frühere grüne Monster; Schalter „Wildschweine“): grasen und wandern friedlich. Nur wenn man sie
  angreift oder lange in die Enge treibt, stürmen sie höchstens zweimal los (8 Schaden, Stoß) und fliehen dann – sie verfolgen niemanden.
  Jagbar: ein erlegtes Wildschwein lässt 1–2 Gold fallen. Wenige Tiere (Standard 2), keine nächtlichen Zusatz-Spawns.
  Alte Spielstände mit Monstern werden beim Laden in Wildschweine umgewandelt.
* **Enterhaken** (Laden, 20 Geld, Ausrüstungsplatz – Taste 6): **Linksklick** schießt den Haken zum Mauszeiger (Vorschau: grüner Kreis = trifft, rotes X = zu weit).
  Er hält an festem Material (Erde, Fels, Holz …). Am Seil: **W/S** einholen/ablassen, **A/D** schwingen, **Leertaste** abspringen,
  **Linksklick/E** Seil lösen. Bricht der Ankerpunkt weg, fällt man.
* **Ballon** (Forschung „Ballonbau“, dann Laden, 15 Geld): **Linksklick** bläst ihn auf (braucht etwas Platz nach oben), der Buddler
  schwebt ~24 s langsam nach oben. **A/D** lenken, **S** sinken, **Leertaste/E** am Boden einpacken bzw. in der Luft loslassen.
  Pfeile, Würfe, Explosionen, Feuer und Lava lassen ihn platzen.
* **Notausgang**: unter der Erde **N 1,5 s halten** (oder Pause › Notausgang) → der Buddler kehrt zur nächsten eigenen Basis zurück
  (ohne Basis: an die Oberfläche). Kostet 10 Geld, ohne Geld 20 Leben; 60 s Abklingzeit; nicht im Gebäude, nicht an der Oberfläche
  und nicht mit Gegnern in der Nähe.
* **Kurze Unverwundbarkeit**: nach einem Treffer (ab 3 Schaden) blinkt der Buddler ~1 s und nimmt keinen weiteren Treffer-Schaden
  (Feuer, Lava und Ertrinken wirken weiter).
* Die **KI** (Mittel/Schwer) kauft nach wiederholtem Steckenbleiben einen Enterhaken und zieht sich damit aus Gruben; Ballons nutzt
  sie, wenn sie welche trägt. Echte KI-Teams verwenden nach sehr langem Feststecken unter der Erde auch den Notausgang.

## Komfort
* **Zoom**: Mausrad (Standard; **Shift+Mausrad** wechselt dann den Inventarplatz – in den Einstellungen umkehrbar), Tasten **+ / −**
  (bzw. Num+ / Num−), auf Touch-Geräten mit **zwei Fingern** (Pinch). Grenzen 50–250 %, beim Herauszoomen höchstens so weit,
  dass die Karte den Bildschirm noch füllt. Der Zoom wird gespeichert.
* **Speichern/Laden** (Einzelspieler): Pause › „Speichern / Laden“ – 3 Plätze im Browser (localStorage, komprimiert,
  ca. 100–300 KB je Stand). Laden auch im Hauptmenü („Spiel laden“). Überschreiben/Löschen mit Bestätigung (zweiter Klick).

## Mehrspieler: Chat, Emotes, Host-Wechsel
* **Chat**: **Enter** öffnet die Eingabe (max. 120 Zeichen), Enter sendet, Esc bricht ab. Nachrichten erscheinen als Sprechblase
  über dem ausgewählten Buddler und im Chatverlauf links unten. Touch: 💬-Knopf oben.
* **Emotes**: **G halten** öffnet das Emote-Rad (Maus zeigen, loslassen) oder G halten + **1–8**; im Chatfenster als Knöpfe
  (👋 Hallo, 👍 Gut gemacht, 😂 Haha, 😮 Oha, 😠 Grrr, ❤️ Danke, 🆘 Hilfe, 💰 Gold).
* Der Host prüft alle Nachrichten (Länge, Steuerzeichen, max. 6 Nachrichten pro 5 s je Spieler); Anzeige ist HTML-sicher.
* **Host-Wechsel (best effort)**: Der Host schickt alle 5 s einen kompakten Spielstand an alle. Verlässt er das Spiel
  (Tab zu, Verbindung weg – erkannt per Lebenszeichen nach ~6 s), übernimmt der erste verbliebene Mitspieler die Raum-ID,
  die anderen verbinden sich automatisch neu (gleiches Team, kein Passwort nötig). Das Team des alten Hosts übernimmt die KI.
  Im Test dauerte das ~7 s (neuer Host) bzw. ~10 s (übrige Spieler). Wer nicht binnen 20 s zurückkommt, wird von der KI ersetzt;
  kommt er später doch noch über den Einladungslink, bekommt er eine neue Zuschauer-Kennung.
* Verbindet sich ein Mitspieler nach einem Abbruch neu (Seite noch offen), übernimmt er wieder sein Team.

## Oberfläche
* Modernes „Glas“-Design, Schriften Inter und Lilita One (OFL), alles responsiv (Desktop, Tablet, Handy quer).
* HUD: Geld mit Symbol, Uhrzeit/Tag, Gesundheits- und Luftbalken, **Schnellleiste mit 3 Inventarplätzen** (Symbole + Tasten 1–3) plus 5 **Ausrüstungsplätzen** (Waffe, Schild, Bogen mit Pfeilzahl, Rüstung, Werkzeug; Tasten 4–6),
  gerahmte Minikarte, Toast-Meldungen, Forschungsfortschritt.
* **Dock** (rechts) zum Anklicken: Kaufen, Verkaufen, Bauen, Forschung, Hilfe, Einstellungen, Pause – jeweils mit Tastenkürzel.
* **Kontext-Hinweise** mit Tastensymbolen („E Betreten“, „LMT Werfen“ …), Zielkreuz und **Wurfbahn-Vorschau**; abschaltbar.
* Laden als Kartenraster (Symbol, Name, Preis, Beschreibung, Besitz, gesperrt mit nötiger Forschung, ausgegraut wenn zu teuer).
* Hauptmenü mit animierter Spielwelt im Hintergrund, Hilfe mit Reitern Tastatur / Gamepad / Touch / Ziel, Credits.
* **Musik**: fröhliche, prozedural erzeugte Musik (WebAudio, keine Dateien) mit leichten Drums, hüpfendem Bass und Melodie-Hooks:
  Menü (116 BPM), Tag (124 BPM), Nacht (112 BPM, sanfter), Kampf/Spannung (132 BPM, wenn Gegner nah sind oder man getroffen wird).
  Wechsel immer am Taktanfang. Startet nach der ersten Eingabe, eigener Lautstärkeregler und Ein/Aus in den Einstellungen.
* **Einstellungs-Bildschirme**: gruppierte Abschnitte mit Symbolen, Stufen als Pillen mit Symbol und Ein-Zeilen-Beschreibung,
  Schalter, Schieberegler mit Wert, Kartengrößen-Vorschau; per Maus, Touch (große Ziele), Tastatur (Tab, Pfeile, Enter) und Gamepad bedienbar.

## Steuerung (Tastatur + Maus) – in den Einstellungen frei belegbar
| Eingabe | Aktion |
|---|---|
| W A S D (oder Pfeiltasten) | Laufen · W halten: Klettern/Hangeln/Schwimmen · S: runter/loslassen |
| Leertaste | Springen (an der Wand halten = klettern) |
| Shift (halten) | Sprinten |
| **Linke Maustaste** | Aktion zum Mauszeiger: Werfen · Schwert · Bogen · Faust · Katapult/Kanone feuern · Lore beladen |
| **Rechte Maustaste (halten)** | In Richtung Mauszeiger graben · mit gewähltem Schwert (4) + Schild: Blocken |
| Maus bewegen | Zielen (auch Katapult-/Kanonenwinkel) |
| 1 / 2 / 3 oder Shift + Mausrad | Inventarplatz wählen |
| 4 / 5 / 6 | Ausrüstung wählen: Schwert / Bogen / Enterhaken |
| Q | Ablegen · mit Erdklumpen: Loch füllen |
| Mausrad · + / − | Zoomen |
| N (1,5 s halten) | Notausgang |
| Enter / G (halten) | Chat / Emote-Rad (Mehrspieler) |
| E | Benutzen: Fahrzeug anfassen/loslassen, Gebäude betreten/verlassen, Gegenstand aufheben, Wipf fangen |
| Am Seil: W/S · A/D · Leertaste | Einholen/Ablassen · Schwingen · Abspringen |
| Im Ballon: A/D · S · Leertaste | Lenken · Sinken · Einpacken/Loslassen |
| Q | Ablegen (TNT wird gezündet) · Lore ausladen |
| F / X | Nahkampf / Graben an-aus (ohne Maus) |
| Tab | Nächster Buddler |
| B / V / C / T | Laden / Verkaufen / Bauen / Forschung |
| H (F1) / O / M / Esc | Hilfe / Einstellungen / Ton / Pause |

## Steuerung (Gamepad, Twin-Stick)
| Knopf | Aktion |
|---|---|
| Linker Stick | Laufen, ↑ Klettern; ganz ausgelenkt = Sprinten · am Seil ↑/↓ einholen/ablassen |
| Rechter Stick | Zielen (Zielkreuz + Wurfbahn) |
| RT / LT (halten) | Aktion / Graben zum Ziel bzw. Blocken |
| A / B / X / Y | Springen / Graben an-aus / Benutzen / Ablegen |
| LB / RB | Inventarplatz wechseln |
| L3 / R3 | Nächster Buddler / Forschung |
| Select / Start | Laden / Pause |

## Touch
Virtueller Stick links, Knöpfe rechts (Aktion, Sprung, Graben, Benutzen, Ablegen, Platz, Buddler), Dock als Symbolleiste oben.
Tippen in die Welt = Aktion zu dieser Stelle, lange drücken = dorthin graben, zwei Finger = zoomen, 💬 = Chat/Emotes. Am Seil: Stick hoch/runter = einholen/ablassen, Sprung = abspringen. In den Einstellungen: Touch Auto/An/Aus.

## Bekannte Einschränkungen
* Mitspieler (nicht Host) haben übers Internet eine kleine Verzögerung; wer mitten in ein Spiel kommt, schaut zu.
* Host-Wechsel ist „best effort“: Es gibt genau einen Nachfolger-Kandidaten nach dem anderen (je 15 s Zeit); Stand ist der letzte
  Zwischenstand (max. ~5 s alt) plus die Positionen aus den Schnappschüssen des Nachfolgers – ganz kurz vor dem Wechsel Gekauftes
  oder Erforschtes kann verloren gehen. Die KI-Planung startet neu. Ist die Raum-ID beim Vermittlungsdienst noch belegt
  (Host nur „eingefroren“ statt weg), scheitert die Übernahme und alle landen mit Hinweis im Hauptmenü.
* Läuft der Host-Tab im Hintergrund, drosselt der Browser das Spiel für alle (wie bisher).
* Kein Splitscreen (bewusst weggelassen, um die Stabilität nicht zu gefährden).
* Teams in der Lobby teilen Basis, Kasse und Forschung; Buddler, Inventar und Statistik bleiben pro Spieler/KI. Gebäude gehören dem Erbauer, werden aber vom ganzen Team genutzt.
* Rettung ist „best effort“: in Granit/Fels eingeschlossene Buddler kann auch der Retter nicht freigraben (dann Notausgang).
* Speichern nur im Einzelspieler; Spielstände liegen im Browser des Geräts (kein Export).
* Emojis im Chat nutzen die Emoji-Schrift des Systems (Aussehen je nach Gerät).
* Ohne TURN-Server klappt die P2P-Verbindung bei manchen NAT-/Firewall-Kombinationen nicht. Die PeerJS-Cloud ist ein kostenloser Dienst ohne Garantie.
* Gamepad: es wird das erste verbundene Gamepad für den lokalen Spieler genutzt (kein Splitscreen).
* Touch-Steuerung ist eine einfache Grundversion (kein Zielen mit Wurfbahn per Finger, außer Tippen auf das Ziel).
* Kartengröße „Riesig“: der Kartenaufbau dauert etwa 1–2,5 s (je nach Teamzahl), im Mehrspieler wird die Startkarte komprimiert übertragen (z. B. 5760 × 880 → ca. 350 KB).
* Die KI baut die Burg nur, wenn sie lange genug überlebt und genug Gold hat (Mittel/Schwer); in kurzen, kampfreichen Runden kommt sie oft nicht dazu.
* Die KI-Wegsuche nutzt ein grobes Raster; in sehr zerklüfteten Höhlen braucht ein KI-Buddler manchmal einige Sekunden, um sich freizugraben.

Credits und Lizenzen: siehe CREDITS.md.
