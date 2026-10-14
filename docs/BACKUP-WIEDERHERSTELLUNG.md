# Sicherung und Wiederherstellung

**Status: implementiert und in einer lokalen, vollständigen Übung erprobt (2026-10-14).** Nicht erprobt: Sicherung/Wiederherstellung gegen echtes Supabase und einen echten S3-Anbieter – das ist die erste Aufgabe in Staging (Abschnitt 7). Zeiten unten stammen aus einer lokalen Übung und sind **keine Zusage** für die Cloud.

## 1. Was gesichert wird

| Bestandteil | Wie | Wo liegt die Kopie |
|---|---|---|
| Datenbank (Schema `public`: Fälle, Kunden, Rechnungen, Audit …) | `npm run backup` → `pg_dump` (Custom-Format), **AES-256-GCM-verschlüsselt** (`BACKUP_ENCRYPTION_KEY`) | Sicherungsordner `backups/ing-backup-<Zeit>/db.dump.enc` |
| Dateien (Fotos, Dokumente, Gutachten-PDFs) | alle Objekte, auf die `media` verweist, **als Chiffretext** (so wie im Bucket; Schlüssel `STORAGE_ENCRYPTION_KEY`) | `…/objects/<Speicherschlüssel>` |
| Prüfdaten | `manifest.json`: SHA-256 jeder Datei und des Dumps, Zeilenzahl je Tabelle, Erweiterungen, Quelle, Zeit; `manifest.hmac`: Siegel (erkennt Manipulation) | im selben Ordner |
| Geheimnisse (`MFA_/STORAGE_/BACKUP_ENCRYPTION_KEY`, Zugangsdaten) | **nicht** Teil der Sicherung – getrennt im Passwortmanager der Geschäftsführung + Offline-Kopie | getrennt von Sicherungen |
| Code, Migrationen | Git (privates Repository), keine Kundendaten | Git |

Der Sicherungsordner ist **vertraulich** (Kundendaten), aber ohne `BACKUP_ENCRYPTION_KEY`/`STORAGE_ENCRYPTION_KEY` nicht lesbar. In Staging/Produktion verweigert `npm run backup` den Lauf ohne `BACKUP_ENCRYPTION_KEY`. Der Ordner `backups/` ist per `.gitignore` ausgeschlossen.

**Ohne `STORAGE_ENCRYPTION_KEY` sind gesicherte und gespeicherte Dateien nicht lesbar. Ohne `MFA_ENCRYPTION_KEY` sind nur die 2FA-Geheimnisse verloren (Zurücksetzen möglich).**

## 2. Befehle

```bash
npm run backup -- --out <Zielordner> --keep 14     # sichern; ältere Sicherungen über 14 Stück entfernen
npm run backup:verify -- <Sicherungsordner>       # Siegel + Prüfsummen aller Dateien prüfen (ohne Zurückspielen)
npm run restore -- <Sicherungsordner> --db <leere Ziel-DB-URL> --storage-dir <leerer Ordner>
npm run restore -- <Sicherungsordner> --db <leere Ziel-DB-URL> --s3     # Ziel-Bucket aus S3_* (muss leer sein)
npm run backup:drill                                  # vollständige Übung mit Wegwerf-Daten (lokal)
```

Datenbank-Zugang: `BACKUP_DATABASE_URL` (direkte Verbindung, nicht der Pooler) – sonst `DATABASE_URL`. `pg_dump` muss mindestens so neu sein wie der Server. Die Sicherung **liest nur**; sie verändert weder Datenbank noch Bucket.

### Schutzmechanismen der Wiederherstellung

- Zielgleich mit der laufenden Datenbank/der Quelle der Sicherung → Abbruch.
- Ziel-Datenbank nicht leer (Tabellen vorhanden) → Abbruch. Ziel-Speicher nicht leer → Abbruch.
- Sicherung wird **vor** dem Zurückspielen vollständig geprüft (Siegel, Prüfsummen); fehlerhaft → nichts wird geschrieben.
- Nach dem Zurückspielen: Zeilenzahl jeder Tabelle = Manifest, jede in der Datenbank referenzierte Datei vorhanden, Prüfsumme gleich, **jede Datei entschlüsselbar** (mit `STORAGE_ENCRYPTION_KEY`); Härtung (`ing_harden_public`) wird erneut angewandt.
- Die alte Umgebung wird nie überschrieben: Wiederherstellung = neue Datenbank + neuer Bucket, dann Variablen umstellen.

