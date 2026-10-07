# Datenschutz – offene Punkte (Operating System)

Stand: Phase 2. **Dies ist keine Rechtsberatung und kein Datenschutztext.** Die Datenschutzerklärung der Website wird hier bewusst
nicht angefasst; sie muss vom Verantwortlichen (ggf. mit Datenschutzbeauftragtem/Anwalt) geprüft und angepasst werden.
Die Kennung `PRIVACY_VERSION` (`src/lib/request-schema.ts`) ist bei jeder Änderung der Erklärung hochzuzählen – sie wird je Anfrage mitgespeichert.

## Was neu gespeichert wird

| Daten | Zweck | Speicherort | Aufbewahrung (offen!) |
|---|---|---|---|
| **Anfrage (Inquiry)**: Zeitpunkt, Formularversion, Anlass, Fahrzeugart, Name, Telefon, E-Mail, Ort, Nachricht | Bearbeitung der Anfrage des Besuchers | PostgreSQL (Tabelle `inquiries`), unveränderlich (DB-Trigger) | **festlegen** (Vorschlag: nicht umgewandelt → 6 Monate; umgewandelt → Dauer des Falls) |
| **Einwilligungsnachweis**: Zeitpunkt + Version der Datenschutzerklärung (keine Marketing-Einwilligung) | Nachweis der Kenntnisnahme | `inquiries.consent_at`, `privacy_version` | wie Anfrage |
| **Herkunft** (optional): UTM-Werte, Host des externen Referrers, Einstiegspfad ohne Query | Auswertung, welche Seite/Kampagne Anfragen bringt | `inquiries.utm_*`, `referrer_host`, `landing_path` | wie Anfrage; **prüfen**, ob Hinweis in der Erklärung nötig ist |
| **IP-Hash** (nur wenn `IP_HASH_SALT` gesetzt): gesalzener, gekürzter HMAC der IP | Missbrauchserkennung | `inquiries.ip_hash` | kurz (Vorschlag: 30 Tage, danach auf NULL) |
| **Anhangs-Metadaten**: Art, Größe, Hash, Typ (keine Datei, kein Original-Dateiname) | Nachvollziehbarkeit, ob Fotos ankamen | `inquiry_attachments` | wie Anfrage |
| **Arbeitskopie (Lead)**: Kontaktdaten, Status, Notizen, Zuständigkeit, Wiedervorlage | Bearbeitung | `leads`, `notes`, `lead_status_history` | **festlegen** |
| **Kunde, Fahrzeug, Fall** (Name, Firma, Anschrift, Kontakt, FIN, Kennzeichen, Schaden-/Versicherungsdaten, Notizen) | Auftragsabwicklung (Gutachten) | `customers`, `vehicles`, `cases`, `notes`, `case_status_history` | **festlegen** (steuer-/handelsrechtliche Fristen für Rechnungen beachten; Gutachten-Aufbewahrung klären) |
| **Protokoll (Audit)**: wer hat wann was geändert; keine Klartextwerte personenbezogener Felder, nur Feldnamen | Nachvollziehbarkeit, Sicherheit | `audit_logs` | **festlegen** |

## Verarbeiter / Drittanbieter (einzutragen, sobald produktiv)

- **E-Mail-Versand** (Benachrichtigung inkl. Anhänge): Brevo **oder** Resend – AV-Vertrag, Standort der Verarbeitung, Drittlandübermittlung prüfen. *Noch nicht produktiv konfiguriert.*
- **Datenbank (später)**: Anbieter und Region festlegen (empfohlen EU, z. B. Frankfurt), AV-Vertrag, Verschlüsselung/Backups. *Aktuell nur lokale Entwicklungsdatenbank.*
- **Dateispeicher (Phase 3)**: privater S3-kompatibler Speicher in der EU. Bis dahin liegen Fotos **nicht** in der Datenbank, sondern nur im Mail-Anhang.
- **Hosting**: Vercel (Funktionsregion einstellen), AV-Vertrag.

## Offene Entscheidungen

1. Aufbewahrungsfristen je Datenart (siehe Tabelle) und ein **automatisiertes Löschkonzept** (Anonymisierung ist technisch vorbereitet: `inquiries` erlaubt gezielt das Überschreiben der Personenfelder; `customers.anonymized_at`).
2. Betroffenenrechte: Auskunft/Löschung/Export – Prozess und Zuständigkeit (Berechtigung `data.export`/`data.anonymize` ist angelegt, das Verfahren noch nicht gebaut).
3. Verzeichnis von Verarbeitungstätigkeiten ergänzen.
4. Hinweistext am Formular prüfen (es wird nur die Verarbeitung der Anfrage einwilligt/akzeptiert – keine Werbung).
5. Mitarbeiter-Zugriff: Rollenkonzept (OFFICE/EXPERT/ACCOUNTING/CONTENT_MANAGER) gegen den Grundsatz der Erforderlichkeit prüfen; Buchhaltung sieht Unfall-Interna bewusst nicht.
