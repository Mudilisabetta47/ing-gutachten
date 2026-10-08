import 'server-only';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { DomainError, notFoundError } from '@/server/errors';
import { getSetting } from '@/server/settings';
import { getStorage } from '@/server/storage';
import { fmtEuro } from '@/lib/money';
import { KIND_LABELS, LABOR_LABELS, lineTotal, minutesToAw, type CalcHeader, type CalcKind, type LaborCategory } from '@/lib/calc';
import { KIND_META, SEVERITY_LABELS, partLabel, type DamageKindKey, type SeverityKey } from '@/lib/vehicle-model';
import { IS_MONEY, TAX_LABELS, TYPE_LABELS, sourceName, usageLossTotal, type ValuationTypeKey } from '@/lib/valuation';
import { FUEL_LABELS, fmtPower } from '@/lib/vehicle-data';
import { defaultContent, normalizeContent, resolveText, validateReport, AUTO_LABELS, type Issue, type ReportContent, type ReportData, type Vars } from '@/lib/report';
import { ReportPdf, pdfSafe, type PdfImageInput } from '@/server/reports/pdf';
import { has } from './access';
import { canOnCase, loadCaseFor } from './case-access';
import { listCalculations } from './calculations';
import { caseValuation } from './valuation';
import { systemCaseStatus } from './cases';
import { putMedia } from './media';

/* ------------------------------------------------------------ Zugriff */

type CaseLite = { id: string; assignedExpertId: string | null };
async function readCase(user: AuthUser, caseId: string): Promise<CaseLite> {
  const c = await loadCaseFor(user, caseId, 'read');
  if (!canOnCase(user, 'reports', 'read', c)) throw new ForbiddenError();
  return c;
}
async function writeCase(user: AuthUser, caseId: string): Promise<CaseLite> {
  const c = await loadCaseFor(user, caseId, 'write');
  if (!canOnCase(user, 'reports', 'write', c)) throw new ForbiddenError();
  return c;
}
async function reportFor(user: AuthUser, id: string) {
  const r = await db.report.findUnique({ where: { id } });
  if (!r) throw notFoundError('Gutachten');
  const c = await readCase(user, r.caseId);
  return { r, c };
}

/* ------------------------------------------------------------ Datenstand (Snapshot) */

export type Snapshot = {
  takenAt: string;
  vars: Vars;
  counts: ReportData['counts'];
  vehicle: [string, string][];
  damages: { component: string; kind: string; damageType: string | null; severity: string | null; repairKind: string | null; description: string | null; priorNote: string | null }[];
  calc: null | {
    version: number; status: string; head: CalcHeader;
    items: { kind: CalcKind; description: string; laborCategory: LaborCategory | null; quantityX100: number; minutes: number; unitPriceCents: number; discountBp: number; totalCents: number }[];
    totals: { parts: number; partsMarkup: number; labor: number; paintLabor: number; paintMaterial: number; misc: number; net: number; vat: number; gross: number; minutes: number };
  };
  valuation: { label: string; value: string; detail: string }[];
  photos: { mediaId: string; caption: string; category: string }[];
};

const d10 = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10).split('-').reverse().join('.') : null);
const berlinDate = (d: Date) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: 'Europe/Berlin' }).format(d);

