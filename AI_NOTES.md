# BuddelRage – KI-Notizen (js/ai.js)

Dieses Dokument beschreibt die überarbeitete KI (Gegner-Teams, Helfer-KI für eigene Buddler, KI-Übernahme im Mehrspieler),
welche Vorbilder recherchiert wurden und was davon übernommen wurde. **Es wurde kein fremder Code kopiert** – alle Ideen sind
selbst in JavaScript neu umgesetzt (das Projekt steht unter ISC; OpenClonk-Skripte, 0 A.D. Petra u. a. haben eigene Lizenzen).

## Aufbau

```
Team-„Hauptquartier“ (aiPlan, alle think·3 Ticks)      ← Petra/Widelands-Idee
  ├─ Rollen: Bergmann / Bauarbeiter / Kämpfer (Anteil je Stufe; anfangs bauen alle ab)
  ├─ Ausgaben (aiSpend): Grundversorgung → Forschung nach Plan → Gebäude → Buddler/Ritter → Fahrzeuge,
  │                      mit Sparziel (keine Buddler-Käufe, solange auf Forschung/Gebäude gespart wird)
  ├─ Bauplatzsuche (aiPlanSite) + „unbaubar“-Merker mit Ablaufzeit
  ├─ Bedrohung/Verteidigung, Stärkevergleich → Angriff mit Hysterese, Schwer: Sammeln in Gruppen
  └─ Status-Text für die Teamübersicht (t.stat: „baut Gold ab“, „forscht: Burg“, „greift an“ …)
Buddler-Agent (aiClonk, alle think Ticks neu entscheiden, sonst ausführen)
  ├─ Utility-Auswahl (aiDecide): heal, fight, arm, attack, guard, gun, sell, build, help, haul, park,
  │   tower, collect, mine, idle, wander – höchste Bewertung gewinnt, +0,08 Hysterese für die laufende Aufgabe
  ├─ Ausführung (aiExec) → Wegsuche/Bewegung (aiGoto / aiMoveKeys) → dieselben Tasten wie ein Spieler
  ├─ Kampf: ballistische Würfe/Pfeile mit Vorhalt, Schwert, Schildblock gegen anfliegende Geschosse
  └─ Steckenbleib-Erkennung und gestufte Erholung
```

## Navigation

* **Grobes Navigationsraster** (`NavGrid`, 5×5 px pro Zelle): Klassen Luft / grabbar (Erde, Sand, Gold) / hart (Fels, Granit, Holz) /
  Wasser / Lava. Der Buddler belegt Zelle + Zelle darüber. Jede Materialänderung (`setMat`) markiert die Zelle, alle 2 Ticks
  werden nur die markierten Zellen neu berechnet (inkrementell). Goldzellen werden in einer Menge geführt.
* **A\*** mit binärem Heap, 8 Nachbarn und Bewegungsarten: Laufen, Springen (nur mit Boden ≤ 5 Zellen darunter oder Wand),
  Klettern, Hangeln, Schwimmen, **Graben** (Erde/Sand teurer, aufwärts noch teurer, senkrecht nach oben verboten),
  Fels/Granit/Lava gesperrt, Lava-Nähe stark bestraft, tiefe Stürze bestraft. Langes Klettern ist teurer als eine begehbare Rampe.
* **Budget:** max. 9000 Knoten-Expansionen pro Tick für alle KIs zusammen, pro Suche je Stufe 1400/2600/3600; bei
  Überschreitung wird ein Teilpfad zum nächstgelegenen erreichten Knoten genutzt.
* **Gelernte Problemstellen:** scheitert ein Buddler an einem Wegstück, werden diese Zellen ~40 s lang teurer (für alle) –
  die nächste Suche nimmt einen anderen Weg.
* **Bewegung:** Wegpunkte werden über Pixel-Nähe weitergeschaltet; beim Klettern wird vorausgeschaut (geht der Pfad weiter
  nach oben, wird nicht abgesprungen); im Sprung zur nächsten Wand steuern; gegen eine Wand gelaufen → springen oder durchgraben.
* **Gestufte Erholung** (Fortschritt = Abstand zum Ziel wird kleiner):
  1. 90 Ticks: springen + neu planen,
  2. 200 Ticks: Problemstelle merken, in Zielrichtung freigraben,
  3. 360 Ticks: Ziel kurz sperren, kurz woanders hinlaufen,
  4. Ziel weit oben und Klettern klappt nicht: **schräge Treppe/Rampe graben** (Serpentinen, Richtungswechsel an Fels),
  5. 1500 Ticks ohne Bewegung: Aufgabe verwerfen, loslassen, ggf. mit Feuerstein freisprengen (wiederholt sich alle 900 Ticks).
