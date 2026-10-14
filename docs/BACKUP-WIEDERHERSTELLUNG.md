# Sicherung und Wiederherstellung (Konzept)

**Status: Konzept, nicht praktisch erprobt.** Eine Wiederherstellung wurde noch nicht geübt. Vor dem Echtbetrieb muss einmal wirklich zurückgespielt werden (Abschnitt 4).

## Was gesichert werden muss

| Bestandteil | Wo | Sicherung |
|---|---|---|
| Datenbank (Fälle, Kunden, Rechnungen, Audit …) | PostgreSQL (z. B. Supabase, EU-Region) | Tägliche automatische Sicherung des Anbieters + **Point-in-Time-Recovery** (falls im Tarif) + wöchentlicher unabhängiger Dump (`pg_dump`, verschlüsselt, anderer Anbieter/Ort) |
| Dateien (Fotos, Dokumente, Gutachten-PDFs) | privater S3-kompatibler Speicher | Versionierung des Buckets + Replikation in eine zweite Region/Anbieter; **Löschschutz** (Object Lock) für freigegebene Gutachten und Rechnungen |
| Geheimnisse | Vercel-Umgebungsvariablen | Offline-Kopie im Passwortmanager der Geschäftsführung: `DATABASE_URL`, `SESSION`-Werte, S3-Zugang, `MFA_ENCRYPTION_KEY` |
| Code und Migrationen | Git (privates Repository) | Repository ist die Quelle; **keine Kundendaten im Repository** |

**Wichtig – `MFA_ENCRYPTION_KEY`:** Ohne diesen Schlüssel sind die gespeicherten Zwei-Faktor-Geheimnisse unbrauchbar. Er muss mit der Datenbanksicherung zusammen wiederherstellbar sein, aber **getrennt** aufbewahrt werden. Geht er verloren, setzt die Leitung die Zwei-Faktor-Anmeldung der Konten zurück (Benutzer → Zurücksetzen).

## Zielwerte (Vorschlag, mit der Geschäftsführung zu bestätigen)

- Datenverlust höchstens **24 Stunden** (mit PITR: wenige Minuten).
- Wiederanlauf innerhalb von **einem Arbeitstag**.
- Aufbewahrung: Tages-Sicherungen 14 Tage, Wochen-Dumps 12 Wochen; Rechnungen und Buchführungsunterlagen unterliegen den gesetzlichen Fristen (§ 147 AO, 10 Jahre) – die Anonymisierung (DSGVO) greift nur in Stammdaten und lässt ausgestellte Rechnungen unverändert.

## Sichere Migrationen

1. Nur `prisma migrate deploy` (nie `db push`, nie `migrate reset`) gegen Echtdaten.
2. **Vor jeder Migration** eine Sicherung/Snapshot anlegen und notieren.
3. Neue Migration zuerst gegen eine **Kopie** der Datenbank (Staging) ausführen; Tests (`npm run test:db`) laufen immer gegen die getrennte Testdatenbank (Name muss auf `_test` enden – wird geprüft).
4. Migrationen sind additiv und enthalten Prüfregeln; Rücknahme = Wiederherstellung aus der Sicherung, nicht „Migration rückwärts“.

## Wiederherstellung – Ablauf

1. Vorfall dokumentieren (Zeitpunkt, Ursache, betroffene Daten).
2. Neue leere Datenbank anlegen (nie die kaputte überschreiben, bevor die Kopie geprüft ist).
3. Sicherung einspielen (Anbieter-Restore oder `pg_restore`), dann `npm run db:status` und `npm run db:check`.
4. Umgebungsvariablen (`DATABASE_URL`, Speicherzugang, `MFA_ENCRYPTION_KEY`) auf die neue Datenbank zeigen lassen, Deployment auslösen.
5. Stichproben: Anmeldung, ein Fall mit Fotos, ein freigegebenes Gutachten (PDF), eine Rechnung samt Zahlungen.
6. Dateispeicher: fehlende Objekte aus der Replik zurückholen; Datenbankeinträge ohne Datei werden im Fall sichtbar als Fehler gemeldet, nicht stillschweigend ignoriert.
7. Vorfall im Protokoll abschließen; Audit-Einträge bleiben erhalten (sie liegen in der Datenbank).

## Wiederherstellungsübung (vor Echtbetrieb, danach halbjährlich)

- [ ] Datenbank-Sicherung in eine Wegwerf-Datenbank einspielen
- [ ] Anmeldung mit einem Testkonto
- [ ] Ein Gutachten-PDF und ein Foto abrufen
- [ ] Dauer und Auffälligkeiten festhalten
