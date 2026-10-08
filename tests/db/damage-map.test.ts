import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser, CUSTOMER, VEHICLE } from './helpers';
import { DAMAGE_KINDS, KIND_META, MAPPED_PART_IDS, PARTS, PART_BY_ID, VIEWS, VIEW_KEYS, projectView, topKind } from '@/lib/vehicle-model';
import { addDamage, deleteDamage, listDamages, setDamagePhotos, updateDamage } from '@/server/pipeline/damages';
import { createCustomer } from '@/server/pipeline/customers';
import { createVehicle } from '@/server/pipeline/vehicles';
import { assignExpert, createCase } from '@/server/pipeline/cases';

assertTestDb();
beforeEach(resetDb);

/* ------------------------------------------------------------ Fahrzeugmodell (rein) */

test('Modell: neun Ansichten in der gewünschten Reihenfolge', () => {
  assert.deepEqual(VIEWS.map((v) => v.label), ['Front', 'Front links', 'Links', 'Heck links', 'Heck', 'Heck rechts', 'Rechts', 'Front rechts', 'Oben']);
});

test('Modell: jedes Bauteil ist in mindestens einer Ansicht klickbar und hat Name, Bereich und eindeutige partId', () => {
  const ids = PARTS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'partIds eindeutig');
  const mapped = new Set(MAPPED_PART_IDS());
  const missing = ids.filter((id) => !mapped.has(id));
  assert.deepEqual(missing, [], `nicht klickbar: ${missing.join(', ')}`);
  for (const id of mapped) assert.ok(PART_BY_ID[id], `unbekannte partId ${id}`);
});

test('Modell: Seitenansichten zeigen nur die zugewandte Seite', () => {
  const left = new Set(projectView('LEFT').parts), right = new Set(projectView('RIGHT').parts);
  for (const id of ['door_fl', 'door_rl', 'fender_fl', 'quarter_l', 'wheel_fl', 'wheel_rl', 'mirror_l', 'glass_fl', 'sill_l']) assert.ok(left.has(id), `LEFT zeigt ${id}`);
  for (const id of ['door_fr', 'door_rr', 'wheel_fr', 'mirror_r']) assert.ok(!left.has(id), `LEFT zeigt nicht ${id}`);
  for (const id of ['door_fr', 'door_rr', 'fender_fr', 'wheel_fr', 'wheel_rr', 'mirror_r']) assert.ok(right.has(id), `RIGHT zeigt ${id}`);
  for (const id of ['door_fl', 'door_rl', 'wheel_fl', 'mirror_l']) assert.ok(!right.has(id), `RIGHT zeigt nicht ${id}`);
});

test('Modell: Front/Heck/Oben zeigen die passenden Teile', () => {
  const has = (v: (typeof VIEW_KEYS)[number], ...ids: string[]) => ids.every((i) => projectView(v).parts.includes(i));
  assert.ok(has('FRONT', 'bumper_front', 'hood', 'windshield', 'headlight_l', 'headlight_r', 'grille'));
  assert.ok(has('REAR', 'bumper_rear', 'taillight_l', 'taillight_r', 'trunk'));
  assert.ok(has('TOP', 'roof', 'hood', 'trunk', 'windshield', 'rear_window'));
  assert.ok(!projectView('FRONT').parts.includes('bumper_rear'));
  assert.ok(!projectView('REAR').parts.includes('bumper_front'));
  for (const k of ['FRONT_LEFT', 'FRONT_RIGHT']) assert.ok(has(k as never, 'bumper_front', 'hood', 'windshield'));
  for (const k of ['REAR_LEFT', 'REAR_RIGHT']) assert.ok(has(k as never, 'bumper_rear', 'trunk'));
});

test('Modell: Projektion ist deterministisch, gültiges SVG und klein genug', () => {
  for (const k of VIEW_KEYS) {
    const a = projectView(k), b = projectView(k);
    assert.equal(a, b, 'zwischengespeichert');
    assert.ok(a.shapes.length > 20 && a.shapes.every((s) => /^M[\d. -]+(L[\d. -]+)*Z/.test(s.d) || s.d === ''));
    const size = a.shapes.reduce((n, s) => n + s.d.length + s.e.length + s.shades.reduce((m, x) => m + x.d.length, 0), 0);
    assert.ok(size < 400_000, `${k}: ${size} Zeichen`);
    for (const id of a.parts) assert.ok(a.anchors[id], `${k}: Marker für ${id}`);
  }
});

test('Status: je Teil gewinnt der schwerwiegendste Zustand, fünf Farben mit Symbol und Text', () => {
  assert.equal(topKind(['REPAIRED', 'USAGE', 'CURRENT', 'PRIOR']), 'CURRENT');
  assert.equal(topKind(['REPAIRED', 'USAGE']), 'USAGE');
  assert.equal(topKind([]), null);
  assert.equal(new Set(DAMAGE_KINDS.map((k) => KIND_META[k].color)).size, 5);
  assert.deepEqual(DAMAGE_KINDS.map((k) => KIND_META[k].label), ['Aktueller Schaden', 'Vorschaden', 'Gebrauchsspur', 'Repariert', 'Zu prüfen']);
  for (const k of DAMAGE_KINDS) assert.ok(KIND_META[k].icon.length > 0);
});

/* ------------------------------------------------------------ Dienst */

async function world() {
  const office = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  const e1 = await makeUser({ role: 'EXPERT' });
  const e2 = await makeUser({ role: 'EXPERT' });
  const exp1 = await asAuthUser(e1.user.id), exp2 = await asAuthUser(e2.user.id);
  const cust = await createCustomer(office, CUSTOMER);
  const veh = await createVehicle(office, cust.id, VEHICLE);
  const c = await createCase(office, { customerId: cust.id, vehicleId: veh.id, data: {} });
  await assignExpert(owner, c.id, e1.user.id);
  return { office, owner, exp1, exp2, c };
}

