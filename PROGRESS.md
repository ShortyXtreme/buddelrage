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
