import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser, CUSTOMER, VEHICLE } from './helpers';
import {
  approvalStatus, buildSearchText, compareRegistration, diffRecords, mayOverwrite, normalizeFuel, normalizeHsn, normalizeManufacturer, normalizeTsn,
  parseDisplacement, parseHsnTsn, parsePower, parseSearchQuery, sourcePriority, splitVehicleName, validateVin,
} from '@/lib/vehicle-data';
import { parseVehicleTables, type NormalizedVehicle } from '@/server/vehicledata/html-parser';
import { assertAllowedUrl, isPrivateAddress } from '@/server/vehicledata/fetcher';
import { createManualRecord, listConflicts, resolveConflict, searchCatalog, upsertNormalized } from '@/server/vehicledata/catalog';
import { identifyByHsnTsn, identifyByVin } from '@/server/vehicledata/identify';
import { callProvider, testConnection, updateProvider } from '@/server/vehicledata/gateway';
import { applyRecordToVehicle, saveRegistration, vehicleProvenance } from '@/server/vehicledata/apply';
import { advanceFetch, createImportPreview, parseCsv, runImport } from '@/server/vehicledata/imports';
import { HsnTsnProvider } from '@/server/vehicledata/providers/hsn-tsn';
import { createCustomer } from '@/server/pipeline/customers';
import { createVehicle, updateVehicle } from '@/server/pipeline/vehicles';
import { ForbiddenError } from '@/server/auth/errors';
import { DomainError } from '@/server/errors';

assertTestDb();
beforeEach(resetDb);

const nv = (over: Partial<NormalizedVehicle> = {}): NormalizedVehicle => ({
  hsn: '0603', tsn: 'ADT', manufacturerNameRaw: 'VW', vehicleNameRaw: 'VW Golf V GT 2.0 TDI', manufacturer: 'Volkswagen', model: 'Golf', generation: 'V', variant: 'GT',
  bodyStyle: null, engineName: '2.0 TDI', driveType: null, fuelType: 'DIESEL', displacementCc: 1968, powerKw: 125, powerHp: 170, torqueNm: null, transmission: null, engineCode: null,
  productionFrom: null, productionTo: null, typeApproval: null, vehicleClass: null, sourceUrl: 'https://www.hsn-tsn.de/beispiel', sourceRecordId: '', raw: { power: '170 PS (125 kW)' }, ...over,
});

async function actors() {
  return {
    owner: await asAuthUser((await makeUser({ role: 'OWNER' })).user.id),
    office: await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id),
    expert: await asAuthUser((await makeUser({ role: 'EXPERT' })).user.id),
    accounting: await asAuthUser((await makeUser({ role: 'ACCOUNTING' })).user.id),
  };
}

/* ------------------------------------------------------------ reine Logik */

test('HSN/TSN: Eingaben werden normalisiert, Fehler klar gemeldet', () => {
  assert.equal(normalizeHsn(' 06 03 ').value, '0603');
  assert.equal(normalizeTsn('adt').value, 'ADT');
  assert.ok(normalizeHsn('06').error && normalizeHsn('06A').error);
  assert.ok(normalizeHsn('06-3!').error);
  assert.ok(normalizeTsn('AB').error);
  const t4 = normalizeTsn('ADT5');
  assert.equal(t4.value, 'ADT');
  assert.match(t4.hint ?? '', /Prüfziffer/);
  for (const v of ['0603/ADT', '0603 adt', '0603-ADT', '0603ADT']) assert.deepEqual(parseHsnTsn(v), { hsn: '0603', tsn: 'ADT' }, v);
  assert.equal(parseHsnTsn('Audi A5'), null);
});

test('Normalisierung: Leistung, Hubraum, Kraftstoff – nichts wird geschätzt', () => {
  assert.deepEqual(parsePower('170 PS (125 kW)'), { kw: 125, hp: 170 });
  assert.deepEqual(parsePower('125 kW / 170 PS'), { kw: 125, hp: 170 });
  assert.deepEqual(parsePower('125 kW'), { kw: 125, hp: null }, 'PS wird nicht aus kW errechnet');
  assert.deepEqual(parsePower('keine Angabe'), { kw: null, hp: null });
  assert.equal(parseDisplacement('1968 ccm'), 1968);
  assert.equal(parseDisplacement('1.498 ccm'), 1498);
  assert.equal(parseDisplacement('1 968 cm³'), 1968);
  assert.equal(parseDisplacement('2,0 Liter'), null, 'Liter werden nicht in cm³ umgerechnet');
  assert.equal(normalizeFuel('Benzin'), 'PETROL');
  assert.equal(normalizeFuel('Diesel'), 'DIESEL');
  assert.equal(normalizeFuel('Elektro'), 'ELECTRIC');
  assert.equal(normalizeFuel('Plug-in-Hybrid (Benzin)'), 'PLUG_IN_HYBRID');
  assert.equal(normalizeFuel('Raketenantrieb'), null);
});

test('Hersteller: Schreibweisen werden vereinheitlicht, unbekannte bleiben unverändert', () => {
  for (const [raw, want] of [['VW', 'Volkswagen'], ['Volkswagen AG', 'Volkswagen'], ['Audi AG', 'Audi'], ['BMW AG', 'BMW'], ['Skoda', 'Škoda'], ['Škoda', 'Škoda'], ['Citroen', 'Citroën'],
    ['Mercedes', 'Mercedes-Benz'], ['Daimler-Benz', 'Mercedes-Benz'], ['Exotenwerk', 'Exotenwerk']] as const) assert.equal(normalizeManufacturer(raw), want, raw);
  assert.equal(normalizeManufacturer('  '), null);
});

