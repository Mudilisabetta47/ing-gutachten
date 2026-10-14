# HSN/TSN und Fahrzeugdaten: Quelle, Rechtslage, Anbieter, Vorschlag

Stand: 2026-10-14. **Es wurde kein Vertrag geschlossen, kein Konto angelegt und keine Zahlung ausgelöst.** Alle Angaben stammen von öffentlich zugänglichen Seiten der Anbieter (Quellen am Ende); was ich nicht belegen konnte, steht als „nicht belegt“ da. Preise sind Anbieter-Listenpreise ohne Gewähr und können sich ändern. Das ist keine Rechtsberatung – die Lizenzfragen unten sind vor einem Vertrag schriftlich beim Anbieter zu klären und ggf. anwaltlich prüfen zu lassen.

## 1. Bisherige Datenquelle in der Anwendung

| Befund | Stand |
|---|---|
| Fahrzeugdaten im System (Entwicklungsdatenbank) | genau 2 Datensätze: 1 manuell erfasst, 1 aus Datei-Import – **beide „nicht verifiziert“**. Aus dem Anbieter-Adapter wurde **nie ein Datensatz übernommen**. |
| Adapter `HSN_TSN` (`src/server/vehicledata/providers/hsn-tsn.ts`) | ruft eine vom Administrator hinterlegte https-Adresse **normal per GET** ab und liest Tabellen aus der Seite. Kein Umgehen von Schutzmaßnahmen, keine Browser-Automatisierung, Zertifikatsfehler werden nie übergangen. Voreingestellte Zielseite in der Entwicklungsdatenbank: `hsn-tsn.de`. |
| Freigabestatus | **`REVIEW_REQUIRED`, Automatik aus, Massenimport aus** – serverseitig gesperrt. Der letzte (und einzige) Testabruf endete mit `TLS_ERROR`. |
| Zertifikat von `www.hsn-tsn.de` | Auch bei der Prüfung am 2026-10-14 passt das Zertifikat **nicht** zum Hostnamen (ausgestellt für `www.autoampel.de`). Wer die Seite betreibt, ließ sich nicht belegen. |
| Nutzungsbedingungen / Erlaubnis für automatische Abrufe | **Nicht auffindbar** (die Seite ließ sich wegen des Zertifikatsfehlers nicht laden; auch die Suche nach Bedingungen blieb ohne Treffer). Ohne ausdrückliche Erlaubnis des Betreibers ist ein automatisiertes Auslesen eines fremden Datenbestands rechtlich riskant (Datenbankschutz, Nutzungsbedingungen). |

**Bewertung:** Die Quelle `hsn-tsn.de` ist **nicht verwendbar**. Der Adapter bleibt als Technik im Code, **darf aber nicht freigegeben werden**, solange der Betreiber keine schriftliche Erlaubnis erteilt und die Zertifikatsfrage geklärt ist. Es gibt keinen Scraping-Betrieb, kein Massen-Auslesen und keine übernommenen Fremddaten. Maßnahme: Die Beschreibung des Anbieters im Admin-Bereich bleibt „nur nach rechtlicher Prüfung und ausdrücklicher Freigabe“; Lizenzstatus bleibt `REVIEW_REQUIRED`.

## 2. Was für den Pilot wirklich nötig ist

Für ein Gutachten sind die **Angaben aus der Zulassungsbescheinigung Teil I** maßgeblich (Hersteller, Typ, HSN 2.1/TSN 2.2, FIN, Erstzulassung, Hubraum, Leistung, Kraftstoff …). Die Anwendung erfasst sie aus dem Fahrzeugschein-Foto (manuell/OCR nicht angebunden) und gleicht sie ab. Ein Fremddatenbestand ist dafür **nicht erforderlich**; er wäre eine Komfortfunktion (Vorbelegung, Ausstattung) – und nur dann sinnvoll, wenn er korrekt, lizenziert und für Gutachten nutzbar ist.
Für **Wiederbeschaffungswert, Restwert und Reparaturkosten** (die eigentlich wertkritischen Daten) gibt es keine freie Quelle; dort braucht ein Kfz-Sachverständiger ohnehin einen lizenzierten Datendienst (DAT oder Schwacke).

## 3. Anbieter im Vergleich (nur Belegtes)