test('Schaden von der Karte: Bauteil liefert Name und Bereich; Zustand, Schwere, Ansicht werden gespeichert', async () => {
  const { exp1, c } = await world();
  const d = await addDamage(exp1, c.id, { partId: 'door_fl', view: 'LEFT', kind: 'CURRENT', severity: 'MEDIUM', damageType: 'Delle', repairKind: 'Ausbeulen' });
  assert.deepEqual([d.component, d.area, d.partId, d.view, d.kind, d.severity], ['Tür vorn links', 'LEFT', 'door_fl', 'LEFT', 'CURRENT', 'MEDIUM']);
  const w = await addDamage(exp1, c.id, { partId: 'wheel_rr', view: 'RIGHT', kind: 'PRIOR', priorNote: 'Bordsteinkante 2024' });
  assert.deepEqual([w.area, w.kind, w.priorNote], ['WHEELS', 'PRIOR', 'Bordsteinkante 2024']);
  const free = await addDamage(exp1, c.id, { component: 'Unterboden', area: 'UNDERBODY', kind: 'CHECK' });
  assert.deepEqual([free.partId, free.area, free.kind], [null, 'UNDERBODY', 'CHECK']);
  const list = await listDamages(exp1, c.id);
  assert.equal(list.length, 3);
});

test('Schaden: ungültige Bauteile/Ansichten/Zustände werden abgewiesen', async () => {
  const { exp1, c } = await world();
  await assert.rejects(addDamage(exp1, c.id, { partId: 'flux_kompensator' }), /Bauteil/);
  await assert.rejects(addDamage(exp1, c.id, { partId: 'door_fl', view: 'UNTEN' }), /Ansicht/);
  await assert.rejects(addDamage(exp1, c.id, { partId: 'door_fl', kind: 'KAPUTT' }));
  await assert.rejects(addDamage(exp1, c.id, { damageType: 'Delle' }), /Bauteil/);
});

test('Schaden ändern: nicht gesendete Felder bleiben erhalten (altes Formular löscht keine Kartendaten)', async () => {
  const { exp1, c } = await world();
  const d = await addDamage(exp1, c.id, { partId: 'hood', view: 'TOP', kind: 'PRIOR', severity: 'LIGHT', priorNote: 'alt', damageType: 'Kratzer' });
  await updateDamage(exp1, d.id, { component: 'Motorhaube', area: 'FRONT', damageType: 'Delle' });
  const r = await db.damage.findUniqueOrThrow({ where: { id: d.id } });
  assert.deepEqual([r.partId, r.view, r.kind, r.severity, r.priorNote, r.damageType], ['hood', 'TOP', 'PRIOR', 'LIGHT', 'alt', 'Delle']);
  await updateDamage(exp1, d.id, { partId: 'hood', kind: 'REPAIRED', severity: '' });
  assert.deepEqual((await db.damage.findUniqueOrThrow({ where: { id: d.id } })).severity, null, 'leer löscht bewusst');
});

test('Fotos verknüpfen: nur Fotos desselben Falls; Auswahl ersetzt die bisherige', async () => {
  const { exp1, c, office } = await world();
  const mkPhoto = async (caseId: string) => {
    const m = await db.media.create({ data: { storageKey: `k${Math.random().toString(36).slice(2)}`, mimeType: 'image/jpeg', sizeBytes: 10, sha256: 'x' } });
    return db.casePhoto.create({ data: { caseId, mediaId: m.id, category: 'DAMAGE' } });
  };
  const p1 = await mkPhoto(c.id), p2 = await mkPhoto(c.id);
  const cust2 = await createCustomer(office, { ...CUSTOMER, email: 'andere@example.test' } as never);
  const veh2 = await createVehicle(office, cust2.id, { ...VEHICLE, licensePlate: 'H XX 1' });
  const other = await createCase(office, { customerId: cust2.id, vehicleId: veh2.id, data: {} });
  const foreign = await mkPhoto(other.id);
  const d = await addDamage(exp1, c.id, { partId: 'bumper_front', view: 'FRONT' });
  assert.equal(await setDamagePhotos(exp1, d.id, [p1.id, foreign.id]), 1, 'fremdes Foto wird ignoriert');
  assert.equal((await db.casePhoto.findUniqueOrThrow({ where: { id: foreign.id } })).damageId, null);
  await setDamagePhotos(exp1, d.id, [p2.id]);
  assert.deepEqual([(await db.casePhoto.findUniqueOrThrow({ where: { id: p1.id } })).damageId, (await db.casePhoto.findUniqueOrThrow({ where: { id: p2.id } })).damageId], [null, d.id]);
  await deleteDamage(exp1, d.id);
  assert.equal((await db.casePhoto.findUniqueOrThrow({ where: { id: p2.id } })).damageId, null, 'beim Löschen werden Fotos gelöst, nicht gelöscht');
});

test('Rechte: Gutachter nur am eigenen Fall; Prüfer/Buchhaltung sehen keine Schäden', async () => {
  const { exp1, exp2, c } = await world();
  await assert.rejects(addDamage(exp2, c.id, { partId: 'hood' }), /nicht gefunden/);
  const reviewer = await asAuthUser((await makeUser({ role: 'REVIEWER' })).user.id);
  await assert.rejects(addDamage(reviewer, c.id, { partId: 'hood' }));
  const accounting = await asAuthUser((await makeUser({ role: 'ACCOUNTING' })).user.id);
  assert.deepEqual(await listDamages(accounting, c.id), []);
  await addDamage(exp1, c.id, { partId: 'hood' });
});
