# Anbietervergleich Fahrzeugdaten (Stand 2026-10-14, vor den Antworten)

Nur öffentlich Belegtes; „?“ = nicht belegt, wird in den Anfragen gestellt (`docs/anfragen/`). Spalte „Antwort“ wird nach Eingang ausgefüllt. Preise ohne Gewähr, netto sofern nicht anders genannt.

| Kriterium | **DAT** (SilverDAT, Interface-Partner) | **Schwacke** (Autovista / J.D. Power) | **api4cars** (Oliversuite GmbH) |
|---|---|---|---|
| Rolle für uns | Identifikation + **Kalkulation + Bewertung** (Branchenstandard für Gutachter) | Bewertung/Restwert, Schadenkalkulation, Identifikation | reine Fahrzeug-Stammdaten-API (HSN/TSN) |
| API / Integration | ja, über Interface-Partnerprogramm (Antrag per Online-Formular, Vertrag); Technik nicht öffentlich; Schnittstellen-Dokumente auf dat.de teils öffentlich | Schnittstellen existieren (Drittsoftware nutzt SchwackeNet Schadenmanager); für Eigenanwendung **?** | ja, JSON-REST, Doku `/api-docs` |
| HSN/TSN | als nationale Codes am €uropa-Code; direkte Eingabe **?** | **?** | ja (Hauptfunktion) |
| FIN/VIN | ja (VIN-Abfrage, Freischaltungsvereinbarung nötig; Hersteller-Abdeckung unterschiedlich) | **?** | auf der Seite nicht genannt – **?** |
| Datentiefe | Serien-/Sonderausstattung, Bauzustand, techn. Daten | **?** (Identifikation, Bewertung, Reparaturkosten laut Drittquelle) | Typ, Baujahr, kW/PS, Hubraum, Kraftstoff, Antrieb, Maße, Gewichte, CO₂, Reifen u. a.; **Quelle nicht genannt** |
| Ersatzteilpreise, Arbeitswerte, Kalkulation, Bewertung | ja (SilverDAT 3 Pro: Identifikation, Reparaturkalkulation, Wertermittlung) | ja laut Drittquelle; Umfang **?** | nein (nicht genannt) |
| Nutzung in eigener Gutachtersoftware / PDF | Daten nur zur Bestimmung von Bauzustand für Kalkulation/Bewertung; PDF-Übernahme **?** | **?** | eigene Anwendungen erlaubt; **Weitergabe an Dritte verboten** → Gutachten an Mandanten **ungeklärt** |
| Dauerhafte Speicherung (Fahrzeugakte) | **?** | **?** | Cache **max. 30 Tage**/Datensatz; **eigene Datenbank aus den Daten verboten** → Konflikt mit Akte/Aufbewahrungspflicht, Rückfrage nötig |
| Kosten | nicht öffentlich | nicht öffentlich (Drittquelle: „ab mehreren hundert Euro monatlich“ für Händler – unbestätigt) | Free: 50 (Tabelle) bzw. 500 (FAQ) Abfragen/Monat · **Starter 79 €/Monat (10.000)** · **Professional 199 €/Monat (100.000, danach 0,002 €)** · Enterprise auf Anfrage · zzgl. 19 % MwSt.; Jahrestarif −20 % |
| Test/Sandbox | **?** | **?** | Free-Tarif (zum Testen); Sandbox **?** |
| Datenschutz / Standort | **?** (Sitz Ostfildern, Deutschland) | **?** (Sitz Frankfurt, Konzern J.D. Power) | **?** (Sitz Sonthofen; AGB: Daten stammen von Dritten, keine Gewähr) |
| Haftung für Richtigkeit | **?** | **?** | **ausgeschlossen** („keine Gewähr für Vollständigkeit und Richtigkeit“) |
| Kontakt | Formular „Interface-Partner“; zentrale@dat.de; +49 711 4503-0 | customer@autovistagroup.com (zu prüfen); +49 69 808839 50 | info@api4cars.com; +49 8321 7109063 |
| Einschätzung | **Favorit strategisch** – deckt auch die wertkritischen Daten ab; Kosten unbekannt, vermutlich höchste Einstiegshürde | **Alternative/Ergänzung** für Marktwerte; nur wenn Eigenanwendung zulässig | **günstiger Einstieg nur für Stammdaten**, Lizenz-/Speicherfragen müssen schriftlich geklärt sein, sonst nein |

## Auswertung der Antworten (ausfüllen)

| Frage | DAT | Schwacke | api4cars |
|---|---|---|---|
| Antwort erhalten am | | | |
| API für Eigenanwendung? | | | |
| HSN/TSN als Eingabe? | | | |
| FIN? | | | |
| Gutachten-PDF an Mandanten erlaubt? | | | |
| Dauerhafte Akte erlaubt? | | | |
| Einrichtung / Grundgebühr / je Abfrage | | | |
| Mindestumsatz / Laufzeit | | | |
| Sandbox / Test | | | |
| AVV vorhanden / Standort | | | |
| Gesamtkosten im 1. Jahr bei [X] Gutachten/Monat | | | |
| Entscheidung | | | |

**Entscheidungsregel:** Kein Anbieter wird gebucht, bevor schriftlich bestätigt ist, dass (a) Daten im Gutachten an Mandanten weitergegeben und (b) für die Aufbewahrungsdauer in der Fall-/Fahrzeugakte gespeichert werden dürfen. Ohne beides ist die Integration unbrauchbar. Danach wirtschaftlichster Tarif; Vertrag nur nach ausdrücklicher Freigabe der Geschäftsführung.
