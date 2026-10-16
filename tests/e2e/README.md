# End-to-End-Prüfungen (echtes Chrome über das DevTools-Protokoll)

Alle Prüfungen laufen gegen einen lokal ausgelieferten Build (`npm run build`, dann z. B. `cd out && python3 -m http.server 4310`).
Es werden **nur synthetische Daten** verwendet und keine echten Anfragen gesendet.

| Skript | Prüft |
|---|---|
| `qa.mjs` | alle Seiten in 4 Größen: horizontales Scrollen, abgeschnittener Text, Konsolenfehler, Bilder, Tippflächen, Meta-Tags, axe-Barrierefreiheit (`npm i --no-save axe-core`) |
| `hero.e2e.mjs` | Hero-Video: läuft, Poster, „Bewegung reduzieren“, blockiertes Autoplay, manuelles Abspielen, kein Video mehr in „Einblicke“ |
| `pause.e2e.mjs` | Video pausiert beim Wegscrollen und bei nicht sichtbarem Tab |
| `kbd.e2e.mjs` | Tastatur: Tab-Reihenfolge, Dropdown, Escape, mobiles Menü |
| `form.e2e.mjs` | Anfrageformular gegen einen Mock der ING-Studio-API (Variante mit `FORM_ENDPOINT=http://127.0.0.1:4311/api/anfrage`, ausgeliefert auf Port 4312); benötigt `ING_STUDIO_SRC=<Pfad zum ING-Studio-Repository>` |

`CHROME_BIN` setzt den Pfad zu Chrome (Standard: macOS-Installation).
