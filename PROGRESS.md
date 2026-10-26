# Fortschritt (Burgplatz / Planieren / Kartengrößen) – Stand 25.10.2026 17:55
## Fertig (Code)
- game.js: MAP_SIZES/mapDims, Startplateau je Basis (plats, castleSites, baseDir), Seen skaliert, Items nach Fläche,
  schnellere Materialgenerierung, placeCheck/sitePos/levelStep (Planieren), build(c, what, at), Snapshot lv-Flag,
  Material-Sim: Film-Verdunstung, Luftblasen-Fix, Lava-canFall, SIM_CHUNK_BUDGET=360
- ai.js: aiPlanSite mit reserviertem Burgplatz + placeCheck/level, Burgfläche frei halten, pend/keep-Sparlogik,
  arm nur mit freiem Geld, unbewaffnete Kämpfer bauen ab, Bauplatz-Helfer am Rand, Baustellen-Stillstand 60 s → aufgeben
- render.js: Bauvorschau grün/gelb/rot, Planier-Baustelle, Kamera bei offenem Bau-Menü
- menus.js/css: Statuszeile je Karte, Hover-Vorschau, Menü unten angedockt; Hilfetexte
- main.js/boot.js/index.html: #spsize/#optsize (gespeichert), applySize, sendMap mit Deflate + Chunk-Puffer
- README: Abschnitt „Karten, Burgplatz und Planieren“
## Tests bisher
- castlecheck.js: klein/mittel/gross komplett 100 %, riesig settle/sp2/sp3 100 % (Rest lief)
- buildui.js ok, p2p.js SIZE=riesig ok (842 KB → 353 KB, Hash identisch, Planieren synchron)
- aiui, ui1, ui2 (60.5 fps), touch, mpui: ERRS []
## Offen
- Finale Sims auswerten (test/fin-*.log, summ.py), fps Riesig bei freier CPU messen
- AI_NOTES.md Abschnitt + Zahlen, README-Grenzen, Zip + sha256
- 17:58 Bedrohungs-Fix (nur bewaffnete Gegner / direkt an Basis), finale Sims gestartet (test/fin-*.log, alte in test/old)
- 18:08 Plan-Timeout in aiPlan (75 s). Sim-Ergebnis vor dieser Änderung: test/summ-final.txt
- 18:10 Finale Sims (test/r2/summ.txt): Burg gebaut Schwer 7/20 (7/11 nach Forschung), Mittel 10/20 (10/15), Leicht 0. fps Riesig idle 60,25. Regressions-Suite (aiui, ui1, ui2, touch, mpui, buildui, p2p Mittel+Riesig) komplett ERRS []. castlecheck alle Größen 100 % (inkl. Riesig 9 Teams: 450/450). Doku aktualisiert.
- 18:20 Zip gebaut (nicht hochgeladen).