| Anbieter | Was | Preis (belegt) | Rechte/Bedingungen (belegt) | Offen / Risiko |
|---|---|---|---|---|
| **Eigene Erfassung aus dem Fahrzeugschein** (Ist-Stand) | Felder aus dem Dokument, Gutachter bestätigt | 0 € | rechtlich unproblematisch | Mehr Tipparbeit; keine Ausstattungsdaten |
| **KBA** (Kraftfahrt-Bundesamt) | vergibt HSN/TSN; Quelle der Schlüsselnummern | nicht belegt | **nicht belegt**: ob und unter welchen Bedingungen Schlüsselverzeichnisse zur gewerblichen Weiterverwendung bereitstehen (mehrere Ratgeber widersprechen sich; eine KBA-Seite lieferte beim Abruf 404) | schriftliche Anfrage an das KBA |
| **DAT** (SilverDAT, Interface-Partnerprogramm) | Fahrzeugidentifikation (FIN, €uropa-Code, KBA-Schlüssel), Reparaturkosten, Wertermittlung; Anbindung eigener Software über „Interface-Partner“ | **nicht öffentlich** (Preise nur auf Anfrage) | Daten dürfen laut Produktbeschreibung nur für Bauzustand/Kalkulation/Bewertung genutzt werden; Anbindung nur nach Antrag (Online-Formular) und Vertrag; VIN-Abfrage benötigt Freischaltungsvereinbarung | Ob HSN/TSN direkt als API-Eingabe möglich ist, geht aus den Unterlagen nicht hervor; Konditionen, Technik, Speicherrechte → Anfrage |
| **Schwacke / Autovista (J.D. Power)** | Marktwerte/Restwerte, Schadenkalkulation | nicht öffentlich („auf Anfrage“) | B2B-Lizenz, Abo-Modelle; Schnittstellen existieren (Drittsoftware nutzt sie) | Für Einzelgutachter und Eigen-Software-Anbindung nicht belegt → Anfrage |
| **api4cars / CarAPI** (Oliversuite GmbH, Sonthofen) | JSON-API, Suche nach HSN/TSN; Felder u. a. Typ, Leistung kW/PS, Hubraum, Kraftstoff, Antrieb, Maße, Gewichte, CO₂ | Free: 50 Abfragen/Monat (FAQ nennt 500 – Widerspruch) · **Starter 79 €/Monat (10.000)** · **Professional 199 €/Monat (100.000, danach 0,002 €)** · Enterprise auf Anfrage · alle zzgl. 19 % MwSt.; Jahrestarif −20 % | nur B2B; Nutzung in eigener Anwendung erlaubt; **keine eigene Datenbank aus den Daten aufbauen** (§ 4); **Zwischenspeichern nur zum Betrieb, höchstens 30 Tage je Datensatz** (§ 5); Weitergabe/Weiterverkauf/Unterlizenz verboten; **keine Gewähr für Vollständigkeit/Richtigkeit**, Daten stammen von Dritten (Hersteller-/Marktdaten) | **Datenquelle nicht genannt**; Gutachten für Dritte nicht ausdrücklich geregelt (Weitergabe-Verbot!); unsere Fahrzeugkatalog-Tabelle (dauerhaftes Speichern) widerspricht § 4/§ 5 → Rückfrage und Anpassung nötig |
| **pkwliste.com** (Datenbank-Download) | HSN/TSN-Datenbank als SQL/CSV/XLSX, 38.646 Fahrzeuge, 80 Hersteller, > 40 Felder | „einmaliger Preis“ – **Betrag auf der Produktseite nicht genannt** (eine Suchtreffer-Angabe „ab 349 €“ ließ sich nicht bestätigen); Demo kostenlos | **Lizenz nicht genannt** (gewerbliche Nutzung, Einbettung, Weitergabe), Datenquelle nicht genannt, Aktualisierungsrhythmus nicht genannt | Lizenz schriftlich klären; Aktualität/Quelle unklar |
| **TecAlliance (TecDoc)** | Teile-/Fahrzeugkatalog (Werkstatt/Handel) | auf Anfrage, jährlich verhandelt (Drittquelle) | Lizenz direkt bei TecAlliance | HSN-Suche nicht belegt; für Gutachter unpassend |
| **VIN-Decoder** (z. B. Vincario ≈ 0,22–0,49 € je FIN-Abfrage laut Anbieter, Zyla, auto.dev …) | decodieren die 17-stellige **FIN**, nicht HSN/TSN | je Anbieter verschieden (Drittangaben) | je Anbieter | Abdeckung/Genauigkeit für deutsche Typdaten ungeprüft; HSN/TSN fehlt meist |
| **Kostenlose Webseiten** (hsn-tsn.de, easyWerkstatt, fahrzeugdaten.com …) | Handsuche | 0 € | Erlauben **nicht** automatisch, dass eine Software sie ausliest | nur für manuelle Nachschau, **nicht als Quelle** |

## 4. Konkreter Vorschlag

**Stufe 0 – Pilot (jetzt, 0 €):** Fahrzeugdaten ausschließlich aus dem Fahrzeugschein (Foto + Erfassung + automatischer Abgleich, Status „vom Gutachter bestätigt“). Anbieter-Adapter bleibt gesperrt. Die Datenbasis wächst durch bestätigte Fälle in der eigenen Fahrzeugdatenbank (eigene Daten, keine Fremdlizenz). Optional: kostenlose Webseiten von Hand zur Kontrolle.

