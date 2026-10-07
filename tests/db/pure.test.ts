import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPlate, normalizePhone, normalizePlate, parseVin, splitName } from '@/lib/normalize';
import {
  CASE_STATUSES, CASE_TRANSITIONS, LEAD_CONVERTIBLE, LEAD_STATUSES, LEAD_TRANSITIONS,
  canCaseTransition, canLeadTransition, caseReasonRequired, initialCaseStatus, serviceFromReason,
} from '@/lib/workflow';
import { berlinDayRange } from '@/lib/berlin';
import { formatCaseNumber, berlinYear } from '@/server/pipeline/core';
import { sanitizeTracking } from '@/server/pipeline/intake';
import { vehicleSchema, customerSchema } from '@/server/pipeline/schemas';

test('Kennzeichen: alle Schreibweisen führen zur selben Suchform', () => {
  for (const v of ['H AB 123', 'H-AB 123', 'hab123', ' h - ab  123 ']) assert.equal(normalizePlate(v), 'HAB123', v);
  assert.equal(normalizePlate('x'), null);
  assert.equal(normalizePlate(''), null);
  assert.equal(normalizePlate('B ÄÖ 12'), 'BÄÖ12'); // Umlaute bleiben
});

test('Kennzeichen: Anzeigeform nur, wenn Trennung eindeutig; sonst Großschreibung', () => {
  assert.equal(formatPlate('h ab 123'), 'H-AB 123');
  assert.equal(formatPlate('H-AB 123E'), 'H-AB 123E');
  assert.equal(formatPlate('hab123'), 'HAB123'); // nicht raten
  assert.equal(formatPlate(null), null);
});

test('Telefon: +49, 0049 und Vorwahl-Schreibweisen werden vergleichbar', () => {
  const a = normalizePhone('+49 511 543 00 976');
  assert.equal(a, '051154300976');
  assert.equal(normalizePhone('0511/543 00 976'), a);
  assert.equal(normalizePhone('0049 (0) 511 54300976'), a);
  assert.equal(normalizePhone('123'), null);
});

test('FIN: großzügig bei historischen Fahrzeugen, hart nur bei Unsinn', () => {
  assert.deepEqual(parseVin('wvwzzz1kz6w000001'), { value: 'WVWZZZ1KZ6W000001' });
  assert.equal(parseVin('').value, null);
  assert.ok(parseVin('1234567').warning, 'Kurze FIN: nur Hinweis');
  assert.equal(parseVin('1234567').value, '1234567');
  assert.ok(parseVin('WVWZZZ1KZ6W00000I').warning, 'I/O/Q: nur Hinweis');
  assert.ok(parseVin('ab$%').error);
  assert.ok(parseVin('A'.repeat(18)).error);
});

test('Name wird in Vor-/Nachname geteilt (nur Vorschlag)', () => {
  assert.deepEqual(splitName('Max Peter Mustermann'), { firstName: 'Max Peter', lastName: 'Mustermann' });
  assert.deepEqual(splitName('Cher'), { firstName: '', lastName: 'Cher' });
  assert.deepEqual(splitName('Anna Beispiel (Demo)'), { firstName: 'Anna', lastName: 'Beispiel' }, 'Klammer-Anhängsel zählt nicht zum Namen');
});

test('Lead-Workflow: CONVERTED nur über die Umwandlung, nie manuell', () => {
  for (const from of LEAD_STATUSES) assert.equal(canLeadTransition(from, 'CONVERTED'), false, `${from}→CONVERTED`);
  assert.deepEqual(LEAD_TRANSITIONS.CONVERTED, []);
  assert.ok(canLeadTransition('NEW', 'CONTACTED'));
  assert.ok(canLeadTransition('SPAM', 'NEW'), 'Spam-Irrtum korrigierbar');
  assert.equal(canLeadTransition('NEW', 'NEW'), false);
  assert.ok(!LEAD_CONVERTIBLE.includes('SPAM') && !LEAD_CONVERTIBLE.includes('CLOSED') && !LEAD_CONVERTIBLE.includes('CONVERTED'));
});

test('Fall-Workflow: lückenlos, Ziele existieren, kein Selbstübergang', () => {
  for (const from of CASE_STATUSES) {
    for (const to of CASE_TRANSITIONS[from]) {
      assert.ok((CASE_STATUSES as readonly string[]).includes(to));
      assert.notEqual(from, to);
    }
  }
  assert.ok(canCaseTransition('NEW', 'APPOINTMENT_SET'));
  assert.equal(canCaseTransition('NEW', 'REPORT_SENT'), false, 'kein Überspringen');
  assert.equal(canCaseTransition('INVOICED', 'NEW'), false);
  assert.ok(canCaseTransition('CLOSED', 'IN_PROGRESS'), 'Wiederöffnen möglich');
});

