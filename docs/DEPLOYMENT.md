# Umgebungen und Bereitstellung (Supabase + Vercel)

Stand: Pilotvorbereitung 2026-10. **Es wurde nichts bereitgestellt.** Dieses Dokument beschreibt, wie die drei Umgebungen aufgebaut werden, damit nach Freigabe nur noch Konten angelegt und Werte eingetragen werden müssen. Es enthält keine Zugangsdaten.

## 1. Überblick: drei getrennte Umgebungen

| | Development | Staging (Vorabnahme) | Produktion |
|---|---|---|---|
| Zweck | Entwickeln, automatische Tests | Probe mit Testdaten, Migrationen vorab, Praxistests | echte Gutachten und Kundendaten |
| `ING_ENV` | `development` (Standard) | `staging` (Vercel „Preview“ ergibt das automatisch) | `production` (Vercel „Production“ ergibt das automatisch) |
| Datenbank | lokales Postgres (`ing_os_dev`, `ing_os_test`) | **eigenes** Supabase-Projekt | **eigenes** Supabase-Projekt |
| Dateispeicher | Ordner `.data/private` | **eigener** privater Bucket | **eigener** privater Bucket |
| Dateien verschlüsselt (App-Ebene) | optional | **Pflicht** (sonst wird nichts gespeichert) | **Pflicht** |
| Demo-Konten / bekanntes Demo-Passwort | erlaubt | **gesperrt** (Anmeldung wird abgewiesen, `db:check` meldet Fehler) | **gesperrt** |
| E-Mail | `dry-run` oder nur Konsole | echter Anbieter **nur an Positivliste** (`MAIL_ALLOWED_RECIPIENTS`) | echter Anbieter |
| Schlüssel (`*_ENCRYPTION_KEY`, Salt, Token) | beliebig | eigene Werte | eigene Werte – **nie** aus Staging übernommen |
| Zugriff | Entwickler | Inhaber + Testpersonen (kein Suchmaschinen-Index, `noindex`) | Mitarbeiter |

Grundsatz: Staging und Produktion **teilen nichts** – weder Datenbank, Bucket, Zugangsdaten noch Schlüssel. `npm run preflight -- production --compare <staging-Datei>` meldet jede Überschneidung als Fehler.

## 2. Supabase

Zwei Projekte anlegen (`ing-staging`, `ing-prod`; Staging im Free-Tarif genügt), jeweils:

1. Region **EU (Frankfurt)**. Starkes, nur im Passwortmanager gespeichertes Datenbankpasswort.
2. *Connection string*: **Direct/Session** (Port 5432) nur für Migrationen und Sicherungen, **Transaction pooler** (Port 6543) für die App (`DATABASE_URL`, `?sslmode=require`). Optional `DATABASE_CA_CERT`.
3. Data-API/Realtime der App **nicht** nutzen. Migration `supabase_hardening` schaltet Row Level Security auf allen Tabellen ein und entzieht `anon`/`authenticated` alle Rechte (`db:check` prüft das).
4. Tarif: für Produktion einen Tarif mit **täglichen Sicherungen** (Free-Projekte haben diese nicht) und idealerweise **Point-in-Time-Recovery** wählen – Preise/Leistungen vor der Buchung auf der Anbieterseite prüfen. Unsere eigene Sicherung (`npm run backup`, Abschnitt 6) ersetzt das nicht, sondern ergänzt es.
5. Privater Dateispeicher: entweder Supabase Storage (S3-kompatibler Endpunkt, Bucket **privat**) oder ein anderer S3-kompatibler Anbieter in der EU (z. B. Cloudflare R2 mit EU-Standort, AWS S3 Frankfurt). Pro Umgebung ein eigener Bucket, **kein** öffentlicher Zugriff, Versionierung/Löschschutz soweit der Anbieter es bietet. Die Anwendung verschlüsselt jede Datei vor dem Hochladen selbst (AES-256-GCM); der Anbieter sieht nur Chiffretext.
   *Eigenschaften Supabase Storage (laut Anbieter):* keine Versionierung, **nicht in Supabase-Backups enthalten**, S3 mit Signatur V4, kein Content-MD5 – der Treiber schaltet die zusätzlichen SDK-Prüfsummen deshalb ab; Dateisicherung erfolgt über `npm run backup`.
   *Einschränkung:* Der S3-Treiber ist gegen einen lokalen S3-Testserver geprüft, nicht gegen einen echten Anbieter. Die erste Probe in Staging (Abschnitt 5, Schritt 6) ist deshalb Pflicht.

