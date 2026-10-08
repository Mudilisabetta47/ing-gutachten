import 'server-only';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { DomainError, notFoundError } from '@/server/errors';
import { addDays, berlinToday } from '@/lib/tasks';
import { has } from './access';

const nameOf = (u: AuthUser) => `${u.firstName} ${u.lastName}`;
import { loadCaseFor } from './case-access';

/* ------------------------------------------------------------ Rechte */

const canReadAll = (u: AuthUser) => has(u, 'tasks.read.all');
const canWriteAll = (u: AuthUser) => has(u, 'tasks.write.all');
function mustRead(u: AuthUser) { if (!canReadAll(u) && !has(u, 'tasks.read.own')) throw new ForbiddenError(); }
function mustWrite(u: AuthUser) { if (!canWriteAll(u) && !has(u, 'tasks.write.own')) throw new ForbiddenError(); }
/** Sichtbarkeit: `.all` alles, `.own` nur eigene (zugewiesen oder selbst angelegt). */
const readScope = (u: AuthUser): Prisma.TaskWhereInput => (canReadAll(u) ? {} : { OR: [{ assigneeId: u.id }, { createdById: u.id }] });
const writeScope = (u: AuthUser): Prisma.TaskWhereInput => (canWriteAll(u) ? {} : { OR: [{ assigneeId: u.id }, { createdById: u.id }] });

/* ------------------------------------------------------------ Lesen */

const include = {
  assignee: { select: { id: true, firstName: true, lastName: true } },
  case: { select: { caseNumber: true } },
  lead: { select: { id: true, name: true } },
  customer: { select: { id: true, firstName: true, lastName: true, company: true } },
} satisfies Prisma.TaskInclude;
type Row = Prisma.TaskGetPayload<{ include: typeof include }>;
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const dateOf = (s: string) => new Date(`${s}T00:00:00Z`);

export type TaskDto = ReturnType<typeof toDto>;
function toDto(r: Row, today: string) {
  const due = ymd(r.dueDate);
  return {
    id: r.id, kind: r.kind, status: r.status, title: r.title, description: r.description, priority: r.priority, dueDate: due,
    overdue: r.status === 'OPEN' && due != null && due < today, dueToday: r.status === 'OPEN' && due === today,
    assignee: r.assignee ? { id: r.assignee.id, name: `${r.assignee.firstName} ${r.assignee.lastName}` } : null,
    caseId: r.caseId, caseNumber: r.case?.caseNumber ?? null,
    leadId: r.leadId, leadName: r.lead?.name ?? null,
    customerId: r.customerId, customerName: r.customer ? r.customer.company || `${r.customer.firstName} ${r.customer.lastName}`.trim() : null,
    snoozeCount: r.snoozeCount, completedAt: r.completedAt, createdAt: r.createdAt,
  };
}

export type TaskQuery = { view?: 'mine' | 'all'; status?: 'open' | 'done'; kind?: 'TASK' | 'FOLLOW_UP'; due?: 'overdue' | 'today' | 'week'; assigneeId?: string; caseId?: string; q?: string; page?: number };
export async function listTasks(user: AuthUser, query: TaskQuery = {}) {
  mustRead(user);
  const today = berlinToday();
  const page = Math.max(1, query.page ?? 1), size = 30;
  const and: Prisma.TaskWhereInput[] = [readScope(user)];
  if (query.view === 'mine' || !canReadAll(user)) and.push({ assigneeId: user.id });
  and.push(query.status === 'done' ? { status: 'DONE' } : { status: 'OPEN' });
  if (query.kind) and.push({ kind: query.kind });
  if (query.assigneeId) and.push({ assigneeId: query.assigneeId });
  if (query.caseId) and.push({ caseId: query.caseId });
  if (query.due === 'overdue') and.push({ dueDate: { lt: dateOf(today) } });
  if (query.due === 'today') and.push({ dueDate: dateOf(today) });
  if (query.due === 'week') and.push({ dueDate: { lte: dateOf(addDays(today, 7)) } });
  if (query.q?.trim()) and.push({ OR: [{ title: { contains: query.q.trim(), mode: 'insensitive' } }, { case: { caseNumber: { contains: query.q.trim(), mode: 'insensitive' } } }] });
  const where: Prisma.TaskWhereInput = { AND: and };
  const [rows, total] = await Promise.all([
    db.task.findMany({ where, include, orderBy: query.status === 'done' ? [{ completedAt: 'desc' }] : [{ dueDate: { sort: 'asc', nulls: 'last' } }, { priority: 'desc' }, { createdAt: 'asc' }], skip: (page - 1) * size, take: size }),
    db.task.count({ where }),
  ]);
  return { rows: rows.map((r) => toDto(r, today)), total, page, pageSize: size };
}