/** Stellt den aktuellen Stand der Falldaten zusammen (wird bei Einreichung/Freigabe eingefroren). */
export async function buildSnapshot(user: AuthUser, caseId: string, number: string): Promise<Snapshot> {
  const c = await db.case.findUniqueOrThrow({
    where: { id: caseId },
    include: {
      customer: true, vehicle: { include: { hsnTsnRecord: false } }, assignedExpert: { select: { firstName: true, lastName: true } }, insuranceOrg: { select: { name: true } },
      appointments: { where: { kind: 'INSPECTION', status: { in: ['PLANNED', 'CONFIRMED', 'DONE'] } }, orderBy: { startsAt: 'desc' }, take: 1 },
      inspections: { orderBy: { startedAt: 'desc' }, take: 1 },
    },
  });
  const [damagesRaw, photosRaw, calcs, val] = await Promise.all([
    db.damage.findMany({ where: { caseId, deletedAt: null }, orderBy: { sortOrder: 'asc' } }),
    db.casePhoto.findMany({ where: { caseId, deletedAt: null, media: { deletedAt: null } }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { mediaId: true, category: true, title: true, damage: { select: { component: true } } }, take: 60 }),
    has(user, 'calculations.read.all') || has(user, 'calculations.read.own') ? listCalculations(user, caseId).catch(() => []) : Promise.resolve([]),
    has(user, 'valuations.read.all') || has(user, 'valuations.read.own') ? caseValuation(user, caseId).catch(() => null) : Promise.resolve(null),
  ]);
  const v = c.vehicle;
  const cust = c.customer;
  const custName = cust.company || `${cust.firstName} ${cust.lastName}`.trim();
  const calc = calcs.filter((k) => k.status === 'FINAL').at(-1) ?? calcs.at(-1) ?? null;
  const sel = val?.selected;
  const appt = c.appointments[0];
  const insp = c.inspections[0];
  const usage = usageLossTotal(sel?.REPAIR_DURATION?.days ?? null, sel?.USAGE_LOSS?.amountCents ?? null);
  const money = (e: { amountCents: number | null; taxMode: 'GROSS' | 'NET' | 'NONE' } | null | undefined) => (e?.amountCents != null ? `${fmtEuro(e.amountCents)} (${TAX_LABELS[e.taxMode]})` : null);
  const days = (e: { days: number | null } | null | undefined) => (e?.days != null ? `${e.days} ${e.days === 1 ? 'Tag' : 'Tage'}` : null);
  const vars: Vars = {
    'gutachten.nummer': number, 'gutachten.datum': berlinDate(new Date()), heute: berlinDate(new Date()),
    'fall.nummer': c.caseNumber, 'fall.schadendatum': d10(c.damageDate), 'fall.unfalldatum': d10(c.accidentDate), 'fall.beschreibung': c.description?.trim() || null,
    schadennummer: c.insuranceClaimNumber, 'versicherung.name': c.insuranceOrg?.name ?? c.insuranceName,
    'kunde.name': custName || null, 'kunde.anschrift': [cust.street, [cust.postalCode, cust.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null,
    'fahrzeug.hersteller': v.manufacturer, 'fahrzeug.modell': [v.model, v.variant].filter(Boolean).join(' '), 'fahrzeug.typ': `${v.manufacturer} ${v.model}${v.variant ? ` ${v.variant}` : ''}`,
    'fahrzeug.kennzeichen': v.licensePlate, 'fahrzeug.fin': v.vin, 'fahrzeug.erstzulassung': d10(v.firstRegistration), 'fahrzeug.km': v.mileage != null ? `${v.mileage.toLocaleString('de-DE')} km` : insp?.odometer != null ? `${insp.odometer.toLocaleString('de-DE')} km` : null,
    'fahrzeug.hsn_tsn': v.hsn && v.tsn ? `${v.hsn} / ${v.tsn}` : null, 'fahrzeug.leistung': fmtPower(v.powerKw, v.powerHp),
    'gutachter.name': c.assignedExpert ? `${c.assignedExpert.firstName} ${c.assignedExpert.lastName}` : null,
    'besichtigung.datum': appt ? berlinDate(appt.startsAt) : insp ? berlinDate(insp.startedAt) : null, 'besichtigung.ort': appt?.location || c.inspectionLocation,
    'kalkulation.netto': calc ? fmtEuro(calc.totals.net) : null, 'kalkulation.brutto': calc ? fmtEuro(calc.totals.gross) : null, 'kalkulation.version': calc ? `V${calc.version}${calc.status === 'DRAFT' ? ' (Entwurf)' : ''}` : null,
    'bewertung.wbw': money(sel?.REPLACEMENT_VALUE), 'bewertung.restwert': money(sel?.RESIDUAL_VALUE), 'bewertung.wertminderung': money(sel?.DIMINISHED_VALUE),
    'bewertung.nutzungsausfall': usage != null ? `${fmtEuro(usage)} (${sel?.REPAIR_DURATION?.days} Tage × ${fmtEuro(sel?.USAGE_LOSS?.amountCents)})` : null,
    'bewertung.reparaturdauer': days(sel?.REPAIR_DURATION), 'bewertung.wiederbeschaffungsdauer': days(sel?.REPLACEMENT_DURATION),
  };
  const vehicle: [string, string][] = ([
    ['Hersteller / Modell', `${v.manufacturer} ${v.model}${v.variant ? ` ${v.variant}` : ''}`], ['Kennzeichen', v.licensePlate], ['Fahrgestellnummer (FIN)', v.vin], ['HSN / TSN', v.hsn && v.tsn ? `${v.hsn} / ${v.tsn}` : null],
    ['Erstzulassung', d10(v.firstRegistration)], ['Kilometerstand', vars['fahrzeug.km']], ['Leistung', vars['fahrzeug.leistung']], ['Hubraum', v.displacementCc ? `${v.displacementCc.toLocaleString('de-DE')} cm³` : null],
    ['Kraftstoff', v.fuelType ? FUEL_LABELS[v.fuelType as keyof typeof FUEL_LABELS] : null], ['Motor', v.engineName], ['Karosserie', v.bodyStyle], ['Getriebe', v.transmission], ['Farbe', v.color],
  ] as [string, string | null][]).filter(([, x]) => x).map(([a, b]) => [a, b as string]);

  const snapDamages = damagesRaw.map((d) => ({ component: d.partId ? partLabel(d.partId) ?? d.component : d.component, kind: KIND_META[d.kind as DamageKindKey].label, damageType: d.damageType, severity: d.severity ? SEVERITY_LABELS[d.severity as SeverityKey] : null, repairKind: d.repairKind, description: d.description, priorNote: d.priorNote }));
  const valuation: Snapshot['valuation'] = [];
  const add = (t: ValuationTypeKey, e: { amountCents: number | null; days: number | null; taxMode: 'GROSS' | 'NET' | 'NONE'; source: string; referenceDate: string | null; label: string | null; note: string | null } | null | undefined) => {
    if (!e) return;
    valuation.push({ label: TYPE_LABELS[t], value: IS_MONEY[t] ? fmtEuro(e.amountCents) + (t === 'USAGE_LOSS' ? ' pro Tag' : '') : `${e.days} Tage`, detail: [IS_MONEY[t] ? TAX_LABELS[e.taxMode] : null, e.label, sourceName(e.source), e.referenceDate ? `Stand ${e.referenceDate.split('-').reverse().join('.')}` : null, e.note].filter(Boolean).join(' · ') });
  };
  for (const t of ['REPLACEMENT_VALUE', 'RESIDUAL_VALUE', 'DIMINISHED_VALUE', 'USAGE_LOSS', 'REPAIR_DURATION', 'REPLACEMENT_DURATION'] as const) add(t, sel?.[t]);
  if (usage != null) valuation.push({ label: 'Nutzungsausfall gesamt', value: fmtEuro(usage), detail: `${sel?.REPAIR_DURATION?.days} Tage × ${fmtEuro(sel?.USAGE_LOSS?.amountCents)}` });

  return {
    takenAt: new Date().toISOString(), vars, vehicle, damages: snapDamages, valuation,
    counts: { damages: snapDamages.length, photos: photosRaw.length, calcItems: calc?.items.length ?? 0, hasCalc: Boolean(calc), hasWbw: sel?.REPLACEMENT_VALUE?.amountCents != null, hasVin: Boolean(v.vin) },
    calc: calc ? {
      version: calc.version, status: calc.status, head: calc.head,
      items: calc.items.map((i) => ({ kind: i.kind, description: i.description, laborCategory: i.laborCategory ?? null, quantityX100: i.quantityX100, minutes: i.minutes, unitPriceCents: i.unitPriceCents, discountBp: i.discountBp, totalCents: lineTotal(i, calc.head.rates) })),
      totals: { parts: calc.totals.parts, partsMarkup: calc.totals.partsMarkup, labor: calc.totals.labor, paintLabor: calc.totals.paintLabor, paintMaterial: calc.totals.paintMaterial, misc: calc.totals.misc, net: calc.totals.net, vat: calc.totals.vat, gross: calc.totals.gross, minutes: calc.totals.minutes },
    } : null,
    photos: photosRaw.map((p, i) => ({ mediaId: p.mediaId, category: p.category, caption: `Foto ${i + 1}: ${p.title || p.damage?.component || p.category}` })),
  };
}

/* ------------------------------------------------------------ Lesen */

export type ReportListQuery = { status?: string; q?: string; page?: number; limit?: number };
export async function listReports(user: AuthUser, query: ReportListQuery = {}) {
  const all = has(user, 'reports.read.all');
  if (!all && !has(user, 'reports.read.own')) throw new ForbiddenError();
  const page = Math.max(1, query.page ?? 1), size = Math.min(query.limit ?? 25, 100);
  const where: Prisma.ReportWhereInput = {
    case: { deletedAt: null, ...(all ? {} : { assignedExpertId: user.id }) },
    ...(query.status ? { status: query.status as 'DRAFT' } : {}),
    ...(query.q?.trim() ? { OR: [{ number: { contains: query.q.trim(), mode: 'insensitive' } }, { case: { caseNumber: { contains: query.q.trim(), mode: 'insensitive' } } }, { case: { customer: { lastName: { contains: query.q.trim(), mode: 'insensitive' } } } }] } : {}),
  };
  const [rows, total, counts] = await Promise.all([
    db.report.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * size, take: size, select: { id: true, number: true, status: true, revision: true, updatedAt: true, submittedAt: true, approvedAt: true, sentAt: true, case: { select: { caseNumber: true, customer: { select: { firstName: true, lastName: true, company: true } }, vehicle: { select: { manufacturer: true, model: true, licensePlate: true } }, assignedExpert: { select: { firstName: true, lastName: true } } } } } }),
    db.report.count({ where }),
    db.report.groupBy({ by: ['status'], where: { case: { deletedAt: null, ...(all ? {} : { assignedExpertId: user.id }) } }, _count: true }),
  ]);
  return { rows, total, page, pageSize: size, counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) as Record<string, number> };
}

