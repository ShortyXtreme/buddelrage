# Credits / Lizenzen

BuddelRage ist ein inoffizielles Fan-Spiel, inspiriert von **Clonk Rage** (RedWolf Design) und **OpenClonk**.
Es enthält **keine** Dateien aus Clonk Rage. Es ist nicht mit RedWolf Design, Matthes Bender oder dem
OpenClonk-Projekt verbunden. „Clonk“ ist eine Marke ihres Inhabers und wird hier nur beschreibend verwendet.

## Fremdbibliotheken
* **PeerJS 1.5.5** (`js/peerjs.min.js`) – © Michelle Bu, Eric Zhang u. a., MIT-Lizenz (`js/peerjs.LICENSE.txt`), https://github.com/peers/peerjs
* Vermittlungsdienst: PeerJS-Cloud (0.peerjs.com), STUN: Google, Cloudflare, Twilio (öffentliche Dienste)

## Schriften (assets/fonts/)
* **Inter** – © The Inter Project Authors (Rasmus Andersson), SIL Open Font License 1.1 (`assets/fonts/OFL-Inter.txt`), https://github.com/rsms/inter – woff2-Dateien (latin) aus dem Paket @fontsource/inter
* **Lilita One** – © Juan Montoreano, SIL Open Font License 1.1 (`assets/fonts/OFL-LilitaOne.txt`), https://fonts.google.com/specimen/Lilita+One – woff2 (latin) aus @fontsource/lilita-one

## Musik
Die Hintergrundmusik wird zur Laufzeit prozedural erzeugt (WebAudio, `js/audio.js`, eigener Code, ISC) – keine fremden Musikdateien.

## Symbole
UI-Symbole sind eigene SVG-Zeichnungen (`js/hud.js`); Gegenstands-Symbole werden aus den eigenen Pixel-Grafiken des Spiels erzeugt.

