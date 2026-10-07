/**
 * Demo-/Entwicklungsdaten – NUR lokal. Verweigert sich in Production und gegen Nicht-Lokal-Datenbanken.
 * Enthält ausschließlich erfundene Beispieldaten, keine echten Kunden.
 *
 *   npm run seed:demo          legt Demo-Benutzer an (idempotent)
 *   npm run seed:demo -- clear entfernt sie wieder
 *
 * Das Demo-Passwort gilt nur für diese lokale Entwicklungsumgebung und steht deshalb hier im Skript.
 */
import { PrismaClient, type Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from '@node-rs/argon2';
import { assertSafeTarget } from './_guard';

export const DEMO_PASSWORD = 'Demo-Passwort-Lokal-2026!';
export const DEMO_USERS: { email: string; firstName: string; lastName: string; role: Role; isExpert?: boolean }[] = [
  { email: 'inhaber@demo.ing.test', firstName: 'Ida', lastName: 'Inhaber', role: 'OWNER' },
  { email: 'admin@demo.ing.test', firstName: 'Adam', lastName: 'Admin', role: 'ADMIN' },
  { email: 'buero@demo.ing.test', firstName: 'Britta', lastName: 'Büro', role: 'OFFICE' },
  { email: 'gutachter@demo.ing.test', firstName: 'Gerd', lastName: 'Gutachter', role: 'EXPERT', isExpert: true },
  { email: 'buchhaltung@demo.ing.test', firstName: 'Bea', lastName: 'Bilanz', role: 'ACCOUNTING' },
  { email: 'redaktion@demo.ing.test', firstName: 'Rita', lastName: 'Redaktion', role: 'CONTENT_MANAGER' },
];

async function main() {
  assertSafeTarget('seed:demo');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    if (process.argv.includes('clear')) {
      // Das Protokoll verweist auf Benutzer (Fremdschlüssel). Nur in der lokalen Entwicklung dürfen
      // die Einträge der Demo-Benutzer mit entfernt werden – gegen echte Datenbanken verweigert _guard das Skript.
      const demo = await db.user.findMany({ where: { email: { endsWith: '@demo.ing.test' } }, select: { id: true } });
      const ids = demo.map((u) => u.id);
      await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
      const r = await db.user.deleteMany({ where: { id: { in: ids } } });
      console.log(`${r.count} Demo-Benutzer entfernt.`);
      return;
    }
    const passwordHash = await hash(DEMO_PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    for (const u of DEMO_USERS) {
      await db.user.upsert({
        where: { email: u.email },
        update: { role: u.role, isActive: true, deletedAt: null, passwordHash, mustChangePassword: false, failedLogins: 0, lockedUntil: null },
        create: { email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role, passwordHash, mustChangePassword: false, employee: { create: { isExpert: u.isExpert ?? false } } },
      });
    }
    console.log(`${DEMO_USERS.length} Demo-Benutzer bereit (…@demo.ing.test).`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