test('Fahrzeugname wird getrennt – nur wenn der Hersteller sicher erkannt ist', () => {
  const a = splitVehicleName('Audi A5 2.0 TDI Sportback quattro');
  assert.deepEqual([a.manufacturer, a.model, a.bodyStyle, a.engineName, a.driveType, a.reliable], ['Audi', 'A5', 'Sportback', '2.0 TDI', 'quattro', true]);
  const g = splitVehicleName('VW Golf V GT 2.0 TDI');
  assert.deepEqual([g.manufacturer, g.model, g.generation, g.variant, g.engineName], ['Volkswagen', 'Golf', 'V', 'GT', '2.0 TDI']);
  const u = splitVehicleName('Exotenwerk Zyx 1.0');
  assert.deepEqual([u.model, u.variant, u.bodyStyle, u.reliable], [null, null, null, false], 'unbekannter Hersteller → nichts erfinden');
});

test('FIN: 17 Zeichen, ohne I/O/Q', () => {
  assert.equal(validateVin('wauzzz8t0ba000001').value, 'WAUZZZ8T0BA000001');
  assert.ok(validateVin('WAUZZZ8T0BA00000').error, 'zu kurz');
  assert.ok(validateVin('WAUZZZ8T0BA00000I').error, 'enthält I');
  assert.ok(validateVin('').error);
});

test('Vergleich & Priorität: Abweichungen erkennen, bessere Daten nie überschreiben', () => {
  const own = nv();
  assert.deepEqual(diffRecords(own, nv()), []);
  assert.deepEqual(diffRecords(own, nv({ powerKw: 150 })), ['powerKw']);
  assert.ok(diffRecords(own, nv({ vehicleNameRaw: 'VW Golf V GT' })).includes('name'), 'Beispiel aus der Aufgabe: Bezeichnung weicht ab');
  assert.deepEqual(diffRecords(own, nv({ powerKw: null, displacementCc: null })), [], 'fehlende Werte sind keine Abweichung');
  assert.ok(sourcePriority('MANUAL_CONFIRMED') > sourcePriority('DAT', { license: 'LICENSED' }));
  assert.ok(sourcePriority('DAT', { license: 'LICENSED' }) > sourcePriority('VIN'));
  assert.ok(sourcePriority('VIN') > sourcePriority('KBA'));
  assert.ok(sourcePriority('KBA') > sourcePriority('HSN_TSN'));
  assert.ok(sourcePriority('HSN_TSN') > sourcePriority('IMPORT_FILE'));
  assert.equal(mayOverwrite(100, 50), false);
  assert.equal(mayOverwrite(50, 50), true);
  assert.equal(mayOverwrite(null, 20), true);
});

test('Suche: HSN/TSN, Teile, Freitext', () => {
  assert.deepEqual(parseSearchQuery('0588 ABC'), { hsn: '0588', tsn: 'ABC', tokens: ['0588', 'abc'] });
  assert.equal(parseSearchQuery('0588/abc').tsn, 'ABC');
  assert.equal(parseSearchQuery('0588').hsnPrefix, '0588');
  assert.deepEqual(parseSearchQuery('Audi A5').tokens, ['audi', 'a5']);
  assert.equal(parseSearchQuery('A5 190 PS').hsn, undefined);
  assert.match(buildSearchText({ hsn: '0603', tsn: 'ADT', manufacturer: 'Volkswagen', model: 'Golf', fuelType: 'DIESEL', powerKw: 125, powerHp: 170, displacementCc: 1968 }), /0603\/adt.*volkswagen.*diesel.*170 ps.*1968 ccm/);
});

test('Fahrzeugschein-Abgleich und Zulassungsstatus behaupten nur Belegtes', () => {
  const rec = { manufacturer: 'Audi', powerKw: 140, displacementCc: 1968, fuelType: 'DIESEL' };
  const ok = compareRegistration({ manufacturer: 'Audi AG', powerKw: 140, displacementCc: 1968, fuelType: 'DIESEL' }, rec);
  assert.ok(ok.every((r) => r.state === 'ok'));
  assert.equal(approvalStatus('EC_TYPE_APPROVAL', ok).state, 'conform');
  const bad = compareRegistration({ powerKw: 140 }, { ...rec, powerKw: 150 });
  assert.equal(bad.find((r) => r.field === 'powerKw')?.state, 'deviation');
  assert.equal(approvalStatus('EC_TYPE_APPROVAL', bad).state, 'deviation');
  assert.equal(approvalStatus(null, ok).state, 'unknown', 'ohne Genehmigungsart keine Konformitätsaussage');
  assert.equal(approvalStatus('ABE', compareRegistration({}, rec)).state, 'unknown', 'ohne Fahrzeugscheinwerte keine Aussage');
  assert.equal(approvalStatus('INDIVIDUAL', ok).state, 'individual');
});

/* ------------------------------------------------------------ Parser & Sicherheit */

const FIXTURE = `<!doctype html><html><head><script>var x = "0000/XXX 1 PS";</script><style>td{}</style></head><body>
<h1>Beispielseite (Test-Fixture)</h1>
<table><thead><tr><th>HSN/TSN</th><th>Fahrzeug</th><th>Leistung</th><th>Hubraum</th><th>Kraftstoff</th></tr></thead><tbody>
<tr><td><a href="/beispiel/0603-adt">0603/ADT</a></td><td>Volkswagen Golf V GT 2.0 TDI</td><td>170 PS (125 kW)</td><td>1968 ccm</td><td>Diesel</td></tr>
<tr><td>0588/ABC</td><td>Audi A5 2.0 TDI Sportback quattro</td><td>190 PS (140 kW)</td><td>1.968 ccm</td><td>Diesel</td></tr>
<tr><td>kaputt</td><td>Zeile ohne Schlüsselnummer</td><td>1 PS</td><td>1 ccm</td><td>Benzin</td></tr>
<tr><td>0005/BBB</td><td><img src=x onerror=alert(1)>Opel Corsa &lt;b&gt;1.2</td><td></td><td></td><td></td></tr>
<tr><td>0001/CCC</td><td>unvollständig
</table></body></html>`;