export async function caseReports(user: AuthUser, caseId: string) {
  await readCase(user, caseId);
  return db.report.findMany({ where: { caseId }, orderBy: { createdAt: 'asc' }, select: { id: true, number: true, status: true, revision: true, updatedAt: true } });
}

export type ReportView = Awaited<ReturnType<typeof getReport>>;

/** Vollständiges Gutachten mit Inhalt, Prüfhinweisen, Kommentaren und Verlauf. Entwürfe zeigen den Live-Stand, eingereichte/freigegebene den eingefrorenen. */
export async function getReport(user: AuthUser, id: string) {
  const { r, c } = await reportFor(user, id);
  const content = normalizeContent(r.content);
  const frozen = r.status === 'IN_REVIEW' || r.status === 'APPROVED' || r.status === 'SENT';
  const latest = frozen ? await db.reportVersion.findFirst({ where: { reportId: id }, orderBy: { createdAt: 'desc' } }) : null;
  const snap = (latest?.data as unknown as Snapshot | undefined) ?? (await buildSnapshot(user, r.caseId, r.number));
  const live = frozen ? await buildSnapshot(user, r.caseId, r.number) : snap;
  const issues: Issue[] = validateReport(content, snap);
  const [comments, versions, users] = await Promise.all([
    db.reportComment.findMany({ where: { reportId: id }, orderBy: { createdAt: 'asc' } }),
    db.reportVersion.findMany({ where: { reportId: id }, orderBy: { createdAt: 'desc' }, select: { id: true, revision: true, kind: true, note: true, createdAt: true, createdById: true, documentId: true } }),
    db.user.findMany({ where: { id: { in: [r.authorId, r.reviewerId, r.approvedById, r.sentById].filter(Boolean) as string[] } }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  const people = await db.user.findMany({ where: { id: { in: [...new Set([...comments.map((x) => x.authorId), ...versions.map((x) => x.createdById)].filter(Boolean) as string[])] } }, select: { id: true, firstName: true, lastName: true } });
  const name = new Map([...users, ...people].map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  const changedSinceSnapshot = frozen && JSON.stringify(live.vars) !== JSON.stringify(snap.vars) ? Object.keys(live.vars).filter((k) => live.vars[k] !== snap.vars[k] && !['heute', 'gutachten.datum'].includes(k)) : [];
  return {
    report: { ...r, content }, content, snapshot: snap, issues, changedSinceSnapshot,
    comments: comments.map((x) => ({ ...x, author: x.authorId ? name.get(x.authorId) ?? null : null })),
    versions: versions.map((v) => ({ ...v, by: v.createdById ? name.get(v.createdById) ?? null : null })),
    people: { author: r.authorId ? name.get(r.authorId) ?? null : null, approver: r.approvedById ? name.get(r.approvedById) ?? null : null, sentBy: r.sentById ? name.get(r.sentById) ?? null : null },
    can: {
      write: canOnCase(user, 'reports', 'write', c) && (r.status === 'DRAFT' || r.status === 'CHANGES_REQUESTED'),
      writeAny: canOnCase(user, 'reports', 'write', c),
      review: has(user, 'reports.review') && r.status === 'IN_REVIEW',
      approve: has(user, 'reports.approve') && r.status === 'IN_REVIEW' && (r.authorId !== user.id || user.role === 'OWNER'),
      selfApproveBlocked: has(user, 'reports.approve') && r.status === 'IN_REVIEW' && r.authorId === user.id && user.role !== 'OWNER',
      send: has(user, 'reports.send') && r.status === 'APPROVED',
      comment: has(user, 'reports.review') || canOnCase(user, 'reports', 'write', c),
    },
  };
}

/* ------------------------------------------------------------ Schreiben */

export async function createReport(user: AuthUser, caseId: string) {
  await writeCase(user, caseId);
  return db.$transaction(async (tx) => {
    const open = await tx.report.findFirst({ where: { caseId, status: { not: 'SENT' } }, select: { number: true } });
    if (open) throw new DomainError(`Zu diesem Fall gibt es bereits ein Gutachten in Arbeit (${open.number}).`, 'conflict');
    const { reportPrefix, reportDigits } = await getSetting('numbering', tx);
    const year = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric' }).format(new Date()));
    const rows = await tx.$queryRaw<{ last_value: number }[]>`INSERT INTO report_counters (year, last_value, updated_at) VALUES (${year}, 1, now()) ON CONFLICT (year) DO UPDATE SET last_value = report_counters.last_value + 1, updated_at = now() RETURNING last_value`;
    const number = `${reportPrefix}-${year}-${String(Number(rows[0].last_value)).padStart(reportDigits, '0')}`;
    const rep = await tx.report.create({ data: { caseId, number, authorId: user.id, content: defaultContent() as unknown as Prisma.InputJsonValue } });
    await writeAudit({ actorId: user.id, action: 'report.create', entityType: 'Case', entityId: caseId, summary: `Gutachten ${number} angelegt`, after: { reportId: rep.id, number } }, tx);
    return rep;
  });
}

const contentSchema = z.object({
  title: z.string().trim().max(160).nullable().optional().transform((v) => v || null),
  content: z.unknown(),
});

/** Autosave des Entwurfs. `counter` = zuletzt bekannter saveCounter; ein anderer Stand wird abgewiesen (zwei Fenster überschreiben sich nicht). */
export async function saveReport(user: AuthUser, id: string, raw: unknown, counter?: number) {
  const { r, c } = await reportFor(user, id);
  if (!canOnCase(user, 'reports', 'write', c)) throw new ForbiddenError();
  if (r.status !== 'DRAFT' && r.status !== 'CHANGES_REQUESTED') throw new DomainError('Dieses Gutachten ist in Prüfung bzw. freigegeben und kann nicht bearbeitet werden.', 'conflict');
  const input = contentSchema.parse(raw);
  const content = normalizeContent(input.content);
  const res = await db.report.updateMany({ where: { id, saveCounter: counter ?? r.saveCounter, status: { in: ['DRAFT', 'CHANGES_REQUESTED'] } }, data: { content: content as unknown as Prisma.InputJsonValue, title: input.title, saveCounter: { increment: 1 } } });
  if (res.count !== 1) throw new DomainError('Das Gutachten wurde zwischenzeitlich geändert (anderes Fenster oder anderer Benutzer). Bitte die Seite neu laden.', 'conflict');
  return { saveCounter: (counter ?? r.saveCounter) + 1 };
}

export async function submitReport(user: AuthUser, id: string) {
  const { r, c } = await reportFor(user, id);
  if (!canOnCase(user, 'reports', 'write', c)) throw new ForbiddenError();
  if (r.status !== 'DRAFT' && r.status !== 'CHANGES_REQUESTED') throw new DomainError('Dieses Gutachten kann nicht (erneut) eingereicht werden.', 'conflict');
  const content = normalizeContent(r.content);
  const snap = await buildSnapshot(user, r.caseId, r.number);
  const errors = validateReport(content, snap).filter((i) => i.level === 'error');
  if (errors.length) throw new DomainError(`Bitte zuerst die offenen Punkte beheben: ${errors.slice(0, 3).map((e) => e.text).join(' ')}${errors.length > 3 ? ` (und ${errors.length - 3} weitere)` : ''}`);
  return db.$transaction(async (tx) => {
    const res = await tx.report.updateMany({ where: { id, status: r.status }, data: { status: 'IN_REVIEW', submittedAt: new Date(), reviewerId: null } });
    if (res.count !== 1) throw new DomainError('Das Gutachten wurde gerade geändert. Bitte neu laden.', 'conflict');
    await tx.reportVersion.create({ data: { reportId: id, revision: r.revision, kind: 'SUBMIT', content: content as unknown as Prisma.InputJsonValue, data: snap as unknown as Prisma.InputJsonValue, createdById: user.id } });
    const moved = await systemCaseStatus(tx, user.id, r.caseId, 'REVIEW', `Gutachten ${r.number} zur Prüfung eingereicht`);
    await writeAudit({ actorId: user.id, action: 'report.submit', entityType: 'Case', entityId: r.caseId, summary: `Gutachten ${r.number} (Fassung ${r.revision}) zur Prüfung eingereicht`, after: { reportId: id, revision: r.revision, caseStatusMoved: moved } }, tx);
    return { caseStatusMoved: moved };
  });
}

export async function addComment(user: AuthUser, id: string, input: { chapterKey?: string | null; body: string }) {
  const { r, c } = await reportFor(user, id);
  if (!has(user, 'reports.review') && !canOnCase(user, 'reports', 'write', c)) throw new ForbiddenError();
  const body = input.body?.trim();
  if (!body) throw new DomainError('Bitte einen Kommentar eingeben.');
  if (body.length > 2000) throw new DomainError('Der Kommentar ist zu lang (max. 2000 Zeichen).');
  const content = normalizeContent(r.content);
  const chapterKey = input.chapterKey && content.chapters.some((x) => x.key === input.chapterKey) ? input.chapterKey : null;
  return db.$transaction(async (tx) => {
    const cm = await tx.reportComment.create({ data: { reportId: id, chapterKey, body, revision: r.revision, authorId: user.id } });
    await writeAudit({ actorId: user.id, action: 'report.comment', entityType: 'Case', entityId: r.caseId, summary: `Kommentar zu Gutachten ${r.number}`, after: { commentId: cm.id, chapterKey } }, tx);
    return cm;
  });
}

export async function resolveComment(user: AuthUser, commentId: string, resolved: boolean) {
  const cm = await db.reportComment.findUnique({ where: { id: commentId }, include: { report: true } });
  if (!cm) throw notFoundError('Kommentar');
  const c = await readCase(user, cm.report.caseId);
  if (!has(user, 'reports.review') && !canOnCase(user, 'reports', 'write', c)) throw new ForbiddenError();
  await db.reportComment.update({ where: { id: commentId }, data: { resolvedAt: resolved ? new Date() : null, resolvedById: resolved ? user.id : null } });
}

/** Prüfer fordert Änderungen an – mindestens ein offener Kommentar oder eine Begründung ist nötig. */
export async function requestChanges(user: AuthUser, id: string, note?: string | null) {
  const { r } = await reportFor(user, id);
  if (!has(user, 'reports.review')) throw new ForbiddenError();
  if (r.status !== 'IN_REVIEW') throw new DomainError('Das Gutachten ist nicht in Prüfung.', 'conflict');
  const open = await db.reportComment.count({ where: { reportId: id, resolvedAt: null } });
  const why = note?.trim();
  if (!open && !why) throw new DomainError('Bitte einen Kommentar oder eine Begründung für die gewünschten Änderungen angeben.');
  return db.$transaction(async (tx) => {
    if (why) await tx.reportComment.create({ data: { reportId: id, body: why, revision: r.revision, authorId: user.id } });
    await tx.report.update({ where: { id }, data: { status: 'CHANGES_REQUESTED', revision: { increment: 1 }, reviewerId: user.id } });
    await systemCaseStatus(tx, user.id, r.caseId, 'REPORT_DRAFT', `Änderungen an Gutachten ${r.number} angefordert`);
    await writeAudit({ actorId: user.id, action: 'report.changes_requested', entityType: 'Case', entityId: r.caseId, summary: `Änderungen am Gutachten ${r.number} angefordert`, after: { reportId: id } }, tx);
  });
}

export async function approveReport(user: AuthUser, id: string) {
  const { r } = await reportFor(user, id);
  if (!has(user, 'reports.approve')) throw new ForbiddenError();
  if (r.status !== 'IN_REVIEW') throw new DomainError('Das Gutachten ist nicht in Prüfung.', 'conflict');
  if (r.authorId === user.id && user.role !== 'OWNER') throw new DomainError('Vier-Augen-Prinzip: Ein Gutachten darf nicht vom Verfasser selbst freigegeben werden.', 'forbidden');
  const open = await db.reportComment.count({ where: { reportId: id, resolvedAt: null } });
  const version = await db.reportVersion.findFirst({ where: { reportId: id, kind: 'SUBMIT' }, orderBy: { createdAt: 'desc' } });
  if (!version) throw new DomainError('Es liegt kein eingereichter Stand vor.');
  // PDF aus dem eingefrorenen Stand erzeugen und als Dokument im Fall ablegen
  const bytes = await renderPdf({ number: r.number, caseNumber: (await db.case.findUniqueOrThrow({ where: { id: r.caseId }, select: { caseNumber: true } })).caseNumber, title: r.title, content: normalizeContent(version.content), snap: version.data as unknown as Snapshot, draft: false });
  // Das Ablegen gehört zur Freigabe (Recht reports.approve) – unabhängig davon, ob der Prüfer sonst Dokumente hochladen darf.
  const media = await putMedia(user.id, { bytes }, 'document');
  const caseRow = await db.case.findUniqueOrThrow({ where: { id: r.caseId }, select: { customerId: true } });
  return db.$transaction(async (tx) => {
    const doc = await tx.document.create({ data: { mediaId: media.id, caseId: r.caseId, customerId: caseRow.customerId, category: 'REPORT', title: `Gutachten ${r.number} (Fassung ${r.revision})`, createdById: user.id } });
    await tx.report.update({ where: { id }, data: { status: 'APPROVED', approvedAt: new Date(), approvedById: user.id, reviewerId: user.id } });
    await tx.reportVersion.create({ data: { reportId: id, revision: r.revision, kind: 'APPROVED', content: version.content as Prisma.InputJsonValue, data: version.data as Prisma.InputJsonValue, documentId: doc.id, createdById: user.id, note: open ? `${open} Kommentar(e) noch offen bei Freigabe` : null } });
    await systemCaseStatus(tx, user.id, r.caseId, 'APPROVED', `Gutachten ${r.number} freigegeben`);
    await writeAudit({ actorId: user.id, action: 'report.approve', entityType: 'Case', entityId: r.caseId, summary: `Gutachten ${r.number} freigegeben${r.authorId === user.id ? ' (Selbstfreigabe durch Inhaber)' : ''}`, after: { reportId: id, documentId: doc.id } }, tx);
    return { documentId: doc.id, mediaId: doc.mediaId };
  });
}

const sendSchema = z.object({ to: z.string().trim().min(2, 'Bitte den Empfänger angeben.').max(200), channel: z.enum(['EMAIL', 'POST', 'PORTAL', 'PERSONAL', 'OTHER']), note: z.string().trim().max(500).optional().nullable().transform((v) => v || null) });
export const SEND_CHANNELS: Record<string, string> = { EMAIL: 'E-Mail', POST: 'Post', PORTAL: 'Portal', PERSONAL: 'Persönlich', OTHER: 'Sonstiges' };

/** Erfasst den Versand. Das System versendet hier NICHTS selbst – der Versand erfolgt außerhalb und wird dokumentiert. */
export async function markSent(user: AuthUser, id: string, raw: unknown) {
  const { r } = await reportFor(user, id);
  if (!has(user, 'reports.send')) throw new ForbiddenError();
  if (r.status !== 'APPROVED') throw new DomainError('Nur freigegebene Gutachten können als versendet erfasst werden.', 'conflict');
  const d = sendSchema.parse(raw);
  return db.$transaction(async (tx) => {
    await tx.report.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), sentById: user.id, sentTo: d.to, sentChannel: d.channel, sentNote: d.note } });
    await systemCaseStatus(tx, user.id, r.caseId, 'SENT', `Gutachten ${r.number} versendet (${SEND_CHANNELS[d.channel]})`);
    await writeAudit({ actorId: user.id, action: 'report.sent', entityType: 'Case', entityId: r.caseId, summary: `Gutachten ${r.number} versendet an ${d.to} (${SEND_CHANNELS[d.channel]})`, after: { reportId: id, channel: d.channel } }, tx);
  });
}

/** Freigegebenes/versendetes Gutachten zur Überarbeitung wieder öffnen – die bisherigen PDFs bleiben erhalten. */
export async function reopenReport(user: AuthUser, id: string, reason: string) {
  const { r, c } = await reportFor(user, id);
  if (!canOnCase(user, 'reports', 'write', c) && !has(user, 'reports.approve')) throw new ForbiddenError();
  if (r.status !== 'APPROVED' && r.status !== 'SENT') throw new DomainError('Nur freigegebene oder versendete Gutachten können wieder geöffnet werden.', 'conflict');
  if (!reason?.trim()) throw new DomainError('Bitte eine Begründung angeben.');
  return db.$transaction(async (tx) => {
    await tx.report.update({ where: { id }, data: { status: 'DRAFT', revision: { increment: 1 }, approvedAt: null, approvedById: null, sentAt: null, sentById: null, sentTo: null, sentChannel: null, sentNote: null } });
    await tx.reportComment.create({ data: { reportId: id, body: `Zur Überarbeitung geöffnet: ${reason.trim().slice(0, 500)}`, revision: r.revision + 1, authorId: user.id } });
    await systemCaseStatus(tx, user.id, r.caseId, 'REPORT_DRAFT', `Gutachten ${r.number} zur Überarbeitung geöffnet`);
    await writeAudit({ actorId: user.id, action: 'report.reopen', entityType: 'Case', entityId: r.caseId, summary: `Gutachten ${r.number} zur Überarbeitung geöffnet`, after: { reportId: id, reason: reason.trim().slice(0, 200) } }, tx);
  });
}

/* ------------------------------------------------------------ PDF */

export async function renderPdf(a: { number: string; caseNumber: string; title: string | null; content: ReportContent; snap: Snapshot; draft: boolean }): Promise<Uint8Array> {
  const company = await getSetting('company');
  const pdf = await ReportPdf.create({
    number: a.number, caseNumber: a.caseNumber, draft: a.draft, title: a.title || `Gutachten ${a.number}`,
    company: { name: company.name, lines: [], footer: [company.street, [company.postalCode, company.city].filter(Boolean).join(' '), company.phone, company.email, company.footer].filter(Boolean).join(', ') },
  });
  const v = a.snap.vars;
  pdf.title(a.title || 'Kraftfahrzeug-Gutachten', `Nr. ${a.number} · Fall ${a.caseNumber} · ${v['fahrzeug.typ'] ?? ''} ${v['fahrzeug.kennzeichen'] ? `· ${v['fahrzeug.kennzeichen']}` : ''}`);
  const storage = getStorage();
  for (const ch of a.content.chapters.filter((x) => x.enabled)) {
    pdf.heading(ch.title);
    const text = resolveText(ch.text, a.snap.vars).text;
    if (text.trim()) pdf.paragraph(text);
    if (ch.auto === 'vehicle') pdf.keyValues(a.snap.vehicle);
    if (ch.auto === 'damages') {
      if (!a.snap.damages.length) pdf.paragraph('Es wurden keine Schäden erfasst.', { color: undefined });
      else pdf.table([{ w: 150 }, { w: 82 }, { w: 80 }, { w: 55 }, { w: 80 }, { w: 130 }], ['Bauteil', 'Zustand', 'Schadenart', 'Schwere', 'Maßnahme', 'Hinweis'], a.snap.damages.map((d) => [d.component, d.kind, d.damageType ?? '', d.severity ?? '', d.repairKind ?? '', [d.description, d.priorNote].filter(Boolean).join(' – ')]));
    }
    if (ch.auto === 'calculation') {
      const k = a.snap.calc;
      if (!k) pdf.paragraph('Es liegt keine Kalkulation vor.');
      else {
        pdf.paragraph(`Kalkulation Version ${k.version}${k.status === 'DRAFT' ? ' (Entwurf)' : ''} · Stundensätze: Karosserie ${k.head.rates.body != null ? fmtEuro(k.head.rates.body) : '-'}, Mechanik ${k.head.rates.mechanic != null ? fmtEuro(k.head.rates.mechanic) : '-'}, Elektrik ${k.head.rates.electric != null ? fmtEuro(k.head.rates.electric) : '-'}, Lack ${k.head.rates.paint != null ? fmtEuro(k.head.rates.paint) : '-'} · 1 AW = ${k.head.minutesPerAw} Min.`, { size: 8.5, color: undefined });
        const rows = k.items.map((i, n) => [String(n + 1), `${i.description}${i.kind === 'LABOR' && i.laborCategory ? ` (${LABOR_LABELS[i.laborCategory]})` : ''}`, KIND_LABELS[i.kind], i.kind === 'LABOR' || i.kind === 'PAINT' ? `${(minutesToAw(i.minutes, k.head.minutesPerAw)).toLocaleString('de-DE', { maximumFractionDigits: 1 })} AW` : (i.quantityX100 / 100).toLocaleString('de-DE'), i.kind === 'LABOR' || i.kind === 'PAINT' ? '' : fmtEuro(i.unitPriceCents), fmtEuro(i.totalCents)]);
        const tot: string[][] = [['', 'Ersatzteile', '', '', '', fmtEuro(k.totals.parts)]];
        if (k.totals.partsMarkup) tot.push(['', 'Teile-Aufschlag', '', '', '', fmtEuro(k.totals.partsMarkup)]);
        tot.push(['', 'Arbeitslohn', '', '', '', fmtEuro(k.totals.labor)], ['', 'Lackierarbeit', '', '', '', fmtEuro(k.totals.paintLabor)]);
        if (k.totals.paintMaterial) tot.push(['', 'Lackmaterial', '', '', '', fmtEuro(k.totals.paintMaterial)]);
        if (k.totals.misc) tot.push(['', 'Nebenkosten', '', '', '', fmtEuro(k.totals.misc)]);
        tot.push(['', 'Netto', '', '', '', fmtEuro(k.totals.net)], ['', `MwSt ${(k.head.vatBp / 100).toLocaleString('de-DE')} %`, '', '', '', fmtEuro(k.totals.vat)], ['', 'Brutto', '', '', '', fmtEuro(k.totals.gross)]);
        pdf.table([{ w: 30 }, { w: 180 }, { w: 78 }, { w: 70, align: 'r' }, { w: 70, align: 'r' }, { w: 75, align: 'r' }], ['Nr.', 'Bezeichnung', 'Art', 'Menge / Zeit', 'Einzelpreis', 'Summe'], rows, { totals: tot });
      }
    }
    if (ch.auto === 'valuation') {
      if (!a.snap.valuation.length) pdf.paragraph('Es wurden keine Bewertungswerte erfasst.');
      else pdf.table([{ w: 130 }, { w: 100, align: 'r' }, { w: 250 }], ['Wert', 'Betrag / Dauer', 'Grundlage'], a.snap.valuation.map((x) => [x.label, x.value, x.detail]));
    }
    if (ch.auto === 'photos') {
      if (!a.snap.photos.length) pdf.paragraph('Es wurden keine Fotos erfasst.');
      else {
        const metas = await db.media.findMany({ where: { id: { in: a.snap.photos.map((p) => p.mediaId) } }, select: { id: true, storageKey: true, thumbKey: true, mimeType: true } });
        const by = new Map(metas.map((m) => [m.id, m]));
        const items: PdfImageInput[] = [];
        for (const p of a.snap.photos) {
          const m = by.get(p.mediaId);
          let bytes: Uint8Array | null = null;
          let mime: 'image/jpeg' | 'image/png' = 'image/jpeg';
          if (m && storage) {
            if (m.thumbKey) bytes = await storage.get(m.thumbKey).catch(() => null);
            if (!bytes && (m.mimeType === 'image/jpeg' || m.mimeType === 'image/png')) { bytes = await storage.get(m.storageKey).catch(() => null); mime = m.mimeType as typeof mime; }
          }
          items.push(bytes ? { bytes, mime, caption: p.caption } : { bytes: null, caption: p.caption });
        }
        await pdf.images(items);
      }
    }
  }
  pdf.spacer(18);
  pdf.paragraph(pdfSafe(`Erstellt am ${v['gutachten.datum'] ?? ''} · ${v['gutachter.name'] ?? ''}`), { size: 9, color: undefined });
  return pdf.finish();
}

/** PDF für die Anzeige: Entwürfe live (mit Wasserzeichen), eingereichte aus dem eingefrorenen Stand, freigegebene = das abgelegte Dokument. */
export async function reportPdf(user: AuthUser, id: string): Promise<{ bytes: Uint8Array; fileName: string }> {
  const { r } = await reportFor(user, id);
  const c = await db.case.findUniqueOrThrow({ where: { id: r.caseId }, select: { caseNumber: true } });
  const fileName = `${r.number}.pdf`;
  if (r.status === 'APPROVED' || r.status === 'SENT') {
    const v = await db.reportVersion.findFirst({ where: { reportId: id, kind: 'APPROVED' }, orderBy: { createdAt: 'desc' }, select: { documentId: true } });
    const doc = v?.documentId ? await db.document.findUnique({ where: { id: v.documentId }, select: { media: { select: { storageKey: true } } } }) : null;
    const bytes = doc && getStorage() ? await getStorage()!.get(doc.media.storageKey) : null;
    if (bytes) return { bytes, fileName };
  }
  if (r.status === 'IN_REVIEW') {
    const v = await db.reportVersion.findFirst({ where: { reportId: id, kind: 'SUBMIT' }, orderBy: { createdAt: 'desc' } });
    if (v) return { bytes: await renderPdf({ number: r.number, caseNumber: c.caseNumber, title: r.title, content: normalizeContent(v.content), snap: v.data as unknown as Snapshot, draft: true }), fileName };
  }
  const snap = await buildSnapshot(user, r.caseId, r.number);
  return { bytes: await renderPdf({ number: r.number, caseNumber: c.caseNumber, title: r.title, content: normalizeContent(r.content), snap, draft: true }), fileName };
}

/* ------------------------------------------------------------ Textbausteine */

export async function listTextBlocks(user: AuthUser) {
  if (!has(user, 'reports.read.all') && !has(user, 'reports.read.own') && !has(user, 'templates.write')) throw new ForbiddenError();
  return db.textBlock.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }], select: { id: true, title: true, category: true, body: true } });
}
const blockSchema = z.object({ title: z.string().trim().min(2, 'Bitte einen Titel angeben.').max(120), category: z.string().trim().max(60).optional().nullable().transform((v) => v || null), body: z.string().trim().min(1, 'Bitte den Text eingeben.').max(10_000) });
export async function saveTextBlock(user: AuthUser, id: string | null, raw: unknown) {
  if (!has(user, 'templates.write')) throw new ForbiddenError();
  const d = blockSchema.parse(raw);
  const bad = resolveText(d.body, {}).unknown;
  if (bad.length) throw new DomainError(`Unbekannte Variable: ${bad.map((b) => `{{${b}}}`).join(', ')}`);
  return db.$transaction(async (tx) => {
    const b = id ? await tx.textBlock.update({ where: { id }, data: d }) : await tx.textBlock.create({ data: { ...d, createdById: user.id } });
    await writeAudit({ actorId: user.id, action: id ? 'textblock.update' : 'textblock.create', entityType: 'TextBlock', entityId: b.id, summary: `Textbaustein „${d.title}“ ${id ? 'geändert' : 'angelegt'}` }, tx);
    return b;
  });
}
export async function archiveTextBlock(user: AuthUser, id: string) {
  if (!has(user, 'templates.write')) throw new ForbiddenError();
  await db.$transaction(async (tx) => {
    await tx.textBlock.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit({ actorId: user.id, action: 'textblock.archive', entityType: 'TextBlock', entityId: id, summary: 'Textbaustein archiviert' }, tx);
  });
}

export { AUTO_LABELS };
