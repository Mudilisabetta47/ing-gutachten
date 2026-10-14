# ING Gutachten – Bestandsaufnahme (Stand 14.10.2026)

Geprüft wurde die tatsächliche Codebasis im Repository `inggutachtenrot`, Branch `feature/ing-operating-system` (nie ohne Freigabe nach `main`).
„Getestet“ heißt: automatisierter Test **gegen die echte Datenbank** bzw. im **echten Browser** (Chrome per DevTools-Protokoll mit echten Maus-/Tastaturereignissen). Mock-Daten zählen nicht.

## 0. Architektur – ein Projekt, nicht zwei

- Website **und** Gutachter-System liegen in **einem** Next.js-Projekt (App Router): öffentliche Seiten unter `src/app/(site)`, interner Bereich unter `/admin` („ING Operating System“) und `/studio` („ING Studio“, Desktop). Daten: PostgreSQL über Prisma. Es gibt kein separates `ing-admin-final` mehr; nichts wurde durch ältere ZIP-Stände ersetzt.
- `HANDOVER(2).md` im Repo beschreibt ein **anderes, statisches Projekt** (kein Next.js, keine Datenbank) und ist für dieses System **veraltet und irreführend**. Maßgeblich sind `docs/PHASE4-UEBERSICHT.md` und dieses Dokument.
- Migrationen: nur additiv (`prisma migrate deploy`), mit Datenbank-Prüfregeln und Härtung. Keine Produktionsdaten wurden angefasst; alle Läufe gegen lokale Entwicklungs-/Testdatenbanken.

## 1. Vollständig funktionsfähig (getestet)

| Bereich | Stand | Nachweis |
|---|---|---|
| Website → Anfrage → Backend | Vierstufiges Formular sendet an `/api/anfrage` (kein Mailto-Weg): serverseitige Validierung, Honeypot + Mindestausfüllzeit, Rate-Limit je IP, Dateityp aus Inhalt (Magic Bytes), Speicherung als unveränderliche Anfrage + Lead, Mailbenachrichtigung mit Status, Dublettenerkennung bei Umwandlung | DB-Tests, Browser |
| Eingang → Kunde → Fahrzeug → Fall | Umwandlung in einer Transaktion (alles oder nichts) | DB-Test `end-to-end` |
| Fälle, Status, Zuständigkeit, Historie | Statusmodell mit erlaubten Übergängen, Rechte `.all/.own` + Objektprüfung | DB- und Browser-Tests |
| Fahrzeuge, HSN/TSN, FIN | Eigene Fahrzeugdatenbank, Herkunft/Konflikte sichtbar | DB-Tests |
| Termine, Kalender, Besichtigung | Überschneidungsschutz in der Datenbank | DB-Tests |
| Mobile Schadenaufnahme | Fahrzeug prüfen, Kilometerstand, Fotos/Dokumente hochladen, Schaden am Fahrzeugbild antippen, Notiz, Terminstatus, Abschluss | **Browser (390 px, Touch): 27 Prüfungen** |
| Schadenerfassung | 9 Ansichten aus einem Bauteilmodell; Bauteil-ID einheitlich; Zustand, Schweregrad, Maßnahme, Fotozuordnung | DB- und Browser-Tests |
| Kalkulation | Teile/Lohn/Lack/Nebenkosten, Cent-genau, Versionen (freigegebene unveränderlich), Vorschläge aus Schäden ohne Dubletten, Quellen je Preis | DB- und Browser-Tests |
| Bewertung | WBW, Restwert, Wertminderung, Nutzungsausfall, Dauer – jeweils mit Quelle und Stand; Wirtschaftlichkeits-/Totalschaden-Rechenhilfe | DB-Tests |
| Gutachten | Kapitel, Variablen, Textbausteine, Prüfungsworkflow (Verfasser ≠ Freigeber), Entwurf mit Wasserzeichen, PDF bei Freigabe in der Akte | **Browser: Schaden → Kalkulation → Gutachten → Freigabe → PDF (19 Prüfungen)** |
| Rechnungen, Zahlungen, Mahnwesen | Lückenlose Nummern, Unveränderlichkeit (Datenbank-Trigger), Storno, keine automatischen Mahnungen | DB- und Browser-Tests |
| Aufgaben, Wiedervorlagen, Kommunikation | Notizen intern/extern, Anrufprotokoll, @Erwähnungen, angeheftete Hinweise | DB- und Browser-Tests |
| Rollen, Rechte, Audit | Prüfung bei jeder Seite/Schnittstelle; Audit-Protokoll | DB-Tests |
| **ING Studio (Desktop)** | siehe Abschnitt 4 | **Browser: 49 Prüfungen** |
| **Zwei-Faktor-Anmeldung** | TOTP nach RFC 6238 (gegen die RFC-Testwerte geprüft), verschlüsseltes Geheimnis, Wiederherstellungscodes, optional Pflicht für Administratoren | Unit-, DB- und Browser-Tests (26) |
| Export, Archiv, DSGVO-Anonymisierung | CSV protokolliert; Anonymisierung nur archivierter Kunden ohne offene Vorgänge | DB-Tests |

