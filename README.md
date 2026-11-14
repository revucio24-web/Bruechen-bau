# Brücken & Beben

2D-Brückenbauspiel mit echter Statik-Simulation. Läuft vollständig lokal:
kein Login, kein Server, keine Datenübertragung, keine Telemetrie.

## Starten

- **Direkt:** `index.html` doppelklicken. Funktioniert ohne Build, ohne Server.
- **Mit lokalem Server** (falls ein Browser `file://` einschränkt):

  ```powershell
  python -m http.server 8000
  ```

  Danach <http://localhost:8000> öffnen.

## Spielen

1. Werkzeug in der Leiste wählen (Maus oder Tasten `1`–`6`).
2. Von einem Knoten zu einem anderen ziehen, um eine Strebe zu bauen.
3. Rechtsklick auf eine Strebe löscht sie wieder.
4. Mit **Test starten** (`Leertaste`) die Katastrophe auslösen.
5. **Fahrzeuge** fahren beim Test über die Brücke – trägt die Fahrbahn nicht,
   stürzen sie ab und der Test ist verloren. Alle Fahrzeuge müssen sicher
   hinüberkommen.
6. Plattformen ins Ziel bringen: Sie dürfen nicht unter `failY` stürzen und
   keine Strebe darf brechen.

### Steuerung

| Taste | Wirkung |
| --- | --- |
| `1`–`6` | Rundholz, Stahl, Beton, Seil, Dämpfer, Pendel |
| `Leertaste` | Test starten / stoppen |
| `X` | Röntgenansicht (Lasten sichtbar) |
| `E` | Werkstatt ein/aus |
| `R` | Werkstatt zurücksetzen |
| `Strg` + `Z` | Letzten Bau-Schritt rückgängig |
| `H` oder `?` | Hilfe |
| `Esc` | Modal/Hilfe schließen |
| Rechtsklick | Strebe löschen |

## Physik

- Fester Design-Raum **1600 × 900**; Level-Koordinaten sind auf `0..1`
  normalisiert und werden zur Laufzeit umgerechnet. 100 px = 1 m.
- Die Simulation läuft mit fester Schrittweite (`1/60 s`) und einem
  Frame-Akkumulator. Dadurch ist sie auf 60-Hz-, 120-Hz- und 144-Hz-Displays
  gleich schnell; die Bildwiederholrate beeinflusst nur die Darstellung.
- Streben haben Zug- und Druckgrenzen. Überlast bricht sie, Bruchstücke
  fallen als Debris weiter. Die Ziel-Verbindungen sind unzerstörbar.
- Katastrophen: Erdbeben (horizontal/vertikal), Orkan (Seitenwind) oder beides.
  Die Stärke rampt in den ersten 3 Sekunden hoch.
- **Fahrzeuge als Belastungstest:** Beim Test fahren Autos von links über die
  Ziellinie (Fahrbahn). Ihr Gewicht wird auf die zwei nächsten Stützpunkte
  verteilt und belastet die Struktur zusätzlich. Kollabiert die Fahrbahn,
  stürzt das Fahrzeug ab → Test sofort verloren. Pro Level konfigurierbar:
  `vehicles: { mass, speed, count, first, interval }`.

## Kampagne

Fünf Level mit steigendem Anspruch. Sterne gibt es für:

1. **Bestehen** – alle Ziele halten bis zum Ende durch.
2. **Budget** – Baukosten ≤ `par.cost`.
3. **Belastung** – Spitzenspannung ≤ `par.peakStress` (Anteil der Bruchlast).

| # | Level | Katastrophe | Budget | Par-Kosten | Par-Last |
| --- | --- | --- | --- | --- | --- |
| 1 | Die Schlucht-Villa | Erdbeben | 2800 $ | 1900 $ | 45 % |
| 2 | Der Sky-High-Turm | Orkan | 3400 $ | 2100 $ | 40 % |
| 3 | Das Mega-Beben | Beben + Wind | 4800 $ | 1700 $ | 45 % |
| 4 | Die Hafenkräne | Orkan | 3200 $ | 2000 $ | 40 % |
| 5 | Die Doppelspann-Brücke | Beben + Wind | 5200 $ | 2200 $ | 45 % |

Jedes Level ist so gebaut, dass mindestens zwei Fundamente direkt (ohne
Zwischenknoten) ein Ziel erreichen. Level 2 wird ab dem ersten Stern
freigeschaltet, danach immer das nächste.

## Werkstatt

`E` öffnet den Editor. Dort lassen sich Fundamente und Ziele setzen, das
Budget, die Dauer und die Katastrophe einstellen sowie eigene Level als
`.bridge`-Datei exportieren und wieder importieren (auch per Drag-and-drop
ins Fenster).

### `.bridge`-Format

