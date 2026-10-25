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
