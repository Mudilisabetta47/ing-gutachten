# Betrieb – Datenbank (Supabase) und Produktion

Stand: Phase 3. Dieses Dokument enthält **keine Zugangsdaten**. Passwörter und Schlüssel gehören ausschließlich in
Vercel (Environment Variables) bzw. in eine lokale, gitignorierte Datei – nie in den Chat, nie ins Repository.

## 1. Supabase-Projekt einrichten

1. Region **EU (Frankfurt)** wählen (Datenschutz).
2. Ein starkes Datenbank-Passwort vergeben und im Passwort-Manager speichern.
3. Unter *Project Settings → Database → Connection string* zwei Adressen kopieren:
   - **Direct connection** (Port 5432) bzw. **Session pooler** → nur für **Migrationen** (`DIRECT_URL`).
   - **Transaction pooler** (Port 6543) → für die **laufende App auf Vercel** (`DATABASE_URL`).
4. Optional, aber empfohlen: *Settings → Database → SSL certificate* → Zertifikat herunterladen, als `DATABASE_CA_CERT` setzen (volle TLS-Prüfung).
5. *Settings → API*: Die Data-API wird von dieser App **nicht** genutzt. Unsere Migration `supabase_hardening` aktiviert Row Level
   Security auf allen Tabellen und entzieht `anon`/`authenticated` alle Rechte – die App selbst verbindet sich direkt als Datenbank-Rolle.

## 2. Migrationen einspielen (einmalig, danach bei jedem Release)

Lokal, in einer Shell, in der die **direkte** URL gesetzt ist (nicht in Dateien im Repository):

```bash
export DATABASE_URL='postgresql://postgres:<PASSWORT>@db.<projekt>.supabase.co:5432/postgres?sslmode=require'
npm run db:deploy      # prisma migrate deploy – wendet nur fehlende Migrationen an, löscht nie etwas
npm run db:check       # prüft: Erweiterungen, Migrationen, RLS, API-Rollen, TLS, Inhaber-Konto
```

`db:check` muss „Alles in Ordnung“ melden. Meldet es fehlendes RLS: `SELECT public.ing_harden_public();` im Supabase-SQL-Editor ausführen.

**Wichtig für jede künftige Migration, die Tabellen anlegt:** am Ende `SELECT public.ing_harden_public();` aufrufen.

## 3. Ersten Inhaber anlegen (einmalig)

```bash
export ALLOW_PRODUCTION_BOOTSTRAP=yes
npm run create-owner -- --email inhaber@ihre-domain.de --first Vorname --last Nachname
```
Das Passwort wird verdeckt abgefragt (min. 12 Zeichen) und muss beim ersten Login geändert werden.
**Keine Demo-Daten** in Produktion: `seed:demo` verweigert sich gegen Nicht-Lokal-Datenbanken.

## 4. Vercel

Environment Variables (Production, getrennt davon Preview):

| Variable | Wert |
|---|---|
| `DATABASE_URL` | Transaction-Pooler-URL (Port 6543, `?sslmode=require`) |
| `DATABASE_CA_CERT` | optional: PEM des Supabase-Zertifikats |
| `DATABASE_POOL_MAX` | `3` (Serverless: wenige Verbindungen je Instanz) |
| `IP_HASH_SALT` | zufällig, ≥ 16 Zeichen |
| `STORAGE_DRIVER=s3` + `S3_*` | privater Bucket (siehe `.env.example`) |
| `MAIL_PROVIDER`, `MAIL_FROM`, `MAIL_TO`, `BREVO_API_KEY` **oder** `RESEND_API_KEY` | E-Mail-Versand |

Preview-Deployments bekommen **keine** Produktions-Datenbank (eigenes Supabase-Projekt oder gar keine – die öffentliche Seite läuft auch ohne DB).

## 5. Backups / Wiederherstellung (offen)

- Supabase-Backups je nach Tarif prüfen (tägliche Backups / Point-in-Time-Recovery ab Pro).
- Wiederherstellung einmal **testweise** in ein leeres Projekt einspielen, bevor echte Kundendaten laufen.
- Privater Dateispeicher (Fotos/Dokumente) separat sichern (Versionierung im Bucket).
