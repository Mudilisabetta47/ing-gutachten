# Schritt-für-Schritt: Geschützte Staging-Umgebung aufbauen

Stand 2026-10-15. Architektur (Entscheidung der Geschäftsführung): **Supabase PostgreSQL (Frankfurt) + Supabase Storage (privater Bucket) + Vercel (Next.js, geschütztes Deployment) + E-Mail-Überwachung + Test auf echtem iPhone.**
Regeln: nur Testdaten · keine Demo-Zugangsdaten in erreichbaren Umgebungen (sind in Staging technisch gesperrt) · Geheimnisse nur in Passwortmanager und Vercel-Variablen · **Schritte mit 💶 (Kosten) und 🚀 (Deployment/Migration) erst nach ausdrücklicher Freigabe** · kein Merge nach `main`.
Begleitdokumente: Konten/Einstellungen `docs/KONTEN-UND-EINSTELLUNGEN.md`, Kosten `docs/KOSTEN.md`, Datenschutz `docs/DATENSCHUTZ-VERARBEITER.md`, Wiederherstellung `docs/BACKUP-WIEDERHERSTELLUNG.md`, Gerätetest `docs/PRAXISTEST-GERAETE.md`.

Vorbereitung auf deinem Rechner: Node.js, dieses Repository (Branch `feature/ing-operating-system`), `psql`/`pg_dump` (mindestens so neu wie die Supabase-Postgres-Version), Passwortmanager geöffnet. Alle Befehle in einer Shell, die **nicht** protokolliert wird; Werte nie in den Chat kopieren.

---

## Phase 0 – Vorab lokal prüfen (ohne Cloud, kostenlos)
```bash
npm run lint && npm run typecheck && npm test && npm run test:db
npm run audit:auth
npm run db:migtest          # alle Migrationen in einer Wegwerf-Datenbank
npm run backup:drill        # Sicherung + Wiederherstellung üben
```
Fertig, wenn alles grün ist.

## Phase 1 – Supabase-Projekt `ing-staging` (Konto: du)
1. supabase.com → Konto anlegen (E-Mail + 2FA aktivieren) → Organisation „ING“. Tarif **Free** ($0). *(Pro erst für Produktion – 💶)*
2. **New project**: Name `ing-staging`, Region **Central EU (Frankfurt)**, Datenbankpasswort = Zufall ≥ 24 Zeichen **aus dem Passwortmanager** (dort speichern).
3. Warten, bis das Projekt „Healthy“ ist. Projekt-Referenz (`<ref>`) notieren (steht in der URL).
4. **Connect**-Dialog: drei Adressen notieren (nur im Passwortmanager):
   - *Transaction pooler* (Port **6543**, Benutzer `postgres.<ref>`) → wird `DATABASE_URL` der App
   - *Session pooler* (Port **5432**) → für Migrationen und Sicherung (`BACKUP_DATABASE_URL`; IPv4 auf allen Plänen)
   - Direkte Verbindung `db.<ref>.supabase.co` ist IPv6-only → nur nutzen, wenn dein Netz IPv6 hat
   An jede URL `?sslmode=require` anhängen (Format `postgresql://postgres.<ref>:<PASSWORT>@aws-…pooler.supabase.com:6543/postgres?sslmode=require`). Sonderzeichen im Passwort URL-kodieren oder ein Passwort nur aus Buchstaben/Ziffern wählen.
5. Settings: „SSL erzwingen“ aktivieren (falls angeboten); Data API, falls abschaltbar, deaktivieren (die App nutzt sie nicht; RLS und entzogene Rechte sind per Migration gesetzt).