JSON mit `format: "bridge-level"` und `version: 1`:

```json
{
  "format": "bridge-level",
  "version": 1,
  "id": "custom-abc",
  "title": "Meine Brücke",
  "budget": 3500,
  "duration": 12,
  "disaster": "both",
  "failY": 0.78,
  "ground": [[{ "x": 0, "y": 0.6 }, { "x": 0.43, "y": 0.6 }, { "x": 0.47, "y": 1 }, { "x": 0, "y": 1 }]],
  "anchors": [{ "x": 0.4, "y": 0.6 }, { "x": 0.6, "y": 0.6 }],
  "targets": [{ "type": "platform", "x": 0.5, "y": 0.5, "mass": 6.2 }],
  "par": { "cost": 1500, "peakStress": 0.5 },
  "vehicles": { "mass": 3.0, "speed": 110, "count": 2, "first": 1.5, "interval": 3.5 }
}
```

`vehicles` ist optional (ohne das Feld gibt es keinen Fahrzeugtest).
Grenzen: `mass` 0,5–50, `speed` 20–400 px/s, `count` 0–12 ganzzahlig,
`first`/`interval` in Sekunden bis zur Level-Dauer.

Fremde Dateien werden strikt geprüft, bevor sie den Spielzustand berühren:
maximal 512 KB, 60 Fundamente, 20 Ziele, 80 Knoten, 8 Bodenflächen,
Titel ≤ 120 Zeichen, Budget 100–100 000 $, Dauer 3–60 s, Masse 0,5–50.
Fehlercodes: `E001` kein JSON/kein Objekt, `E002` falsches Format,
`E003` unbekannte Version, `E004` Pflichtfeld fehlt, `E005` Koordinate
außerhalb `0..1`, `E007` Zahl außerhalb des erlaubten Bereichs,
`E008` kein Fundament/Ziel, `E009` zu viele Elemente, `E010` unbekannte
Katastrophe, `E011` Text zu lang.

## Aufbau

```
index.html            Markup + HUD (keine Inline-Skripte)
css/style.css         gesamtes Styling
js/
  config.js           Materialkatalog, Konstanten (VERSION, FIXED_STEP)
  storage.js          einzige Persistenzstelle (heute localStorage)
  audio.js            prozedurale Effekte über WebAudio
  levels.js           Kampagnen-Level + Werkstatt-Startzustand
  levelformat.js      `.bridge` lesen/prüfen/schreiben
  physics.js          Solver, Stress, Bruch, Geometrie – ohne DOM-Zugriff
  render.js           Canvas-Zeichnung, Heatmap, Debris
  ui.js               sämtlicher DOM-Zugriff
  editor.js           Werkstatt, Platzieren/Löschen, Undo, Import/Export
  game.js             Zustand, Levelwechsel, Eingaben, Loop
test/smoke.mjs        Headless-Tests gegen DOM-Stubs
backup/index-v1.html  ursprüngliche Ein-Datei-Version
```

Die Module hängen an einem gemeinsamen Namespace `window.BB` und werden als
klassische Scripts geladen. Deshalb bleibt `file://` nutzbar – ES-Module
würden dort an CORS scheitern.

## Persistenz

Fortschritt, Sterne, Bestwerte, freigeschaltete Level und eigene Level liegen
ausschließlich in `BB.storage` (aktuell `localStorage`). Für die
Microsoft-Store-Version wird nur diese Datei gegen eine Datei-Implementierung
getauscht; das übrige Spiel bleibt unverändert. Es werden keine Daten
übertragen.

## Tests

```powershell
node test/smoke.mjs
```

Der Test lädt alle Module in einer VM mit DOM-Stubs und prüft 100 Punkte:
Levelaufbau, Kosten, Einsturz- und Erfolgspfad, Bruch-Erkennung,
Wiederherstellung nach dem Umbauen, Sterne/Bestwerte/Freischaltung,
Tastensteuerung, **Fahrzeuge** (Ankunft bei stabiler Brücke, Absturz bei
kollabierter Fahrbahn, `.bridge`-Roundtrip mit `vehicles`),
`.bridge`-Validierung, Werkstatt, Zeichnen, echte
Frame-Zeit (60/120 Hz) sowie die Lösbarkeit aller fünf Level (mit
Fahrzeuglast). Regressionstests decken zusätzlich ab, dass nach einem
beendeten Test die Brücke wiederhergestellt wird (kein Start auf dem Wrack).

## Bekannte Grenzen / nächste Schritte

- MSIX-Paketierung ohne Netzwerk-Capability (WebView2 + WinUI 3).
- `BB.storage` gegen eine Datei-Implementierung tauschen.
- Weitere Kampagnen-Level und ein Kurz-Tutorial.
- Balancing der Par-Werte nach echtem Spielerfeedback.