## 3. Vercel

- **Staging und öffentliche Website in getrennten Vercel-Projekten.** Staging: eigenes Projekt `ing-studio-staging` (Deployment Protection „All Deployments“, `ING_ENV=staging` in allen Umgebungen, nur manuelle Deployments – `vercel.json` sperrt Git-Auto-Deployments des Feature-Branches). Vorlagen: `.env.staging.example`, `.env.production.example`. Ausführlich: `docs/STAGING-AUFBAU.md`.
- **Plan:** Vercel **Pro** (Hobby ist laut Vercel auf nicht-kommerzielle Nutzung beschränkt).
- `vercel.json` legt die Funktions-Region auf `fra1` (Frankfurt, nahe an Supabase Frankfurt; Daten bleiben in der EU).
- Vercel nimmt höchstens 4,5 MB je Anfrage an. Die App verkleinert Fotos im Browser vor dem Hochladen; Dokumente sind auf 4 MB begrenzt. Das ist in der Oberfläche erklärt.
- **Preview-Deployments dürfen nie die Produktionsdatenbank sehen.** Produktions-Variablen nur für „Production“ eintragen.
- Schutz für Staging: **Vercel Authentication** (in allen Plänen enthalten); Tester sind Teammitglieder (Viewer). Password Protection ($20/Projekt auf Pro) ist nicht nötig.
- Keine Geheimnisse in `NEXT_PUBLIC_*`-Variablen (die landen im Browser; `preflight` meldet das).

## 4. Variablen und Schlüssel

`npm run secrets:generate` erzeugt Zufallswerte **nur auf dem Bildschirm** (nichts wird gespeichert). Je Umgebung einmal ausführen und in den Passwortmanager + Vercel eintragen:

| Variable | Zweck | Folge bei Verlust |
|---|---|---|
| `MFA_ENCRYPTION_KEY` | verschlüsselt die 2FA-Geheimnisse in der Datenbank | 2FA muss für alle Konten zurückgesetzt werden |
| `STORAGE_ENCRYPTION_KEY` | verschlüsselt Fotos/Dokumente/PDFs im Bucket | **Dateien unwiederbringlich verloren** – Sicherung des Schlüssels getrennt von Bucket und Datenbank, z. B. Passwortmanager der Geschäftsführung + versiegelte Offline-Kopie |
| `BACKUP_ENCRYPTION_KEY` | verschlüsselt Datenbank-Sicherungen | Sicherungen nicht lesbar |
| `IP_HASH_SALT`, `HEALTH_TOKEN` | Missbrauchserkennung, Betriebsprüfung | neu erzeugen, kein Datenverlust |

Schlüsselwechsel (Rotation): neuen Wert setzen, alten als `…_PREVIOUS` behalten, `npm run mfa:rotate` bzw. `npm run storage:migrate -- --apply` ausführen, danach `…_PREVIOUS` entfernen.

## 5. Ablauf der ersten Bereitstellung (nach ausdrücklicher Freigabe)