# Fortschritt (Tiere / Enterhaken & Ballon / Chat & Host-Wechsel / Komfort) – Start 25.10.2026 18:35
Backup: /workspace/clonk-game.bak5 · Testserver: python3 -m http.server 8099 (in clonk-game)
## Plan
- js/fauna.js: Tiere (wipf, bird, fish, bat, shark) – World.prototype, Snapshot-Feld `a`, Wipf als Inventar-Item 'wipf' (spawnItem('wipf') → Tier)
- js/gear.js: Enterhaken (item 'hook', act 'rope'), Ballon (item 'balloon', act 'float'), Notausgang (action 'escape'), Unverwundbarkeit invT
- js/save.js: serialize/deserialize, Speicherstände (localStorage, 3 Plätze, deflate), Menü
- js/chat.js: Chat (Enter), Emote-Rad (G), Sprechblasen, Chatlog; net.js: 'chat', 'mig' (Host-Wechsel)
- Zoom (Mausrad, +/-, Pinch), Steuerung/Hilfe/Tutorial/README/CREDITS
## Status
- Fauna/Gear/Save/Chat implementiert, in index.html eingebunden; Steuerung: 'up' getrennt von 'jump' (W zieht am Seil), Rad = Zoom, Shift+Rad = Platz (umschaltbar)
- Monster neu gezeichnet (Stacheln, glühende Augen, Krallen, Zähne, Lauf-/Aushol-/Biss-Animation, Treffer-Blitz, HP-Balken), Biss mit 16-Tick-Vorwarnung (Snapshot-Feld bite: negativ = Ausholen, Format gleich lang)
- Host-Wechsel: 'mig' alle 300 Ticks + kurz nach Beitritt/Wechsel; Lebenszeichen (ping 1 s, Timeout Host 6 s / Client 8 s), weil WebRTC-close beim Tab-Schließen nicht zuverlässig kommt; Nachfolger prüft erst, ob der Host noch da ist; Kandidaten der Reihe nach (15 s)
- Tests: test/feat2.js (Fauna je Größe, Haken, Ballon, Unverwundbarkeit, Wipf, Notausgang, Zoom, Monster-Biss, Save-Roundtrip, Menü-Laden), test/mp3.js (3 Tabs: Chat, Emotes, Spam, Host weg → Anna Host, Bert zurück; Anna weg → Bert Host), test/mp4.js (Client-Abbruch → Rückkehr ins Team; Host verlässt Lobby), test/pinch.js, test/aigear.js, test/sprite.js, test/scene.js. Lokaler TURN (coturn 127.0.0.1:3478) nötig für WebRTC im Container.
- Regressions-Suite aiui, ui1, ui2, touch, buildui, mpui, p2p: ERRS []
- 19:35 Tiere mit eigenem Zufallsgenerator (frnd, beim Laden neu gesetzt), damit Karten-/KI-Zufall unverändert bleibt. Sims r6 (alle Stufen, klein/mittel/gross/riesig): ERRS [], Schwer gewinnt/verliert wie erwartet (Abweichungen durch Tier-Einfluss auf Kämpfe, kein Fehler). Jetzt: feat2, fpsbig, castlecheck, mp3, Regressionen.
- 19:55 Abschluss-Tests nach frnd-Änderung: feat2, fpsbig (Riesig 60,25 fps mit Tieren), castlecheck 40 Seeds alle Größen 100 %, mp3 (3 Tabs, 2 Host-Wechsel), mp4, pinch, wipfthrow, sprite, aiui, ui1, ui2, touch, buildui, mpui, p2p – alle ERRS [] / Exit 0. Zip wird gebaut (nicht hochgeladen, kein Push).
- 19:58 Abschluss-Tests nach frnd-Änderung: feat2, mp3 (3 Tabs, zweifacher Host-Wechsel), mp4, pinch, wipfthrow, sprite, aiui, ui1, ui2, touch, buildui, mpui, p2p: alle ERRS []/Exit 0. fpsbig mit Tieren: Mittel 60,25 fps, Riesig 60,25 fps (schlechtester Frame 19 ms). castlecheck 40 Seeds alle Größen 100 %. Sims r6: ERRS [], ~0,5–1,3 ms/Tick.
- 20:00 Zip gebaut (nicht hochgeladen, nichts gepusht).

