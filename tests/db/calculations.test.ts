import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser, CUSTOMER, VEHICLE } from './helpers';
import { awToMinutes, diffCalculations, lineTotal, minutesToAw, totals, type CalcHeader, type CalcLine } from '@/lib/calc';
import { addDamage } from '@/server/pipeline/damages';
import { appendFromDamages, createCalculation, deleteDraft, finalizeCalculation, listCalculations, saveCalculation, suggestItems } from '@/server/pipeline/calculations';
import { createCustomer } from '@/server/pipeline/customers';
import { createVehicle } from '@/server/pipeline/vehicles';
import { assignExpert, createCase, updateCase } from '@/server/pipeline/cases';
import { createOrganization } from '@/server/pipeline/masterdata';
import { ForbiddenError } from '@/server/auth/errors';

assertTestDb();
beforeEach(resetDb);

const head: CalcHeader = { vatBp: 1900, minutesPerAw: 5, partsMarkupBp: 0, paintMaterialBp: 0, rates: { body: 13000, mechanic: 12000, electric: 14000, paint: 15000 } };
const L = (over: Partial<CalcLine>): CalcLine => ({ kind: 'PART', laborCategory: null, quantityX100: 100, minutes: 0, unitPriceCents: 0, discountBp: 0, ...over });

/* ------------------------------------------------------------ Rechenlogik */

test('Teile: Menge × Preis × (1 − Rabatt), kaufmännisch gerundet', () => {
  assert.equal(lineTotal(L({ quantityX100: 200, unitPriceCents: 1250, discountBp: 1000 }), head.rates), 2250);
  assert.equal(lineTotal(L({ quantityX100: 150, unitPriceCents: 999 }), head.rates), 1499, '1,5 × 9,99 = 14,985 → 14,99');
  assert.equal(lineTotal(L({ quantityX100: 100, unitPriceCents: 333, discountBp: 3333 }), head.rates), 222);
});

test('Arbeit: Minuten/60 × Stundensatz der Kategorie; AW ↔ Minuten', () => {
  assert.equal(awToMinutes(6, 5), 30);
  assert.equal(minutesToAw(30, 5), 6);
  assert.equal(lineTotal(L({ kind: 'LABOR', laborCategory: 'BODY', minutes: 30 }), head.rates), 6500);
  assert.equal(lineTotal(L({ kind: 'LABOR', laborCategory: 'MECHANIC', minutes: 60 }), head.rates), 12000);
  assert.equal(lineTotal(L({ kind: 'LABOR', laborCategory: 'ELECTRIC', minutes: 90 }), head.rates), 21000);
  assert.equal(lineTotal(L({ kind: 'PAINT', minutes: 45 }), head.rates), 11250);
  assert.equal(lineTotal(L({ kind: 'LABOR', laborCategory: 'BODY', minutes: 7 }), { ...head.rates, body: 13550 }), 1581, '7 min × 135,50 €/h = 15,808 → 15,81');
});

test('Summen: Aufschläge, Lackmaterial, MwSt auf Netto', () => {
  const lines = [L({ unitPriceCents: 100000 }), L({ kind: 'LABOR', laborCategory: 'BODY', minutes: 120 }), L({ kind: 'PAINT', minutes: 60 }), L({ kind: 'MISC', quantityX100: 100, unitPriceCents: 5000 })];
  const t = totals(lines, { ...head, partsMarkupBp: 1000, paintMaterialBp: 5000 });
  assert.equal(t.parts, 100000);
  assert.equal(t.partsMarkup, 10000);
  assert.equal(t.laborBody, 26000);
  assert.equal(t.paintLabor, 15000);
  assert.equal(t.paintMaterial, 7500);
  assert.equal(t.misc, 5000);
  assert.equal(t.net, 163500);
  assert.equal(t.vat, 31065);
  assert.equal(t.gross, 194565);
  assert.equal(t.minutes, 180);
  assert.equal(t.aw, 36);
  assert.equal(totals(lines, { ...head, vatBp: 0 }).gross, totals(lines, { ...head, vatBp: 0 }).net, 'ohne MwSt');
});

