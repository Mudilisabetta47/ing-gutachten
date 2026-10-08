import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser, CUSTOMER, VEHICLE } from './helpers';
import { comparableStats, convertTax, decide, usageLossTotal } from '@/lib/valuation';
import { addComparable, addEntry, caseValuation, evaluate, selectEntry, setComparable, withdrawEntry } from '@/server/pipeline/valuation';
import { createCalculation, finalizeCalculation, saveCalculation } from '@/server/pipeline/calculations';
import { createCustomer } from '@/server/pipeline/customers';
import { createVehicle } from '@/server/pipeline/vehicles';
import { assignExpert, createCase } from '@/server/pipeline/cases';
import { ForbiddenError } from '@/server/auth/errors';

assertTestDb();
beforeEach(resetDb);

/* ------------------------------------------------------------ Rechenhilfe */

test('MwSt-Umrechnung: brutto ⇄ netto, „ohne Ausweis“ bleibt unverändert', () => {
  assert.equal(convertTax(11900, 'GROSS', 'NET', 1900), 10000);
  assert.equal(convertTax(10000, 'NET', 'GROSS', 1900), 11900);
  assert.equal(convertTax(5000, 'NONE', 'GROSS', 1900), 5000);
  assert.equal(convertTax(5000, 'GROSS', 'GROSS', 1900), 5000);
});

test('Nutzungsausfall: Tage × Tagessatz; ohne Angabe kein Ergebnis', () => {
  assert.equal(usageLossTotal(7, 5900), 41300);
  assert.equal(usageLossTotal(null, 5900), null);
  assert.equal(usageLossTotal(7, null), null);
});

test('Vergleichsfahrzeuge: Median/Mittelwert nur aus einbezogenen', () => {
  const s = comparableStats([{ priceCents: 1000000, included: true }, { priceCents: 1200000, included: true }, { priceCents: 1500000, included: true }, { priceCents: 9900000, included: false }]);
  assert.deepEqual([s.n, s.median, s.mean, s.min, s.max], [3, 1200000, 1233333, 1000000, 1500000]);
  assert.equal(comparableStats([{ priceCents: 1000, included: true }, { priceCents: 2001, included: true }]).median, 1501, 'gerade Anzahl → gerundeter Mittelwert der mittleren beiden');
  assert.equal(comparableStats([]).median, null);
});

test('Reparatur oder Totalschaden: Wiederbeschaffungsaufwand und Grenze', () => {
  const W = { cents: 1000000, tax: 'GROSS' as const }, R = { cents: 200000, tax: 'GROSS' as const };
  const base = { replacement: W, residual: R, basis: 'GROSS' as const, vatBp: 1900 };
  assert.equal(decide({ ...base, repairCents: 700000 }).state, 'REPAIR');
  assert.equal(decide({ ...base, repairCents: 800000 }).state, 'REPAIR', 'genau am Wiederbeschaffungsaufwand');
  assert.equal(decide({ ...base, repairCents: 800001 }).state, 'BETWEEN');
  assert.equal(decide({ ...base, repairCents: 1300000 }).state, 'BETWEEN', 'genau an der Grenze');
  assert.equal(decide({ ...base, repairCents: 1300001 }).state, 'TOTAL_LOSS');
  const d = decide({ ...base, repairCents: 900000 });
  assert.deepEqual([d.replacementEffort, d.limit, d.ratioBp], [800000, 1300000, 9000]);
  assert.equal(decide({ ...base, repairCents: 1100000, limitBp: 11000 }).state, 'BETWEEN', 'Grenze einstellbar');
  assert.equal(decide({ ...base, repairCents: 1100001, limitBp: 11000 }).state, 'TOTAL_LOSS');
});

test('Einordnung: fehlende Angaben ergeben „unbekannt“ und Hinweise, nichts wird erfunden', () => {
  const none = decide({ repairCents: null, replacement: null, residual: null, basis: 'GROSS', vatBp: 1900 });
  assert.equal(none.state, 'UNKNOWN');
  assert.ok(none.notes.length >= 2);
  const noRw = decide({ repairCents: 500000, replacement: { cents: 1000000, tax: 'GROSS' }, residual: null, basis: 'GROSS', vatBp: 1900 });
  assert.equal(noRw.state, 'REPAIR');
  assert.ok(noRw.notes.some((n) => /Restwert/.test(n)));
});

