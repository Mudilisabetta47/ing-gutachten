import { db } from '@/server/db';

/** Schutz: Diese Tests löschen Daten – nur gegen eine Datenbank, deren Name auf _test endet. */
export function assertTestDb(): void {
  const url = process.env.DATABASE_URL ?? '';
  const name = new URL(url.replace(/^postgres(ql)?:/, 'http:')).pathname.replace('/', '');
  if (!name.endsWith('_test')) throw new Error(`Test-Datenbank erwartet (…_test), gefunden: "${name}". Abbruch.`);
}

export async function resetDb(): Promise<void> {
  assertTestDb();
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE notes, case_status_history, lead_status_history, cases, vehicles, customers, leads, inquiry_attachments, inquiries, case_counters, ' +
      'audit_logs, login_attempts, sessions, user_permissions, employees, system_settings, users RESTART IDENTITY CASCADE',
  );
}

export async function makeUser(over: Partial<{ email: string; isExpert: boolean; role: 'OWNER' | 'ADMIN' | 'OFFICE' | 'EXPERT' | 'ACCOUNTING' | 'CONTENT_MANAGER'; password: string; isActive: boolean }> = {}) {
  const { hashPassword } = await import('@/server/auth/password');
  const password = over.password ?? 'Sehr-Langes-Testpasswort-1';
  const user = await db.user.create({
    data: {
      email: over.email ?? `u${Math.random().toString(36).slice(2, 8)}@test.example`,
      firstName: 'Test',
      lastName: 'Person',
      role: over.role ?? 'OFFICE',
      isActive: over.isActive ?? true,
      passwordHash: await hashPassword(password),
      employee: { create: { isExpert: over.isExpert ?? over.role === 'EXPERT' } },
    },
  });
  return { user, password };
}

export async function asAuthUser(userId: string) {
  const { effectivePermissions } = await import('@/server/auth/permissions');
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { permissions: true, employee: true } });
  return {
    id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role,
    isExpert: u.employee?.isExpert ?? false, mustChangePassword: u.mustChangePassword,
    permissions: effectivePermissions(u.role, u.permissions), sessionId: 'test-session',
  };
}

/** Fertige Anfrage über den echten Intake-Pfad (wie das Formular). */
export async function makeLead(over: Partial<{ name: string; email: string; phone: string; reason: string; fahrzeug: string; standort: string; nachricht: string }> = {}) {
  const { persistInquiry } = await import('@/server/pipeline/intake');
  const res = await persistInquiry({
    fields: {
      anlass: over.reason ?? 'Unfall', fahrzeug: over.fahrzeug ?? 'PKW', name: over.name ?? 'Erika Mustermann',
      telefon: over.phone ?? '0511 1234567', email: over.email ?? 'erika@example.test', standort: over.standort ?? 'Hannover',
      nachricht: over.nachricht ?? 'Heckschaden', datenschutz: true,
    },
    attachments: [],
    tracking: { utmSource: null, utmMedium: null, utmCampaign: null, referrerHost: null, landingPath: '/' },
    ip: '203.0.113.9',
  });
  return res;
}

export const CUSTOMER = { type: 'PRIVATE', firstName: 'Erika', lastName: 'Mustermann', email: 'erika@example.test', phone: '0511 1234567', city: 'Hannover' };
export const VEHICLE = { manufacturer: 'VW', model: 'Golf', licensePlate: 'H AB 123', vin: 'WVWZZZ1KZ6W000001' };