## Programmcode
Der gesamte Code (js/*.js, index.html, css/style.css, server/server.js) wurde neu geschrieben – siehe LICENSE (ISC).
Spielmechaniken (Graben, Klettern, Hangeln, Feuersteine, Gold verkaufen an der Heimatbasis, Melee, Lore, Katapult, Kanone,
Burg, Wachturm, Ritter, Forschung, Lava, Feuer, Tag/Nacht) orientieren
sich am Spielprinzip von Clonk/OpenClonk; es wurde kein OpenClonk-Code übernommen.
Figuren, Ritter, Monster, Hütte, Wachturm, Burg, Fahrzeuge, Waffen, Feuer und Gegenstände sind eigene, prozedural gezeichnete
Pixel-Grafik. Lava wird prozedural eingefärbt (keine Lava-Textur).
Neu und ebenfalls eigene, prozedural gezeichnete Pixel-Grafik bzw. eigener Code: Tiere (Wipf, Vogel, Fisch, Fledermaus, Hai),
das neu gestaltete Monster, Enterhaken mit Seil, Ballon, Notausgang-Effekt, Chat-Sprechblasen und Emote-Rad.
Die Geräusche „Ballon platzt“ und „Chat-Ping“ werden zur Laufzeit per WebAudio synthetisiert (keine Dateien).
Emotes sind Unicode-Emojis und werden mit der Emoji-Schrift des jeweiligen Systems dargestellt (es wird keine Emoji-Grafik mitgeliefert).

## Assets aus OpenClonk (https://github.com/openclonk/openclonk, Commit 36de799)
Lizenz: **Creative Commons Attribution 3.0** (CC-BY 3.0, https://creativecommons.org/licenses/by/3.0/),
außer wo „CC0“ angegeben. Volltext: LICENSE-CC-BY-3.0.txt (Kopie von planet/COPYING).
Quelle der Autorenangaben: planet/Material.ocg/authors.txt und planet/Sound.ocg/authors.txt.

**Änderungen:** Texturen auf 128×128 Pixel verkleinert, JPEG neu kodiert und zusätzlich als Base64 in js/assets.js
eingebettet; im Spiel eingefärbt/abgedunkelt. Sounds auf Mono/22 kHz Ogg Vorbis umkodiert und umbenannt.

### Texturen (assets/textures/, js/assets.js) – Materialien aus planet/Material.ocg
| Datei im Spiel | Original | Autor | Lizenz |
|---|---|---|---|
| earth.jpg | earth.jpg | Nachtfalter | CC-BY 3.0 |
| sand.jpg | sand.jpg | Nachtfalter | CC-BY 3.0 |
| gold.jpg | gold.jpg | Nachtfalter | CC-BY 3.0 |
| tunnel.jpg | tunnel.jpg | Nachtfalter | CC-BY 3.0 |
| rock.jpg | rock.jpg | Matthi | CC-BY 3.0 |
| granite.jpg | granite.jpg | Matthi | CC-BY 3.0 |
| water.jpg | water.jpg | Newton | CC-BY 3.0 |
| brick.jpg (Holzbrücke) | brick.jpg | MimmoO | CC-BY 3.0 |

### Sounds (assets/sounds/) – aus planet/Sound.ocg
| Datei im Spiel | Original | Autor / Quelle | Lizenz |
|---|---|---|---|
| blast1-3.ogg | Fire/Blast1-3 | Benboncan (freesound.org/people/Benboncan/sounds/73005) | CC-BY 3.0 |
| dig1-5.ogg | Clonk/Action/Dig/Dig1-5 | Stephen Hall (freesound.org/people/shall555/sounds/72199) | CC-BY 3.0 |
| throw1-3.ogg | Objects/Weapons/Javelin/Throw1-3 | Checkmaty | CC-BY 3.0 |
| punch1-3.ogg | Objects/Weapons/WeaponHit1-3 | Checkmaty | CC-BY 3.0 |
| hitliving.ogg | Hits/ProjectileHitLiving1 | Checkmaty | CC-BY 3.0 |
| hurt1-3.ogg, die1-3.ogg | Clonk/Skin/Adventurer/Hurt1-3, Die1-3 | ala | CC-BY 3.0 |
| uncash.ogg | UI/UnCash1 | ala | CC-BY 3.0 |
| build.ogg | Structures/FinishBuilding | ala (aus JoelAudio & cmusounddesign, freesound, CC-BY 3.0) | CC-BY 3.0 |
| splash1-3.ogg | Liquids/Splash1-3 | CGEffex (freesound.org/people/CGEffex/sounds/98335) | CC-BY 3.0 |
| growl1-3.ogg | Animals/Monster/Growl1-3 | Ringwaul | CC-BY 3.0 |
| cash.ogg | UI/Cash | FreqMan (freesound.org/people/FreqMan/sounds/31377) | CC-BY 3.0 |
| click.ogg | UI/Click | TicTacShutUp (freesound.org/people/TicTacShutUp/sounds/406) | CC-BY 3.0 |
| fanfare.ogg | UI/Fanfare | Toby Knowles (freesound.org/people/tobyk/sounds/26198) | CC-BY 3.0 |
| error.ogg | UI/Error | Harbour11, bearbeitet von Sven2 (freesound.org/people/Harbour11/sounds/194624) | CC-BY 3.0 |
| grab.ogg | Clonk/Action/Grab | Sven2 | CC-BY 3.0 |
| rock1-3.ogg | Hits/Materials/Rock/RockHit1-3 | mbezzola (freesound.org/people/mbezzola/sounds/105282) | CC0 |
| fuse.ogg | Fire/Fuse | RytmenPinnen (freesound.org/people/RytmenPinnen/sounds/102264) | CC0 |
| inflame.ogg | Fire/Inflame | CGEffex (freesound.org/people/CGEffex/sounds/94102) | CC-BY 3.0 |
| sizzle.ogg | Liquids/Sizzle | qubodup (freesound.org/people/qubodup/sounds/194635) | CC-BY 3.0 |
| swing1-3.ogg | Objects/Weapons/WeaponSwing1-3 | Checkmaty | CC-BY 3.0 |
| bow1-3.ogg | Objects/Weapons/Bow/Shoot1-3 | Checkmaty | CC-BY 3.0 |
| arrowhit.ogg | Objects/Arrow/HitGround | Checkmaty | CC-BY 3.0 |
| shield.ogg | Objects/Weapons/Shield/WeaponHitShield | Checkmaty | CC-BY 3.0 |
| metalhit.ogg | Objects/Weapons/Shield/MetalHit1 | Checkmaty | CC-BY 3.0 |
| cannon.ogg | Objects/Weapons/Blunderbuss/GunShoot1 (Musket/GunShot) | Checkmaty | CC-BY 3.0 |
| catapult.ogg | Objects/Catapult_Launch | 110110010 & schluppipuppie (freesound.org/people/110110010/sounds/66396, freesound.org/people/schluppipuppie/sounds/12833) | CC0 |
| dump.ogg | Objects/Lorry/Dump1 | ala | CC-BY 3.0 |
| door.ogg | Structures/DoorOpen1 | ala | CC-BY 3.0 |
| ding.ogg | UI/Ding | Aiwha, bearbeitet (freesound.org/people/Aiwha/sounds/196106) | CC-BY 3.0 |

Bewusst **nicht** verwendet: Lava/Schnee-Texturen (Herkunft RedWolf Design GmbH – daher eigene prozedurale Lava), Clonk-3D-Modelle
(Mesh, kein 2D-Sprite), sämtliche Dateien aus Clonk Rage.
