import 'server-only';
import { db } from '@/server/db';
import type { AuthUser } from '@/server/auth/session-types';
import { normalizeCaseStatus, type CaseStatusKey } from '@/lib/workflow';
import { loadCaseFor } from './case-access';

export type CheckState = 'done' | 'open' | 'warn' | 'na';
export type CheckItem = { key: string; label: string; state: CheckState; hint?: string; tab?: string };

const ORDER = ['NEW', 'APPOINTMENT_PENDING', 'APPOINTMENT_SET', 'INSPECTED', 'CALCULATION', 'REPORT_DRAFT', 'REVIEW', 'APPROVED', 'SENT', 'BILLING', 'CLOSED'] as const;
/** Ist der Fall mindestens beim Status `at` angekommen? (Storniert zählt nirgends.) */
const reached = (status: CaseStatusKey, at: (typeof ORDER)[number]) => {
  const n = normalizeCaseStatus(status);
  return n !== 'CANCELLED' && ORDER.indexOf(n as (typeof ORDER)[number]) >= ORDER.indexOf(at);
};

const REQUIRED_VIEWS = ['OVERVIEW', 'FRONT', 'REAR', 'LEFT', 'RIGHT'];

/**
 * Status-Checkliste, Dokumentenstatus und fehlende Unterlagen eines Falls – ausschließlich aus vorhandenen Daten abgeleitet
 * (nichts wird von Hand „abgehakt“, damit die Anzeige nie von der Wirklichkeit abweichen kann).
 */
export async function caseChecklist(user: AuthUser, caseId: string) {
  const ref = await loadCaseFor(user, caseId, 'read', { archived: true });
  const c = await db.case.findUniqueOrThrow({
    where: { id: ref.id },
    select: {
      status: true, claimType: true, insuranceOrgId: true, insuranceName: true, insuranceClaimNumber: true, lawyerOrgId: true, lawyer: true,
      documents: { where: { deletedAt: null, media: { deletedAt: null } }, select: { category: true } },
      photos: { where: { deletedAt: null, media: { deletedAt: null } }, select: { category: true } },
      inspections: { select: { status: true } },
    },
  });
  const docs = new Set(c.documents.map((d) => d.category));
  const cats = new Set(c.photos.map((p) => p.category));
  const status = c.status as CaseStatusKey;

  const missingPhotoParts: string[] = [];
  if (!REQUIRED_VIEWS.some((k) => cats.has(k as never))) missingPhotoParts.push('Gesamtansicht');
  if (!cats.has('PLATE')) missingPhotoParts.push('Kennzeichen');
  if (!cats.has('VIN')) missingPhotoParts.push('Fahrgestellnummer');
  if (!cats.has('ODOMETER')) missingPhotoParts.push('Tacho');
  if (!cats.has('DAMAGE')) missingPhotoParts.push('Schadenstelle');
  const photosDone = c.photos.length > 0 && missingPhotoParts.length === 0;

  const inspected = c.inspections.some((i) => i.status === 'FINISHED') || reached(status, 'INSPECTED');

  const items: CheckItem[] = [
    { key: 'customer', label: 'Kunde aufgenommen', state: 'done' },
    { key: 'poa', label: 'Vollmacht vorhanden', state: docs.has('POWER_OF_ATTORNEY') ? 'done' : 'open', tab: 'dokumente' },
    { key: 'registration', label: 'Fahrzeugschein vorhanden', state: docs.has('REGISTRATION') ? 'done' : 'open', tab: 'dokumente' },
    { key: 'photos', label: 'Fotos vollständig', state: photosDone ? 'done' : 'open', hint: photosDone ? undefined : c.photos.length === 0 ? 'Noch keine Fotos' : `Fehlt: ${missingPhotoParts.join(', ')}`, tab: 'fotos' },
    { key: 'inspection', label: 'Besichtigung durchgeführt', state: inspected ? 'done' : 'open', tab: 'termine' },
    { key: 'calculation', label: 'Kalkulation erstellt', state: reached(status, 'REPORT_DRAFT') ? 'done' : 'open', tab: 'kalkulation' },
    { key: 'valuation', label: 'Bewertung erstellt', state: reached(status, 'REPORT_DRAFT') ? 'done' : 'open', tab: 'bewertung' },
    { key: 'report', label: 'Gutachten fertig', state: reached(status, 'REVIEW') ? 'done' : 'open', tab: 'gutachten' },
    { key: 'reviewed', label: 'Gutachten geprüft', state: reached(status, 'APPROVED') ? 'done' : 'open', tab: 'gutachten' },
    { key: 'sent', label: 'Gutachten versendet', state: reached(status, 'SENT') ? 'done' : 'open', tab: 'gutachten' },
    { key: 'invoice', label: 'Rechnung erstellt', state: reached(status, 'BILLING') ? 'done' : 'open', tab: 'rechnung' },
    { key: 'paid', label: 'Rechnung bezahlt', state: normalizeCaseStatus(status) === 'CLOSED' ? 'done' : 'open', tab: 'rechnung' },
  ];

  const hasInsurance = Boolean(c.insuranceOrgId || c.insuranceName);
  const needsReport = c.claimType === 'LIABILITY' || c.claimType === 'COMPREHENSIVE' || c.claimType === 'PARTIAL_COMPREHENSIVE';
  const hasLawyer = Boolean(c.lawyerOrgId || c.lawyer);
  const documents: CheckItem[] = [
    { key: 'registration', label: 'Fahrzeugschein', state: docs.has('REGISTRATION') ? 'done' : 'open', tab: 'dokumente' },
    { key: 'poa', label: 'Vollmacht', state: docs.has('POWER_OF_ATTORNEY') ? 'done' : 'open', tab: 'dokumente' },
    { key: 'accident', label: 'Unfallbericht', state: docs.has('ACCIDENT_REPORT') || docs.has('POLICE_REPORT') ? 'done' : needsReport ? 'open' : 'na', tab: 'dokumente' },
    { key: 'insurance', label: 'Versicherungsdaten', state: hasInsurance && c.insuranceClaimNumber ? 'done' : hasInsurance ? 'warn' : needsReport ? 'open' : 'na', hint: hasInsurance && !c.insuranceClaimNumber ? 'Schadennummer fehlt' : undefined },
    { key: 'assignment', label: 'Mandat / Abtretung', state: docs.has('ASSIGNMENT') || docs.has('ASSIGNMENT_OF_CLAIM') ? 'done' : hasLawyer ? 'warn' : 'na', hint: hasLawyer && !(docs.has('ASSIGNMENT') || docs.has('ASSIGNMENT_OF_CLAIM')) ? 'prüfen' : undefined, tab: 'dokumente' },
  ];
  const missing = documents.filter((d) => d.state === 'open' || d.state === 'warn');
  const done = items.filter((i) => i.state === 'done').length;
  return { items, documents, missing, progress: { done, total: items.length, pct: Math.round((done / items.length) * 100) } };
}