test('Fehlende Stundensätze werden nicht erfunden, sondern gemeldet', () => {
  const t = totals([L({ kind: 'LABOR', laborCategory: 'BODY', minutes: 60 })], { ...head, rates: { body: null, mechanic: null, electric: null, paint: null } });
  assert.deepEqual([t.labor, t.net, t.missingRates], [0, 0, 1]);
});

test('Versionsvergleich: neu, entfallen, geändert – über die stabile ref', () => {
  const it = (ref: string, over: Partial<CalcLine> & { description?: string }) => ({ ref, description: over.description ?? ref, ...L(over) });
  const a = { head, items: [it('a', { unitPriceCents: 10000, description: 'Stoßfänger' }), it('b', { kind: 'LABOR', laborCategory: 'BODY', minutes: 60 }), it('c', { unitPriceCents: 500 })] };
  const b = { head, items: [it('a', { unitPriceCents: 12000, description: 'Stoßfänger' }), it('b', { kind: 'LABOR', laborCategory: 'BODY', minutes: 60 }), it('d', { kind: 'PAINT', minutes: 30 })] };
  const d = diffCalculations(a, b);
  assert.deepEqual([d.added.map((x) => x.ref), d.removed.map((x) => x.ref), d.changed.map((x) => x.ref), d.unchanged], [['d'], ['c'], ['a'], 1]);
  assert.deepEqual(d.changed[0].fields, ['Einzelpreis']);
  assert.equal(d.changed[0].deltaCents, 2000);
  assert.equal(d.netAfter - d.netBefore, 2000 + 7500 - 500);
});

test('Vorschlag aus Schäden: nur aktuelle Schäden mit Maßnahme, ohne erfundene Preise', () => {
  const s = suggestItems([
    { id: 'd1', component: 'Stoßfänger vorn', partId: 'bumper_front', kind: 'CURRENT', repairKind: 'Ersetzen' },
    { id: 'd2', component: 'Tür vorn links', partId: 'door_fl', kind: 'CURRENT', repairKind: 'Ausbeulen' },
    { id: 'd3', component: 'Kotflügel', partId: 'fender_fl', kind: 'PRIOR', repairKind: 'Lackieren' },
    { id: 'd4', component: 'Spiegel', partId: 'mirror_l', kind: 'CURRENT', repairKind: 'Keine Reparatur' },
    { id: 'd5', component: 'Dach', partId: 'roof', kind: 'CURRENT', repairKind: null },
  ]);
  assert.deepEqual(s.map((x) => `${x.kind}:${x.damageId}`), ['PART:d1', 'LABOR:d1', 'PAINT:d1', 'LABOR:d2', 'PAINT:d2']);
  assert.ok(s.every((x) => x.unitPriceCents === 0 && x.minutes === 0));
  assert.equal(s[0].description, 'Stoßfänger vorn');
});

/* ------------------------------------------------------------ Dienst */

async function world(withRates = true) {
  const office = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  const e1 = await makeUser({ role: 'EXPERT' }), e2 = await makeUser({ role: 'EXPERT' });
  const exp1 = await asAuthUser(e1.user.id), exp2 = await asAuthUser(e2.user.id);
  const cust = await createCustomer(office, CUSTOMER);
  const veh = await createVehicle(office, cust.id, VEHICLE);
  const ws = withRates ? await createOrganization(owner, 'WORKSHOP', { name: 'Werkstatt Test (Demo)', rateBodyCents: '130', rateMechanicCents: '120', rateElectricCents: '140', ratePaintCents: '150', partsMarkupBp: '10', paintMaterialBp: '40' }) : null;
  const c = await createCase(office, { customerId: cust.id, vehicleId: veh.id, data: ws ? { workshopOrgId: ws.id } : {} });
  await assignExpert(owner, c.id, e1.user.id);
  return { office, owner, exp1, exp2, c, ws };
}
const item = (over: Record<string, unknown> = {}) => ({ kind: 'PART', description: 'Stoßfänger vorn', quantityX100: 100, minutes: 0, unitPriceCents: 45000, discountBp: 0, ...over });
const save = (u: Parameters<typeof saveCalculation>[0], id: string, over: Record<string, unknown> = {}, items: unknown[] = [item()]) =>
  saveCalculation(u, id, { vatBp: 1900, minutesPerAw: 5, rateBodyCents: 13000, rateMechanicCents: 12000, rateElectricCents: 14000, ratePaintCents: 15000, partsMarkupBp: 0, paintMaterialBp: 0, items, ...over });