export async function caseTasks(user: AuthUser, caseId: string) {
  mustRead(user);
  await loadCaseFor(user, caseId, 'read');
  const today = berlinToday();
  const rows = await db.task.findMany({ where: { AND: [{ caseId }, readScope(user)] }, include, orderBy: [{ status: 'asc' }, { dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }], take: 100 });
  return rows.map((r) => toDto(r, today));
}

/** Zähler für Dashboard/Heute – nur im Sichtbereich des Benutzers. */
export async function taskStats(user: AuthUser) {
  if (!canReadAll(user) && !has(user, 'tasks.read.own')) return null;
  const today = dateOf(berlinToday());
  const mine: Prisma.TaskWhereInput = { AND: [readScope(user), { assigneeId: user.id, status: 'OPEN' }] };
  const [open, overdue, dueToday, followUpsDue] = await Promise.all([
    db.task.count({ where: mine }),
    db.task.count({ where: { AND: [mine, { dueDate: { lt: today } }] } }),
    db.task.count({ where: { AND: [mine, { dueDate: today }] } }),
    db.task.count({ where: { AND: [mine, { kind: 'FOLLOW_UP', dueDate: { lte: today } }] } }),
  ]);
  return { open, overdue, dueToday, followUpsDue };
}

/** Kommende Wiedervorlagen/Aufgaben der Person für „Heute“ (fällig oder überfällig). */
export async function dueForToday(user: AuthUser, limit = 8) {
  if (!canReadAll(user) && !has(user, 'tasks.read.own')) return [];
  const today = berlinToday();
  const rows = await db.task.findMany({ where: { AND: [readScope(user), { assigneeId: user.id, status: 'OPEN', dueDate: { lte: dateOf(today) } }] }, include, orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }], take: limit });
  return rows.map((r) => toDto(r, today));
}

