import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma-7-Konfiguration (nur für die CLI: Migrationen, Studio, generate).
 * Zur Laufzeit liest `src/server/db.ts` DATABASE_URL selbst.
 * Enthält keine Geheimnisse.
 *
 * Der Platzhalter greift nur, wenn DATABASE_URL fehlt (z. B. `prisma generate`
 * im Vercel-Build ohne Datenbank). Jede echte Verbindung (migrate, studio)
 * scheitert damit laut – es kann nie versehentlich gegen eine falsche DB laufen.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://invalid:invalid@invalid.invalid:5432/invalid' },
});