test('HSN/TSN-Parser: Tabellen lesen, Werte normalisieren, Originalwerte behalten, defektes HTML überstehen', () => {
  const { rows, tables } = parseVehicleTables(FIXTURE, 'https://www.hsn-tsn.de/beispiel');
  assert.equal(tables, 1);
  const ok = rows.filter((r) => r.ok).map((r) => (r.ok ? r.vehicle : null)!);
  const golf = ok.find((v) => v.hsn === '0603')!;
  assert.deepEqual([golf.tsn, golf.manufacturer, golf.model, golf.generation, golf.variant, golf.engineName, golf.powerKw, golf.powerHp, golf.displacementCc, golf.fuelType],
    ['ADT', 'Volkswagen', 'Golf', 'V', 'GT', '2.0 TDI', 125, 170, 1968, 'DIESEL']);
  assert.equal(golf.raw.power, '170 PS (125 kW)', 'Rohwert bleibt erhalten');
  assert.equal(golf.sourceUrl, 'https://www.hsn-tsn.de/beispiel/0603-adt');
  const audi = ok.find((v) => v.hsn === '0588')!;
  assert.deepEqual([audi.manufacturer, audi.model, audi.bodyStyle, audi.driveType, audi.displacementCc], ['Audi', 'A5', 'Sportback', 'quattro', 1968]);
  assert.ok(rows.some((r) => !r.ok), 'Zeile ohne HSN/TSN wird als ungültig gemeldet, bricht aber nichts ab');
  const opel = ok.find((v) => v.hsn === '0005')!;
  assert.equal(opel.powerKw, null, 'Fehlendes bleibt null');
  assert.ok(!JSON.stringify(ok).includes('onerror'), 'kein HTML wird übernommen');
  assert.ok(!ok.some((v) => v.hsn === '0000'), 'Skripte werden ignoriert');
});

test('Sicherer Abruf: nur https, nur freigegebene Hosts, keine privaten Ziele', () => {
  const hosts = ['www.hsn-tsn.de'];
  assert.doesNotThrow(() => assertAllowedUrl('https://www.hsn-tsn.de/x', hosts));
  for (const bad of ['http://www.hsn-tsn.de/x', 'https://evil.example/x', 'https://www.hsn-tsn.de.evil.example/', 'https://127.0.0.1/', 'https://[::1]/', 'https://user:pw@www.hsn-tsn.de/', 'https://www.hsn-tsn.de:8443/', 'file:///etc/passwd', 'javascript:alert(1)', 'nonsense'])
    assert.throws(() => assertAllowedUrl(bad, hosts), bad);
  for (const ip of ['10.0.0.1', '127.0.0.1', '192.168.1.5', '169.254.169.254', '172.16.0.1', '::1', 'fd00::1', '::ffff:10.0.0.1']) assert.equal(isPrivateAddress(ip), true, ip);
  assert.equal(isPrivateAddress('93.184.216.34'), false);
});

test('CSV-Leser: Trennzeichen, Anführungszeichen, BOM', () => {
  const rows = parseCsv('﻿hsn;tsn;name\r\n0603;ADT;"VW Golf; ""GT"""\r\n');
  assert.deepEqual(rows, [['hsn', 'tsn', 'name'], ['0603', 'ADT', 'VW Golf; "GT"']]);
});

/* ------------------------------------------------------------ Datenbank: Speichern, Konflikte, Identifikation */

test('Speichern: neu → vorhanden → Konflikt; vorhandene Daten werden nie überschrieben', async () => {
  const a = await db.$transaction((tx) => upsertNormalized(tx, nv(), { source: 'HSN_TSN' }));
  assert.equal(a.outcome, 'created');
  assert.equal(a.record.verificationStatus, 'PARTIAL', 'einzelne Drittquelle → PARTIAL');
  assert.ok(a.record.sourceHash && a.record.importerVersion && a.record.searchText.includes('0603/adt'));
  assert.equal((await db.vehicleMake.count()), 1);
  const b = await db.$transaction((tx) => upsertNormalized(tx, nv(), { source: 'HSN_TSN' }));
  assert.equal(b.outcome, 'exists');
  assert.equal(await db.vehicleHsnTsn.count(), 1, 'keine Dublette');
  const c = await db.$transaction((tx) => upsertNormalized(tx, nv({ powerKw: 150, powerHp: 204 }), { source: 'HSN_TSN' }));
  assert.equal(c.outcome, 'conflict');
  const rec = await db.vehicleHsnTsn.findFirstOrThrow();
  assert.equal(rec.powerKw, 125, 'Bestand bleibt unverändert');
  assert.equal(rec.verificationStatus, 'CONFLICT');
  assert.equal(await db.vehicleDataConflict.count({ where: { status: 'OPEN' } }), 1);
  await db.$transaction((tx) => upsertNormalized(tx, nv({ powerKw: 150, powerHp: 204 }), { source: 'HSN_TSN' }));
  assert.equal(await db.vehicleDataConflict.count(), 1, 'derselbe eingehende Stand erzeugt nur einen Konflikt');
  // zweite Quelle, identische Werte → bleibt eine Zeile; lizenzierte Quelle verifiziert
  await db.$transaction((tx) => upsertNormalized(tx, nv({ powerKw: 125, powerHp: 170 }), { source: 'KBA', license: 'LICENSED' }));
  assert.equal(await db.vehicleHsnTsn.count(), 1);
});