* Spiel-Physik (gilt auch für Spieler): Klettern rutscht an 1–2 px unebenen Schachtwänden nach bzw. weicht kleinen Beulen aus
  und hält sich nicht mehr an einzelnen losen Pixeln fest.

## Schwierigkeitsstufen (`AI_DIFF`)

| Wert | Leicht | Mittel | Schwer |
|---|---|---|---|
| Denkintervall (Ticks) | 34 | 16 | 7 |
| Reaktionszeit im Kampf (Ticks) | 50 | 22 | 8 |
| Zielfehler (rad, Gauß) | 0,20 | 0,08 | 0,025 |
| Vorhalt bei bewegten Zielen | 0 | 60 % | 100 % |
| Wurf-/Block-/Ausweich-Wahrscheinlichkeit | 0,35 / 0,25 / 0 | 0,65 / 0,6 / 0,5 | 0,92 / 0,95 / 0,9 |
| max. Buddler / Geldreserve | 3 / 40 | 5 / 25 | 7 / 15 |
| Angriff ab (Stärkeverhältnis, frühestens) | 2,4× nach 5 min | 1,5× nach 3 min | 1,15× nach ~2 min, in Gruppen |
| Kämpferanteil | 0 | 34 % | 45 % |
| Forschung | Waffen, Lore, Wachturm | + Burg, Ritter, TNT | + Katapult, Kanone (Lore zuerst) |
| Gebäude / Fahrzeuge | Wachturm / – | Wachturm, Burg / Lore | Wachturm, Burg / Lore, Katapult/Kanone |
| Trödeln | 12 % (nie mit Gold in der Tasche) | 4 % | 0 |
| Wegsuche (Expansionen) | 1400 | 2600 | 3600 |

**Fairness:** Die KI benutzt nur dieselben Aktionen wie Spieler (Tasten, Kaufen, Verkaufen an der Hütte, Forschen, Bauen).
Einzige Ausnahme (dokumentiert): **Schwer** bekommt +1 Geld alle 120 Ticks (2 s). Dieser Bonus galt früher für *jede* KI
und gilt jetzt nur noch für Schwer.

## Weitere Teile

* **Ballistik:** analytische Lösung für den Abwurfwinkel (`v⁴ − g(g·x² + 2·y·v²)`), danach per diskreter Simulation der
  Spielphysik geprüft (`aiSimShot`), Vorhalt aus der Zielgeschwindigkeit, Gauß-Fehler je Stufe. Geschütze: Winkelsuche.
* **Schutz** (Idee aus OpenClonk: drohende Geschosse vorhersagen): Projektile der nächsten 18 Ticks vorausberechnen →
  Schild hoch oder wegspringen.
* **Wirtschaft:** Goldader wählen (Abstand zur Basis, Lava meiden, nicht zwei Buddler an dieselbe Stelle), abbauen, bei voller
  Tasche heim oder in die Lore, Lore an die Mine holen und heimschieben, verkaufen (Waffen werden behalten).
  Verkaufen/Einkaufen/Heilen zielt auf einen begehbaren Punkt in der Verkaufszone (die Hütte kann über einem Schacht stehen).
* **Helfer-KI** (`t.helper`): steuert nicht ausgewählte Buddler menschlicher Teams; gibt nie Geld aus.
* **KI-Übernahme** (`aiTakeover`): verlässt ein Mitspieler das Spiel, übernimmt eine KI mit der in der Lobby gewählten Stufe.

## Quellen und was übernommen wurde