test('Einordnung rechnet netto/brutto konsistent um', () => {
  // WBW 11.900 brutto = 10.000 netto; Reparatur 8.000 netto → bei Basis netto: Aufwand 10.000 − RW 2.380 brutto (=2.000 netto)
  const d = decide({ repairCents: 800000, replacement: { cents: 1190000, tax: 'GROSS' }, residual: { cents: 238000, tax: 'GROSS' }, basis: 'NET', vatBp: 1900 });
  assert.deepEqual([d.replacement, d.residual, d.replacementEffort, d.state], [1000000, 200000, 800000, 'REPAIR']);
});

/* ------------------------------------------------------------ Dienst */

async function world() {
  const office = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  const e1 = await makeUser({ role: 'EXPERT' }), e2 = await makeUser({ role: 'EXPERT' });
  const exp1 = await asAuthUser(e1.user.id), exp2 = await asAuthUser(e2.user.id);
  const cust = await createCustomer(office, CUSTOMER);
  const veh = await createVehicle(office, cust.id, VEHICLE);
  const c = await createCase(office, { customerId: cust.id, vehicleId: veh.id, data: {} });
  await assignExpert(owner, c.id, e1.user.id);
  return { office, owner, exp1, exp2, c };
}
const wbw = (over: Record<string, unknown> = {}) => ({ type: 'REPLACEMENT_VALUE', amountCents: 1500000, taxMode: 'GROSS', source: 'MANUAL', referenceDate: '2026-10-01', ...over });

test('Werte: neuer Wert wird gewählt, der alte bleibt im Verlauf; Quelle, Datum, Notiz und Autor werden gespeichert', async () => {
  const { exp1, c } = await world();
  const a = await addEntry(exp1, c.id, wbw({ note: 'erste Schätzung' }));
  const b = await addEntry(exp1, c.id, wbw({ amountCents: 1600000, source: 'VERGLEICH', sourceRef: 'Median', note: 'Vergleichsfahrzeuge' }));
  const v = await caseValuation(exp1, c.id);
  assert.equal(v.entries.length, 2);
  assert.equal(v.selected.REPLACEMENT_VALUE?.id, b.id);
  const old = v.entries.find((e) => e.id === a.id)!;
  assert.deepEqual([old.selected, old.amountCents, old.note, old.referenceDate, old.byName !== null], [false, 1500000, 'erste Schätzung', '2026-10-01', true]);
  await selectEntry(exp1, a.id);
  assert.equal((await caseValuation(exp1, c.id)).selected.REPLACEMENT_VALUE?.id, a.id);
  assert.equal(await db.valuationEntry.count({ where: { caseId: c.id, type: 'REPLACEMENT_VALUE', selected: true } }), 1, 'je Typ genau ein gewählter Wert (DB-Index)');
});

test('Wert zurückziehen statt löschen', async () => {
  const { exp1, c } = await world();
  const a = await addEntry(exp1, c.id, wbw());
  await withdrawEntry(exp1, a.id);
  const v = await caseValuation(exp1, c.id);
  assert.equal(v.selected.REPLACEMENT_VALUE, null);
  assert.equal(v.entries[0].withdrawn, true);
  assert.equal(await db.valuationEntry.count(), 1, 'Datensatz bleibt erhalten');
  await assert.rejects(selectEntry(exp1, a.id), /nicht gefunden/);
});

test('Pflichtangaben je Typ', async () => {
  const { exp1, c } = await world();
  await assert.rejects(addEntry(exp1, c.id, wbw({ amountCents: null })), /Betrag/);
  await assert.rejects(addEntry(exp1, c.id, wbw({ referenceDate: '' })), /Stichtag/);
  await assert.rejects(addEntry(exp1, c.id, { type: 'RESIDUAL_OFFER', amountCents: 100000, taxMode: 'GROSS' }), /Bieter/);
  await assert.rejects(addEntry(exp1, c.id, { type: 'REPAIR_DURATION' }), /Dauer/);
  await assert.rejects(addEntry(exp1, c.id, { type: 'REPAIR_DURATION', days: -1 }));
  await assert.rejects(addEntry(exp1, c.id, { type: 'UNSINN', amountCents: 1 }));
});