## 3. Ergebnis der Wiederherstellungsübung (`npm run backup:drill`, 2026-10-14)

Die Übung legt eine Kopie der Entwicklungsdaten an, verschlüsselt deren Dateispeicher mit frischen Zufallsschlüsseln, sichert, manipuliert Kopien der Sicherung, spielt in eine **leere Datenbank und einen leeren Ordner** zurück, prüft und löscht alles wieder.

**15 von 15 Prüfungen bestanden**, darunter:
Sicherung verschlüsselt (kein Klartext-Header) · Siegel-/Prüfsummenprüfung · manipulierte Datei erkannt · manipuliertes Manifest erkannt · falscher Schlüssel erkannt · Rückspielen in die Quelle verweigert · nicht-leeres Ziel verweigert · vollständige Wiederherstellung · `db:check` gegen das Ergebnis grün · Stichproben über die Anwendungs-Dienste (Passwortprüfung eines Kontos, Foto und PDF entschlüsselt) · zweites Rückspielen in die gefüllte Datenbank verweigert.

Gemessene Dauer (lokale Datenbank, lokaler Ordner, Apple-Silicon-Rechner):

| Datenmenge | Sicherung | Wiederherstellung (DB + Dateien + Prüfung) |
|---|---|---|
| 753 Zeilen, 27 Dateien (0,1 MB) | 0,6 s | 0,7 s |
| 1.540 Zeilen, 814 Dateien (**300 MB**, je 400 KB) | 1,2 s | 2,0 s |

Die lokale Messung zeigt nur den Rechenaufwand (Hashing, Verschlüsselung, Dump). In der Cloud bestimmt die **Netzwerkgeschwindigkeit** zum Bucket und zur Datenbank die Dauer. Richtwert zur Planung: Rechenaufwand ≈ 150 MB/s; bei realistischen 20–50 MB/s Netzwerk dauert die Wiederherstellung von 10 GB etwa 3–9 Minuten für Dateien, plus Datenbankimport (sehr klein im Vergleich zu Dateien). Für den Pilot (wenige Gigabyte) ist **Wiederanlauf in unter einer Stunde** realistisch; die verbindliche Zahl entsteht erst mit der Probe in Staging (Abschnitt 7).

## 4. Zielwerte (Vorschlag – von der Geschäftsführung zu bestätigen)

| | Ziel | Wie erreicht |
|---|---|---|
| Datenverlustfenster (RPO) Datenbank | **höchstens 24 h** mit eigener Tagessicherung; **wenige Minuten** mit Point-in-Time-Recovery des Datenbankanbieters (falls im Tarif) | tägliche `npm run backup`, PITR des Anbieters |
| RPO Dateien | **höchstens 24 h** (Sicherung); mit Bucket-Versionierung bei versehentlichem Löschen praktisch 0 | tägliche Sicherung + Versionierung/Löschschutz im Bucket |
| Wiederanlaufzeit (RTO) | **innerhalb eines Arbeitstags**; Ziel < 2 h für Pilot-Datenmengen | Ablauf Abschnitt 6; zu bestätigen durch die Staging-Probe |

Realistisch bedeutet das: Zwischen der letzten Sicherung und einem Ausfall erfasste Fälle/Fotos können fehlen. Gutachter sollten deshalb im Pilot Fotos vor Ort zusätzlich auf dem Gerät behalten, bis der Fall abgeschlossen ist.

## 5. Aufbewahrung

Tagessicherungen 14 Stück (`--keep 14`), zusätzlich wöchentlich eine Sicherung 12 Wochen auf einem **anderen** Speicherort/Anbieter (Kopie des Ordners). Rechnungen und Buchführungsunterlagen unterliegen den gesetzlichen Fristen (§ 147 AO, 10 Jahre); die DSGVO-Anonymisierung greift nur in Stammdaten, nicht in ausgestellten Rechnungen.
Löschwünsche (DSGVO) gelten in Sicherungen mit Verzögerung: Gelöschte Daten verschwinden aus Sicherungen spätestens nach Ablauf der Aufbewahrung (14 Tage / 12 Wochen) – das ist in der Datenschutzerklärung/im Verarbeitungsverzeichnis zu nennen (siehe `docs/DATENSCHUTZ-TODO.md`).

