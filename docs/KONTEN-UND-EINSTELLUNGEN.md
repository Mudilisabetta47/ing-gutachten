# Benötigte Konten und Einstellungen (Staging)

Stand 2026-10-14. Entscheidung der Geschäftsführung: Supabase PostgreSQL (Frankfurt) + Supabase Storage (privater Bucket) + Vercel + geschütztes Staging + Monitoring mit E-Mail + Test auf echtem iPhone. **Noch nichts angelegt.** 💶 = kann Kosten verursachen (vorher deine Freigabe). Zugangsdaten gehören in den Passwortmanager, nie in den Chat oder ins Repository.

## 1. Konten

| # | Konto | Zweck | Wer legt an | Kosten | Notwendig für |
|---|---|---|---|---|---|
| K1 | **Passwortmanager** der Geschäftsführung (Team-Tresor, 2 Personen) | Zugangsdaten, Schlüssel, Wiederherstellungscodes | du | je Produkt | alles |
| K2 | **Supabase-Konto** + Organisation „ING“ | Datenbank + Dateispeicher | du (Konto/Zahlungsdaten) | Free $0; Pro ab $25/Monat (Produktion) 💶 | Phase A |
| K3 | **Vercel-Konto** + Team | Hosting der Anwendung | du | **Pro $20/Monat je Entwickler-Platz** 💶 (Hobby ist nur für nicht-kommerzielle Nutzung erlaubt) | Phase E |
| K4 | **GitHub** (vorhanden: Repository `Mudilisabetta47/ing-gutachten`) | Quelltext; Vercel-Verbindung | vorhanden | – | Phase E |
| K5 | **Mail-Anbieter** (Empfehlung Brevo; Alternative Resend) | Versand der Testmails und Betriebs-Mails | du | Free-Tarife mit Tageslimit (Brevo: 300/Tag laut Drittquellen; vor Nutzung auf brevo.com prüfen) | Phase I |
| K6 | **Prüfdienst** für Erreichbarkeit (z. B. cron-job.org kostenlos; UptimeRobot Solo €10/Monat – der Gratis-Tarif ist laut Anbieter für Hobby/Non-Profit) | ruft `/api/monitor/check` regelmäßig auf | du | 0 – €10/Monat; **Nutzungsbedingungen für gewerblichen Einsatz vorher prüfen** | Phase H |
| K7 | **Domain/DNS-Zugang** für `ing-gutachten.de` | Mail-Absender (SPF/DKIM/DMARC), später `staging.ing-gutachten.de` | vorhanden? (Registrar-Zugang nötig) | – | Phase I |
| K8 | **Apple-ID auf dem iPhone**: kein Developer-Konto nötig (Webanwendung in Safari) | iPhone-Test | du | – | Phase J |
| K9 | **Postfächer für Testadressen** (1–2, ausdrücklich freigegeben) und Betriebs-Mail-Empfänger (bis 3) | Testmail, Alarmmails | du | – | Phase I/H |

## 2. Einstellungen je Dienst

### Supabase (Projekt `ing-staging`)
| Einstellung | Wert | Warum |
|---|---|---|
| Region | **Central EU (Frankfurt)** | Datenbank/Storage-Standort; Verarbeitung durch Supabase insgesamt ist **nicht** automatisch rein EU (siehe `docs/DATENSCHUTZ-VERARBEITER.md`) |
| Datenbankpasswort | Zufall ≥ 24 Zeichen, nur Passwortmanager | – |
| Verbindungen | App: **Transaction-Pooler** (Port 6543, Benutzer `postgres.<ref>`); Migration/Sicherung: **Session-Pooler** (Port 5432) oder direkte Verbindung | Direkte Verbindung ist IPv6-only (IPv4 nur mit Add-on); Transaction-Pooler unterstützt keine Prepared Statements – der Datenbanktreiber der App verwendet keine benannten |
| SSL | Verbindungen mit `sslmode=require`; „SSL erzwingen“ aktivieren, falls angeboten | Verschlüsselung der Leitung |
| Data API | wird von der App nicht genutzt; falls abschaltbar, abschalten | Migration `supabase_hardening` (RLS + entzogene Rechte) bleibt zusätzlich |
| Storage-Bucket `ing-staging-private` | **nicht öffentlich**, Größenlimit ≤ 10 MB, kein öffentlicher Link | Dateien nur über die App nach Rechteprüfung |
| S3-Verbindung | aktivieren (Storage → Settings → S3 Connection), Endpunkt + Region kopieren, Zugriffsschlüssel erzeugen | App spricht S3 mit Signatur V4 |
| Tarif Staging | Free ($0) reicht; **pausiert nach 1 Woche Inaktivität**, keine automatischen Backups, 500 MB Datenbank, 1 GB Dateien | wir sichern selbst (`npm run backup`) |
| Zweites Projekt `ing-restore-test` | später für den Wiederherstellungstest (Free erlaubt 2 aktive Projekte) | Restore-Probe |