# Fortschritt (Team-Lobby) – Start 26.10.2026 12:00
Backup: /workspace/clonk-game.bak6
- 12:10 Team-Seiten (side) in World: ally()/friendly(), kein Eigenbeschuss zwischen Verbündeten, gemeinsame Hütten/Burgen (betreten, verkaufen, einkaufen, mitbauen), Sieg pro Seite. KI: Gegner = nicht verbündet, verteidigt verbündete Basen, hilft bei Baustellen von Verbündeten.
- 12:15 js/lobby.js: Team-Lobby (Teams/Farben/Namen, Beitreten, Host verschiebt, „+ KI“ mit Stufe, Freunde gegen KI, Jeder gegen jeden, Startprüfung). net: 'lobby'/'lteam'.
- 12:20 KI-Helfer mit Stufe (SP/MP-Auswahl, Pause-Menü, Aktion 'helper'), Übernahme beim Tod (bester eigener Buddler, Meldung).
- 12:25 Monster → Wildschwein (friedlich, max. 2 Anstürme, flieht, lässt Gold fallen, keine Nacht-Extras); Speicherversion 2 (v1 wird umgewandelt). KI wehrt sich gegen Tiere (Wildschwein: kämpfen/ausweichen, Hai: Wasser verlassen), Gelegenheitsjagd mit Abklingzeit.
- Offen: Fahrzeug-Physik, Goldziel-Einstellung, schönere Einstellungs-Screens, Tests.
- 12:40 Fahrzeug-Physik: vFit/vRest/vSlope (Stufen bis 5 px, alle Spalten, Neigung, Hangabtrieb, zu steil → zurückrollen, Entklemmen), Darstellung mit Neigung/geglättetem y. test/vehtest.js ROUGH=1: alle 18 Fahrten (Mittel+Riesig, 3 Typen, 3 Seeds) erreichen das Ziel, clip 0 (alt: Katapult blieb hängen, clip 38578).
- 12:50 Rettung (js/rescue.js), Musik neu (js/audio.js: Menü 116 / Tag 124 / Nacht 112 / Kampf 132 BPM), Vögel klauen Gold (fauna.js goldOpen/birdTheft/birdDropGold, Snapshot-Bit 16, Nugget im Schnabel/Krallen, KI schießt Dieb).
- 13:00 Einstellungs-Screens neu (js/ui.js: Segment-Pillen über unsichtbaren <select>, Ein-Zeilen-Beschreibung, Kartenvorschau, Schalter mit Untertitel, Schieberegler mit Füllung, Tastatur/Gamepad), Goldziel (100–1000/Eigenes) mit HUD-Balken, SP-Schalter Wildschweine, Lobby-Teamkarten mit Farbtupfern und Stufen-Pillen.
- 13:10 Tests: birdtest, boartest, musictest, allysim, allycoop, mpteam (3 Tabs), sptest, rescuetest, vehtest, shots7 (Screenshots Desktop/Handy). Alte MP-Tests auf neue Lobby umgestellt (lobbyAct). mp.js/mp2.js/mptick.js sind veraltet (#lobbycode gibt es seit Längerem nicht mehr).
- 13:15 Abschluss-Tests (letzter Stand): birdtest, boartest, smoke2, sptest, mpteam (3 Tabs, ALLERRS 0), rescuetest (2/2 Eingeklemmte gerettet, 3. Fall befreit sich selbst), ui2 (Blocken/Schwingen ok), fpsbig (Riesig 60,25 fps), castlecheck 10/20 Seeds alle Größen 100 %, Screenshots shots7 neu (ERRS []). Alles Exit 0, keine Konsolenfehler.
- 13:15 Zip gebaut: /workspace/buddelrage-site.zip (nicht hochgeladen, nichts gepusht).

# Fortschritt (Team-Basis & KI-Verteidigung) – Start 26.10.2026 13:50
Backup: /workspace/clonk-game.bak7 (= Zip 0493259…)
- 14:10 Teamkasse/gemeinsame Basis: World.setupPools() (Geld/Forschung/Projekt je Seite über Accessoren, Startgeld summiert), eine Basis/Hütte je Seite (generate(nSeiten), baseIdx/baseX/castleSiteOf), Teamkollegen starten gemeinsam, Forschung läuft einmal je Seite, Meldungen an alle Mitglieder. Speichern/Laden (cfg.sharedBase; alte Stände: Kassen werden zusammengelegt), Client (setupPools), Host-Wechsel (mergeLive). HUD-Abzeichen „Teamkasse“. KI: nur erste KI im Team plant Forschung/Bau, Rücklage für menschliche Mitspieler. Lobby-Kartenbreite nach Seiten. test/teambase.js ok.
- 14:30 KI-Verteidigung js/aidef.js (AI_DEF je Stufe): Bedrohung inkl. Angreifer auf eigene Buddler/Gebäude (hitBy), Verteidiger-Zuteilung, Sammelpunkt, Fokusziel, Rückzug/Heilen, Schutz in Hütte für Unbewaffnete, Leine, Turm/Burg-Posten, Schild-Takt im Nahkampf, Notkauf Ritter, Konter, Basiswache. Fehler behoben: KI-Heilen an der Burg scheiterte (use() braucht Gebäudemitte), Turm-Aufgabe ohne Zeitlimit. test/raidtest.js (Überfall durch 3 Ritter, alte KI als Angreifer).
- 16:20 KI-Verteidigung abgestimmt: Rückzug nur bei verlorenem Duell (Schwer ab 35 %), aus der Hütte bei Gefahr ab 65 % bewaffnet zurück; Unbewaffnete greifen bewaffnete Gegner nicht mehr mit Fäusten an (Schutz/Ausweichen); KI gibt höchstens ~60 % der Teamkasse aus, wenn Menschen im Team sind. mpteam (3 Tabs) prüft jetzt die Teamkasse: gleich auf allen Tabs, Verkauf/Kauf, Host-Wechsel ok.
- 16:35 Überfall-Tests (20 Seeds, 3 Ritter): Leicht 11/20 (vorher 0/12 – Heil-Fehler behoben), Mittel 10/20 (vorher 10/20, weniger Verluste 48 statt 55), Schwer 15/20 (vorher 16/20, Verluste 50 statt 65). Überfall durch 3 bewaffnete Buddler (12 Seeds): Leicht 4 (0), Mittel 8 (10), Schwer 9 (6). Mittel: Rückzugsschwelle entfernt (Grund-Heilen bleibt). KI-Sims (2–4 Teams, klein–riesig): keine Fehler, 0,25–1,9 ms/Tick.
- 16:40 test/allydef.js: verbündete KI verteidigt gemeinsame Basis gegen 2 Ritter – Leicht 1 Verteidiger/0 Kills, Mittel 4/2 Kills, Schwer 5/2 Kills, Hütte steht, ERRS [].
- 16:55 Regressionen (alle Exit 0, ERRS []): teambase, mpteam (3 Tabs, Teamkasse gleich auf allen Tabs, Kauf/Verkauf, Host-Wechsel, Sieg), sptest (Helfer, Übernahme, Speichern/Laden identisch, v1-Upgrade), smoke2, feat2, allysim, allycoop, aiui, ui1, ui2, touch, buildui, pinch, wipfthrow, sprite, helpchk, mpui, mp3, mp4, p2p, mpfeat, birdtest, boartest, rescuetest.
- 17:00 Weitere Tests: vehtest (alle erreichen das Ziel, clip 0), aiveh, musictest, fpsbig (Riesig 60 fps), castlecheck 10/20 Seeds 1600/1600 Starts ok (Jeder gegen jeden), teamcastle.js (3 Teams × 3 KI, alle Größen: je Team eine Hütte + gültiger Burgplatz), Überfall Mittel nach Abstimmung 13/20 (vorher 10/20). Alles ERRS [].
- 17:03 Zip gebaut: /workspace/buddelrage-site.zip (nicht hochgeladen, nichts gepusht).

# Fortschritt (Ausrüstung, Verkauf, Wirtschaft, Löcher füllen) – Start 26.10.2026 20:31
Backup: /workspace/clonk-game.bak8 (= Zip 5000b67…)

## Stand (siehe Uhrzeit unten)
- [x] 1 Ausrüstungsplätze: c.gear (sword/shield/bow/hook), Rüstung = c.armor, Pfeile = c.arrows; Tasten 4–6 (Schwert/Bogen/Haken), Wechsel per Rad/LB/RB/Touch über selSlots; HUD-Ausrüstungsleiste (5 Plätze, gestrichelt), giveItem/canTake überall (Kauf, Aufheben), Tod wirft auch gear ab, Snapshot a[25], Save + migrateGear (alte Stände), KI aiSlot/aiArm/aiFindItem angepasst. Rechtsklick blockt nur mit gewähltem Schwert (4), sonst graben.
- [x] 2 Verkaufen: t.autoSell (Standard {gold}), sell(c, only), sellOne (Inv-Index oder Ausrüstungstyp), Aktionen 'autosell'/'sellone', Snapshot-Team a[11], Laden: Box „Verkaufen“ (Automatik-Chips + Einzeln-Chips). KI verkauft fest Gold/Stein + Lore.
- [x] 3 Wirtschaft: Forschung ×~1,75 Kosten / ×1,5 Zeit, Laden teurer (s. Tabelle im Abschlussbericht).
- [x] 4 Erdklumpen (js/fill.js): Laden 2 Geld, Q = Loch vor/unter füllen, Werfen = platscht; blockiert nie Buddler/Tiere/Fahrzeuge/Gebäude.
- [x] test/gear.js grün
- [ ] KI-Sims alle Stufen, Goldziel SP, Regression, MP 3 Spieler TURN, Screenshots, Doku, Zip
- [x] MP 3 Spieler + TURN (test/mpgear.js = mpteam + R3-Teil): Kauf/Ausrüstung/Slot sync, Standardverkauf nur Gold, autosell sync, sellone, Erdklumpen füllt bei Host/A/B gleich (359→222 px) – ERRS []
- [x] Screenshots test/shots9/*.png (HUD Ausrüstung desk/phone, Verkaufsbox, Erdklumpen vorher/nachher, mp-anna-shop)
- [x] Doku: README, Hilfe (Tipps, Gamepad), Ladentexte
- [ ] läuft: r8/sims (aisim3 neu vs bak8), r8/settle (Goldrausch erreichbar), dann r8/reg3.sh (Raids + Regression + castlecheck)
- 21:22 Regression reg3 komplett grün (castlecheck, fpsbig 60 fps, mpfeat nur alter Digit10-Testfehler → Erdklumpen ans Ende von SHOP_ALL verschoben). sptest/ui2 auf neues Ausrüstungsmodell umgestellt: grün.
- KI-Fixes: aiArm hält Platz für Gold (Flints nur bis inv+Schwert+Schild<3); Rechtsklick-Block nur für Menschen (!c.ai). Versuch fullNoGold mit Ausrüstung → schlechter, zurückgenommen.
- läuft: r8/raid4.sh (raidH_*), danach Zip
- 21:36 Raids final (raidH_*): Ritter-Überfall 20 Seeds leicht 9 / mittel 7 / schwer 11 (Release 2: 11/10/15; mit alter Wirtschaft + neuem Code 11/9/12 → Rückgang = teurere Forschung, Ritter seltener erforscht nach 3 min). Bewaffnete Buddler 12 Seeds: 0/12/10 (R2: 4/8/9).
- [x] Zip gebaut (sha256 im Bericht)