## Phase 2 – Privater Speicher (Supabase Storage)
1. **Storage → New bucket**: `ing-staging-private`, **Public bucket AUS**, Größenlimit 10 MB.
2. **Storage → Settings → S3 Connection**: S3-Zugang **aktivieren**; **Endpoint** und **Region** kopieren; **Access keys** erzeugen (Key-ID und Secret sofort in den Passwortmanager – das Secret wird nur einmal angezeigt).
3. Zu wissen: Storage-Dateien sind **nicht** in Supabase-Backups enthalten und es gibt **keine Versionierung** (gelöscht = weg). Unser Verschlüsselungs- und Backup-Verfahren deckt das ab (Phase 8). Zugriffsschlüssel gelten vermutlich projektweit (Dashboard-Hinweis lesen) – deshalb **ein eigenes Projekt für Staging**.

## Phase 3 – Schlüssel und Konfiguration (lokal, nichts wird gespeichert)
```bash
npm run secrets:generate     # zeigt Zufallswerte nur auf dem Bildschirm
```
Werte in den Passwortmanager übernehmen: `MFA_ENCRYPTION_KEY`, `STORAGE_ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY`, `IP_HASH_SALT`, `HEALTH_TOKEN`, `MONITOR_SECRET`. **`STORAGE_ENCRYPTION_KEY` zusätzlich offline sichern** (Verlust = Dateien unwiederbringlich).
Konfigurationsdatei lokal anlegen (wird von `.gitignore` ausgeschlossen: Namensmuster `.env*.local`):
```bash
cp .env.staging.example .env.staging.local   # dann Werte eintragen, Datei NIE einchecken
npm run preflight -- staging --env-file .env.staging.local
```
Fertig, wenn „Fehler: 0“. Warnungen (z. B. fehlender Alarm-Empfänger) bewusst abarbeiten. Wichtige Werte: `ING_ENV=staging`, `STORAGE_DRIVER=s3` + `S3_*`, `MAIL_ALLOWED_RECIPIENTS` (nur freigegebene Testadressen, auch `ALERT_EMAIL_TO`), `ALERT_EMAIL_TO`, `MONITOR_SECRET`.

## Phase 4 – Datenbank migrieren 🚀 (erste Migration auf Staging – Freigabe)
Mit der **Session-Pooler**-URL (nicht Transaction-Pooler; Migrationen brauchen Sitzungen):
```bash
export DATABASE_URL='<Session-Pooler-URL mit ?sslmode=require>'   # nur in dieser Shell
npm run db:deploy        # nur fehlende Migrationen, löscht nie etwas
npm run db:check         # muss „Alles in Ordnung“ melden (RLS, Erweiterungen, Demo-Konten = 0)
unset DATABASE_URL
```
Fertig, wenn `db:check` grün ist. Meldet es fehlendes RLS: im Supabase-SQL-Editor `SELECT public.ing_harden_public();` ausführen.

## Phase 5 – Vercel-Projekt (💶 Pro $20/Monat, 🚀 Deployment – Freigabe)
1. vercel.com → Konto (2FA), Team anlegen, **Plan Pro** (Hobby ist nur für nicht-kommerzielle Nutzung). 💶
2. **Neues, eigenes Projekt** `ing-studio-staging` (nicht das der öffentlichen Website): Import des Repositories oder `vercel link` per CLI. `vercel.json` verhindert automatische Git-Deployments des Branches `feature/ing-operating-system` – es wird nur manuell deployt.
3. **Settings → Deployment Protection**: **Vercel Authentication** an, Geltungsbereich **All Deployments**. **Protection Bypass for Automation** aktivieren, Geheimnis in den Passwortmanager.
4. **Settings → Environment Variables**: alle Werte aus `.env.staging.local` eintragen, **für alle Umgebungen des Projekts**, als „Sensitive“; `DATABASE_URL` = **Transaction-Pooler** (6543). `ING_ENV=staging` gesetzt lassen. Keine `NEXT_PUBLIC_`-Geheimnisse.
5. **Settings → General**: Functions-Region Frankfurt (`fra1` steht bereits in `vercel.json`); Budget-/Ausgabenlimit setzen.
6. **Deployment (nur nach ausdrücklicher Freigabe)**:
```bash
npm i -g vercel
vercel login && vercel link          # Projekt ing-studio-staging wählen
vercel deploy                         # Vorschau-Deployment, ohne --prod
```
   Die ausgegebene Adresse ist durch Vercel Authentication geschützt. Notiere sie als `SITE_URL` (in Vercel eintragen, neu deployen).
