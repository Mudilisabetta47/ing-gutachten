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
    'TRUNCATE TABLE organizations, inspections, appointments, damages, case_photos, documents, media, notes, case_status_history, lead_status_history, cases, vehicles, customers, leads, inquiry_attachments, inquiries, case_counters, ' +
      'audit_logs, login_attempts, sessions, user_permissions, employees, system_settings, users RESTART IDENTITY CASCADE',
  );
}

export async function makeUser(over: Partial<{ email: string; isExpert: boolean; role: 'OWNER' | 'ADMIN' | 'OFFICE' | 'EXPERT' | 'ACCOUNTING' | 'CONTENT_MANAGER' | 'REVIEWER'; password: string; isActive: boolean }> = {}) {
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

/** Termin für einen Fall (Besichtigung), standardmäßig morgen, 1 Stunde. */
export async function makeAppointment(user: Awaited<ReturnType<typeof asAuthUser>>, caseId: string, expertId: string, startOffsetH = 24, durH = 1) {
  const { createAppointment } = await import('@/server/pipeline/appointments');
  const start = new Date(Date.now() + startOffsetH * 3_600_000);
  start.setMinutes(0, 0, 0);
  return createAppointment(user, caseId, { expertId, kind: 'INSPECTION', startsAt: start, endsAt: new Date(start.getTime() + durH * 3_600_000) });
}

/** Lokaler Test-Speicher in einem Temp-Verzeichnis (nie im Projekt). */
export async function useTempStorage() {
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const dir = await mkdtemp(path.join(tmpdir(), 'ing-storage-'));
  process.env.STORAGE_DRIVER = 'local';
  process.env.STORAGE_LOCAL_DIR = dir;
  return dir;
}

/** Winziges, gültiges JPEG (Magic Bytes) – Inhalt ist für die Prüfung irrelevant. */
export const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
export const PDF_BYTES = new Uint8Array(Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'));
