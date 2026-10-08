# ING Operating System – Phase 4: Funktionsumfang und ehrliche Grenzen

Stand: Oktober 2026 · Branch `feature/ing-operating-system` (nie nach `main` mergen, ohne Freigabe).

## Was gebaut ist (Ablauf Anfrage → Abschluss)

| Station | Wo im System | Wichtigste Regeln |
|---|---|---|
| Anfrage | Anfragen | Website-Anfrage unveränderlich; Bearbeitung am „Lead“; Umwandlung in Kunde + Fahrzeug + Fall in einer Transaktion |
| Fall | Fälle, Falldetail | Statusmodell NEU → Termin → Besichtigt → Kalkulation → Gutachten-Entwurf → Prüfung → Freigegeben → Versendet → Abrechnung → Abgeschlossen; Folgestatus entstehen automatisch, wo eindeutig |
| Fahrzeug | Fahrzeuge, Fahrzeugdatenbank | HSN/TSN, FIN, Fahrzeugschein, manuell; eigene Datenbank zuerst; Herkunft und Konflikte sichtbar, nichts wird überschrieben |
| Schaden | Fall → Schaden | 9 SVG-Ansichten, klickbare Bauteile, Zustände (aktuell, Vorschaden, Gebrauchsspur, repariert, zu prüfen) |
| Kalkulation | Fall → Kalkulation | Teile, Lohn (AW), Lack, Versionen, Vergleich; Cent/Basispunkte; Sätze aus der Werkstatt |
| Bewertung | Fall → Bewertung | WBW, Restwert, Wertminderung, Nutzungsausfall, Dauer – immer mit Quelle und Stand; Totalschaden-Einordnung nur als Rechenhilfe |
| Gutachten | Fall → Gutachten | Kapitel, Variablen, Textbausteine, Prüfung (Vier-Augen), Freigabe erzeugt PDF in der Akte, Versand wird nur **vermerkt** |
| Rechnung | Fall → Rechnung, Rechnungen | Entwurf frei bearbeitbar; Ausstellen vergibt lückenlose Nummer; danach unveränderlich (Datenbank-Trigger); Storno mit Begründung |
| Zahlung | Rechnung, Zahlungen | Teilzahlungen, keine Überzahlung, Storno statt Löschen; volle Zahlung schließt den Fall |
| Mahnwesen | Mahnwesen | Nur überfällig, Stufen 1–3, **nie automatisch**; Gebühren/Zinsen trägt niemand vor |
| Aufgaben | Aufgaben, Wiedervorlagen, Fall → Aufgaben | Zuweisung mit Hinweis, Verschieben mit Zähler, nur eigener Sichtbereich bei `.own`-Rechten |
| Kommunikation | Fall → Kommunikation | Interne/externe Notizen, Anrufprotokoll, @Erwähnungen (nur erlaubte Personen), angeheftete Hinweise; **es wird nichts versendet** |
| Auswertung | Dashboard, Auswertungen | Nur echte Daten; Umsatz nur mit Recht |
| Export / DSGVO | Export / Archiv, Kunde | CSV-Exporte protokolliert; Anonymisierung nur archivierter Kunden ohne offene Vorgänge |

Querschnitt: Rollen und Rechte werden bei **jeder** Abfrage serverseitig geprüft (`.all` / `.own` + Objektprüfung); Audit-Protokoll; ⌘K-Suche über Fälle, Kunden, Fahrzeuge, Anfragen, Rechnungen, Gutachten, Aufgaben; deutsche Formate (08.10.2026, 1.250,00 €).

## Tests

```bash
npm test            # 20 Unit-Tests ohne Datenbank
npm run test:db     # Integrationstests gegen ing_os_test (u. a. Gesamtablauf in tests/db/end-to-end.test.ts)
```

Browser-Durchläufe (CDP-Skripte) liegen im Sitzungs-Scratchpad und sind nicht Teil des Repos.

## Ehrliche Grenzen – was **nicht** gebaut oder nicht geprüft ist

- **HSN/TSN-Anbieter:** Die Anbindung ist gebaut, aber nicht gegen die echte Seite getestet (TLS-Zertifikatsfehler beim Test; URL-Vorlage und Lizenz sind mit dem Anbieter zu klären). Standard-Status: „Prüfung erforderlich“.
- **Nicht angebunden (zeigen „Nicht konfiguriert“):** DAT, Audatex/GT Motive, Restwertbörse, KBA/FIN-Decoder, Kalender-Sync, DATEV, SMS, Zahlungsanbieter, E-Signatur. Werte werden manuell mit Quelle und Stand erfasst.
- **Kein echter E-Mail-/Brief-Versand** von Gutachten, Rechnungen oder Mahnungen. Alles wird nur vermerkt.
- **Nicht umgesetzt:** OCR des Fahrzeugscheins, Excel-Import der Fahrzeugdaten, Foto-Annotationen/KI-Auswertung, Provisionen (bewusst gesperrt bis zur rechtlichen Prüfung), Wertminderungs-/Nutzungsausfall-Tabellen (keine Tabellen hinterlegt, nichts erfunden).
- **Dateispeicher S3:** Code vorhanden, aber nur mit dem lokalen Speicher getestet.
- **Website-Verwaltung (CMS/SEO/Regionen/Ratgeber):** Phase 5, nicht Teil dieser Arbeit.
- **DSGVO:** Anonymisierung betrifft Kundenstammdaten, Kundennotizen und Kundendokumente. Fälle, Fahrzeuge und ausgestellte Rechnungen bleiben wegen gesetzlicher Aufbewahrung (§ 147 AO) unverändert; die Bereinigung nach Fristablauf ist ein separater, noch offener Vorgang. Rechtlich nicht geprüft.
- **Steuer/Recht:** Rechnungspflichtangaben (Name, Anschrift, Steuernummer) werden geprüft; ob das Layout alle Anforderungen des UStG erfüllt (z. B. Leistungszeitraum, Kleinunternehmerhinweis), ist durch Steuerberatung zu bestätigen.

## Produktivbetrieb (Supabase/Vercel)

Zugangsdaten gehören ausschließlich in Vercel bzw. die lokale Shell – nie in den Chat. Reihenfolge: `npm run db:deploy` → `npm run db:check` → `ALLOW_PRODUCTION_BOOTSTRAP=yes npm run create-owner -- …`.
