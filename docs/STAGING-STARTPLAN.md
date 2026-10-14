# Staging-Startplan ING Studio (Supabase + Vercel)

> **Aktualisiert 2026-10-15:** Die Entscheidungen E1–E6 sind getroffen (Supabase Frankfurt + Storage, Vercel, geschütztes Staging, Mail-Überwachung, iPhone). Die ausführliche Anleitung steht in **`docs/STAGING-AUFBAU.md`**, Konten/Einstellungen in `docs/KONTEN-UND-EINSTELLUNGEN.md`, Kosten in `docs/KOSTEN.md`. Dieser Plan bleibt als Übersicht.

Stand: 2026-10-14. **Nichts davon ist angelegt.** Jeder Schritt mit 💶 oder 🚀 braucht deine ausdrückliche Freigabe, bevor ich (oder du) ihn ausführt; Kontoanlagen und Zahlungsangaben führst du selbst aus. Ergänzt `docs/DEPLOYMENT.md` (Konzept) und `docs/PILOT-GO-NOGO.md` (Blocker).

## 0. Entscheidungen, die ich von dir brauche (kurz)

| # | Frage | Empfehlung |
|---|---|---|
| E1 | Supabase-Tarif für **Staging** | Kostenloses Projekt reicht für den Anfang (keine automatischen Backups, pausiert bei Inaktivität) – **wir sichern selbst mit `npm run backup`**. Produktion später mit einem Tarif mit Backups/PITR. Preise vor Buchung auf supabase.com prüfen. |
| E2 | Privater Dateispeicher | Supabase Storage (S3-Endpunkt, privater Bucket) – ein Anbieter weniger. Alternative Cloudflare R2/AWS S3 Frankfurt. Egal welcher: **eigener Bucket je Umgebung**. |
| E3 | Staging-Adresse | Vercel-Preview-Adresse mit **Deployment Protection** (Anmeldung); später `staging.ing-gutachten.de`. |
| E4 | Alarm-Ziel | z. B. ntfy-Kanal oder E-Mail-Weiterleitung über einen Webhook-Dienst; Uptime-Dienst mit kostenlosem Tarif. Welches Ziel willst du? |
| E5 | **Testadressen** für Mail | 1–2 Adressen, die du ausdrücklich freigibst (z. B. eine eigene Postfach-Adresse). |
| E6 | Gerät | Dein iPhone (iOS-Version?) und ein Android, falls vorhanden. |

## 1. Reihenfolge und Abnahme (jeweils „fertig, wenn …“)

| Phase | Schritte | Wer | Freigabe | Fertig, wenn |
|---|---|---|---|---|
| **A – Konten (du)** | Supabase-Konto/Organisation, Projekt `ing-staging` (Region Frankfurt), Vercel-Team, ggf. Bucket-Anbieter | du | 💶 (falls kostenpflichtig) | Projekte existieren; **Zugangsdaten nur in dein Passwortmanager**, nicht in den Chat |
| **B – Schlüssel** | `npm run secrets:generate` → Werte in Passwortmanager und Vercel-„Preview“-Variablen (Vorlage `.env.staging.example`) | du, ich begleite | – | `npm run preflight -- staging --env-file <lokale Datei>` ohne Fehler |
| **C – Datenbank** | `npm run db:migtest` lokal grün → Sicherung/Snapshot → `npm run db:deploy` (direkte URL, in der Shell) → `npm run db:check` | du führst aus (Zugangsdaten), ich werte aus | 🚀 (erste Migration auf Staging) | `db:check`: „Alles in Ordnung“, RLS aktiv |
| **D – Speicher** | Privaten Bucket anlegen (kein öffentlicher Zugriff), Zugangsdaten als `S3_*` setzen, `STORAGE_ENCRYPTION_KEY` setzen | du | – | `/api/health` mit Token: `storage` ok (Schreib-/Lese-/Löschprobe verschlüsselt) |
| **E – Deployment** | Branch `feature/ing-operating-system` als **Preview** (nicht Production) deployen, Deployment Protection an | du/ich | 🚀 | Staging-Adresse erreichbar nur mit Anmeldung; `noindex` |
| **F – Konten & MFA** | Inhaber anlegen (`create-owner`), 2FA einrichten, Pflicht einschalten (Abschnitt 2) | du | – | Anmeldung nur mit zweitem Faktor; Demo-Konten funktionieren **nicht** (gesperrt) |
| **G – Cloud-Backup-Test** | Abschnitt 4 | ich + du | – | Wiederherstellung in zweites leeres Projekt vollständig und geprüft, Dauer notiert |
| **H – Monitoring** | Abschnitt 5 | du/ich | – | Testalarm kommt an; Uptime-Dienst meldet bei künstlichem Ausfall |
| **I – Mailtest** | Abschnitt 6 | ich + du | nach E5 | Testmail im Postfach, nicht im Spam |
| **J – iPhone-Praxistest** | Abschnitt 7 | du/Gutachter | – | Protokoll ausgefüllt |
| **K – Bewertung** | `docs/PILOT-GO-NOGO.md` aktualisieren | ich | – | Blocker 1–6 abgehakt |