7. Tester: Teammitglieder mit Rolle **Viewer** einladen (Viewer-Plätze auf Pro laut Preisseite kostenlos – prüfen).

## Phase 6 – Konten und MFA (Staging)
1. Inhaber anlegen – **lokal gegen die Staging-Datenbank** (Session-Pooler-URL in der Shell):
```bash
export DATABASE_URL='<Session-Pooler-URL>'
export ALLOW_PRODUCTION_BOOTSTRAP=yes
npm run create-owner -- --email <echte Adresse> --first <Vorname> --last <Nachname>   # Passwort wird verdeckt abgefragt
unset DATABASE_URL ALLOW_PRODUCTION_BOOTSTRAP
```
   Die Demo-Adresse `@demo.ing.test` und das Demo-Passwort werden abgelehnt.
2. Auf der Staging-Adresse anmelden (Vercel-Login, dann ING-Login), Passwort ändern.
3. **Profil → Zwei-Faktor-Anmeldung → Einrichten**: QR-Code mit Authenticator-App scannen, Code bestätigen, **Wiederherstellungscodes** im Passwortmanager ablegen.
4. **Einstellungen → Sicherheit**: „verpflichtend für Inhaber und Administratoren“ einschalten. Zweites Leitungskonto mit 2FA anlegen (Aussperr-Schutz).
5. Abnahme: Anmeldung ohne Code scheitert · falscher Code scheitert · Wiederherstellungscode funktioniert einmal · `…@demo.ing.test` wird abgewiesen.

## Phase 7 – Speicher- und Gesundheitsprobe
```bash
curl -s -H "x-vercel-protection-bypass: <Bypass-Geheimnis>" -H "Authorization: Bearer <HEALTH_TOKEN>" https://<staging-adresse>/api/health
```
Erwartet: `status: ok`, `database`, `migrations`, `storage` (Schreib-/Lese-/Löschprobe verschlüsselt), `mfaKey` jeweils ok. `mail` ist erst nach Phase 9 ok. Danach ein Foto im Testfall hochladen; Kontrolle im Supabase-Bucket: die Objekte heißen zufällig und der Inhalt ist Chiffretext (Download öffnet sich nicht als Bild).

## Phase 8 – Backup und Wiederherstellung in der echten Cloud
1. Staging mit Testdaten füllen (Anfrageformular mit Foto, Besichtigung, Gutachten).
2. Sicherung (Shell mit `BACKUP_DATABASE_URL` = Session-Pooler, `S3_*`, `STORAGE_ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY`):
```bash
npm run backup -- --out ~/ing-backups --keep 14
npm run backup:verify -- ~/ing-backups/ing-backup-<Zeit>
```
3. Zweites kostenloses Projekt `ing-restore-test` + Bucket `ing-restore-private`, Migrationen **nicht** einspielen (die Wiederherstellung bringt das Schema mit).
4. Wiederherstellen (Variablen auf **Restore**-Projekt zeigen lassen):
```bash
npm run restore -- ~/ing-backups/ing-backup-<Zeit> --db '<URL Restore-Projekt>' --s3
npm run db:check    # mit DATABASE_URL = Restore-Projekt
```
5. Dauer und Auffälligkeiten in `docs/BACKUP-WIEDERHERSTELLUNG.md` (Abschnitt 3/7) eintragen. Projekt `ing-restore-test` danach löschen (nur dieses; zuerst nachfragen).