test('DB-Constraint: ungültige HSN/TSN/Werte werden auch ohne Anwendung abgelehnt', async () => {
  await assert.rejects(db.vehicleHsnTsn.create({ data: { hsn: '06', tsn: 'ADT', source: 'MANUAL' } }));
  await assert.rejects(db.vehicleHsnTsn.create({ data: { hsn: '0603', tsn: 'adt', source: 'MANUAL' } }));
  await assert.rejects(db.vehicleHsnTsn.create({ data: { hsn: '0603', tsn: 'ADT', source: 'MANUAL', powerKw: 0 } }));
});

test('Konflikt lösen: Zusammenführen, Eigene behalten, Externe übernehmen', async () => {
  const { owner } = await actors();
  const mk = async (hsn: string, inc: Partial<NormalizedVehicle>) => {
    await db.$transaction((tx) => upsertNormalized(tx, nv({ hsn, powerKw: 125, powerHp: 170, torqueNm: null }), { source: 'HSN_TSN' }));
    await db.$transaction((tx) => upsertNormalized(tx, nv({ hsn, ...inc }), { source: 'HSN_TSN' }));
  };
  await mk('0603', { powerKw: 150, powerHp: 204, bodyStyle: 'Limousine' });
  await mk('0604', { powerKw: 150, powerHp: 204 });
  await mk('0605', { powerKw: 150, powerHp: 204 });
  const open = (await listConflicts(owner)).rows;
  assert.equal(open.length, 3);
  const by = (hsn: string) => open.find((c) => c.hsn === hsn)!;
  assert.deepEqual(by('0603').own.powerKw, '125 kW');
  assert.deepEqual(by('0603').incoming.powerKw, '150 kW');
  await resolveConflict(owner, by('0603').id, 'MERGE');
  let r = await db.vehicleHsnTsn.findFirstOrThrow({ where: { hsn: '0603' } });
  assert.equal(r.powerKw, 125, 'Zusammenführen behält vorhandene Werte');
  assert.equal(r.bodyStyle, 'Limousine', '…und füllt nur Lücken');
  assert.equal(r.verificationStatus, 'PARTIAL');
  await resolveConflict(owner, by('0604').id, 'KEEP_OWN');
  assert.equal((await db.vehicleHsnTsn.findFirstOrThrow({ where: { hsn: '0604' } })).powerKw, 125);
  await resolveConflict(owner, by('0605').id, 'TAKE_EXTERNAL');
  assert.equal((await db.vehicleHsnTsn.findFirstOrThrow({ where: { hsn: '0605' } })).powerKw, 150);
  assert.equal((await listConflicts(owner)).total, 0);
  await assert.rejects(resolveConflict(owner, by('0605').id, 'KEEP_OWN'), DomainError, 'bereits gelöst');
});

test('Identifikation: eigene Datenbank zuerst, kein externer Abruf; ohne Freigabe kein Provider', async () => {
  const { office } = await actors();
  let calls = 0;
  const orig = HsnTsnProvider.lookupByHsnTsn;
  HsnTsnProvider.lookupByHsnTsn = async () => { calls++; return { status: 'ok', data: [nv({ hsn: '0588', tsn: 'ABC', vehicleNameRaw: 'Audi A5 2.0 TDI', manufacturer: 'Audi', model: 'A5', powerKw: 140, powerHp: 190 })] }; };
  try {
    await db.$transaction((tx) => upsertNormalized(tx, nv(), { source: 'HSN_TSN' }));
    const hit = await identifyByHsnTsn(office, '0603', 'adt');
    assert.equal(hit.status, 'found');
    assert.equal(hit.cached, true);
    assert.equal(hit.records[0].manufacturer, 'Volkswagen');
    assert.equal(calls, 0, 'kein externer Request bei Treffer');
    const miss = await identifyByHsnTsn(office, '0588', 'ABC');
    assert.equal(miss.status, 'not_found');
    assert.equal(miss.external.state, 'not_enabled', 'Anbieter nicht freigegeben');
    assert.equal(calls, 0);
    const bad = await identifyByHsnTsn(office, '06', 'A');
    assert.equal(bad.status, 'invalid');
    assert.ok(bad.errors.hsn && bad.errors.tsn);
  } finally { HsnTsnProvider.lookupByHsnTsn = orig; }
});