## 2. Teilweise funktionsfähig / nur eingeschränkt belegt

- **HSN/TSN-Anbieter (extern):** Anbindung gebaut, aber **nicht gegen die echte Seite getestet** (Zertifikatsfehler beim Versuch; URL-Vorlage/Lizenz offen). Standardstatus „Prüfung erforderlich“.
- **E-Mail-Versand:** nur die Benachrichtigung über neue Anfragen. Gutachten/Rechnungen/Mahnungen werden bewusst **nicht** versendet, nur als versendet vermerkt. Mail-Anbieter (Brevo/Resend) im echten Betrieb nicht geprüft.
- **S3-Dateispeicher:** Code vorhanden, nur mit lokalem Speicher getestet.
- **Fahrzeugmodell:** ein **generisches** Bauteilmodell (Limousine/Kombi-Silhouette) für alle Fahrzeuge – kein fahrzeugspezifisches 3D-Modell und **keine echte 3D-Rotation**. Das ist so gewollt (keine erfundene Modellgenauigkeit), aber nicht „optional 3D“.
- **Website-SEO/Performance:** Struktur, Sitemap, Canonicals, strukturierte Daten sind vorhanden und werden im Abschnitt „Verifikation“ unten geprüft; Lighthouse-Werte auf Vercel wurden nicht gemessen.

## 3. Bewusst nicht vorhanden

- DAT/Audatex/GT Motive/Schwacke, Restwertbörse, KBA-/FIN-Decoder (keine Zugänge/Verträge; Werte manuell mit Quelle und Stand).
- Digitale Signatur im Gutachten (es gibt Freigabe-Vermerk mit Person und Datum, **keine** Signaturgrafik/qualifizierte Signatur).
- OCR des Fahrzeugscheins, Excel-Import der Fahrzeugdaten, Foto-Annotationen/KI, Provisionen, Kalender-Sync, DATEV, SMS, Zahlungsanbieter.
- Offline-Betrieb mit Synchronisation (nicht gebaut → in der Oberfläche als „nicht verfügbar“ gekennzeichnet).
- Website-CMS/SEO-Verwaltung/Regionen/Ratgeber im Admin (Phase 5).

## 4. ING Studio (neu)

Echter Desktop unter `/studio`: Hintergrund (3 Varianten), Verknüpfungen, Startmenü mit App- und Datensuche, Taskleiste (angeheftete + laufende Apps), Benachrichtigungszentrale (echte Zähler + persönliche Hinweise), Hell/Dunkel/System, Einstellungen, eigenes ING-Iconset (19 Symbole).
Fenster: verschieben, Größe ändern (alle Kanten/Ecken), minimieren, maximieren, schließen, Andocken links/rechts/oben, Fokus/Ebenen, Kontextmenüs, Tastenkürzel (Strg+Alt+Pfeile/W/Tab/D, Strg/⌘+K), Doppelklick auf Titelleiste, ⌘/Umschalt-Klick auf Links öffnet neues Fenster.
Jede App ist eine **echte Fachseite** in einem Fenster (gleiche Daten und Rechte wie im Operating System, kein Screenshot). Minimierte Fenster bleiben eingehängt – ungespeicherte Eingaben gehen beim Wechseln nicht verloren (getestet). Fenster-Layout, Hintergrund, angeheftete Apps liegen **im Benutzerkonto** (Datenbank), nicht im Browser. Auf Smartphones (< 900 px) leitet `/studio` auf die eigene Touch-Oberfläche um.
Grenze: Die Fenster sind iframes derselben Anwendung (gleicher Ursprung, `frame-ancestors 'self'`); das ist robust und teilt Sitzung/Rechte, bedeutet aber, dass jedes Fenster seine Seite komplett lädt.

## 5. Bekannte Mängel

- Nur Entwicklung: Next.js-Dev-Plakette (jetzt abgeschaltet); Port 3100 kann von einem anderen lokalen Projekt belegt sein (ING-Server läuft dann auf 3101).
- `HANDOVER(2).md` veraltet (siehe oben) – sollte entfernt oder ersetzt werden (Entscheidung beim Inhaber).
- Die Studio-Fenster teilen den Seitenstil des Operating Systems; ein eigenes „Fenster-Design“ pro App gibt es nicht.
