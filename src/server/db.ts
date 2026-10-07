import 'server-only';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { pgConfig } from './db-config';

/**
 * Datenbankzugriff – die einzige Stelle, an der ein PrismaClient entsteht.
 *
 * Lazy: Der Client wird erst beim ersten Zugriff erzeugt. Dadurch laufen Build
 * und alle öffentlichen Seiten auch ohne DATABASE_URL (die öffentliche Website
 * darf nie von der Datenbank abhängen).
 *
 * Prisma 7 braucht einen Treiber-Adapter (`@prisma/adapter-pg`). Der Zwischen-
 * speicher am globalThis verhindert im Dev-Modus einen neuen Pool pro Reload.
 */

const globalForPrisma = globalThis as unknown as { __ingPrisma?: PrismaClient };

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function create(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL ist nicht gesetzt. Siehe .env.example und docs/BETRIEB.md.');
  }
  const adapter = new PrismaPg(pgConfig());
  return new PrismaClient({ adapter, log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });
}

function client(): PrismaClient {
  if (!globalForPrisma.__ingPrisma) globalForPrisma.__ingPrisma = create();
  return globalForPrisma.__ingPrisma;
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop, receiver) {
    return Reflect.get(client(), prop, receiver);
  },
});