test('Anbieter-Freigabe: Automatik erst nach APPROVED/LICENSED; danach Abruf, Cache, 429-Pause', async () => {
  const { owner, office, expert } = await actors();
  await assert.rejects(updateProvider(office, 'HSN_TSN', { enabled: true }), ForbiddenError);
  await assert.rejects(updateProvider(expert, 'HSN_TSN', { autoLookup: true }), ForbiddenError);
  await assert.rejects(updateProvider(owner, 'HSN_TSN', { enabled: true, autoLookup: true }), /Freigabe|Freigegeben|Lizenz/);
  await assert.rejects(updateProvider(owner, 'KBA', { enabled: true }), /nicht angebunden/);
  await assert.rejects(updateProvider(owner, 'OWN', { licenseStatus: 'APPROVED' }), DomainError);
  await assert.rejects(updateProvider(owner, 'HSN_TSN', { urlTemplate: 'http://www.hsn-tsn.de/{hsn}/{tsn}' }), /https/);
  await assert.rejects(updateProvider(owner, 'HSN_TSN', { urlTemplate: 'https://evil.example/{hsn}/{tsn}' }), /freigegeben/);
  await updateProvider(owner, 'HSN_TSN', { licenseStatus: 'APPROVED', enabled: true, autoLookup: true });
  const row = await db.vehicleProvider.findUniqueOrThrow({ where: { key: 'HSN_TSN' } });
  assert.deepEqual([row.licenseStatus, row.enabled, row.autoLookup, row.massImport], ['APPROVED', true, true, false]);

  let calls = 0;
  const orig = HsnTsnProvider.lookupByHsnTsn;
  HsnTsnProvider.lookupByHsnTsn = async () => { calls++; return { status: 'ok', data: [nv({ hsn: '0588', tsn: 'ABC', vehicleNameRaw: 'Audi A5 2.0 TDI', manufacturer: 'Audi', model: 'A5', powerKw: 140, powerHp: 190 })] }; };
  try {
    const first = await identifyByHsnTsn(office, '0588', 'ABC');
    assert.equal(first.status, 'found');
    assert.equal(first.external.state, 'ok');
    assert.equal(calls, 1);
    const second = await identifyByHsnTsn(office, '0588', 'ABC');
    assert.equal(second.cached, true);
    assert.equal(calls, 1, 'zweite Suche kommt aus der eigenen Datenbank');
    assert.equal(await db.vehicleProviderLog.count({ where: { providerKey: 'HSN_TSN' } }), 1);

    // Anbieter nicht erreichbar → Antwort bleibt nutzbar
    HsnTsnProvider.lookupByHsnTsn = async () => ({ status: 'unavailable', message: 'x', category: 'TLS_ERROR' });
    const down = await identifyByHsnTsn(office, '0603', 'ADT');
    assert.equal(down.status, 'not_found');
    assert.equal(down.external.state, 'unavailable');
    assert.match(down.external.message ?? '', /nicht erreichbar/);

    // HTTP 429 → Provider pausiert automatisch, weitere Anfragen laufen nicht
    HsnTsnProvider.lookupByHsnTsn = async () => ({ status: 'rate_limited', message: 'zu viele', category: 'RATE_LIMITED', httpStatus: 429, retryAfterSec: 120 });
    await callProvider('HSN_TSN', 'lookup', 'live', (p, cfg) => p.lookupByHsnTsn('0001', 'AAA', { config: cfg }));
    const paused = await db.vehicleProvider.findUniqueOrThrow({ where: { key: 'HSN_TSN' } });
    assert.ok(paused.pausedUntil && paused.pausedUntil.getTime() > Date.now());
    calls = 0;
    HsnTsnProvider.lookupByHsnTsn = async () => { calls++; return { status: 'not_found', message: '' }; };
    const blocked = await callProvider('HSN_TSN', 'lookup', 'live', (p, cfg) => p.lookupByHsnTsn('0002', 'AAA', { config: cfg }));
    assert.equal(blocked.status, 'paused');
    assert.equal(calls, 0, 'während der Pause kein Request');
  } finally { HsnTsnProvider.lookupByHsnTsn = orig; }
});

test('Lokales Rate-Limit: kein Request über dem Kontingent', async () => {
  const { owner } = await actors();
  await updateProvider(owner, 'HSN_TSN', { licenseStatus: 'APPROVED', enabled: true, autoLookup: true, rateLimitPerMin: 2 });
  let calls = 0;
  const orig = HsnTsnProvider.lookupByHsnTsn;
  HsnTsnProvider.lookupByHsnTsn = async () => { calls++; return { status: 'not_found', message: '' }; };
  try {
    const out = [];
    for (let i = 0; i < 4; i++) out.push((await callProvider('HSN_TSN', 'lookup', 'live', (p, c) => p.lookupByHsnTsn('0001', 'AAA', { config: c }))).status);
    assert.deepEqual(out, ['not_found', 'not_found', 'rate_limited', 'rate_limited']);
    assert.equal(calls, 2);
  } finally { HsnTsnProvider.lookupByHsnTsn = orig; }
});

test('Verbindungstest: nicht konfiguriert und TLS-Fehler werden ehrlich gemeldet, nichts wird gespeichert', async () => {
  const { owner } = await actors();
  const a = await testConnection(owner, 'HSN_TSN');
  assert.equal(a.status, 'not_configured');
  const k = await testConnection(owner, 'KBA');
  assert.equal(k.status, 'not_configured', 'KBA ist nur Platzhalter – nichts wird erfunden');
  assert.equal(await db.vehicleHsnTsn.count(), 0);
});

test('Mehrfachtreffer werden nicht automatisch ausgewählt', async () => {
  const { office } = await actors();
  await db.$transaction(async (tx) => {
    await upsertNormalized(tx, nv({ sourceRecordId: '1', vehicleNameRaw: 'VW Golf V 1.9 TDI', powerKw: 77, powerHp: 105, displacementCc: 1896 }), { source: 'HSN_TSN' });
    await upsertNormalized(tx, nv({ sourceRecordId: '2', vehicleNameRaw: 'VW Golf V 2.0 TDI', powerKw: 103, powerHp: 140 }), { source: 'HSN_TSN' });
  });
  const r = await identifyByHsnTsn(office, '0603', 'ADT');
  assert.equal(r.status, 'multiple');
  assert.equal(r.records.length, 2);
});

test('Manuell anlegen: eigener, unverifizierter Datensatz; Doppelte werden nicht überschrieben', async () => {
  const { office } = await actors();
  const ok = await createManualRecord(office, { hsn: '7777', tsn: 'abc', manufacturer: 'VW', model: 'Testmodell', powerKw: '66', fuelType: 'PETROL' });
  assert.equal(ok.outcome, 'created');
  assert.equal(ok.record.source, 'MANUAL');
  assert.equal(ok.record.verificationStatus, 'UNVERIFIED');
  assert.equal(ok.record.manufacturer, 'Volkswagen');
  const dup = await createManualRecord(office, { hsn: '7777', tsn: 'ABC', manufacturer: 'VW', model: 'Anderes', powerKw: '99' });
  assert.equal(dup.outcome, 'conflict');
  assert.equal((await db.vehicleHsnTsn.findFirstOrThrow({ where: { hsn: '7777' } })).powerKw, 66);
  await assert.rejects(createManualRecord(office, { hsn: '77', tsn: 'ABC', manufacturer: 'X', model: 'Y' }));
});