Zeitrahmen: A–F etwa ein Arbeitstag, G–J ein weiterer; Vorlauf entsteht nur durch Anbieterantworten und Freigaben.

## 2. Sichere MFA-Konfiguration (Staging und später Produktion)

- `MFA_ENCRYPTION_KEY`: eigener Zufallswert je Umgebung (≥ 32 Zeichen), nie aus der Entwicklung übernehmen; in Passwortmanager **und** versiegelte Offline-Kopie. Ohne ihn ist die Einrichtung in Staging/Produktion gesperrt (so gewollt).
- Reihenfolge: Schlüssel setzen → deployen → Inhaber meldet sich an → Profil → Zwei-Faktor einrichten (QR-Code mit Authenticator-App, Code bestätigen) → **Wiederherstellungscodes ausdrucken/im Passwortmanager** → Einstellungen → Sicherheit → „verpflichtend für Inhaber und Administratoren“.
- Mindestens **zwei** Konten mit Leitungsrechten und 2FA, damit ein verlorenes Gerät kein Aussperren bedeutet (Zurücksetzen durch die andere Leitung: Benutzer → Konto → Zurücksetzen).
- Anmeldeschutz: 5 Fehlversuche → 15 min Sperre; Sitzung 12 h, höchstens 7 Tage (Standard, `preflight` warnt bei großzügigeren Werten).
- Schlüsselwechsel: `MFA_ENCRYPTION_KEY_PREVIOUS` setzen, `npm run mfa:rotate`, danach `…_PREVIOUS` entfernen (getestet).
- Prüfen: `tests/e2e/mfa.e2e.mjs` gegen die Staging-Adresse ist **nicht** vorgesehen (legt Demo-Daten an); stattdessen manuelle Checkliste: Anmeldung ohne Code scheitert, falscher Code scheitert, Wiederherstellungscode funktioniert einmal, Zurücksetzen beendet Sitzungen.

## 3. Privater S3-kompatibler Dokumentenspeicher

1. Bucket `ing-staging-private`, **privat**, Region EU, Versionierung an (falls angeboten). Kein öffentlicher Link, keine öffentliche Richtlinie.
2. Zugangsdaten mit **nur diesem Bucket** als Berechtigung (kein Konto-Hauptschlüssel); als `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET_PRIVATE`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` in Vercel „Preview“.
3. `STORAGE_ENCRYPTION_KEY` setzen: die App verschlüsselt **vor** dem Hochladen (AES-256-GCM) – der Anbieter sieht nur Chiffretext. Ohne den Schlüssel speichert Staging nichts (fail-closed).
4. Abnahme: `/api/health` (Bearer-Token) zeigt `storage` ok; ein Foto hochladen, im Bucket liegt nur `INGE1…`-Chiffretext (Kontrolle: Datei herunterladen, öffnet sich nicht als Bild); Zugriff mit fremdem Gutachter → 403/404.
5. Offen bis zur Probe: Der S3-Treiber ist bisher nur gegen einen lokalen Testserver geprüft. Ob Supabase-S3 „Path-Style“-Adressen verlangt, zeigt sich hier; falls nötig, ist das eine kleine Anpassung in `src/server/storage/s3.ts`.

## 4. Backup- und Restore-Test in der echten Cloud

Voraussetzung: Phasen C–D. Alle Befehle laufen **von deinem Rechner** (Zugangsdaten in der Shell, nicht im Chat).
1. Staging mit **Testdaten** füllen (Anfrageformular + Besichtigung mit Fotos, ein Gutachten, eine Rechnung).
2. `BACKUP_ENCRYPTION_KEY` und `BACKUP_DATABASE_URL` (direkte URL) setzen → `npm run backup -- --out ~/ing-backups --keep 14` → `npm run backup:verify -- <Ordner>`.
3. **Zweites** leeres Supabase-Projekt `ing-restore-test` + leerer Bucket (💶 nur, falls kostenpflichtig; kostenloses Projekt genügt).
4. `npm run restore -- <Ordner> --db <URL Restore-Projekt> --s3` (S3-Variablen dabei auf den Restore-Bucket zeigen lassen!).
5. `DATABASE_URL` auf Restore-Projekt → `npm run db:check`; Stichproben (Anmeldung mit 2FA, Fall mit Fotos, PDF, Rechnung).
6. **Dauer** (Sicherung, Wiederherstellung) und Auffälligkeiten in `docs/BACKUP-WIEDERHERSTELLUNG.md` Abschnitt 3/7 eintragen. Das ist die erste echte RTO-Zahl.
7. Projekt `ing-restore-test` und Bucket danach löschen (🚀 destruktiv – nur nach Rückfrage, nur dieses Testprojekt).
8. Zeitplan: erst nach der Probe (GitHub-Actions oder Cron auf eigenem Rechner mit `pg_dump` ≥ Serverversion; Ziel anderer Anbieter/Region).

## 5. Monitoring und Alarmierung

1. `HEALTH_TOKEN` (zufällig) setzen. Uptime-Dienst (kostenloser Tarif genügt): URL `https://<staging>/api/health` alle 1–5 min, bei ≠ 200 oder `degraded` benachrichtigen. Der Detailaufruf mit `Authorization: Bearer <HEALTH_TOKEN>` zeigt, **was** fehlt.
2. `ALERT_WEBHOOK_URL` auf das Alarm-Ziel (E4) setzen. Testauslösung: eine absichtlich fehlerhafte Anfrage an eine Schnittstelle, die einen Serverfehler erzeugt (in Staging, mit Absprache) → genau eine Meldung im Ziel (Dedupe 5 min, höchstens 10/min, ohne personenbezogene Daten).
3. Vercel: Log-Benachrichtigungen/Spend-Limit aktivieren; Supabase: Berichte zu Datenbankgröße und Verbindungen ansehen; E-Mail bei Auslastung > 80 %.
4. Abnahme: künstlicher Ausfall (z. B. falscher `DATABASE_URL`-Wert in Preview kurz setzen und zurücknehmen) → Uptime-Meldung kommt an; danach wieder grün.