## 6. Wiederherstellung im Ernstfall

1. Vorfall dokumentieren (Zeit, Ursache, betroffene Daten); Anwendung ggf. auf Wartung stellen.
2. Neue, leere Datenbank (Supabase-Projekt oder -Branch) und neuen leeren privaten Bucket anlegen. **Nie** die defekte Umgebung überschreiben, bevor die Kopie geprüft ist.
3. Neueste fehlerfreie Sicherung wählen: `npm run backup:verify -- <Ordner>`.
4. `npm run restore -- <Ordner> --db <neue DB> --s3` (oder `--storage-dir`), mit den Schlüsseln der Produktion (`BACKUP_ENCRYPTION_KEY`, `STORAGE_ENCRYPTION_KEY`) in der Umgebung.
5. Variablen (`DATABASE_URL`, `S3_*`) auf die neuen Ziele umstellen, `npm run db:check`, dann `GET /api/health` mit Token.
6. Stichproben: Anmeldung (mit 2FA), ein Fall mit Fotos, ein freigegebenes Gutachten (PDF), eine Rechnung samt Zahlungen.
7. Wenn die Datenbank jünger ist als die Sicherung (PITR): Datenbank per PITR, Dateien aus der Sicherung; fehlende Objekte erscheinen in `restore` als Fehler, nicht stillschweigend.
8. Vorfall abschließen; Audit-Einträge bleiben erhalten (liegen in der Datenbank).

## 7. Offene Punkte vor dem Echtbetrieb

- [ ] **Probe in Staging**: Sicherung der Staging-Supabase, Wiederherstellung in ein *zweites* leeres Projekt und einen leeren Bucket; echte Dauer notieren und hier eintragen.
- [ ] Zeitplan für die tägliche Sicherung festlegen (z. B. GitHub-Actions-Workflow oder Cron auf einem eigenen Rechner/Server mit `pg_dump` ≥ Serverversion; **nicht** auf Vercel – keine langlaufenden Prozesse). Das Ziel der Kopie (anderer Anbieter/Region) ist eine Entscheidung der Geschäftsführung.
- [ ] Wöchentliche Offsite-Kopie und Aufbewahrung festlegen; Löschschutz/Versionierung im Bucket aktivieren.
- [ ] Schlüssel-Hinterlegung (zwei Personen, Offline-Kopie) umsetzen und **einmal** testen, dass man damit tatsächlich entschlüsseln kann.
- [ ] Zeilensicherheit (RLS) nach der Wiederherstellung in echtem Supabase prüfen – lokal gibt es keine Supabase-Rollen, daher dort nicht prüfbar (`db:check` meldet es).
- [ ] Halbjährliche Übung (Kalendereintrag), danach nach jeder größeren Schemaänderung `npm run backup:drill`.

## 8. Sichere Migrationen

1. Nur `prisma migrate deploy` gegen echte Daten – nie `db push`, nie `migrate reset`.
2. **Vor jeder Migration** `npm run backup` (und bei Supabase einen Snapshot/PITR-Zeitpunkt notieren).
3. Jede neue Migration läuft vorher durch `npm run db:migtest`: legt eine **Wegwerf-Datenbank** an, wendet alle Migrationen auf eine leere Datenbank an, prüft Status, Wiederholbarkeit (nichts passiert beim zweiten Lauf), Drift gegenüber `schema.prisma` und die Betriebsprüfung; stellt außerdem einen **älteren Stand mit Beispieldaten** her, spielt die letzten Migrationen ein und prüft, dass die Daten erhalten bleiben und neue Spalten sichere Standardwerte haben. Die Datenbank wird danach gelöscht. Ergebnis 2026-10-14: **10 von 10 Prüfungen bestanden** (16 Migrationen in 1,2 s auf leerer DB).
4. Migrationen sind additiv und enthalten Prüfregeln; Rücknahme = Wiederherstellung aus der Sicherung, nicht „Migration rückwärts“.
5. `npm run test:db` läuft ausschließlich gegen die getrennte Testdatenbank (Name muss auf `_test` enden – wird geprüft).