test('Katalogsuche: HSN, HSN/TSN, Hersteller/Modell, Leistung, Hubraum', async () => {
  const { office } = await actors();
  await db.$transaction(async (tx) => {
    await upsertNormalized(tx, nv(), { source: 'HSN_TSN' });
    await upsertNormalized(tx, nv({ hsn: '0588', tsn: 'ABC', manufacturerNameRaw: 'Audi', vehicleNameRaw: 'Audi A5 Sportback 2.0 TDI', manufacturer: 'Audi', model: 'A5', powerKw: 140, powerHp: 190, displacementCc: 1968 }), { source: 'HSN_TSN' });
  });
  const ids = async (q: string) => (await searchCatalog(office, { q })).rows.map((r) => `${r.hsn}/${r.tsn}`).sort();
  assert.deepEqual(await ids('0588'), ['0588/ABC']);
  assert.deepEqual(await ids('0588 ABC'), ['0588/ABC']);
  assert.deepEqual(await ids('0588/abc'), ['0588/ABC']);
  assert.deepEqual(await ids('Audi A5'), ['0588/ABC']);
  assert.deepEqual(await ids('A5 190 PS'), ['0588/ABC']);
  assert.deepEqual(await ids('2.0 TDI'), ['0588/ABC', '0603/ADT']);
  assert.deepEqual(await ids('1968 Diesel'), ['0588/ABC', '0603/ADT']);
  assert.deepEqual(await ids('golf'), ['0603/ADT']);
  assert.deepEqual(await ids('gibt es nicht'), []);
});

test('Rechte: Buchhaltung sieht keine Fahrzeugdaten, Büro/Gutachter identifizieren, nur Admin verwaltet', async () => {
  const { owner, office, expert, accounting } = await actors();
  await assert.rejects(identifyByHsnTsn(accounting, '0603', 'ADT'), ForbiddenError);
  await assert.rejects(searchCatalog(accounting, { q: 'x' }), ForbiddenError);
  await identifyByHsnTsn(office, '0603', 'ADT');
  await identifyByHsnTsn(expert, '0603', 'ADT');
  await assert.rejects(listConflicts(office), ForbiddenError);
  await assert.rejects(createImportPreview(office, { mode: 'CSV', text: 'hsn;tsn\n0603;ADT' }), ForbiddenError);
  await assert.rejects(createImportPreview(expert, { mode: 'CSV', text: 'hsn;tsn\n0603;ADT' }), ForbiddenError);
  await createImportPreview(owner, { mode: 'CSV', text: 'hsn;tsn;name\n0603;ADT;VW Golf' });
});

/* ------------------------------------------------------------ Import */

test('Import (CSV): Vorschau mit Neu/Vorhanden/Konflikt/Ungültig, dann Import ohne Überschreiben', async () => {
  const { owner } = await actors();
  await db.$transaction((tx) => upsertNormalized(tx, nv(), { source: 'IMPORT_FILE' }));
  await db.$transaction((tx) => upsertNormalized(tx, nv({ hsn: '0588', tsn: 'ABC', vehicleNameRaw: 'Audi A5', manufacturer: 'Audi', model: 'A5', powerKw: 140, powerHp: 190 }), { source: 'IMPORT_FILE' }));
  const csv = [
    'HSN;TSN;Hersteller;Fahrzeug;Leistung;Hubraum;Kraftstoff',
    '0603;ADT;VW;VW Golf V GT 2.0 TDI;170 PS (125 kW);1968 ccm;Diesel',          // vorhanden, identisch
    '0588;ABC;Audi;Audi A5;204 PS (150 kW);1968 ccm;Diesel',                     // Konflikt (kW)
    '1234;XYZ;Opel;Opel Corsa 1.2;75 PS (55 kW);1229 ccm;Benzin',                // neu
    '1235;XYZ;Ford;Ford Fiesta;;;Benzin',                                         // neu, ohne Leistung
    'abc;XYZ;Ford;Ford Ka;;;',                                                    // ungültig
    '1234;XYZ;Opel;Opel Corsa 1.2;75 PS (55 kW);1229 ccm;Benzin',                // doppelt in Datei
  ].join('\n');
  const jobId = await createImportPreview(owner, { mode: 'CSV', text: csv, label: 'Test' });
  let job = await db.vehicleImportJob.findUniqueOrThrow({ where: { id: jobId } });
  assert.deepEqual([job.status, job.total, job.countNew, job.countExists, job.countConflict, job.countInvalid], ['PREVIEW', 6, 2, 2, 1, 1]);
  assert.equal(await db.vehicleHsnTsn.count(), 2, 'Vorschau schreibt nichts');
  job = await runImport(owner, jobId);
  assert.equal(job.status, 'COMPLETED');
  assert.equal(job.countImported, 2);
  assert.equal(await db.vehicleHsnTsn.count(), 4);
  assert.equal((await db.vehicleHsnTsn.findFirstOrThrow({ where: { hsn: '0588' } })).powerKw, 140, 'Bestand nicht überschrieben');
  assert.equal(await db.vehicleDataConflict.count({ where: { status: 'OPEN' } }), 1, 'Konflikt wurde vorgemerkt');
  const corsa = await db.vehicleHsnTsn.findFirstOrThrow({ where: { hsn: '1234' } });
  assert.deepEqual([corsa.source, corsa.verificationStatus, corsa.powerHp], ['IMPORT_FILE', 'UNVERIFIED', 75]);
  await assert.rejects(runImport(owner, jobId), /beendet/);
  await assert.rejects(createImportPreview(owner, { mode: 'CSV', text: 'name\nx' }), /HSN/);
  await assert.rejects(createImportPreview(owner, { mode: 'EXCEL', text: '' }), /CSV/);
  await assert.rejects(createImportPreview(owner, { mode: 'MANUFACTURER' }), /nicht/);
});

