/**
 * Demo-/Entwicklungsdaten – NUR lokal. Verweigert sich in Production und gegen Nicht-Lokal-Datenbanken.
 * Enthält ausschließlich erfundene Beispieldaten, keine echten Kunden.
 *
 *   npm run seed:demo                  legt Demo-Benutzer an (idempotent)
 *   npm run seed:demo -- fixtures      legt zusätzlich markierte Beispiel-Anfragen/-Kunden/-Fälle an
 *   npm run seed:demo -- clear         entfernt Demo-Benutzer UND alle Pipeline-Daten (nur lokale Entwicklung)
 *
 * Fixtures sind erkennbar: E-Mail-Adressen auf @demo.ing.test, Namen mit „(Demo)“.
 *
 * Das Demo-Passwort gilt nur für diese lokale Entwicklungsumgebung und steht deshalb hier im Skript.
 */
import { PrismaClient, type Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from '@node-rs/argon2';
import { assertSafeTarget } from './_guard';

export const DEMO_PASSWORD = 'Demo-Passwort-Lokal-2026!';
export const DEMO_USERS: { email: string; firstName: string; lastName: string; role: Role; isExpert?: boolean }[] = [
  { email: 'inhaber@demo.ing.test', firstName: 'Ida', lastName: 'Inhaber', role: 'OWNER' },
  { email: 'admin@demo.ing.test', firstName: 'Adam', lastName: 'Admin', role: 'ADMIN' },
  { email: 'buero@demo.ing.test', firstName: 'Britta', lastName: 'Büro', role: 'OFFICE' },
  { email: 'gutachter@demo.ing.test', firstName: 'Gerd', lastName: 'Gutachter', role: 'EXPERT', isExpert: true },
  { email: 'buchhaltung@demo.ing.test', firstName: 'Bea', lastName: 'Bilanz', role: 'ACCOUNTING' },
  { email: 'redaktion@demo.ing.test', firstName: 'Rita', lastName: 'Redaktion', role: 'CONTENT_MANAGER' },
  { email: 'pruefer@demo.ing.test', firstName: 'Paul', lastName: 'Prüfer', role: 'REVIEWER' },
];

async function fixtures(db: PrismaClient) {
  if ((await db.lead.count()) > 0) {
    console.log('Fixtures übersprungen: es gibt bereits Anfragen (erst `-- clear`).');
    return;
  }
  const expert = await db.user.findUniqueOrThrow({ where: { email: 'gutachter@demo.ing.test' } });
  const office = await db.user.findUniqueOrThrow({ where: { email: 'buero@demo.ing.test' } });
  const now = Date.now();
  const mk = async (i: number, v: { name: string; reason: string; kind: string; place: string; status?: 'NEW' | 'CONTACTED'; mail?: 'SENT' | 'FAILED' }) => {
    const email = `${v.name.split(' ')[0].toLowerCase()}.demo@demo.ing.test`;
    const received = new Date(now - i * 3_600_000 * 5);
    const inq = await db.inquiry.create({
      data: { receivedAt: received, formVersion: 'form-2026-10-v1', reason: v.reason, vehicleKind: v.kind, name: v.name, email, phone: `0511 55500${i}${i}`, location: v.place, message: 'Beispielanfrage (Demo) – erfundene Daten.', consentAt: received, privacyVersion: 'datenschutz-2026-10', landingPath: '/kfz-gutachter-hannover/' },
    });
    const lead = await db.lead.create({
      data: { inquiryId: inq.id, name: v.name, email, phone: `0511 55500${i}${i}`, phoneNorm: `051155500${i}${i}`, location: v.place, reason: v.reason, vehicleKind: v.kind, message: 'Beispielanfrage (Demo) – erfundene Daten.', status: v.status ?? 'NEW', notificationStatus: v.mail ?? 'SENT', createdAt: received },
    });
    await db.leadStatusHistory.create({ data: { leadId: lead.id, toStatus: 'NEW', reason: 'Demo-Fixture', createdAt: received } });
  };
  await mk(1, { name: 'Anna Beispiel (Demo)', reason: 'Unfall', kind: 'PKW', place: 'Hannover' });
  await mk(2, { name: 'Bernd Probe (Demo)', reason: 'Parkschaden', kind: 'Motorrad', place: 'Laatzen', mail: 'FAILED' });
  await mk(3, { name: 'Clara Muster (Demo)', reason: 'Wertgutachten', kind: 'Oldtimer', place: 'Langenhagen', status: 'CONTACTED' });
  await mk(4, { name: 'Dirk Test (Demo)', reason: 'Unfall', kind: 'Elektro / Hybrid', place: 'Garbsen' });

  const year = new Date().getFullYear();
  const customer = await db.customer.create({ data: { firstName: 'Erika', lastName: 'Fixture (Demo)', email: 'erika.fixture@demo.ing.test', phone: '0511 5550100', phoneNorm: '05115550100', street: 'Beispielweg 1', postalCode: '30159', city: 'Hannover' } });
  const vehicle = await db.vehicle.create({ data: { customerId: customer.id, manufacturer: 'VW', model: 'Golf VIII', licensePlate: 'H-DM 2026', licensePlateNorm: 'HDM2026', fuelType: 'DIESEL' } });
  const rows = await db.$queryRaw<{ last_value: number }[]>`INSERT INTO case_counters (year, last_value, updated_at) VALUES (${year}, 1, now()) ON CONFLICT (year) DO UPDATE SET last_value = case_counters.last_value + 1, updated_at = now() RETURNING last_value`;
  // Stammdaten für die Demo: Werkstatt mit Stundensätzen (Demo-Werte, keine Marktpreise) und eine Versicherung
  const demoOrg = async (name: string, kind: 'WORKSHOP' | 'INSURANCE', extra: Record<string, number> = {}) =>
    (await db.organization.findFirst({ where: { name, kind, deletedAt: null } })) ?? db.organization.create({ data: { name, kind, city: 'Hannover', ...extra } });
  const workshop = await demoOrg('Musterwerkstatt (Demo)', 'WORKSHOP', { rateBodyCents: 12500, rateMechanicCents: 11000, rateElectricCents: 12000, ratePaintCents: 13500, partsMarkupBp: 1000, paintMaterialBp: 3500 });
  const insurance = await demoOrg('Beispiel-Versicherung (Demo)', 'INSURANCE');
  const c = await db.case.create({ data: { workshopOrgId: workshop.id, insuranceOrgId: insurance.id, claimType: 'LIABILITY', caseNumber: `ING-${year}-${String(rows[0].last_value).padStart(5, '0')}`, status: 'APPOINTMENT_SET', customerId: customer.id, vehicleId: vehicle.id, assignedExpertId: expert.id, createdById: office.id, description: 'Heckschaden (Demo-Fixture)', inspectionLocation: 'Hannover' } });
  await db.caseStatusHistory.create({ data: { caseId: c.id, toStatus: 'NEW', actorId: office.id, reason: 'Demo-Fixture' } });
  // Demo-Schäden für die visuelle Schadenkarte (jeder Zustand einmal)
  await db.damage.createMany({
    data: [
      { caseId: c.id, area: 'REAR', component: 'Stoßfänger hinten', partId: 'bumper_rear', view: 'REAR_LEFT', kind: 'CURRENT', severity: 'HEAVY', damageType: 'Verformung', repairKind: 'Ersetzen', description: 'Heckanprall (Demo)', sortOrder: 1, createdById: expert.id },
      { caseId: c.id, area: 'REAR', component: 'Heckklappe / Kofferraumdeckel', partId: 'trunk', view: 'REAR_LEFT', kind: 'CURRENT', severity: 'MEDIUM', damageType: 'Delle', repairKind: 'Ausbeulen', description: 'Eindrückung (Demo)', sortOrder: 2, createdById: expert.id },
      { caseId: c.id, area: 'LEFT', component: 'Kotflügel vorn links', partId: 'fender_fl', view: 'FRONT_LEFT', kind: 'PRIOR', severity: 'LIGHT', damageType: 'Kratzer', repairKind: 'Lackieren', priorNote: 'Alter Parkschaden laut Halter (Demo)', sortOrder: 3, createdById: expert.id },
      { caseId: c.id, area: 'RIGHT', component: 'Außenspiegel rechts', partId: 'mirror_r', view: 'RIGHT', kind: 'USAGE', severity: 'LIGHT', damageType: 'Kratzer', description: 'Gebrauchsspuren (Demo)', sortOrder: 4, createdById: expert.id },
      { caseId: c.id, area: 'FRONT', component: 'Stoßfänger vorn', partId: 'bumper_front', view: 'FRONT', kind: 'REPAIRED', priorNote: 'Reparatur laut Rechnung 2025 (Demo)', sortOrder: 5, createdById: expert.id },
      { caseId: c.id, area: 'LEFT', component: 'Tür hinten links', partId: 'door_rl', view: 'LEFT', kind: 'CHECK', priorNote: 'Spaltmaß prüfen (Demo)', sortOrder: 6, createdById: expert.id },
    ],
  });
  // Termine: einer heute (in ca. einer Stunde), einer in zwei Tagen – damit Kalender, „Heute“ und Dashboard etwas zeigen.
  // „heute“ immer in der Zukunft, solange der Tag es hergibt (bis 21 Uhr), damit „Heute“ den Termin als nächsten zeigt
  const berlinHour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Berlin' }).formatToParts(new Date()).find((p) => p.type === 'hour')?.value ?? '12');
  const soon = Math.min(21, Math.max(8, berlinHour + 1));
  const at = (dayOffset: number, hour: number) => {
    const base = new Date(Date.now() + dayOffset * 86_400_000);
    const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(base);
    const guess = new Date(`${ymd}T${String(hour).padStart(2, '0')}:00:00Z`);
    const off = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', timeZoneName: 'longOffset' }).formatToParts(guess).find((p) => p.type === 'timeZoneName')?.value.match(/GMT([+-]\d{2})/)?.[1] ?? '0');
    return new Date(guess.getTime() - off * 3_600_000);
  };
  await db.appointment.createMany({
    data: [
      { caseId: c.id, expertId: expert.id, kind: 'INSPECTION', status: 'PLANNED', startsAt: at(0, soon), endsAt: at(0, soon + 1), location: 'Hannover, Beispielweg 1 (Demo)', createdById: office.id },
      { caseId: c.id, expertId: expert.id, kind: 'CONSULTATION', status: 'CONFIRMED', startsAt: at(2, 9), endsAt: at(2, 10), location: 'Telefon (Demo)', createdById: office.id },
    ],
  });
  console.log('Fixtures angelegt: 4 Anfragen, 1 Kunde, 1 Fahrzeug, 1 Fall mit 2 Terminen (dem Demo-Gutachter zugewiesen).');
}

async function main() {
  assertSafeTarget('seed:demo');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    if (process.argv.includes('clear')) {
      // Das Protokoll verweist auf Benutzer (Fremdschlüssel). Nur in der lokalen Entwicklung dürfen
      // die Einträge der Demo-Benutzer mit entfernt werden – gegen echte Datenbanken verweigert _guard das Skript.
      // Pipeline-Daten verweisen auf Benutzer → zuerst leeren (lokale Entwicklungsdatenbank, _guard erzwingt das).
      await db.$executeRawUnsafe(
        'TRUNCATE TABLE inspections, appointments, damages, case_photos, documents, media, notes, case_status_history, lead_status_history, cases, vehicles, customers, leads, inquiry_attachments, inquiries, case_counters RESTART IDENTITY CASCADE',
      );
      const demo = await db.user.findMany({ where: { email: { endsWith: '@demo.ing.test' } }, select: { id: true } });
      const ids = demo.map((u) => u.id);
      await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
      const r = await db.user.deleteMany({ where: { id: { in: ids } } });
      console.log(`${r.count} Demo-Benutzer entfernt.`);
      return;
    }
    const passwordHash = await hash(DEMO_PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    for (const u of DEMO_USERS) {
      await db.user.upsert({
        where: { email: u.email },
        update: { role: u.role, isActive: true, deletedAt: null, passwordHash, mustChangePassword: false, failedLogins: 0, lockedUntil: null },
        create: { email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role, passwordHash, mustChangePassword: false, employee: { create: { isExpert: u.isExpert ?? false } } },
      });
    }
    console.log(`${DEMO_USERS.length} Demo-Benutzer bereit (…@demo.ing.test).`);
    if (process.argv.includes('fixtures')) await fixtures(db);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