**Stufe 1 – parallel: schriftliche Anfragen (kostenfrei, ohne Verpflichtung)**, mit diesen Fragen:
1. *DAT*: Interface-Partner-Antrag (Online-Formular) bzw. Hotline +49 711 4503-0. Fragen: Kosten (einmalig/monatlich/je Abfrage), Mindestlaufzeit, HSN/TSN als Eingabe, Ausgabefelder, **dauerhafte Speicherung im Gutachten/Fall** erlaubt?, Testzugang.
2. *Schwacke/Autovista*: gleiche Fragen für Marktwert/Restwert-Schnittstelle für Gutachter-Software.
3. *api4cars*: Datenquelle? Erlaubt die Nutzung für Gutachten an Dritte (Weitergabe-Verbot)? Darf ein in einem Gutachten verwendeter Datensatz dauerhaft im Fall archiviert werden (gesetzliche Aufbewahrung)? Free-Tarif: 50 oder 500 Abfragen?
4. *KBA*: Schlüsselverzeichnis zur gewerblichen Nutzung – Bezugsweg, Gebühr, Lizenz.
5. *pkwliste.com*: Preis, Lizenztext, Quelle, Update-Rhythmus, Nutzung in eigener Software.

**Stufe 2 – Entscheidung nach den Antworten.** Mein Vorschlag nach heutigem Wissensstand:
- **Strategisch DAT** (oder Schwacke), weil der Sachverständige für Wiederbeschaffungs-/Restwert und Reparaturkosten ohnehin einen lizenzierten Dienst braucht; dann kommt die Fahrzeugidentifikation aus derselben Quelle, rechtlich sauber und für Gutachten gedacht. Kosten: auf Anfrage (nicht öffentlich) – Erwartungswert nicht schätzbar.
- **Als günstiger Zwischenschritt api4cars Starter (79 €/Monat zzgl. MwSt. = 948 €/Jahr zzgl. MwSt.)**, *nur wenn* die schriftlichen Antworten zu Datenquelle, Gutachtennutzung und Archivierung zufriedenstellend sind. Bei Pilotmengen (einige hundert Abfragen im Monat) wäre sogar der Free-Tarif zum Testen genug. Sonst entfällt dieser Weg.
- pkwliste.com nur, wenn die Lizenz die Einbettung in eine eigene Software ausdrücklich erlaubt und der Preis bekannt ist.

**Keine Verträge, keine Zahlung ohne deine ausdrückliche Freigabe.**

## 5. Technische Voraussetzungen für einen Anbieter

1. Neuer Adapter hinter dem vorhandenen Provider-Interface (`providers/types.ts`; `Dat`/`Vin`-Platzhalter existieren). Aufwand je REST-Anbieter ca. 1–2 Tage inkl. Tests gegen einen Stub.
2. Zugangsdaten (API-Schlüssel) nur als Umgebungsvariable je Umgebung (Staging eigener Testschlüssel); Gateway (Lizenzstatus, Pause, Rate-Limit, Protokoll ohne personenbezogene Daten) ist vorhanden.
3. **Speicher-Regeln des Vertrags umsetzen:** Bei Anbietern mit Speicherverbot (z. B. api4cars: höchstens 30 Tage) muss ein Ablauf je Datensatz (`source_last_checked_at`) mit automatischem Löschen nachgerüstet werden; Daten, die ins Gutachten übernommen wurden, bleiben dort als Teil des Dokuments – ausdrücklich vom Anbieter bestätigen lassen.
4. Lizenzstatus erst auf `LICENSED` setzen, wenn der unterschriebene Vertrag vorliegt; bis dahin bleibt alles gesperrt. Datensätze behalten Quelle und Priorität (vom Gutachter bestätigt > lizenziert > Dritt-API).
5. Datenschutz: Anbieter erhält nur HSN/TSN bzw. FIN (technische Fahrzeugdaten, keine Kunden-/Fallbezüge); trotzdem Auftragsverarbeitung/Datenschutzprüfung vor Vertrag (siehe `docs/DATENSCHUTZ-TODO.md`).

## 6. Quellen (abgerufen 2026-10-14)

- api4cars: Startseite https://api4cars.com/ · AGB https://api4cars.com/agb · API-Nutzungsbedingungen https://api4cars.com/api-nutzungsbedingungen
- pkwliste.com: https://www.pkwliste.com/de/produktinformation
- DAT: Interface-Partnerprogramm https://www.datgroup.com/products/interface-partnership/ · Produktbeschreibung SilverDAT 3 Pro https://www.dat.de/fileadmin/de/download/rechtliches/produktbeschreibung-silverdat-3-pro.pdf · Europa-Code https://dynamic-www.dat.de/fileadmin/de/download/rechtliches/produktbeschreibung-europa-code.pdf
- Autovista (Schwacke/Eurotax): https://autovistagroup.com/products-and-services/eurotax-applications
- TecAlliance/TecDoc und VIN-Decoder: Drittübersichten aus Websuche (nicht amtlich), daher nur als Orientierung.
