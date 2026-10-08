import 'server-only';
import { db } from '@/server/db';
import type { AuthUser } from '@/server/auth/session-types';
import { berlinDayRange, berlinToday } from '@/lib/berlin';
import { CASE_TERMINAL } from '@/lib/workflow';
import { caseScope, has } from './access';

/**
 * Daten für „Heute“ und das Dashboard – ausschließlich echte Datensätze, jeweils nach den
 * Rechten des Benutzers. Termine gibt es erst mit Phase 3 (Kalender); bis dahin zeigt die Seite das ehrlich.
 */
export async function todayOverview(user: AuthUser) {
  const day = berlinDayRange(berlinToday())!;
  const canLeads = has(user, 'leads.read');
  const scope = caseScope(user, 'read');

  const canAppts = has(user, 'appointments.read.all') || has(user, 'appointments.read.own');
  const apptScope = has(user, 'appointments.read.all') ? {} : { expertId: user.id };
  const [newLeads, dueLeads, workCases, appts] = await Promise.all([
    canLeads
      ? db.lead.findMany({ where: { deletedAt: null, status: 'NEW' }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, name: true, reason: true, vehicleKind: true, phone: true, location: true, createdAt: true, notificationStatus: true } })
      : Promise.resolve([]),
    canLeads
      ? db.lead.findMany({
          where: { deletedAt: null, status: { notIn: ['CONVERTED', 'CLOSED', 'SPAM'] }, nextActionAt: { lt: day.end } },
          orderBy: { nextActionAt: 'asc' }, take: 10,
          select: { id: true, name: true, status: true, nextActionAt: true, phone: true },
        })
      : Promise.resolve([]),
    scope
      ? db.case.findMany({
          where: { AND: [scope, { deletedAt: null }, { status: { in: ['NEW', 'APPOINTMENT_PENDING', 'DOCUMENTS_MISSING', 'INSPECTED', 'IN_PROGRESS'] } }] },
          orderBy: { createdAt: 'asc' }, take: 10,
          select: { id: true, caseNumber: true, status: true, createdAt: true, customer: { select: { lastName: true, company: true } }, vehicle: { select: { licensePlate: true, model: true } } },
        })
      : Promise.resolve([]),
    // Termine heute + der nächste anstehende Termin (nach Rechten: alle oder nur eigene)
    canAppts
      ? db.appointment.findMany({
          where: { ...apptScope, case: { deletedAt: null }, OR: [{ startsAt: { gte: day.start, lt: day.end }, status: { in: ['PLANNED', 'CONFIRMED', 'DONE'] } }, { endsAt: { gt: new Date() }, status: { in: ['PLANNED', 'CONFIRMED'] }, startsAt: { lt: new Date(day.end.getTime() + 14 * 86_400_000) } }] },
          orderBy: { startsAt: 'asc' }, take: 40,
          select: {
            id: true, kind: true, status: true, startsAt: true, endsAt: true, location: true, caseId: true,
            expert: { select: { firstName: true, lastName: true } },
            inspection: { select: { status: true } },
            case: { select: { caseNumber: true, inspectionLocation: true, customer: { select: { firstName: true, lastName: true, company: true, phone: true } }, vehicle: { select: { manufacturer: true, model: true, licensePlate: true } } } },
          },
        })
      : Promise.resolve([]),
  ]);
  const todays = appts.filter((a) => a.startsAt >= day.start && a.startsAt < day.end);
  const upcoming = appts.filter((a) => (a.status === 'PLANNED' || a.status === 'CONFIRMED') && a.endsAt > new Date());
  return { newLeads, dueLeads, workCases, appointments: todays, next: upcoming[0] ?? null };
}

/** Echte Kennzahlen für das Dashboard (0 bleibt 0). */
export async function dashboardCounts(user: AuthUser) {
  const scope = caseScope(user, 'read');
  const canLeads = has(user, 'leads.read');
  const dayEnd = berlinDayRange(berlinToday())!.end;
  const reportScope = has(user, 'reports.read.all') ? {} : has(user, 'reports.read.own') ? { case: { assignedExpertId: user.id } } : null;
  const [newLeads, failedMail, openCases, unassigned, customers, reportsOpen, followUpsDue, appointmentsToday, reviewsPending] = await Promise.all([
    canLeads ? db.lead.count({ where: { deletedAt: null, status: 'NEW' } }) : null,
    canLeads ? db.lead.count({ where: { deletedAt: null, notificationStatus: 'FAILED', status: { notIn: ['CONVERTED', 'SPAM', 'CLOSED'] } } }) : null,
    scope ? db.case.count({ where: { AND: [scope, { deletedAt: null, status: { notIn: [...CASE_TERMINAL] } }] } }) : null,
    scope && has(user, 'cases.read.all') ? db.case.count({ where: { deletedAt: null, assignedExpertId: null, status: { notIn: [...CASE_TERMINAL] } } }) : null,
    has(user, 'customers.read') ? db.customer.count({ where: { deletedAt: null } }) : null,
    // „Gutachten offen“: Gutachten, die noch geschrieben, geprüft oder freigegeben werden müssen
    reportScope ? db.report.count({ where: { AND: [reportScope, { case: { deletedAt: null }, status: { in: ['DRAFT', 'CHANGES_REQUESTED', 'IN_REVIEW', 'APPROVED'] } }] } }) : null,
    canLeads ? db.lead.count({ where: { deletedAt: null, status: { notIn: ['CONVERTED', 'CLOSED', 'SPAM'] }, nextActionAt: { lt: dayEnd } } }) : null,
    has(user, 'appointments.read.all') || has(user, 'appointments.read.own')
      ? db.appointment.count({ where: { ...(has(user, 'appointments.read.all') ? {} : { expertId: user.id }), startsAt: { gte: berlinDayRange(berlinToday())!.start, lt: dayEnd }, status: { in: ['PLANNED', 'CONFIRMED', 'DONE'] } } })
      : null,
    has(user, 'reports.review') ? db.report.count({ where: { status: 'IN_REVIEW', case: { deletedAt: null } } }) : null,
  ]);
  return { newLeads, failedMail, openCases, unassigned, customers, reportsOpen, followUpsDue, appointmentsToday, reviewsPending };
}