test('Anlegen: Sätze und Aufschläge kommen aus der Werkstatt des Falls (Kopie), sonst leer', async () => {
  const { exp1, c } = await world();
  const v1 = await createCalculation(exp1, c.id);
  assert.deepEqual([v1.version, v1.status, v1.head.rates.body, v1.head.rates.paint, v1.head.partsMarkupBp, v1.head.paintMaterialBp, v1.ratesSource], [1, 'DRAFT', 13000, 15000, 1000, 4000, 'Werkstatt: Werkstatt Test (Demo)']);
  const w = await world(false);
  const bare = await createCalculation(w.exp1, w.c.id);
  assert.deepEqual([bare.head.rates.body, bare.head.rates.paint, bare.ratesSource], [null, null, 'manuell']);
});

test('Nur ein Entwurf gleichzeitig; Speichern ersetzt alle Positionen und rechnet nach', async () => {
  const { exp1, c } = await world();
  const v1 = await createCalculation(exp1, c.id);
  await assert.rejects(createCalculation(exp1, c.id), /Entwurf/);
  const saved = await save(exp1, v1.id, {}, [item(), item({ kind: 'LABOR', laborCategory: 'BODY', description: 'Aus-/Einbau', unitPriceCents: 0, minutes: 90 }), item({ kind: 'PAINT', description: 'Lackieren', unitPriceCents: 0, minutes: 60 })]);
  assert.equal(saved.items.length, 3);
  assert.equal(saved.totals.parts, 45000);
  assert.equal(saved.totals.laborBody, 19500);
  assert.equal(saved.totals.paintLabor, 15000);
  assert.equal(saved.totals.net, 79500);
  assert.deepEqual(saved.items.map((i) => i.position), [1, 2, 3]);
  const again = await save(exp1, v1.id, {}, [item({ ref: saved.items[0].ref, unitPriceCents: 50000 })]);
  assert.equal(again.items.length, 1);
  assert.equal(again.items[0].ref, saved.items[0].ref, 'ref bleibt erhalten');
  assert.equal(again.items[0].unitPriceCents, 50000);
});

test('Ungültige Eingaben werden abgewiesen; Arbeit hat nie einen Einzelpreis', async () => {
  const { exp1, c } = await world();
  const v1 = await createCalculation(exp1, c.id);
  await assert.rejects(save(exp1, v1.id, {}, [item({ description: '' })]), /bezeichnen/);
  await assert.rejects(save(exp1, v1.id, {}, [item({ quantityX100: -1 })]));
  await assert.rejects(save(exp1, v1.id, { vatBp: 99999 }));
  await assert.rejects(save(exp1, v1.id, { minutesPerAw: 0 }));
  const ok = await save(exp1, v1.id, {}, [item({ kind: 'LABOR', unitPriceCents: 9999, minutes: 60, description: 'x' })]);
  assert.equal(ok.items[0].unitPriceCents, 0);
  assert.equal(ok.items[0].laborCategory, 'BODY');
});