test('Import (JSON) und Einzel-Abruf mit Freigabeprüfung', async () => {
  const { owner } = await actors();
  const id = await createImportPreview(owner, { mode: 'JSON', text: JSON.stringify([{ hsn: '2000', tsn: 'AAA', hersteller: 'Skoda', fahrzeug: 'Skoda Octavia 1.6', kw: 75 }]) });
  assert.equal((await runImport(owner, id)).status, 'COMPLETED');
  const r = await db.vehicleHsnTsn.findFirstOrThrow({ where: { hsn: '2000' } });
  assert.deepEqual([r.manufacturer, r.model, r.powerKw, r.powerHp], ['Škoda', 'Octavia', 75, null]);

  // Einzelabruf über den Anbieter: ohne Freigabe FAILED
  await updateProvider(owner, 'HSN_TSN', { licenseStatus: 'REVIEW_REQUIRED', enabled: true });
  const orig = HsnTsnProvider.lookupByHsnTsn;
  HsnTsnProvider.lookupByHsnTsn = async () => ({ status: 'ok', data: [nv({ hsn: '3000', tsn: 'BBB' })] });
  try {
    const jid = await createImportPreview(owner, { mode: 'SINGLE', providerKey: 'HSN_TSN', hsn: '3000', tsn: 'bbb' });
    const j = await db.vehicleImportJob.findUniqueOrThrow({ where: { id: jid } });
    assert.equal(j.status, 'PREVIEW', 'Einzelabruf durch den Admin ist als Test-Abfrage erlaubt');
    assert.equal(j.countNew, 1);
    // URL-Massenabruf braucht die Freigabe
    const uid = await createImportPreview(owner, { mode: 'URL', providerKey: 'HSN_TSN', urls: 'https://www.hsn-tsn.de/a' });
    const u = await db.vehicleImportJob.findUniqueOrThrow({ where: { id: uid } });
    assert.equal(u.status, 'FAILED');
    assert.match(u.message ?? '', /Massenimport/);
    // 429 während des Abrufs → Job pausiert und ist fortsetzbar
    await updateProvider(owner, 'HSN_TSN', { licenseStatus: 'APPROVED', massImport: true });
    let n = 0;
    const origD = HsnTsnProvider.getVehicleDetails;
    HsnTsnProvider.getVehicleDetails = async (ref) => {
      n++;
      if (n === 2) return { status: 'rate_limited', message: 'zu viele', category: 'RATE_LIMITED', httpStatus: 429, retryAfterSec: 1 };
      return { status: 'ok', data: [nv({ hsn: `40${n}0`.slice(0, 4), tsn: 'CCC', sourceUrl: ref.sourceUrl ?? null })] };
    };
    try {
      const pid = await createImportPreview(owner, { mode: 'URL', providerKey: 'HSN_TSN', urls: 'https://www.hsn-tsn.de/a https://www.hsn-tsn.de/b https://www.hsn-tsn.de/c' });
      const p = await db.vehicleImportJob.findUniqueOrThrow({ where: { id: pid } });
      assert.equal(p.status, 'PAUSED');
      assert.equal(p.cursor, 1);
      await db.vehicleProvider.update({ where: { key: 'HSN_TSN' }, data: { pausedUntil: null } });
      const done = await advanceFetch(owner, pid);
      assert.equal(done.status, 'PREVIEW');
      assert.equal(done.cursor, 3);
    } finally { HsnTsnProvider.getVehicleDetails = origD; }
  } finally { HsnTsnProvider.lookupByHsnTsn = orig; }
});

/* ------------------------------------------------------------ Fahrzeug übernehmen, Prioritäten, Historie */

async function vehicleWorld() {
  const a = await actors();
  const cust = await createCustomer(a.office, CUSTOMER);
  const veh = await createVehicle(a.office, cust.id, VEHICLE);
  const rec = (await db.$transaction((tx) => upsertNormalized(tx, nv(), { source: 'HSN_TSN' }))).record;
  return { ...a, cust, veh, rec };
}

test('Fahrzeug übernehmen: Werte aus dem Datensatz, Herkunft + Historie, Audit', async () => {
  const { office, veh, rec } = await vehicleWorld();
  const res = await applyRecordToVehicle(office, veh.id, rec.id);
  assert.ok(res.applied.includes('powerKw') && res.applied.includes('displacementCc'));
  const v = await db.vehicle.findUniqueOrThrow({ where: { id: veh.id } });
  assert.deepEqual([v.hsn, v.tsn, v.manufacturer, v.model, v.powerKw, v.powerHp, v.displacementCc, v.fuelType, v.hsnTsnId], ['0603', 'ADT', 'VW', 'Golf', 125, 170, 1968, 'DIESEL', rec.id]);
  assert.ok(res.kept.some((k) => k.field === 'manufacturer'), 'beim Anlegen eingegebener Hersteller gilt als bestätigt');
  const prov = await vehicleProvenance(office, veh.id);
  const kw = prov.points.find((p) => p.field === 'powerKw')!;
  assert.deepEqual([kw.source, kw.priority, kw.status], ['HSN_TSN', 50, 'PARTIAL']);
  assert.ok(prov.history.some((h) => h.field === 'powerKw' && h.newValue === '125' && h.actor));
  assert.ok(prov.history.some((h) => h.field === '*' && /identifiziert/.test(h.note ?? '')));
  assert.equal(await db.auditLog.count({ where: { action: 'vehicle.identify' } }), 1);
});

