import 'server-only';
import { db } from '@/server/db';
import { CASE_LABELS, LEAD_LABELS, type CaseStatusKey, type LeadStatusKey } from '@/lib/workflow';

export type ActivityItem = { id: string; at: Date; actor: string | null; text: string; kind: 'status' | 'note' | 'system'; plain?: boolean };

const name = (a?: { firstName: string; lastName: string } | null) => (a ? `${a.firstName} ${a.lastName}`.trim() : null);

/** Audit-Aktionen, die schon aus eigenen Tabellen (Statushistorie, Notizen) kommen – nicht doppelt anzeigen. */
const COVERED_BY_TABLES = new Set(['case.status_change', 'lead.status_change', 'note.add', 'case.create', 'customer.create', 'vehicle.create', 'media.download']);

const AUDIT_TEXT: Record<string, string> = {
  'case.create': 'hat den Fall angelegt.',
  'case.update': 'hat den Fall bearbeitet.',
  'case.assign': 'hat die Zuständigkeit geändert.',
  'case.archive': 'hat den Fall archiviert.',
  'case.restore': 'hat den Fall wiederhergestellt.',
  'appointment.create': 'hat einen Termin angelegt.',
  'appointment.update': 'hat einen Termin geändert.',
  'appointment.status_change': 'hat einen Termin aktualisiert.',
  'photo.add': 'hat ein Foto hinzugefügt.',
  'photo.update': 'hat ein Foto bearbeitet.',
  'photo.delete': 'hat ein Foto gelöscht.',
  'document.add': 'hat ein Dokument hinzugefügt.',
  'document.delete': 'hat ein Dokument gelöscht.',
  'damage.add': 'hat einen Schaden erfasst.',
  'damage.update': 'hat einen Schaden bearbeitet.',
  'damage.delete': 'hat einen Schaden gelöscht.',
  'inspection.start': 'hat die Besichtigung begonnen.',
  'inspection.finish': 'hat die Besichtigung abgeschlossen.',
  'lead.update': 'hat die Anfrage bearbeitet.',
  'lead.notification_failed': 'E-Mail-Benachrichtigung fehlgeschlagen.',
  'lead.assign': 'hat die Zuständigkeit geändert.',
  'lead.convert': 'hat die Anfrage in einen Fall umgewandelt.',
  'customer.create': 'hat den Kunden angelegt.',
  'customer.update': 'hat den Kunden bearbeitet.',
  'customer.archive': 'hat den Kunden archiviert.',
  'customer.restore': 'hat den Kunden wiederhergestellt.',
  'vehicle.create': 'hat das Fahrzeug angelegt.',
  'vehicle.update': 'hat das Fahrzeug bearbeitet.',
  'vehicle.archive': 'hat das Fahrzeug archiviert.',
};

async function auditItems(entityType: string, entityId: string): Promise<ActivityItem[]> {
  const rows = await db.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, action: true, createdAt: true, actor: { select: { firstName: true, lastName: true } } },
  });
  return rows
    .filter((r) => !COVERED_BY_TABLES.has(r.action) || r.action === 'case.create')
    .map((r) => ({ id: `a${r.id}`, at: r.createdAt, actor: name(r.actor), text: AUDIT_TEXT[r.action] ?? r.action, kind: 'system' as const, plain: r.action === 'lead.notification_failed' }));
}

/** Aktivitäts-Feed eines Falls: Statushistorie + Notizen (sofern sichtbar) + Audit-Ereignisse, neueste zuerst. */
export async function caseActivity(caseId: string, opts: { includeNotes: boolean }): Promise<ActivityItem[]> {
  const [history, notes, audit] = await Promise.all([
    db.caseStatusHistory.findMany({ where: { caseId }, include: { actor: { select: { firstName: true, lastName: true } } } }),
    opts.includeNotes ? db.note.findMany({ where: { caseId }, include: { author: { select: { firstName: true, lastName: true } } } }) : Promise.resolve([]),
    auditItems('Case', caseId),
  ]);
  const items: ActivityItem[] = [
    ...history.map((h) => ({
      id: `h${h.id}`, at: h.createdAt, actor: name(h.actor), kind: 'status' as const,
      text: h.fromStatus
        ? `hat den Status von „${CASE_LABELS[h.fromStatus as CaseStatusKey]}“ auf „${CASE_LABELS[h.toStatus as CaseStatusKey]}“ gesetzt.${h.reason ? ` Grund: ${h.reason}` : ''}`
        : 'hat den Fall angelegt.',
    })),
    ...notes.map((n) => ({ id: `n${n.id}`, at: n.createdAt, actor: name(n.author), kind: 'note' as const, text: n.kind === 'PHONE_CALL' ? 'hat eine Telefonnotiz hinzugefügt.' : 'hat eine Notiz hinzugefügt.' })),
    ...audit.filter((a) => a.text !== 'hat den Fall angelegt.'),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export async function leadActivity(leadId: string): Promise<ActivityItem[]> {
  const [history, notes, audit] = await Promise.all([
    db.leadStatusHistory.findMany({ where: { leadId }, include: { actor: { select: { firstName: true, lastName: true } } } }),
    db.note.findMany({ where: { leadId }, include: { author: { select: { firstName: true, lastName: true } } } }),
    auditItems('Lead', leadId),
  ]);
  const items: ActivityItem[] = [
    ...history.map((h) =>
      h.fromStatus === null
        ? { id: `h${h.id}`, at: h.createdAt, actor: null, kind: 'status' as const, plain: true, text: 'Anfrage über die Website eingegangen.' }
        : {
            id: `h${h.id}`, at: h.createdAt, actor: name(h.actor), kind: 'status' as const,
            text: `hat den Status von „${LEAD_LABELS[h.fromStatus as LeadStatusKey]}“ auf „${LEAD_LABELS[h.toStatus as LeadStatusKey]}“ gesetzt.${h.reason ? ` ${h.reason}` : ''}`,
          },
    ),
    ...notes.map((n) => ({ id: `n${n.id}`, at: n.createdAt, actor: name(n.author), kind: 'note' as const, text: n.kind === 'PHONE_CALL' ? 'hat eine Telefonnotiz hinzugefügt.' : 'hat eine Notiz hinzugefügt.' })),
    ...audit.filter((a) => !a.text.includes('umgewandelt')), // Umwandlung steht schon in der Statushistorie
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export async function customerActivity(customerId: string): Promise<ActivityItem[]> {
  const [notes, audit, cases] = await Promise.all([
    db.note.findMany({ where: { customerId }, include: { author: { select: { firstName: true, lastName: true } } } }),
    auditItems('Customer', customerId),
    db.case.findMany({ where: { customerId }, select: { id: true, caseNumber: true, createdAt: true, createdBy: { select: { firstName: true, lastName: true } } } }),
  ]);
  return [
    ...notes.map((n) => ({ id: `n${n.id}`, at: n.createdAt, actor: name(n.author), kind: 'note' as const, text: 'hat eine Notiz hinzugefügt.' })),
    ...audit,
    ...cases.map((c) => ({ id: `c${c.id}`, at: c.createdAt, actor: name(c.createdBy), kind: 'system' as const, text: `hat Fall ${c.caseNumber} angelegt.` })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
}
