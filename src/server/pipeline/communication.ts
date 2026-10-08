import 'server-only';
import { z } from 'zod';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { DomainError, notFoundError } from '@/server/errors';
import { canSeeCaseInternals } from './access';
import { canOnCase, loadCaseFor } from './case-access';

/**
 * Kommunikation am Fall: interne/externe Notizen, Anrufprotokoll, angeheftete Hinweise, @Erwähnungen.
 * Es wird nichts versendet – externe Notizen sind nur als „darf an Dritte weitergegeben werden“ markiert.
 */

const nameOf = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

export async function caseCommunication(user: AuthUser, caseId: string) {
  const c = await loadCaseFor(user, caseId, 'read');
  if (!canOnCase(user, 'communication', 'read', c)) throw new ForbiddenError();
  const internals = canSeeCaseInternals(user);
  const rows = await db.note.findMany({
    where: { caseId, ...(internals ? {} : { external: true }) },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    take: 200,
    include: { author: { select: { firstName: true, lastName: true } } },
  });
  const ids = [...new Set(rows.flatMap((r) => r.mentionIds))];
  const users = ids.length ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } }) : [];
  const byId = new Map(users.map((u) => [u.id, nameOf(u)]));
  return rows.map((n) => ({
    id: n.id, kind: n.kind, body: n.body, pinned: n.pinned, external: n.external, createdAt: n.createdAt,
    author: n.author ? nameOf(n.author) : null,
    mentions: n.mentionIds.map((id) => byId.get(id)).filter((x): x is string => Boolean(x)),
    call: n.kind === 'PHONE_CALL' ? { direction: n.callDirection, phone: n.callPhone, outcome: n.callOutcome } : null,
  }));
}

/** Personen, die in diesem Fall erwähnt werden dürfen (Gutachter nur, wenn sie dem Fall zugewiesen sind). */
export async function mentionable(user: AuthUser, caseId: string) {
  const c = await loadCaseFor(user, caseId, 'read');
  if (!canOnCase(user, 'communication', 'read', c)) throw new ForbiddenError();
  const rows = await db.user.findMany({
    where: { isActive: true, deletedAt: null, OR: [{ role: { in: ['OWNER', 'ADMIN', 'OFFICE', 'ACCOUNTING', 'REVIEWER'] } }, { id: c.assignedExpertId ?? '__none__' }] },
    orderBy: { firstName: 'asc' }, select: { id: true, firstName: true, lastName: true },
  });
  return rows.filter((r) => r.id !== user.id).map((r) => ({ id: r.id, name: nameOf(r) }));
}

const noteSchema = z.object({
  body: z.string().trim().min(1, 'Die Notiz ist leer.').max(4000, 'Höchstens 4000 Zeichen.'),
  kind: z.enum(['NOTE', 'PHONE_CALL']).default('NOTE'),
  external: z.boolean().default(false),
  pinned: z.boolean().default(false),
  mentionIds: z.array(z.string().max(40)).max(10).default([]),
  call: z.object({
    direction: z.enum(['INBOUND', 'OUTBOUND']),
    phone: z.string().trim().max(40).nullable().optional().transform((v) => v || null),
    outcome: z.string().trim().max(200).nullable().optional().transform((v) => v || null),
  }).nullable().optional(),
});
export type CommunicationInput = z.input<typeof noteSchema>;

export async function addCommunication(user: AuthUser, caseId: string, raw: unknown) {
  const c = await loadCaseFor(user, caseId, 'read');
  if (!canOnCase(user, 'communication', 'write', c)) throw new ForbiddenError();
  const d = noteSchema.parse(raw);
  if (d.kind === 'PHONE_CALL' && !d.call) throw new DomainError('Bitte die Richtung des Anrufs angeben.');
  if (d.kind === 'NOTE' && d.call) throw new DomainError('Anrufdaten gehören nur zu einem Anruf.');
  // Erwähnung nur, wenn sie im Text wirklich steht und die Person erwähnt werden darf
  const allowed = await mentionable(user, caseId);
  const mentioned = allowed.filter((p) => d.mentionIds.includes(p.id) && d.body.includes(`@${p.name}`));
  return db.$transaction(async (tx) => {
    const n = await tx.note.create({
      data: {
        caseId, authorId: user.id, kind: d.kind, body: d.body, external: d.external, pinned: d.pinned, mentionIds: mentioned.map((m) => m.id),
        ...(d.kind === 'PHONE_CALL' && d.call ? { callDirection: d.call.direction, callPhone: d.call.phone, callOutcome: d.call.outcome } : {}),
      },
    });
    for (const m of mentioned) {
      await tx.notification.create({ data: { userId: m.id, kind: 'MENTION', text: `${nameOf(user)} hat Sie in ${c.caseNumber} erwähnt`, href: `/admin/faelle/${c.caseNumber}/?tab=kommunikation` } });
    }
    await writeAudit({ actorId: user.id, action: d.kind === 'PHONE_CALL' ? 'call.log' : 'note.add', entityType: 'Case', entityId: caseId, summary: d.kind === 'PHONE_CALL' ? 'Anruf protokolliert' : `${d.external ? 'Externe' : 'Interne'} Notiz hinzugefügt`, after: { noteId: n.id, mentions: mentioned.length } }, tx);
    return n;
  });
}

/** Heftet eine Notiz oben an (oder löst sie wieder). Der Text selbst bleibt unverändert. */
export async function setPinned(user: AuthUser, noteId: string, pinned: boolean) {
  const n = await db.note.findUnique({ where: { id: noteId }, select: { id: true, caseId: true } });
  if (!n?.caseId) throw notFoundError('Notiz');
  const c = await loadCaseFor(user, n.caseId, 'read');
  if (!canOnCase(user, 'communication', 'write', c)) throw new ForbiddenError();
  await db.$transaction(async (tx) => {
    await tx.note.update({ where: { id: noteId }, data: { pinned } });
    await writeAudit({ actorId: user.id, action: pinned ? 'note.pin' : 'note.unpin', entityType: 'Case', entityId: n.caseId, summary: pinned ? 'Notiz angeheftet' : 'Notiz gelöst' }, tx);
  });
}

/** Angeheftete, für die Person sichtbare Hinweise eines Falls (für den Kopfbereich). */
export async function pinnedNotes(user: AuthUser, caseId: string) {
  try {
    return (await caseCommunication(user, caseId)).filter((n) => n.pinned);
  } catch {
    return [];
  }
}