test('Pflichtbegründung: Storno und Wiederöffnen', () => {
  assert.ok(caseReasonRequired('NEW', 'CANCELLED'));
  assert.ok(caseReasonRequired('CLOSED', 'IN_PROGRESS'));
  assert.ok(caseReasonRequired('CANCELLED', 'NEW'));
  assert.equal(caseReasonRequired('NEW', 'APPOINTMENT_SET'), false);
});

test('Umwandlung: Startstatus des Falls und Gutachtenart', () => {
  assert.equal(initialCaseStatus('NEW'), 'NEW');
  assert.equal(initialCaseStatus('APPOINTMENT_SET'), 'APPOINTMENT_SET');
  assert.equal(serviceFromReason('Unfall'), 'ACCIDENT_REPORT');
  assert.equal(serviceFromReason('Leasingrückgabe'), 'VALUATION');
  assert.equal(serviceFromReason('???'), 'OTHER');
});

test('Fallnummer-Format und Berliner Jahr', () => {
  assert.equal(formatCaseNumber('ING', 2026, 1, 6), 'ING-2026-000001');
  assert.equal(formatCaseNumber('ING', 2026, 1234567, 6), 'ING-2026-1234567', 'läuft über, statt abzuschneiden');
  assert.equal(berlinYear(new Date('2026-12-31T23:30:00Z')), 2027, 'Silvester 23:30 UTC ist in Berlin schon Neujahr');
  assert.equal(berlinYear(new Date('2026-06-15T12:00:00Z')), 2026);
});

test('Berliner Tagesgrenzen inkl. Zeitumstellung', () => {
  const sommer = berlinDayRange('2026-07-01')!;
  assert.equal(sommer.start.toISOString(), '2026-06-30T22:00:00.000Z');
  assert.equal(sommer.end.toISOString(), '2026-07-01T22:00:00.000Z');
  const winter = berlinDayRange('2026-01-15')!;
  assert.equal(winter.start.toISOString(), '2026-01-14T23:00:00.000Z');
  const umstellung = berlinDayRange('2026-03-29')!; // 23 Stunden lang
  assert.equal(umstellung.end.getTime() - umstellung.start.getTime(), 23 * 3600_000);
  assert.equal(berlinDayRange('nonsense'), null);
});

test('Herkunft: nur harmlose Werte, externe Referrer als Host, Pfad ohne Query', () => {
  const t = sanitizeTracking(
    { utm_source: 'google', utm_medium: 'cpc', utm_campaign: '<script>', ref: 'https://www.google.com/search?q=privat+suche', lp: '/kfz-gutachter-hannover/' },
    'ing-gutachten.de',
  );
  assert.equal(t.utmSource, 'google');
  assert.equal(t.utmCampaign, null, 'verdächtiger Wert verworfen');
  assert.equal(t.referrerHost, 'www.google.com', 'nur Host – nie Suchbegriffe');
  assert.equal(t.landingPath, '/kfz-gutachter-hannover/');
  assert.equal(sanitizeTracking({ ref: 'https://ing-gutachten.de/x' }, 'ing-gutachten.de').referrerHost, null, 'eigene Seite ist kein Referrer');
  assert.equal(sanitizeTracking({ lp: '/a?x=1' }, null).landingPath, null);
});

test('Schemas: Fahrzeug normalisiert Kennzeichen/FIN, Kunde verlangt Firma bei B2B', () => {
  const v = vehicleSchema.parse({ manufacturer: 'VW', model: 'Golf', licensePlate: 'h ab 123', vin: 'wvwzzz1kz6w000001', mileage: '123.456' });
  assert.equal(v.licensePlate, 'H-AB 123');
  assert.equal(v.licensePlateNorm, 'HAB123');
  assert.equal(v.vin, 'WVWZZZ1KZ6W000001');
  assert.equal(v.mileage, 123456);
  assert.throws(() => vehicleSchema.parse({ manufacturer: 'VW', model: 'Golf', vin: 'ab$%' }));
  assert.throws(() => customerSchema.parse({ type: 'BUSINESS', lastName: 'X' }));
  assert.equal(customerSchema.parse({ lastName: 'X', email: '' }).email, null);
});