test('Priorität: vom Gutachter bestätigte Daten werden nie von schlechteren Quellen überschrieben', async () => {
  const { office, veh, rec } = await vehicleWorld();
  // Gutachter trägt Leistung manuell ein → Priorität 100
  await updateVehicle(office, veh.id, { ...VEHICLE, powerKw: '130' });
  const before = await vehicleProvenance(office, veh.id);
  assert.equal(before.points.find((p) => p.field === 'powerKw')?.priority, 100);
  const res = await applyRecordToVehicle(office, veh.id, rec.id);
  assert.ok(res.kept.some((k) => k.field === 'powerKw'));
  assert.equal((await db.vehicle.findUniqueOrThrow({ where: { id: veh.id } })).powerKw, 130, 'manuell bestätigter Wert bleibt');
  assert.ok(res.applied.includes('displacementCc'), 'Felder ohne bestätigten Wert werden gefüllt');
  // Leere Quellwerte löschen nichts
  const empty = (await db.$transaction((tx) => upsertNormalized(tx, nv({ hsn: '9999', tsn: 'ZZZ', powerKw: null, powerHp: null, displacementCc: null, fuelType: null }), { source: 'HSN_TSN' }))).record;
  await applyRecordToVehicle(office, veh.id, empty.id);
  assert.equal((await db.vehicle.findUniqueOrThrow({ where: { id: veh.id } })).displacementCc, 1968);
});

test('Formular-Update ohne technische Felder lässt gespeicherte Fahrzeugdaten unberührt', async () => {
  const { office, veh, rec } = await vehicleWorld();
  await applyRecordToVehicle(office, veh.id, rec.id);
  await updateVehicle(office, veh.id, { ...VEHICLE, color: 'Blau' });
  const v = await db.vehicle.findUniqueOrThrow({ where: { id: veh.id } });
  assert.deepEqual([v.powerKw, v.hsn, v.color], [125, '0603', 'Blau']);
});

test('Neues Fahrzeug mit Datensatz: Werte behalten die Quelle, geänderte gelten als manuell', async () => {
  const { office, cust, rec } = await vehicleWorld();
  const veh = await createVehicle(office, cust.id, { ...VEHICLE, manufacturer: 'Volkswagen', model: 'Golf', hsn: '0603', tsn: 'ADT', hsnTsnId: rec.id, powerKw: '125', powerHp: '175', displacementCc: '1968' });
  const prov = await vehicleProvenance(office, veh.id);
  const p = (f: string) => prov.points.find((x) => x.field === f)!;
  assert.equal(p('powerKw').source, 'HSN_TSN');
  assert.equal(p('powerHp').source, 'MANUAL_CONFIRMED', 'abweichend vom Datensatz → manuell');
  assert.equal(p('manufacturer').source, 'HSN_TSN');
});

test('FIN-Suche: ungültige FIN abgewiesen, bekannte Fahrzeuge nur im Zugriffsbereich', async () => {
  const { office, expert, veh } = await vehicleWorld();
  await updateVehicle(office, veh.id, { ...VEHICLE, vin: 'WAUZZZ8T0BA000001' });
  const ok = await identifyByVin(office, 'wauzzz8t0ba000001');
  assert.equal(ok.status, 'ok');
  assert.equal(ok.known.length, 1);
  assert.equal(ok.provider.state, 'not_configured');
  assert.equal((await identifyByVin(expert, 'WAUZZZ8T0BA000001')).known.length, 0, 'Gutachter ohne Fall sieht das Fahrzeug nicht');
  assert.equal((await identifyByVin(office, 'ZU-KURZ')).status, 'invalid');
});

test('Fahrzeugschein: Abgleich, Abweichung, keine Behauptung ohne Datenbasis', async () => {
  const { office, veh, rec } = await vehicleWorld();
  await applyRecordToVehicle(office, veh.id, rec.id);
  const res = await saveRegistration(office, veh.id, { hsn: '0603', tsn: 'ADT', manufacturer: 'Volkswagen AG', powerKw: '140', displacementCc: '1968', fuel: 'Diesel', vin: 'WAUZZZ8T0BA000001', approvalKind: 'EC_TYPE_APPROVAL', seats: '5' });
  assert.equal(res.rows.find((r) => r.field === 'powerKw')?.state, 'deviation', '140 kW laut Schein ↔ 125 kW in der Datenbank');
  assert.equal(res.rows.find((r) => r.field === 'displacementCc')?.state, 'ok');
  const v = await db.vehicle.findUniqueOrThrow({ where: { id: veh.id } });
  assert.deepEqual([v.vin, v.seats, v.approvalKind, v.powerKw], ['WAUZZZ8T0BA000001', 5, 'EC_TYPE_APPROVAL', 125], 'Leistung aus dem Schein wird nur verglichen, nicht übernommen');
  assert.ok(v.registrationCheck);
  const none = await saveRegistration(office, veh.id, { hsn: '9998', tsn: 'ZZZ' });
  assert.match(none.note ?? '', /keinen Datensatz/);
  await assert.rejects(saveRegistration(office, veh.id, { vin: 'KURZ' }));
});

test('Objektzugriff: Gutachter darf fremde Fahrzeuge nicht per Datensatz verändern', async () => {
  const { expert, veh, rec } = await vehicleWorld();
  await assert.rejects(applyRecordToVehicle(expert, veh.id, rec.id), /nicht gefunden/);
});