/** Zuweisbare Personen: wer alles schreiben darf, wählt frei; sonst nur man selbst. */
export async function assignees(user: AuthUser) {
  mustWrite(user);
  if (!canWriteAll(user)) return [{ id: user.id, name: nameOf(user) }];
  const rows = await db.user.findMany({ where: { isActive: true, deletedAt: null, role: { in: ['OWNER', 'ADMIN', 'OFFICE', 'EXPERT', 'ACCOUNTING', 'REVIEWER'] } }, orderBy: { firstName: 'asc' }, select: { id: true, firstName: true, lastName: true } });
  return rows.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}` }));
}

/* ------------------------------------------------------------ Schreiben */

const opt = (n: number) => z.string().trim().max(n).nullable().optional().transform((v) => v || null);
const taskSchema = z.object({
  kind: z.enum(['TASK', 'FOLLOW_UP']).default('TASK'),
  title: z.string().trim().min(1, 'Bitte einen Titel angeben.').max(160, 'Höchstens 160 Zeichen.'),
  description: opt(2000),
  priority: z.enum(['NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Bitte ein gültiges Datum angeben.').nullable().optional().or(z.literal('')).transform((v) => v || null),
  assigneeId: opt(40),
  caseId: opt(40),
  leadId: opt(40),
  customerId: opt(40),
}).superRefine((v, ctx) => {
  if (v.kind === 'FOLLOW_UP' && !v.dueDate) ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Eine Wiedervorlage braucht ein Datum.' });
  if ([v.caseId, v.leadId, v.customerId].filter(Boolean).length > 1) ctx.addIssue({ code: 'custom', path: ['caseId'], message: 'Eine Aufgabe kann nur zu einem Fall, einer Anfrage oder einem Kunden gehören.' });
});
export type TaskInput = z.input<typeof taskSchema>;

async function checkRefs(user: AuthUser, d: { caseId: string | null; leadId: string | null; customerId: string | null }) {
  if (d.caseId) await loadCaseFor(user, d.caseId, 'read');
  if (d.leadId) {
    if (!has(user, 'leads.read')) throw new ForbiddenError();
    if (!(await db.lead.findFirst({ where: { id: d.leadId, deletedAt: null }, select: { id: true } }))) throw notFoundError('Anfrage');
  }
  if (d.customerId) {
    if (!has(user, 'customers.read')) throw new ForbiddenError();
    if (!(await db.customer.findFirst({ where: { id: d.customerId, deletedAt: null }, select: { id: true } }))) throw notFoundError('Kunde');
  }
}
async function checkAssignee(user: AuthUser, assigneeId: string | null) {
  if (!assigneeId) return;
  if (!canWriteAll(user) && assigneeId !== user.id) throw new ForbiddenError();
  const u = await db.user.findFirst({ where: { id: assigneeId, isActive: true, deletedAt: null }, select: { id: true } });
  if (!u) throw new DomainError('Die gewählte Person ist nicht (mehr) aktiv.');
}
function hrefFor(t: { caseNumber?: string | null; leadId?: string | null }) {
  return t.caseNumber ? `/admin/faelle/${t.caseNumber}/?tab=aufgaben` : t.leadId ? `/admin/anfragen/${t.leadId}/` : '/admin/aufgaben/';
}

export async function createTask(user: AuthUser, raw: unknown) {
  mustWrite(user);
  const d = taskSchema.parse(raw);
  await checkRefs(user, d);
  const assigneeId = d.assigneeId ?? user.id;
  await checkAssignee(user, assigneeId);
  return db.$transaction(async (tx) => {
    const t = await tx.task.create({ data: { kind: d.kind, title: d.title, description: d.description, priority: d.priority, dueDate: d.dueDate ? dateOf(d.dueDate) : null, assigneeId, createdById: user.id, caseId: d.caseId, leadId: d.leadId, customerId: d.customerId }, include });
    if (assigneeId !== user.id) {
      await tx.notification.create({ data: { userId: assigneeId, kind: 'TASK_ASSIGNED', text: `${nameOf(user)} hat Ihnen ${d.kind === 'FOLLOW_UP' ? 'eine Wiedervorlage' : 'eine Aufgabe'} zugewiesen: ${d.title}`, href: hrefFor({ caseNumber: t.case?.caseNumber, leadId: d.leadId }) } });
    }
    await writeAudit({ actorId: user.id, action: 'task.create', entityType: 'Task', entityId: t.id, summary: `${d.kind === 'FOLLOW_UP' ? 'Wiedervorlage' : 'Aufgabe'} angelegt: ${d.title}` }, tx);
    return toDto(t, berlinToday());
  });
}

async function loadTask(user: AuthUser, id: string, tx: Prisma.TransactionClient | typeof db = db) {
  mustWrite(user);
  const t = await tx.task.findFirst({ where: { AND: [{ id }, writeScope(user)] }, include });
  if (!t) throw notFoundError('Aufgabe');
  return t;
}

export async function updateTask(user: AuthUser, id: string, raw: unknown) {
  const cur = await loadTask(user, id);
  if (cur.status !== 'OPEN') throw new DomainError('Erledigte oder abgebrochene Aufgaben können nicht mehr geändert werden. Bitte wieder öffnen.', 'conflict');
  const d = taskSchema.parse({ ...(raw as object), caseId: cur.caseId, leadId: cur.leadId, customerId: cur.customerId });
  const assigneeId = d.assigneeId ?? cur.assigneeId;
  if (assigneeId !== cur.assigneeId) await checkAssignee(user, assigneeId);
  return db.$transaction(async (tx) => {
    const t = await tx.task.update({ where: { id }, data: { kind: d.kind, title: d.title, description: d.description, priority: d.priority, dueDate: d.dueDate ? dateOf(d.dueDate) : null, assigneeId }, include });
    if (assigneeId && assigneeId !== cur.assigneeId && assigneeId !== user.id) {
      await tx.notification.create({ data: { userId: assigneeId, kind: 'TASK_ASSIGNED', text: `${nameOf(user)} hat Ihnen eine Aufgabe zugewiesen: ${d.title}`, href: hrefFor({ caseNumber: t.case?.caseNumber, leadId: t.leadId }) } });
    }
    await writeAudit({ actorId: user.id, action: 'task.update', entityType: 'Task', entityId: id, summary: `Aufgabe geändert: ${d.title}` }, tx);
    return toDto(t, berlinToday());
  });
}

export async function completeTask(user: AuthUser, id: string) {
  const cur = await loadTask(user, id);
  if (cur.status !== 'OPEN') throw new DomainError('Diese Aufgabe ist bereits abgeschlossen.', 'conflict');
  await db.$transaction(async (tx) => {
    await tx.task.update({ where: { id }, data: { status: 'DONE', completedAt: new Date(), completedById: user.id } });
    await writeAudit({ actorId: user.id, action: 'task.complete', entityType: 'Task', entityId: id, summary: `Aufgabe erledigt: ${cur.title}` }, tx);
  });
}

export async function reopenTask(user: AuthUser, id: string) {
  const cur = await loadTask(user, id);
  if (cur.status === 'OPEN') return;
  await db.$transaction(async (tx) => {
    await tx.task.update({ where: { id }, data: { status: 'OPEN', completedAt: null, completedById: null } });
    await writeAudit({ actorId: user.id, action: 'task.reopen', entityType: 'Task', entityId: id, summary: `Aufgabe wieder geöffnet: ${cur.title}` }, tx);
  });
}

/** Verschiebt die Fälligkeit (z. B. „morgen“, „in einer Woche“); zählt mit, wie oft verschoben wurde. */
export async function snoozeTask(user: AuthUser, id: string, to: { days?: number; date?: string }) {
  const cur = await loadTask(user, id);
  if (cur.status !== 'OPEN') throw new DomainError('Nur offene Aufgaben lassen sich verschieben.', 'conflict');
  const today = berlinToday();
  const target = to.date ?? addDays(ymd(cur.dueDate) && ymd(cur.dueDate)! > today ? ymd(cur.dueDate)! : today, to.days ?? 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target) || target <= today) throw new DomainError('Das neue Datum muss in der Zukunft liegen.');
  await db.$transaction(async (tx) => {
    await tx.task.update({ where: { id }, data: { dueDate: dateOf(target), snoozeCount: { increment: 1 } } });
    await writeAudit({ actorId: user.id, action: 'task.snooze', entityType: 'Task', entityId: id, summary: `Aufgabe verschoben auf ${target.split('-').reverse().join('.')}: ${cur.title}` }, tx);
  });
  return target;
}

export async function cancelTask(user: AuthUser, id: string) {
  const cur = await loadTask(user, id);
  if (cur.status === 'CANCELLED') return;
  await db.$transaction(async (tx) => {
    await tx.task.update({ where: { id }, data: { status: 'CANCELLED' } });
    await writeAudit({ actorId: user.id, action: 'task.cancel', entityType: 'Task', entityId: id, summary: `Aufgabe abgebrochen: ${cur.title}` }, tx);
  });
}

/* ------------------------------------------------------------ Benachrichtigungen */

export async function myNotifications(user: AuthUser, limit = 30) {
  const rows = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: limit });
  return rows.map((n) => ({ id: n.id, kind: n.kind, text: n.text, href: n.href, read: Boolean(n.readAt), createdAt: n.createdAt }));
}
export const unreadNotifications = (user: AuthUser) => db.notification.count({ where: { userId: user.id, readAt: null } });
export async function markNotificationsRead(user: AuthUser, id?: string) {
  await db.notification.updateMany({ where: { userId: user.id, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
}
