# Fahrzeugdaten: HSN/TSN-Identifikation

Stand: Oktober 2026. Das Modul identifiziert Fahrzeuge über HSN/TSN, FIN, Fahrzeugschein oder manuell und übernimmt sie in Fahrzeug und Gutachten.
Es arbeitet **ohne externen Dienst**. Externe Anbieter sind optionale, austauschbare Zulieferer.

## Architektur

```
Oberfläche (Browser)            nie direkt zu externen Seiten
   ↓  POST /api/admin/fahrzeugdaten/identify   (Sitzung + Recht vehicledata.read)
VehicleDataService (src/server/vehicledata/identify.ts)
   ↓
eigene Fahrzeugdatenbank (vehicle_hsn_tsn)   → Treffer: sofort, kein externer Request
   ↓ nur wenn nichts da/alles veraltet UND Anbieter freigegeben
Gateway (gateway.ts): Lizenzstatus · Pause · Rate-Limit · Protokoll
   ↓
Provider-Adapter (providers/*)  → normalisieren → in eigener DB zwischenspeichern
```

| Datei | Aufgabe |
| --- | --- |
| `src/lib/vehicle-data.ts` | reine Logik: HSN/TSN/FIN, Leistung/Hubraum/Kraftstoff, Hersteller, Namenszerlegung, Vergleich, Prioritäten, Fahrzeugschein-Abgleich |
| `vehicledata/fetcher.ts` | sicherer Abruf: nur https/443, Host-Freigabeliste, keine privaten Ziele, Redirect-Limit mit Neuprüfung, Zeitlimit, Größenlimit, Content-Type-Prüfung. **Zertifikatsfehler werden nie umgangen.** |
| `vehicledata/html-parser.ts` | Tabellenparser (DOM + toleranter Weg für defektes HTML); nur Text, nie HTML |
| `vehicledata/providers/` | `VehicleDataProvider`-Interface; `HsnTsnProvider` (echt), `Kba/Dat/VinProvider` (nur Platzhalter, „nicht angebunden“), `Own`/`Manual` |
| `vehicledata/catalog.ts` | Speichern mit Konflikterkennung, Suche, Konflikte lösen, manueller Datensatz |
| `vehicledata/apply.ts` | Übernahme ins Fahrzeug, Prioritätslogik, Datenherkunft, Historie, Fahrzeugschein-Abgleich |
| `vehicledata/imports.ts` | Import (CSV, JSON, Einzel-HSN/TSN, URL-Liste) mit Vorschau, gedrosselt/pausierbar/fortsetzbar |

## Regeln

- **Nichts wird erfunden.** Fehlt ein Wert, ist er `null` und wird als „Nicht verfügbar“ angezeigt (auch kW↔PS wird nicht umgerechnet; Liter werden nicht zu cm³).
- **Hersteller** werden normalisiert (VW → Volkswagen, Škoda/Skoda, Citroën, …); der Originalwert bleibt immer erhalten (`manufacturer_name_raw`, `raw_data`).
- **HSN/TSN identisch, Inhalt abweichend** → nie überschreiben, stattdessen Status `CONFLICT` und Eintrag unter *Fahrzeugdaten → Datenkonflikte* (Zusammenführen · Eigene behalten · Externe übernehmen · Manuell).
- **Priorität** (höher gewinnt): vom Gutachter bestätigt (100) · offiziell/lizenziert (80) · VIN-Anbieter (70) · KBA (60) · HSN/TSN-Drittanbieter (50) · unverifiziert (20). Niedrigere Quellen überschreiben nie höhere.
- **Status**: `VERIFIED`, `PARTIAL` (einzelne Drittquelle), `UNVERIFIED` (manuell/Datei), `OUTDATED` (> 365 Tage nicht geprüft), `CONFLICT`.
- **Zulassung/Typgenehmigung**: „konform“ wird nur gemeldet, wenn Genehmigungsart und ein belegter, übereinstimmender Fahrzeugschein-Abgleich vorliegen – sonst „Nicht beurteilbar“.

## Freigabe externer Anbieter (wichtig)

Der HSN/TSN-Anbieter ist ausgeliefert mit **Lizenzstatus „Review erforderlich“, Automatik aus, Massenimport aus**.
Vor einer Freigabe bitte **Nutzungsbedingungen und Lizenzfragen des Anbieters rechtlich prüfen**. Ohne ausdrückliche Freigabe
(`APPROVED`/`LICENSED`) sind automatische Abfragen und Massenimport technisch gesperrt (auch serverseitig). Admin-Testabfragen
(*Verbindung testen*, *Testabfrage*, *Testdatensatz importieren*) sind einzeln erlaubt.

Die Abruf-Adresse (URL-Vorlage mit `{hsn}`/`{tsn}`) wird **nicht vorgegeben**: Die Seitenstruktur des Anbieters wird nicht erraten.
Der Administrator trägt sie unter *Datenquellen* ein; erlaubt sind nur https-Adressen der freigegebenen Hosts.

**Beobachtung beim Entwickeln (7./8. Oktober 2026):** `www.hsn-tsn.de` lieferte ein TLS-Zertifikat, das nicht zum Hostnamen passt
(Zertifikat für einen anderen Host). Das System bricht solche Abrufe ab und meldet „Das Zertifikat des Anbieters ist ungültig …“.
Ein Live-Abruf von dieser Quelle wurde deshalb **nicht** getestet; der Parser ist mit einer Test-Fixture geprüft, die der beschriebenen
Tabellenstruktur entspricht – nicht mit echten Seiten. Vor einer Freigabe bitte die tatsächliche Seitenstruktur prüfen und den Parser ggf. anpassen.

## Nicht umgesetzt / offen (ehrlich)

- **OCR** für Fahrzeugscheinfotos: nicht angebunden. Die Felder (2.1, 2.2, B, D.1–D.3, E, J, P.1–P.3, S.1) werden manuell erfasst und abgeglichen.
- **Excel-Import**: nicht direkt; bitte als CSV (UTF-8) speichern. **Hersteller-/Modell-/API-Import**: keine Listenseiten/Schnittstelle konfiguriert.
- **KBA, DAT, Schwacke, TecDoc, VIN-Decoder**: nur Provider-Struktur und ehrliche Platzhalter – keine Schnittstellen, Zugangsdaten oder Daten erfunden.
- **Ausstattung/UVP/CO₂/Abgasnorm**: werden nicht geliefert und nicht geschätzt.
- Rate-Limit und 429-Pause sind getestet (Gateway-Tests); gegen echte Anbieter nicht.

## Betrieb

- Rechte: `vehicledata.read` (suchen/identifizieren: Büro, Gutachter, Prüfer), `vehicledata.write` (manuell anlegen, übernehmen: Büro, Gutachter), `vehicledata.manage` (Anbieter, Import, Konflikte: Inhaber/Admin).
- Provider-Protokoll (`vehicle_provider_logs`) enthält nur Anbieter, Zeit, Art, Ergebnis, Dauer, HTTP-Status, Trefferzahl, Fehlerart – keine Kennzeichen, FIN oder Nutzerdaten.
- Datei-Import: CSV/JSON bis 2 MB (Server-Action-Limit 2,5 MB, siehe `next.config.mjs`).
