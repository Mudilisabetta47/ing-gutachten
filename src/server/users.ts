import 'server-only';
import { z } from 'zod';
import type { Prisma, Role } from '@prisma/client';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import { ForbiddenError, can } from '@/server/auth/errors';
import { hashPassword, validatePasswordPolicy } from '@/server/auth/password';
import { revokeAllSessions } from '@/server/auth/session';
import type { AuthUser } from '@/server/auth/session-types';
import { normalizeEmail } from '@/server/auth/login';

export const ROLES = ['OWNER', 'ADMIN', 'OFFICE', 'EXPERT', 'ACCOUNTING', 'REVIEWER', 'CONTENT_MANAGER'] as const satisfies readonly Role[];

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Bitte eine gültige E-Mail-Adresse angeben.').max(200),
  firstName: z.string().trim().min(1, 'Vorname fehlt.').max(80),
  lastName: z.string().trim().min(1, 'Nachname fehlt.').max(80),
  role: z.enum(ROLES),
  isExpert: z.boolean().default(false),
  password: z.string().min(1, 'Startpasswort fehlt.'),
});

export const updateUserSchema = z.object({
  id: z.string().min(1),
  role: z.enum(ROLES),
  isActive: z.boolean(),
  isExpert: z.boolean(),
});

/** ADMIN darf keine Inhaber anlegen/ändern; nur OWNER vergibt die Rolle OWNER. */
function assertMayManageRole(actor: AuthUser, role: Role) {
  if (role === 'OWNER' && !can(actor, 'users.write.owner')) throw new ForbiddenError('Nur der Inhaber darf die Rolle „Inhaber“ vergeben oder ändern.');
}

export async function createUser(actor: AuthUser, input: unknown, ctx: { ip?: string | null; userAgent?: string | null } = {}) {
  const data = createUserSchema.parse(input);
  assertMayManageRole(actor, data.role);
  const policy = validatePasswordPolicy(data.password, data);
  if (policy) throw new z.ZodError([{ code: 'custom', path: ['password'], message: policy }]);

  const exists = await db.user.findUnique({ where: { email: normalizeEmail(data.email) } });
  if (exists) throw new z.ZodError([{ code: 'custom', path: ['email'], message: 'Diese E-Mail-Adresse ist bereits vergeben.' }]);

  const passwordHash = await hashPassword(data.password);
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        passwordHash,
        mustChangePassword: true,
        employee: { create: { isExpert: data.isExpert || data.role === 'EXPERT' } },
      },
    });
    await writeAudit({ actorId: actor.id, action: 'user.create', entityType: 'User', entityId: user.id, summary: `Benutzer ${user.email} angelegt (${user.role})`, after: { email: user.email, role: user.role }, ...ctx }, tx);
    return user;
  });
}

export async function updateUser(actor: AuthUser, input: unknown, ctx: { ip?: string | null; userAgent?: string | null } = {}) {
  const data = updateUserSchema.parse(input);
  const target = await db.user.findFirst({ where: { id: data.id, deletedAt: null }, include: { employee: true } });
  if (!target) throw new ForbiddenError('Benutzer nicht gefunden.');

  assertMayManageRole(actor, target.role); // ein ADMIN fasst keinen OWNER an
  assertMayManageRole(actor, data.role);
  if (target.id === actor.id && (!data.isActive || data.role !== target.role)) {
    throw new ForbiddenError('Das eigene Konto kann hier weder deaktiviert noch in der Rolle geändert werden.');
  }

  // Der letzte aktive Inhaber darf nicht verloren gehen.
  const losesOwner = target.role === 'OWNER' && (data.role !== 'OWNER' || !data.isActive);
  if (losesOwner) {
    const owners = await db.user.count({ where: { role: 'OWNER', isActive: true, deletedAt: null } });
    if (owners <= 1) throw new ForbiddenError('Es muss mindestens ein aktiver Inhaber bleiben.');
  }

  const roleChanged = data.role !== target.role;
  const deactivated = target.isActive && !data.isActive;

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: target.id },
      data: {
        role: data.role,
        isActive: data.isActive,
        employee: { upsert: { create: { isExpert: data.isExpert }, update: { isExpert: data.isExpert } } },
      },
    });
    await writeAudit(
      {
        actorId: actor.id,
        action: deactivated ? 'user.deactivate' : roleChanged ? 'user.role_change' : 'user.update',
        entityType: 'User',
        entityId: u.id,
        summary: `Benutzer ${u.email} geändert`,
        before: { role: target.role, isActive: target.isActive, isExpert: target.employee?.isExpert ?? false },
        after: { role: u.role, isActive: u.isActive, isExpert: data.isExpert },
        ...ctx,
      },
      tx,
    );
    return u;
  });

  // Rollenwechsel/Deaktivierung wirken sofort: alle Sitzungen beenden.
  if (roleChanged || deactivated) await revokeAllSessions(updated.id);
  return updated;
}

export async function resetPassword(actor: AuthUser, userId: string, newPassword: string, ctx: { ip?: string | null; userAgent?: string | null } = {}) {
  const target = await db.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!target) throw new ForbiddenError('Benutzer nicht gefunden.');
  assertMayManageRole(actor, target.role);
  const policy = validatePasswordPolicy(newPassword, target);
  if (policy) throw new z.ZodError([{ code: 'custom', path: ['password'], message: policy }]);
  const passwordHash = await hashPassword(newPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: target.id }, data: { passwordHash, mustChangePassword: true, failedLogins: 0, lockedUntil: null } });
    await writeAudit({ actorId: actor.id, action: 'user.password_reset', entityType: 'User', entityId: target.id, summary: `Passwort von ${target.email} zurückgesetzt`, ...ctx }, tx);
  });
  await revokeAllSessions(target.id);
}

export type UserListFilter = { q?: string; role?: Role; page: number; pageSize?: number };

export async function listUsers(f: UserListFilter) {
  const pageSize = Math.min(f.pageSize ?? 25, 100);
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(f.role ? { role: f.role } : {}),
    ...(f.q ? { OR: [{ email: { contains: f.q, mode: 'insensitive' } }, { firstName: { contains: f.q, mode: 'insensitive' } }, { lastName: { contains: f.q, mode: 'insensitive' } }] } : {}),
  };
  const [total, items] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { lastName: 'asc' }, { firstName: 'asc' }],
      skip: (Math.max(1, f.page) - 1) * pageSize,
      take: pageSize,
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, lastLoginAt: true, employee: { select: { isExpert: true } } },
    }),
  ]);
  return { total, items, pageSize };
}
