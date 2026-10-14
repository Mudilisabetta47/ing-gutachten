# Entwurf: Anfrage an DAT

**Status: Entwurf, nicht versendet.**
**An:** zentrale@dat.de (Hinweis im Betreff: „zur Weiterleitung an Vertrieb / Schnittstellenpartnerschaft“) – parallel Online-Formular „Interface-Partner“ auf datgroup.com
**Betreff:** Anfrage Schnittstellenpartnerschaft – Fahrzeugidentifikation (HSN/TSN, FIN), Kalkulation und Bewertung für eigene Gutachtersoftware (ING Gutachten, Hannover)

> ▶ Vor Versand: alle `[…]` ersetzen; Absender = Geschäftsadresse.

---

Sehr geehrte Damen und Herren,

wir sind ein Kfz-Sachverständigenbüro in [Hannover / Region] und entwickeln mit dem „ING Studio“ eine eigene Gutachtersoftware (Fallverwaltung, Schadenerfassung, Kalkulation, Gutachten-PDF). Wir möchten Fahrzeugdaten, Kalkulation und Bewertung künftig direkt über DAT-Dienste in dieses System einbinden und bitten Sie deshalb um ein Angebot sowie Auskunft zu Ihrem Interface-Partnerprogramm.

**Über uns**
ING Gutachten, [Rechtsform, vollständiger Firmenname], [Anschrift], USt-IdNr. [ … ], Sachverständiger: [Name, Qualifikation/Bestellung durch … – nur wenn zutreffend], Web: ing-gutachten.de.
Aktuell [Anzahl] Sachverständige, erwartet [X] Gutachten pro Monat im ersten Jahr, Ziel [Y] pro Monat in [Z] Jahren.
Kundennummer bei DAT: [falls vorhanden, sonst „noch keine“].

**Unsere Fragen**

1. **API-Zugang:** Können wir SilverDAT-Funktionen (Identifikation, Kalkulation, Bewertung) per Schnittstelle direkt in unsere eigene Anwendung integrieren? Welche Schnittstelle (Protokoll, Authentifizierung), welche Dokumentation und welcher Partnerstatus sind dafür nötig?
2. **HSN/TSN:** Können wir ein Fahrzeug über HSN/TSN (KBA-Schlüssel) identifizieren – als direkte Eingabe der Schnittstelle? Welche Fahrzeugmerkmale werden dabei geliefert?
3. **FIN:** Wird die Identifikation über die 17-stellige Fahrzeug-Identifizierungsnummer angeboten (VIN-Abfrage)? Für welche Hersteller/Baujahre, und welche Voraussetzungen (Freischaltungsvereinbarung) gelten?
4. **Datentiefe:** Welche Felder erhalten wir – Marke, Modell, Motorisierung, Leistung (kW/PS), Hubraum, Kraftstoff, Baujahr/Erstzulassung, Serien- und Sonderausstattung, technische Daten (Maße, Gewichte, Reifen, CO₂)? Gibt es eine Feldliste/Beispielantwort?
5. **Kalkulation und Bewertung:** Stehen über die Schnittstelle Ersatzteilpreise, Arbeitswerte, Lackierkosten, Reparaturkalkulation (z. B. calculateEXP) sowie Wiederbeschaffungswert, Restwert und Fahrzeugbewertung zur Verfügung? Welche Module sind für Sachverständige üblich und was kostet jedes einzeln?
6. **Lizenzierung/Anzeige:** Dürfen die Daten in unserer eigenen Gutachtersoftware angezeigt, weiterverarbeitet und **in Gutachten-PDFs an unsere Mandanten** (Geschädigte, Anwälte, Versicherungen, Gerichte) übernommen werden? Gelten Kennzeichnungs- oder Quellenangabe-Pflichten?
7. **Speicherung:** Welche Daten dürfen wir **dauerhaft in der Fahrzeug-/Fallakte** speichern (Aufbewahrungspflicht für Gutachten)? Gibt es Beschränkungen für Zwischenspeicherung (Caching), Wiederverwendung für andere Fälle und für Berechnungsstände?
8. **Kosten:** Bitte nennen Sie Einrichtungsgebühr, monatliche Grundgebühr, Preis je Abfrage/Kalkulation/Bewertung, Mindestumsatz, Vertragslaufzeit und Kündigungsfrist. Wir bitten um den **wirtschaftlichsten Tarif für ein wachsendes Sachverständigenunternehmen** (Staffeln, Einstiegspakete, Pilotphase).
9. **Test:** Gibt es eine Sandbox, einen Testzugang oder eine zeitlich begrenzte Testphase für die Entwicklung? Zu welchen Bedingungen?
10. **Datenschutz und Sicherheit:** In welchen Ländern werden Daten verarbeitet? Welche personenbezogenen Daten (z. B. FIN) werden übertragen? Stellen Sie einen Auftragsverarbeitungsvertrag bereit? Welche Sicherheitsanforderungen (Authentifizierung, Verschlüsselung, Protokollierung) stellen Sie an Partneranwendungen?

**Technischer Hintergrund (kurz):** Webanwendung (Next.js/Node.js, PostgreSQL in der EU), die Anfragen serverseitig über eine zentrale Schnittstellenschicht an den Anbieter sendet; Zugangsdaten liegen ausschließlich serverseitig; Dateien sind verschlüsselt, Zugriffe rollenbasiert und protokolliert.

Wir bitten um ein unverbindliches Angebot, die Schnittstellendokumentation und einen Ansprechpartner für Sachverständigen-Software/Schnittstellen. Gern vereinbaren wir ein kurzes Telefonat.

Mit freundlichen Grüßen
[Name, Funktion]
ING Gutachten · [Anschrift] · [Telefon] · [E-Mail]

---

## Formular „Interface-Partner“ (datgroup.com) – Angaben

(Pflichtfelder laut Seite: Firma, Anschrift, PLZ, Ort; Kontaktperson: Anrede, Vor-/Nachname, E-Mail, Telefon; DAT-Anbindungen auswählen; Beschreibung der Anwendung)
- **DAT-Anbindungen:** Fahrzeugidentifikation/VIN-Abfrage, Kalkulation (SilverDAT 3 / calculateEXP), Wertermittlung/Restwert – nur auswählen, was wirklich gewünscht ist.
- **Ihre Anwendung:** „Eigene Gutachtersoftware (Webanwendung) für ein Kfz-Sachverständigenbüro: Fallverwaltung, Schadenerfassung, Kalkulation, Gutachten-PDF. Zielnutzer: Sachverständige und Büro von ING Gutachten, später ggf. weitere Büros. Funktion der DAT-Anbindung: Fahrzeugidentifikation (HSN/TSN, FIN), Kalkulation, Bewertung.“
- **Haben Sie bereits eine DAT-Schnittstelle?** Nein.
- Doppeltes Opt-in per E-Mail bestätigen (Spam-Ordner prüfen).
