# Entwurf: Anfrage an api4cars (Oliversuite GmbH)

**Status: Entwurf, nicht versendet.**
**An:** info@api4cars.com (Impressum api4cars.com, E-Mail dort verschleiert; dekodiert)
**Betreff:** Fragen zu Datenquelle, Lizenz und Speicherung vor Buchung – Fahrzeugdaten-API für Gutachtersoftware (ING Gutachten)

> ▶ Vor Versand: alle `[…]` ersetzen; Absender = Geschäftsadresse. Hinweis: Ein Free-/Testkonto dürfen wir erst anlegen, wenn Sie das freigeben (Kontoanlage durch Menschen, nicht durch Claude).

---

Guten Tag,

wir sind ein Kfz-Sachverständigenbüro in [Hannover / Region] und entwickeln eine eigene Gutachtersoftware (ING Studio). Fahrzeugdaten sollen anhand von HSN/TSN – und wenn möglich FIN – automatisch abgerufen werden. Ihre API ist für uns interessant; vor einer Buchung brauchen wir einige Auskünfte, weil Ihre veröffentlichten Bedingungen für unseren Einsatzzweck Fragen offenlassen.

**Über uns**
ING Gutachten, [Rechtsform, vollständiger Firmenname], [Anschrift], USt-IdNr. [ … ], Web: ing-gutachten.de. Erwartete Abfragen: ca. [X] pro Monat im ersten Jahr (ein Fahrzeug je Gutachten, wenige Abfragen je Fall), Ziel [Y] in [Z] Jahren.

**Unsere Fragen**

1. **API-Zugang:** Können wir die API serverseitig in unsere eigene Anwendung einbinden (REST/JSON, API-Schlüssel pro Umgebung)? Gibt es getrennte Schlüssel für Test und Betrieb? Rate-Limits?
2. **HSN/TSN:** Welche Fahrzeugmerkmale liefert die Abfrage über HSN/TSN vollständig (Felder, Beispielantwort)? Wie ist die Abdeckung (Hersteller, Baujahre, Nutzfahrzeuge, Motorräder, ältere Fahrzeuge/Oldtimer)?
3. **FIN:** Bieten Sie eine Abfrage über die Fahrzeug-Identifizierungsnummer an (oder ist das geplant)? Wenn ja: Abdeckung und Preis.
4. **Datentiefe:** Welche Felder genau: Marke, Modell, Motorisierung, Leistung kW/PS, Hubraum, Baujahr/Bauzeitraum, Karosserie, Ausstattung, Maße, Gewichte, Reifen, CO₂? Liefern Sie Ausstattungs-/Bauteiledaten? **Welche Datenquelle(n)** liegen den Daten zugrunde, und wie aktuell sind sie?
5. **Kalkulation:** Bieten Sie Ersatzteilpreise, Arbeitswerte, Reparaturkalkulationen oder Fahrzeugbewertungen an? (Wir gehen davon aus, dass das nicht der Fall ist, und fragen zur Klarheit.)
6. **Lizenzierung:** Ihre API-Nutzungsbedingungen untersagen die Weitergabe an Dritte und nennen als erlaubt die Nutzung in eigenen Anwendungen. Ein **Gutachten** enthält Fahrzeugdaten und wird **an Mandanten (Geschädigte, Anwälte, Versicherungen, Gerichte) übergeben**. Ist die Übernahme einzelner Daten in solche Gutachten-PDFs ausdrücklich erlaubt? Bitte schriftlich bestätigen.
7. **Speicherung:** Die Bedingungen erlauben Zwischenspeicherung höchstens 30 Tage je Datensatz und verbieten den Aufbau einer eigenen Datenbank. Gutachten unterliegen aber **Aufbewahrungspflichten**. Dürfen die für einen Fall abgerufenen und im Gutachten verwendeten Fahrzeugdaten **dauerhaft in der Fall-/Fahrzeugakte** verbleiben? Dürfen wir einmal abgerufene Daten für denselben Fall wiederverwenden? Gibt es eine entsprechende Ausnahme/Option?
8. **Kosten:** Wir haben Starter (79 €/Monat, 10.000 Abfragen), Professional (199 €/Monat, 100.000 Abfragen) und Enterprise gesehen. Gibt es einen kleineren Einstieg oder Jahrestarif für unsere Menge? Einrichtungsgebühr, Mindestumsatz, Vertragslaufzeit, Kündigungsfrist? Wir bitten um den **wirtschaftlichsten Tarif für ein wachsendes Unternehmen**.
9. **Test:** Auf der Seite stehen für den Free-Tarif 50 Abfragen/Monat (Preistabelle) und 500 (FAQ). Welche Zahl gilt? Dürfen wir Entwicklung und Test mit dem Free-Tarif durchführen (nicht produktiv)?
10. **Datenschutz:** Verarbeitungsstandorte/Rechenzentren, welche personenbezogenen Daten Sie verarbeiten (IP, ggf. FIN), Auftragsverarbeitungsvertrag, Sicherheitsmaßnahmen, Haftung für die Richtigkeit der Daten (AGB nennen keine Gewähr für Vollständigkeit/Richtigkeit – wie ist das für ein Gutachten gedacht?).

Wir bitten um eine kurze schriftliche Antwort zu 4, 6 und 7; davon hängt unsere Entscheidung ab.

Mit freundlichen Grüßen
[Name, Funktion]
ING Gutachten · [Anschrift] · [Telefon] · [E-Mail]