## Phase 9 – Mail mit freigegebenen Testadressen
1. Brevo-Konto, **Absender-Domain `ing-gutachten.de` verifizieren** (SPF, DKIM, DMARC – DNS-Einträge setzt, wer die Domain verwaltet), API-Schlüssel in den Passwortmanager und Vercel.
2. In Vercel: `MAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `MAIL_FROM`, `MAIL_TO` (Testadresse), `MAIL_ALLOWED_RECIPIENTS` = freigegebene Testadressen, `ALERT_EMAIL_TO` (muss in der Liste stehen). Neu deployen.
3. Testmail: `npm run mail:test -- --to <freigegebene Adresse>` (Shell mit den Staging-Variablen). Prüfen: Eingang, Spam, Absender.
4. Anfrageformular der Staging-Website mit Foto ausfüllen → Mail an `MAIL_TO`. Es geht **nie** etwas an andere Adressen (Positivliste, serverseitig erzwungen).

## Phase 10 – Überwachung mit E-Mail
1. Die App sendet selbst eine Mail bei **jedem** unbehandelten Serverfehler (entdoppelt, ohne personenbezogene Daten) an `ALERT_EMAIL_TO`.
2. Erreichbarkeitsprüfung: Dienst nach Wahl (cron-job.org kostenlos – **Bedingungen für gewerbliche Nutzung vorher prüfen**; oder UptimeRobot Solo €10/Monat). Einstellungen: GET `https://<staging-adresse>/api/monitor/check`, alle 5 Minuten, Header `Authorization: Bearer <MONITOR_SECRET>` und `x-vercel-protection-bypass: <Bypass-Geheimnis>`, Benachrichtigung bei Fehler an eine eigene Adresse.
3. Die App entscheidet selbst, wann eine Mail nötig ist: **eine** Mail bei Störung, eine Erinnerung nach 6 h, eine Entwarnung bei Erholung (Zustand in der Datenbank, im Test belegt).
4. Abnahme: In Vercel `STORAGE_ENCRYPTION_KEY` kurz auf einen anderen Wert stellen **oder** Supabase-Bucketzugang temporär sperren → nach ≤ 5 Minuten kommt eine Störungs-Mail; zurücksetzen → Entwarnung. (Nur in Staging, nach Absprache.)

## Phase 11 – Praxistest auf dem iPhone
Nach `docs/PRAXISTEST-GERAETE.md` Abschnitt 3 mit Testfall „Testfahrzeug“. Vorbereitung: Vercel-Login auf dem iPhone (Viewer), Staging-Adresse als Lesezeichen/„Zum Home-Bildschirm“, Authenticator-App auf demselben Gerät. Protokoll je Schritt, Screenshots ohne Echtdaten, iOS-/Safari-Version notieren.

## Phase 12 – Abnahme und Rückbau
| Prüfung | Soll |
|---|---|
| `preflight -- staging` | 0 Fehler |
| `db:check` | „Alles in Ordnung“ |
| `/api/health` (Token) | alles ok |
| Demo-Konto-Anmeldung | abgewiesen |
| Zugriff ohne Vercel-Login | Anmeldeseite von Vercel, keine Inhalte |
| Foto im Bucket | Chiffretext |
| Restore-Probe | vollständig, Dauer notiert |
| Testmail | angekommen, nicht im Spam |
| Störungs-Mail | angekommen |
| iPhone-Protokoll | ausgefüllt |
Danach `docs/PILOT-GO-NOGO.md` aktualisieren. **Rückbau** (falls abgebrochen): Vercel-Projekt löschen, Supabase-Projekte löschen (nur Testdaten) – vorher nachfragen; Schlüssel im Passwortmanager als „ungültig“ markieren.

## Was ich nicht selbst tun kann
Konten anlegen, Zahlungsdaten eingeben, Zugangsdaten oder Schlüssel sehen/setzen, DNS-Einträge setzen, deployen ohne deine Freigabe. Ich unterstütze mit Befehlen, Prüfungen und Auswertung der Ausgaben.