test('Freigabe: braucht Positionen und Stundensätze; danach unveränderlich; neue Version kopiert mit gleichen refs', async () => {
  const { exp1, c } = await world();
  const v1 = await createCalculation(exp1, c.id);
  await assert.rejects(finalizeCalculation(exp1, v1.id), /leer/);
  const saved = await save(exp1, v1.id, { rateBodyCents: null }, [item({ kind: 'LABOR', description: 'Arbeit', minutes: 60, unitPriceCents: 0 })]);
  await assert.rejects(finalizeCalculation(exp1, v1.id), /Stundensatz/);
  const ok = await save(exp1, v1.id, { rateBodyCents: 13000 }, [item({ ref: saved.items[0].ref, kind: 'LABOR', description: 'Arbeit', minutes: 60, unitPriceCents: 0 }), item()]);
  const fin = await finalizeCalculation(exp1, v1.id);
  assert.equal(fin.status, 'FINAL');
  await assert.rejects(save(exp1, v1.id, {}, [item()]), /freigegeben/);
  await assert.rejects(finalizeCalculation(exp1, v1.id), /bereits/);
  await assert.rejects(deleteDraft(exp1, v1.id), /nicht gelöscht/);
  const v2 = await createCalculation(exp1, c.id);
  assert.deepEqual([v2.version, v2.status, v2.items.map((i) => i.ref)], [2, 'DRAFT', ok.items.map((i) => i.ref)]);
  assert.equal(await db.calculation.count({ where: { caseId: c.id } }), 2);
  await deleteDraft(exp1, v2.id);
  assert.equal(await db.calculation.count({ where: { caseId: c.id } }), 1);
  assert.equal(await db.auditLog.count({ where: { action: { in: ['calculation.create', 'calculation.finalize', 'calculation.delete'] } } }), 4);
  assert.equal((await listCalculations(exp1, c.id)).length, 1);
});

test('Gleichzeitiges Bearbeiten: veraltetes Token wird abgewiesen', async () => {
  const { exp1, c } = await world();
  const v1 = await createCalculation(exp1, c.id);
  const first = await save(exp1, v1.id, {}, [item()]);
  await assert.rejects(saveCalculation(exp1, v1.id, { vatBp: 1900, minutesPerAw: 5, partsMarkupBp: 0, paintMaterialBp: 0, rateBodyCents: null, rateMechanicCents: null, rateElectricCents: null, ratePaintCents: null, items: [item()] }, v1.updatedAt.toISOString()), /zwischenzeitlich/);
  await saveCalculation(exp1, v1.id, { vatBp: 1900, minutesPerAw: 5, partsMarkupBp: 0, paintMaterialBp: 0, rateBodyCents: null, rateMechanicCents: null, rateElectricCents: null, ratePaintCents: null, items: [item()] }, first.updatedAt.toISOString());
});

test('Aus Schäden vorschlagen: ergänzt, ohne Doppelte', async () => {
  const { exp1, c } = await world();
  const v1 = await createCalculation(exp1, c.id);
  const d = await addDamage(exp1, c.id, { partId: 'bumper_front', view: 'FRONT', kind: 'CURRENT', repairKind: 'Ersetzen' });
  await addDamage(exp1, c.id, { partId: 'hood', kind: 'PRIOR', repairKind: 'Lackieren' });
  const r = await appendFromDamages(exp1, v1.id);
  assert.equal(r.added, 3);
  assert.ok(r.calc.items.every((i) => i.damageId === d.id));
  assert.equal((await appendFromDamages(exp1, v1.id)).added, 0);
});

test('Rechte: nur eigener Fall; Prüfer liest nur; Buchhaltung und Website-Rolle haben keinen Zugriff', async () => {
  const { exp1, exp2, c, owner } = await world();
  const v1 = await createCalculation(exp1, c.id);
  await assert.rejects(createCalculation(exp2, c.id), /nicht gefunden/);
  await assert.rejects(listCalculations(exp2, c.id), /nicht gefunden/);
  const reviewer = await asAuthUser((await makeUser({ role: 'REVIEWER' })).user.id);
  assert.equal((await listCalculations(reviewer, c.id)).length, 1);
  await assert.rejects(save(reviewer, v1.id), ForbiddenError);
  for (const role of ['ACCOUNTING', 'CONTENT_MANAGER'] as const) {
    const u = await asAuthUser((await makeUser({ role })).user.id);
    await assert.rejects(listCalculations(u, c.id));
  }
  await save(owner, v1.id);
  // Archivierter Fall: keine Änderungen mehr
  await updateCase(owner, c.id, {});
});