Wichtig: **Supabase-Sicherungen enthalten keine Dateien aus Storage**, und Storage hat **keine Versionierung** („Gelöschte Objekte werden dauerhaft entfernt“). Dateisicherung läuft deshalb ausschließlich über `npm run backup`.

### Vercel (eigenes Projekt `ing-studio-staging`, getrennt von der öffentlichen Website)
| Einstellung | Wert |
|---|---|
| Plan | Pro (kommerzielle Nutzung) 💶 |
| Region der Funktionen | `fra1` (steht in `vercel.json`) |
| Git-Verbindung | optional; `vercel.json` verhindert automatische Deployments des Branches `feature/ing-operating-system` – Deployments nur manuell nach deiner Freigabe |
| Deployment Protection | **Vercel Authentication, Geltungsbereich „All Deployments“** (schützt auch die Produktions-URL des Staging-Projekts; ohne Zusatzkosten) |
| Zugriff für Tester | Mitglieder mit Rolle **Viewer** (laut Preisseite kostenlose Viewer-Plätze auf Pro – vor Einladung prüfen) – Anmeldung mit Vercel-Konto, auch auf dem iPhone |
| Automations-Bypass | **Protection Bypass for Automation** aktivieren (auf allen Plänen enthalten); Geheimnis nur für den Prüfdienst |
| Umgebungsvariablen | alle Werte aus `.env.staging.example`, **ING_ENV=staging in allen Vercel-Umgebungen** des Staging-Projekts (damit selbst ein versehentlicher „Production“-Deploy die Staging-Regeln hat); keine Variable mit `NEXT_PUBLIC_` für Geheimnisse; Variablen als „Sensitive“ markieren |
| Ausgaben-Limit | Spend-Limit/Budget-Benachrichtigung setzen (Pro) |
| Cron-Jobs | nicht verwenden: Vercel-Cron ruft **nur die Produktions-Bereitstellung** auf; Überwachung läuft über externen Prüfdienst |

### Mail-Anbieter (Brevo)
Absender-Domain `ing-gutachten.de` verifizieren (SPF, DKIM, DMARC – DNS-Einträge, die Brevo anzeigt); API-Schlüssel nur in Vercel/Passwortmanager; Absenderadresse z. B. `noreply@…` oder die bestätigte Geschäftsadresse; in Staging `MAIL_ALLOWED_RECIPIENTS` = nur Testadressen **und** `ALERT_EMAIL_TO`.

### Prüfdienst
URL `https://<staging-adresse>/api/monitor/check`, Methode GET, alle 5 Minuten, Header `Authorization: Bearer <MONITOR_SECRET>` **und** `x-vercel-protection-bypass: <Bypass-Geheimnis>`, Alarm bei HTTP ≠ 200 an eine eigene E-Mail-Adresse. Die App sendet zusätzlich selbst eine Mail beim Statuswechsel (Störung, Erinnerung nach 6 h, Entwarnung).

## 3. Umgebungsvariablen (Staging) – Eigentümer der Werte

| Variable | Quelle | Aufbewahrung |
|---|---|---|
| `DATABASE_URL`, `BACKUP_DATABASE_URL` | Supabase Connect-Dialog | Passwortmanager; `BACKUP_…` nur lokale Shell |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET_PRIVATE`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Supabase Storage Settings | Passwortmanager |
| `STORAGE_ENCRYPTION_KEY`, `MFA_ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY`, `IP_HASH_SALT`, `HEALTH_TOKEN`, `MONITOR_SECRET` | `npm run secrets:generate` (nur Bildschirm) | Passwortmanager + Offline-Kopie für die drei `*_ENCRYPTION_KEY` |
| `BREVO_API_KEY`, `MAIL_FROM`, `MAIL_TO`, `MAIL_ALLOWED_RECIPIENTS`, `ALERT_EMAIL_TO` | Brevo / du | Passwortmanager |
| `ING_ENV=staging`, `SITE_URL` | fest | Vercel |
