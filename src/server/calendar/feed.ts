import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import { effectivePermissions } from '@/server/auth/permissions';
import { buildIcs, type IcsEvent } from '@/lib/ics';
import { KIND_LABELS } from '@/server/pipeline/appointments';
import { SITE_URL } from '@/lib/site';
import type { AuthUser } from '@/server/auth/session-types';

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const PAST_DAYS = 30;
const FUTURE_DAYS = 365;

export type FeedStatus = { exists: boolean; showDetails: boolean; createdAt: Date | null; lastUsedAt: Date | null };

export async function feedStatus(userId: string): Promise<FeedStatus> {
  const f = await db.calendarFeed.findUnique({ where: { userId } });
  return { exists: Boolean(f), showDetails: f?.showDetails ?? false, createdAt: f?.createdAt ?? null, lastUsedAt: f?.lastUsedAt ?? null };
}

/** Erzeugt (oder ersetzt) den Abo-Link. Der Klartext-Schlüssel wird nur hier zurückgegeben und nirgends gespeichert. */
export async function createFeed(user: AuthUser, opts: { showDetails: boolean }): Promise<{ token: string }> {
  if (!user.permissions.has('appointments.read.all') && !user.permissions.has('appointments.read.own')) throw new Error('forbidden');
  const token = randomBytes(32).toString('base64url');
  const data = { tokenHash: hashToken(token), showDetails: opts.showDetails, createdAt: new Date(), lastUsedAt: null };
  await db.calendarFeed.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  await writeAudit({ actorId: user.id, action: 'calendar.feed_created', entityType: 'User', entityId: user.id, summary: opts.showDetails ? 'Kalender-Abo erzeugt (mit Details)' : 'Kalender-Abo erzeugt' });
  return { token };
}

export async function revokeFeed(user: AuthUser): Promise<void> {
  const r = await db.calendarFeed.deleteMany({ where: { userId: user.id } });
  if (r.count) await writeAudit({ actorId: user.id, action: 'calendar.feed_revoked', entityType: 'User', entityId: user.id, summary: 'Kalender-Abo widerrufen' });
}

export const feedUrl = (token: string, origin = SITE_URL) => `${origin.replace(/\/+$/, '')}/api/kalender/${token}.ics`;

/** Baut den ICS-Inhalt für einen Link-Schlüssel – oder `null`, wenn er unbekannt ist (kein Hinweis, ob es ihn je gab). */
export async function feedForToken(token: string, now = new Date()): Promise<string | null> {
  if (!TOKEN_RE.test(token)) return null;
  const feed = await db.calendarFeed.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { permissions: true } } },
  });
  if (!feed || !feed.user.isActive || feed.user.deletedAt) return null;
  const perms = effectivePermissions(feed.user.role, feed.user.permissions);
  const all = perms.has('appointments.read.all');
  if (!all && !perms.has('appointments.read.own')) return null; // Recht inzwischen entzogen → Link liefert nichts mehr
  const from = new Date(now.getTime() - PAST_DAYS * 86_400_000);
  const to = new Date(now.getTime() + FUTURE_DAYS * 86_400_000);
  const rows = await db.appointment.findMany({
    where: { startsAt: { lt: to }, endsAt: { gt: from }, ...(all ? {} : { expertId: feed.userId }), case: { deletedAt: null } },
    orderBy: { startsAt: 'asc' },
    take: 1000,
    select: {
      id: true, kind: true, status: true, startsAt: true, endsAt: true, location: true, updatedAt: true, caseId: true,
      expert: { select: { firstName: true, lastName: true } },
      case: { select: { caseNumber: true, customer: { select: { firstName: true, lastName: true, company: true } }, vehicle: { select: { manufacturer: true, model: true } } } },
    },
  });
  await db.calendarFeed.update({ where: { id: feed.id }, data: { lastUsedAt: now } }).catch(() => undefined);
  const events: IcsEvent[] = rows.map((a) => {
    const kind = KIND_LABELS[a.kind] ?? 'Termin';
    const who = a.case.customer.company || a.case.customer.lastName;
    const detail = feed.showDetails;
    return {
      uid: `appt-${a.id}@ing-gutachten`,
      start: a.startsAt, end: a.endsAt, updated: a.updatedAt,
      summary: detail ? `${kind} · ${who} (${a.case.caseNumber})` : `${kind} (${a.case.caseNumber})`,
      location: detail ? a.location ?? undefined : undefined,
      description: [`Fall ${a.case.caseNumber}`, detail && a.case.vehicle ? [a.case.vehicle.manufacturer, a.case.vehicle.model].filter(Boolean).join(' ') : '', all ? `Sachverständiger: ${a.expert.firstName} ${a.expert.lastName}` : '', `Öffnen: ${SITE_URL.replace(/\/+$/, '')}/admin/faelle/${a.case.caseNumber}/`].filter(Boolean).join('\n'),
      status: a.status === 'CANCELLED' || a.status === 'NO_SHOW' ? 'CANCELLED' : a.status === 'PLANNED' ? 'TENTATIVE' : 'CONFIRMED',
    };
  });
  return buildIcs(events, { name: `ING Termine – ${feed.user.firstName} ${feed.user.lastName}` });
}
