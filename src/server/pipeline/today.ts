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

  const [newLeads, dueLeads, workCases, jobs] = await Promise.all([
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
    // Einsätze: Fälle mit vereinbartem Termin (Uhrzeiten kommen mit dem Kalender in Phase 3)
    scope
      ? db.case.findMany({
          where: { AND: [scope, { deletedAt: null, status: 'APPOINTMENT_SET' }] },
          orderBy: { updatedAt: 'asc' }, take: 8,
          select: {
            id: true, caseNumber: true, inspectionLocation: true,
            customer: { select: { firstName: true, lastName: true, company: true, phone: true } },
            vehicle: { select: { manufacturer: true, model: true, licensePlate: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  return { newLeads, dueLeads, workCases, jobs };
}

/** Echte Kennzahlen für das Dashboard (0 bleibt 0). */
export async function dashboardCounts(user: AuthUser) {
  const scope = caseScope(user, 'read');
  const canLeads = has(user, 'leads.read');
  const dayEnd = berlinDayRange(berlinToday())!.end;
  const [newLeads, failedMail, openCases, unassigned, customers, reportsOpen, followUpsDue] = await Promise.all([
    canLeads ? db.lead.count({ where: { deletedAt: null, status: 'NEW' } }) : null,
    canLeads ? db.lead.count({ where: { deletedAt: null, notificationStatus: 'FAILED', status: { notIn: ['CONVERTED', 'SPAM', 'CLOSED'] } } }) : null,
    scope ? db.case.count({ where: { AND: [scope, { deletedAt: null, status: { notIn: [...CASE_TERMINAL] } }] } }) : null,
    scope && has(user, 'cases.read.all') ? db.case.count({ where: { deletedAt: null, assignedExpertId: null, status: { notIn: [...CASE_TERMINAL] } } }) : null,
    has(user, 'customers.read') ? db.customer.count({ where: { deletedAt: null } }) : null,
    // „Gutachten offen“: Fälle, in denen das Gutachten noch erstellt oder freigegeben werden muss
    scope ? db.case.count({ where: { AND: [scope, { deletedAt: null, status: { in: ['INSPECTED', 'DOCUMENTS_MISSING', 'IN_PROGRESS', 'REPORT_READY'] } }] } }) : null,
    canLeads ? db.lead.count({ where: { deletedAt: null, status: { notIn: ['CONVERTED', 'CLOSED', 'SPAM'] }, nextActionAt: { lt: dayEnd } } }) : null,
  ]);
  return { newLeads, failedMail, openCases, unassigned, customers, reportsOpen, followUpsDue };
}
