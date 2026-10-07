import { db } from '@/server/db';

/** Schutz: Diese Tests löschen Daten – nur gegen eine Datenbank, deren Name auf _test endet. */
export function assertTestDb(): void {
  const url = process.env.DATABASE_URL ?? '';
  const name = new URL(url.replace(/^postgres(ql)?:/, 'http:')).pathname.replace('/', '');
  if (!name.endsWith('_test')) throw new Error(`Test-Datenbank erwartet (…_test), gefunden: "${name}". Abbruch.`);
}

export async function resetDb(): Promise<void> {
  assertTestDb();
  await db.$executeRawUnsafe('TRUNCATE TABLE audit_logs, login_attempts, sessions, user_permissions, employees, system_settings, users RESTART IDENTITY CASCADE');
}

export async function makeUser(over: Partial<{ email: string; role: 'OWNER' | 'ADMIN' | 'OFFICE' | 'EXPERT' | 'ACCOUNTING' | 'CONTENT_MANAGER'; password: string; isActive: boolean }> = {}) {
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
      employee: { create: {} },
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