test('Restwertangebote: mehrere parallel, keines automatisch gewählt', async () => {
  const { exp1, c } = await world();
  await addEntry(exp1, c.id, { type: 'RESIDUAL_OFFER', label: 'Händler A', amountCents: 250000, taxMode: 'GROSS', source: 'ANGEBOT', validUntil: '2026-11-01' });
  await addEntry(exp1, c.id, { type: 'RESIDUAL_OFFER', label: 'Händler B', amountCents: 310000, taxMode: 'GROSS', source: 'ANGEBOT' });
  const v = await caseValuation(exp1, c.id);
  assert.equal(v.entries.filter((e) => e.type === 'RESIDUAL_OFFER').length, 2);
  assert.equal(v.selected.RESIDUAL_OFFER, null);
  assert.equal(v.selected.RESIDUAL_VALUE, null, 'ohne Entscheidung kein Restwert');
});

test('Auswertung nutzt gewählte Werte und die freigegebene Kalkulation; Entwurf wird als vorläufig erkannt', async () => {
  const { exp1, c } = await world();
  const calc = await createCalculation(exp1, c.id);
  const items = [{ kind: 'PART', description: 'Teile', quantityX100: 100, minutes: 0, unitPriceCents: 700000, discountBp: 0 }];
  const head = { vatBp: 1900, minutesPerAw: 5, rateBodyCents: null, rateMechanicCents: null, rateElectricCents: null, ratePaintCents: null, partsMarkupBp: 0, paintMaterialBp: 0 };
  await saveCalculation(exp1, calc.id, { ...head, items });
  await addEntry(exp1, c.id, wbw({ amountCents: 1000000 }));
  await addEntry(exp1, c.id, { type: 'RESIDUAL_VALUE', amountCents: 200000, taxMode: 'GROSS', source: 'MANUAL' });
  await addEntry(exp1, c.id, { type: 'USAGE_LOSS', amountCents: 5900, taxMode: 'NONE', source: 'TABELLE', label: 'Gruppe F' });
  await addEntry(exp1, c.id, { type: 'REPAIR_DURATION', days: 7, source: 'MANUAL' });
  let ev = await evaluate(exp1, c.id, 'NET');
  assert.equal(ev.calcDraft, true);
  assert.equal(ev.decision.repair, 700000);
  assert.equal(ev.usageTotal, 41300);
  ev = await evaluate(exp1, c.id, 'GROSS');
  assert.equal(ev.decision.repair, 833000);
  assert.equal(ev.decision.state, 'BETWEEN', 'brutto: 8.330 > 8.000 Aufwand, aber < 13.000');
  await finalizeCalculation(exp1, calc.id).catch(() => {}); // ohne Sätze erlaubt (nur Teile)
  assert.equal((await evaluate(exp1, c.id, 'GROSS')).calcDraft, false);
});

test('Vergleichsfahrzeuge: erfassen, ein-/ausschließen, entfernen; Link bleibt Text', async () => {
  const { exp1, c } = await world();
  const a = await addComparable(exp1, c.id, { title: 'VW Golf, 2019, 45.000 km', priceCents: 1450000, mileage: 45000, sourceRef: 'https://example.test/inserat/1', seenOn: '2026-10-05' });
  const b = await addComparable(exp1, c.id, { title: 'VW Golf, 2018', priceCents: 1350000 });
  await assert.rejects(addComparable(exp1, c.id, { title: 'x', priceCents: 0 }), /Preis|Bezeichnung/);
  assert.equal((await caseValuation(exp1, c.id)).stats.n, 2);
  await setComparable(exp1, b.id, { included: false });
  assert.deepEqual([(await caseValuation(exp1, c.id)).stats.n, (await caseValuation(exp1, c.id)).stats.median], [1, 1450000]);
  await setComparable(exp1, a.id, { remove: true });
  assert.equal((await caseValuation(exp1, c.id)).comparables.length, 1);
});

test('Rechte: nur eigener Fall; Prüfer liest; Buchhaltung ohne Zugriff', async () => {
  const { exp1, exp2, c } = await world();
  await addEntry(exp1, c.id, wbw());
  await assert.rejects(caseValuation(exp2, c.id), /nicht gefunden/);
  await assert.rejects(addEntry(exp2, c.id, wbw()), /nicht gefunden/);
  const reviewer = await asAuthUser((await makeUser({ role: 'REVIEWER' })).user.id);
  assert.equal((await caseValuation(reviewer, c.id)).entries.length, 1);
  await assert.rejects(addEntry(reviewer, c.id, wbw()), ForbiddenError);
  const acc = await asAuthUser((await makeUser({ role: 'ACCOUNTING' })).user.id);
  await assert.rejects(caseValuation(acc, c.id));
  assert.ok((await db.auditLog.count({ where: { action: { startsWith: 'valuation.' } } })) >= 1);
});
