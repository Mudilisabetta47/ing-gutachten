# ING Operating System – Entwicklung & Betrieb (Stand Phase 1)

## Lokal starten

```bash
# 1. PostgreSQL (z. B. Postgres.app) läuft, zwei neue Datenbanken anlegen – nie bestehende verwenden:
createdb ing_os_dev && createdb ing_os_test

# 2. .env (gitignored) und .env.test (gitignored) nach .env.example / .env.test.example anlegen
# 3. Migrationen anwenden, Demo-Daten laden, starten
npm install
npx prisma migrate dev          # legt/aktualisiert das Schema in ing_os_dev
npm run seed:demo               # Demo-Benutzer …@demo.ing.test (nur lokal; verweigert sich sonst)
npm run dev                     # http://localhost:3000/admin
```

Demo-Konten (nur lokal): `inhaber@`, `admin@`, `buero@`, `gutachter@`, `buchhaltung@`, `redaktion@demo.ing.test`.
Das Demo-Passwort steht ausschließlich in `scripts/seed-demo.ts` und gilt nur für diese lokale Umgebung.

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run db:migrate` | neue Migration erzeugen/anwenden (Entwicklung) |
| `npm run db:deploy` | Migrationen anwenden (Staging/Production, **nie** `db push`/`reset`) |
| `npm run db:status` | Migrationsstand prüfen |
| `npm run create-owner -- --email … --first … --last …` | ersten Inhaber anlegen (Passwort per Prompt oder `OWNER_PASSWORD`) |
| `npm run seed:demo [-- clear]` | Demo-Daten anlegen/entfernen (nur lokal) |
| `npm test` | Unit-Tests ohne Datenbank |
| `npm run test:db` | Integrationstests gegen `ing_os_test` (Name **muss** auf `_test` enden) |

## Production einrichten (einmalig)

1. Verwaltete PostgreSQL-Datenbank in der EU anlegen, `DATABASE_URL` in Vercel setzen (Production **und** Preview getrennt – nie dieselbe DB).
2. `npm run db:deploy` gegen diese DB ausführen (z. B. aus einer lokalen Shell mit gesetzter `DATABASE_URL`).
3. Inhaber anlegen: `ALLOW_PRODUCTION_BOOTSTRAP=yes npm run create-owner -- --email … --first … --last …`.
4. Anmelden, Passwort ändern, weitere Benutzer unter `/admin/benutzer` anlegen.

Ohne `DATABASE_URL` baut und läuft die öffentliche Website unverändert; `/admin` zeigt „nicht eingerichtet“.

## Sicherheitsgrundsätze (umgesetzt in Phase 1)

* Argon2id, Passwort-Richtlinie (≥ 12 Zeichen, Blocklist, kein Namens-/E-Mail-Bezug)
* Serversession, nur SHA-256 des Tokens in der DB, Cookie `__Host-ing_session` (HttpOnly, Secure, SameSite=Lax)
* Login-Drosselung in der DB (je Konto 5/15 min, je IP 20/15 min), neutrale Fehlermeldung, gleiche Laufzeit bei unbekannter E-Mail
* Rechte ausschließlich serverseitig (`src/server/auth/permissions.ts`), fehlende Berechtigung ⇒ 404
* Rollenwechsel, Deaktivierung und Passwort-Reset beenden Sitzungen sofort; letzter Inhaber bleibt geschützt
* Audit-Log append-only, Geheimnisse werden vor dem Schreiben entfernt
* `/admin`: `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `X-Frame-Options: DENY`, in `robots.txt` gesperrt