## 6. Mailversand mit freigegebenen Testadressen

1. Du nennst 1–2 Testadressen (E5). Eintrag: `MAIL_ALLOWED_RECIPIENTS=<a@…,b@…>` in Vercel Preview (Pflicht in Staging, sonst verweigert die App den Versand).
2. Mail-Anbieter (Brevo/Resend): **Absender-Domain verifizieren** (SPF/DKIM) – ohne das landen Mails im Spam. API-Schlüssel nur in Vercel.
3. `npm run mail:test -- --to <freigegebene Adresse>` (Variablen aus Staging in der Shell) → eine Testmail ohne Kundendaten. Prüfen: Eingang, Spam, Absenderanzeige.
4. Anfrageformular der Staging-Website mit Foto ausfüllen → Mail an `MAIL_TO` (muss in der Positivliste stehen).
5. Ergebnis mit Datum in `docs/PRAXISTEST-GERAETE.md` Abschnitt 4 eintragen. **Es wird nie an andere Adressen gesendet.**

## 7. Praxistest auf einem echten iPhone

Vorbereitung (ich): Staging mit Testfall „Testfahrzeug“ und einem Gutachter-Testkonto (2FA); Testfall mit zugewiesener Besichtigung; Checkliste `docs/PRAXISTEST-GERAETE.md` Abschnitt 3 als Ausdruck/Bildschirm.
Auf dem iPhone (du):
1. Staging-Adresse in Safari öffnen (Deployment-Protection-Anmeldung), Lesezeichen/„Zum Home-Bildschirm“ (die App ist eine Webseite, **keine** native App; kein Store nötig).
2. Passwortmanager/Autofill testen, 2FA-App auf demselben Gerät.
3. Checkliste Schritte 1–13 (Anmeldung, Besichtigung, **echte Kamera** 10+ Fotos, Fahrzeugschein, Flugmodus-Test, Schäden am Fahrzeugbild, Diktat, Abschluss, am Schreibtisch Kalkulation/PDF, PDF auf dem iPhone öffnen, fremder Zugriff, Abmelden).
4. Protokoll je Schritt (ok/Problem), Screenshots **ohne** Echtdaten; iOS-/Safari-Version notieren.
5. Probleme als Liste an mich → Korrektur → Wiederholung nur der betroffenen Schritte.
Typische Stolpersteine zum Gegenprüfen: Tastatur verdeckt Felder, Zoom beim Fokussieren, Fotogröße > 4,5 MB (wird im Browser verkleinert), Foto-Ausrichtung, Sitzungsende beim App-Wechsel.

## 8. Kosten, die entstehen können (nur zur Planung – alles vor Buchung prüfen)

| Posten | Staging | Hinweis |
|---|---|---|
| Supabase | kostenloses Projekt möglich | Free hat keine automatischen Backups und pausiert; Pro für Produktion prüfen |
| Vercel | Hobby/Pro je nach Team | Hobby ist für gewerbliche Nutzung laut Anbieter nicht gedacht – Bedingungen prüfen |
| Speicher | meist Cent-Bereich bei Testmengen | Ausgehender Verkehr/Anfragen beachten |
| Mail (Brevo/Resend) | kostenlose Tarife mit Limits | Domain-Verifizierung nötig |
| Uptime-Dienst | kostenloser Tarif genügt | |
| Fahrzeugdaten (DAT/Schwacke/api4cars) | **noch nichts gebucht** | siehe `docs/ANBIETERVERGLEICH.md` |