1. Supabase-Staging-Projekt, Bucket, Vercel-Preview-Variablen anlegen (Abschnitte 2–4). Datei mit den Werten **lokal und gitignoriert** halten.
2. `npm run preflight -- staging --env-file <Datei>` → keine Fehler.
3. Migration vorab in der **isolierten Wegwerf-Datenbank** prüfen: `npm run db:migtest` (leere DB, Aktualisierungspfad mit Daten, Drift, Betriebsprüfung). Details in `docs/BACKUP-WIEDERHERSTELLUNG.md`.
4. Migration auf Staging: Sicherung → `npm run db:deploy` (mit direkter URL in der Shell) → `npm run db:check` muss „Alles in Ordnung“ melden. Nur `migrate deploy`, nie `db push`/`migrate reset`.
5. Inhaber anlegen (`ALLOW_PRODUCTION_BOOTSTRAP=yes npm run create-owner …`, Variable danach wieder entfernen), 2FA einrichten, „verpflichtend für Inhaber und Administratoren“ einschalten.
6. Speicher-Probe: `GET /api/health` mit Token → `storage` ok (Schreib-/Lese-/Löschprobe gegen den echten Bucket, verschlüsselt). Foto hochladen, im Fall ansehen.
7. Testmail nur an eine freigegebene Adresse: `npm run mail:test -- --to <freigegebene Adresse>`.
8. Erst-Sicherung und **Wiederherstellung in eine leere Staging-Umgebung** einmal komplett durchspielen (Abschnitt 7 von `docs/BACKUP-WIEDERHERSTELLUNG.md`).
9. Praxistest nach `docs/PRAXISTEST-GERAETE.md`.
10. Produktion erst danach mit eigenen Projekten/Schlüsseln; `npm run preflight -- production --env-file <Datei> --compare <Staging-Datei>`.

## 6. Fehlerüberwachung und Alarmierung

- Jeder unbehandelte Serverfehler (`instrumentation.ts` → `onRequestError`) wird als **strukturierte Logzeile** ausgegeben (ohne personenbezogene Daten: Pfad ohne Parameter, Fehlerklasse, Fingerabdruck) und – wenn `ALERT_WEBHOOK_URL` gesetzt ist – als Alarm an den Webhook gesendet (nur https, gleiche Fehler höchstens alle 5 Minuten, höchstens 10 Alarme je Minute).
- `GET /api/health`: ohne Token nur `ok`/`degraded`; mit `Authorization: Bearer <HEALTH_TOKEN>` Detail (Datenbank, offene Migrationen, Speicher-Probe, Mail-Konfiguration, 2FA-Schlüssel).
- **E-Mail-Überwachung (Entscheidung der Geschäftsführung):** `ALERT_EMAIL_TO` (bis 3 Adressen) erhält Mails bei Serverfehlern; `GET /api/monitor/check` (Bearer `MONITOR_SECRET`) prüft Datenbank, Migrationen, Speicher, Mail, 2FA-Schlüssel und schickt eine Mail bei Störung, nach 6 h eine Erinnerung und bei Erholung eine Entwarnung. Aufgerufen von einem externen Prüfdienst (alle 5 Minuten; bei geschütztem Staging mit Bypass-Header). **Vercel-Cron wird bewusst nicht genutzt:** er ruft nur die Produktions-Bereitstellung auf und kann Vercel-Ausfälle nicht melden. Zusätzlich Vercel-Logs/Ausgabenlimit und Supabase-Berichte aktivieren.
- Alarmtest nach der Einrichtung: in Staging `ALERT_WEBHOOK_URL` setzen und eine absichtlich fehlerhafte Anfrage auslösen; im Ziel muss genau eine Meldung ankommen.

## 7. Was bewusst nicht automatisiert ist

- Kein automatisches Deployment aus diesem Branch; kein Merge nach `main` ohne Freigabe.
- Keine Anlage von Cloud-Konten oder kostenpflichtigen Diensten durch Skripte.
- Sicherungen laufen als Befehl (`npm run backup`); ein Zeitplan (GitHub Actions/Cron) wird erst eingerichtet, wenn Produktion und Zielspeicher feststehen (Beispiel im Backup-Dokument).