| Quelle | Übernommen (als Idee, neu implementiert) |
|---|---|
| OpenClonk, KI-Skripte `planet/Objects.ocd/Helpers.ocd/AI.ocd` – https://github.com/openclonk/openclonk (z. B. RangedWeapons-Komponente: https://github.com/MDT-Maikel/openclonk/commit/42dfc7935933ff88556f0d143e5ae6f4915d8ef9) | Aufteilung in Ausführungs-Funktionen (Nahkampf/Fernkampf/Schutz), Flugzeit-Vorhalt beim Zielen, auf Kopfhöhe zielen, Geschosse vorhersagen und ausweichen |
| OpenClonk-Referenz (Skript-/Objektmodell) – https://docs.openclonk.org/en/sdk/definition/script.html | Verständnis Clonk-typischer Aktionen (Klettern, Hangeln, Graben) für die Bewegungsarten des Planers |
| 0 A.D. Petra-KI – https://github.com/0ad/0ad/tree/master/binaries/data/mods/public/simulation/ai/petra , Alpha-22-Notizen https://play0ad.com/new-release-0-a-d-alpha-22-venustas/ | „Headquarters“ mit Managern (Wirtschaft, Bau, Forschung, Angriff, Verteidigung), Ausgaben-Warteschlange mit Prioritäten, „unbuildable“-Merker, Angriff erst bei Stärkevorteil |
| Widelands Default-AI – https://github.com/widelands/widelands (src/ai) | Rollen/Bedarf je Gebäudetyp, regelmäßige Neuplanung in Intervallen statt jeden Tick |
| Dave Mark, Infinite Axis Utility System (GDC AI Summit 2013) – https://www.gdcvault.com/play/1018040/Architecture-Tricks-Managing-Behaviors , https://www.gameai.com/iaus.php | Utility-Auswahl der Aufgaben mit Bewertungen statt starrer if/else-Kette, Hysterese gegen Flackern |
| Jeff Orkin, GOAP (F.E.A.R.) – http://alumni.media.mit.edu/~jorkin/goap.html | Aufgaben mit Vorbedingungen (z. B. „verkaufen“ nur mit Gold, „abbauen“ nur mit Platz in der Tasche); kein vollständiger Planer |
| Behavior Trees – https://www.gamedeveloper.com/programming/behavior-trees-for-ai-how-they-work | Ausführung pro Aufgabe als Sequenz mit Abbruchbedingungen |
| Red Blob Games, A\* – https://www.redblobgames.com/pathfinding/a-star/introduction.html | A\* mit Heap, Heuristik, Kosten pro Bewegungsart |
| 2D-Plattformer-Pathfinding (Terraria/Starbound-artig) – https://gamedevelopment.tutsplus.com/tutorials/how-to-adapt-a-pathfinding-to-a-2d-grid-based-platformer-theory--cms-24662 | Sprung-/Fallregeln im Raster (Bodenabstand, Wandkontakt), Knoten abhängig von der Spielphysik |
| Wurfparabel – https://en.wikipedia.org/wiki/Projectile_motion | Formel für den Abwurfwinkel bei gegebener Geschwindigkeit (Würfe, Pfeile, Katapult) |
| Worms/Liero/Teeworlds (Spielprinzip, Teeworlds-Quellen https://github.com/teeworlds/teeworlds) | Schwierigkeitsgrade über Zielgenauigkeit/Reaktionszeit statt über Schummeln |

## Burgplatz, Planieren und Kartengrößen

**Generator (`generate`)**: Die Karte bleibt zufällig (fBm-Rauschen). Pro Startbasis wird ein Plateau gelegt:
- Hütte in der Mitte, 78 px Platz auf der Wachturm-Seite und 118 px auf der Burg-Seite (zur Kartenmitte hin).
- Höhe = Mittel aus Gelände an der Basis und Umgebungsmittel (±260 px), damit das Plateau natürlich liegt.
- Übergang mit Smoothstep über max(60, 2,6 × Höhenunterschied) px, begrenzt durch den Abstand zur Nachbarbasis.
- Darunter eine feste Erdschicht von 34 px; Seen werden dort nicht angelegt.
- Burgplatz (`castleSites`) bei Hütte ± 62 px.

**Platzprüfung (`placeCheck`)**, gleich für Spieler, Vorschau und KI:
- `ok`: Bauraum frei und ≥ 80 % Boden.
- `level` (Planieren nötig): Erde/Sand im Bauraum (max. 26 px pro Spalte), Lücken bis 14 px darunter.
  Tiefere Schächte erhalten eine 6-px-Abdeckung; höchstens 30 % solcher Spalten.
  Kosten: 1 Geld pro 60 Pixel.
- `no` (mit Grund): Fels/Granit/Holz, Wasser/Lava, Kartenrand, Gebäude im Weg, zu steiler Hang, kein Boden.

**Planieren (`levelStep`)** ist die erste Bauphase:
- Arbeitende Buddler (max. 3) tragen ab bzw. füllen auf, je Buddler 3 Pixel alle 2 Ticks.
- Abtrag oben zuerst, Auffüllen von unten.
- Gold im Abtrag wird zu Goldklumpen.
- Terrainänderungen laufen über `setMat`, gehen also über die normale Chunk-Synchronisation an die Clients.
- Das Planier-Flag steht im Snapshot.

**KI**:
- `aiPlanSite` prüft zuerst den reservierten Burgplatz und danach Kandidaten links/rechts.
- Bewertung: Entfernung + Planierkosten.
- Andere Gebäude halten die Burgfläche frei.
- Ein erforschtes, aber nicht gebautes Gebäude hat Vorrang vor weiterer Forschung und vor dem Ausrüsten (Rücklage `keep`).
- Helfer stehen beim Planieren am Rand der Baufläche.
- Eine Baustelle ohne Fortschritt wird nach 60 s aufgegeben (halber Preis zurück).
- Als Bedrohung zählen nur bewaffnete Gegner bzw. Gegner direkt an der Basis.

**Kartengrößen** (`MAP_SIZES`): Klein 0,85 × / 580 px, Mittel 1,2 × / 660 px (neuer Standard), Groß 1,6 × / 760 px, Riesig 2,2 × / 880 px.
- Höhlen, Gold und Gestein wachsen mit der Fläche (Rauschen in festen Pixel-Frequenzen).
- Mit der Breite wachsen Lava-Höhlen (W/800), Seen (W/1700), eingebettete Gegenstände (nach Fläche) und Monster (× Faktor).
- Die Startabstände sind proportional zur Breite.

**Performance auf großen Karten**:
- Materialerzeugung in Prioritätsreihenfolge (weniger Rauschaufrufe).
- Material-Simulation: Tropfen/Filme auf festem Boden verdunsten bzw. erstarren langsam.
- Eingeschlossene Luftblasen unter Fels wandern nicht mehr endlos.
- Lava hält ihren Chunk nur aktiv, wenn sie wirklich fließen kann.
- Budget von 360 aktiven Chunks pro Tick.
- Ergebnis Riesig (5060 × 880): aktive Chunks nach 1 min 506 → 231, Simulation 4,8 → 2,6 ms/Tick.

**Vorbilder (nur Ideen, kein Code):**
- Planieren von Bauplätzen wie bei *Die Siedler II*: Bauarbeiter ebnen den Boden vor dem Bau.
- Aktive-Chunk-Optimierung für Falling-Sand-Simulationen wie in Petri Purhos GDC-2019-Vortrag „Exploring the Tech and Design of Noita“ (GDC Vault).

**Mehrspieler**:
- Die Startkarte wird als RLE + Deflate (`CompressionStream`) in 16-KB-Stücken übertragen.
- Der Host hält Chunk-Updates zurück, bis die Karte gesendet ist; der Client puffert Chunks, bis die Karte entpackt ist.
- Riesig mit 4 Teams (5760 × 880): 842 KB → 353 KB.

## Tests

Headless-Simulationen KI gegen KI (Chrome/Playwright, `test/aisim.js`), siehe Ergebnisse unten.

## Testergebnisse

Headless-Simulation (`world.update()` ohne Rendering), Melee, 30000 Ticks (~8:20 min Spielzeit), je 3 Seeds.

| Paarung | Ergebnis | Verdient (Geld je Lauf) |
|---|---|---|
| Leicht vs. Schwer | Schwer gewinnt 3/3 | Schwer 1366 / 800 / 600 · Leicht 240 / 260 / 500 |
| Schwer vs. Leicht (Startplätze getauscht) | Schwer 1 Sieg, 2 Unentschieden | Schwer 180 / 360 / 820 · Leicht 900 / 1460 / 480 |
| Mittel vs. Leicht | Mittel gewinnt 3/3 | Mittel 660 / 1520 / 620 |
| Mittel vs. Mittel | 1 Unentschieden, je 1 Sieg | 1720/1280 · 762/680 · 342/780 |
| Schwer vs. Mittel vs. Leicht | Schwer gewinnt 3/3 | – |

| Schwierigkeit | Forschungen | Gebäude / Fahrzeuge | Kills (max.) |
|---|---|---|---|
| Leicht | bis 3 | Turm | – |
| Mittel | 5–6 | Turm | – |
| Schwer | bis 8 | Turm, Lore, Katapult | 14 |

- **Steckenbleiben:** in allen Läufen kein dauerhaftes Hängen. Längste Stuck-Phase ≤ 1789 Ticks (~30 s), danach immer befreit (Penalty-Map, Rampe, Hard-Reset). Keine JS-Fehler.
- **Performance:** 2 KI-Teams 0,8–1,9 ms/Tick, 3 KI-Teams 2,5–3,2 ms/Tick. Spike-Test über 12000 Ticks: Ø 2,58 ms, nur 5 Ticks > 12 ms (4 davon in den ersten 4 Ticks, erster Tick 49 ms durch JIT/NavGrid-Aufbau 6,8 ms).
- **UI/Netz-Tests (Playwright):** aiui.js (Name bereinigt, „Name 2/3“, localStorage, HUD-Tags), ui1/ui2 (60 fps), touch.js, mpui.js, p2p.js (Namen und Schwierigkeiten auf Host und Client synchron, Terrain-Hash identisch, KI-Übernahme beim Verlassen). Alle ohne Fehler.

### Testergebnisse Burgplatz / Kartengrößen (Okt. 2026)

**Burgplatz-Validierung** (`test/castlecheck.js`): pro Seed Karte erzeugen, 200 Ticks simulieren, dann je Team prüfen: Burg-placeCheck „ok“ (ohne Planieren), Turmplatz frei, KI plant genau den reservierten Burgplatz, Himmel frei. 200 Seeds für 1–4 Teams, 50 Seeds für 6 und 9 Teams, alle vier Größen.

| Größe | Konfigurationen | Startplätze geprüft | Burgplatz ok | Turm ok | KI-Plan ok | Himmel frei | Ø Hang | Ø Generierung |
|---|---|---|---|---|---|---|---|---|
| Klein | 1/2/3/4/6/9 Teams | 2750 | 100 % | 100 % | 100 % | 100 % | 0,35–0,39 | 146–360 ms |
| Mittel | 1/2/3/4/6/9 Teams | 2750 | 100 % | 100 % | 100 % | 100 % | 0,35–0,38 | 225–621 ms |
| Groß | 1/2/3/4/6/9 Teams | 2750 | 100 % | 100 % | 100 % | 100 % | 0,35–0,37 | 336–869 ms |
| Riesig | 1/2/3/4/6/9 Teams | 2750 | 100 % | 100 % | 100 % | 100 % | 0,35–0,37 | 544–1397 ms |

Fehlschläge: 0 (Log `test/cc-<größe>.log`).

**KI baut Burg** (`test/aisim2.js`, 30000 Ticks max., 50 Team-Läufe: Mittel-Karten 5 Paarungen × 4 Seeds, 3 Teams Groß ×2, Riesig ×2):

| Schwierigkeit | Läufe | Siege | Ø verdient | Turm | Burg gebaut | davon auf reserviertem Platz | davon mit Planieren | Burg erforscht → gebaut |
|---|---|---|---|---|---|---|---|---|
| Schwer | 20 | 14 | 692 | 15 | 7 | 6 | 2 | 7/11 (Ø 3420 Ticks ≈ 57 s) |
| Mittel | 20 | 6 | 886 | 15 | 10 | 7 | 4 | 10/15 (Ø 2100 Ticks ≈ 35 s) |
| Leicht | 10 | 0 | 572 | 6 | 0 | – | – | (baut bewusst keine Burg) |

Nicht gebaut trotz Forschung: Team wurde vorher eliminiert/belagert oder hatte zu wenig Einkommen (z. B. Schwer-vs-Schwer Seed 1104: beide < 500 Gold in 8 Minuten). Längste Stuck-Phase 2172 Ticks, danach immer befreit. Keine JS-Fehler. 0,4–1,8 ms/Tick.

**Performance:** idle Box, Riesig (5060 × 880, 3 Teams) 60,25 fps, schlechtester Frame 20 ms, Laden 1,6 s; Mittel 60,25 fps. Materialsimulation: aktive Chunks auf Riesig 506 → 231, 4,8 → 2,6 ms/Tick (Budget 360 Chunks/Tick, Film-Verdunstung, Lava-Fallregel).

**Mehrspieler:** Startkarte deflate-komprimiert und in 16-KB-Teilen übertragen: Mittel 339898 → 142736 Zeichen, Riesig (5760 × 880) 863846 → 360280. Terrain-Hash Host/Client identisch, Planier-Status synchron, Client-Vorschau „⚒ Planieren nötig“, KI-Übernahme baut Burg.

**Regressions-Tests:** aiui, ui1, ui2 (60,5 fps), touch, mpui, buildui (ok/planieren/nein, Burg gebaut nach 981 bzw. 1143 Ticks), p2p (Mittel und Riesig) – alle ERRS [].

## Bekannte Grenzen

- Ein Schwer-Team auf einer stark zerklüfteten Höhlen-Startposition ist spürbar schwächer: der Hüttenvorplatz ist schlecht erreichbar, daher die Unentschieden.
- Burg: Ohne garantiertes Plateau wurde die Burg früher praktisch nie gebaut – siehe neuer Abschnitt „Burgplatz, Planieren und Kartengrößen“.
- Erster Tick nach dem Start ~49 ms (einmalig).
- Helfer-KI steuert nur nicht ausgewählte Buddler und gibt kein Geld aus.
- Ältere Testskripte (feat.js, smoke.js, sp.js) zielen auf die alte UI/Port 8080 und sind veraltet.
