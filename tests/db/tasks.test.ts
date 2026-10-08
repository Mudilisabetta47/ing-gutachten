import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser, CUSTOMER, VEHICLE } from './helpers';
import { addDays, berlinToday, dueBucket } from '@/lib/tasks';
import { assignees, cancelTask, caseTasks, completeTask, createTask, dueForToday, listTasks, markNotificationsRead, myNotifications, reopenTask, snoozeTask, taskStats, unreadNotifications, updateTask } from '@/server/pipeline/tasks';
import { addCommunication, caseCommunication, mentionable, pinnedNotes, setPinned } from '@/server/pipeline/communication';
import { createCustomer } from '@/server/pipeline/customers';
import { createVehicle } from '@/server/pipeline/vehicles';
import { assignExpert, createCase } from '@/server/pipeline/cases';
import { ForbiddenError } from '@/server/auth/errors';

assertTestDb();
beforeEach(resetDb);

const today = berlinToday();

async function world() {
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  const office = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  const exp = await asAuthUser((await makeUser({ role: 'EXPERT' })).user.id);
  const exp2 = await asAuthUser((await makeUser({ role: 'EXPERT' })).user.id);
  const acc = await asAuthUser((await makeUser({ role: 'ACCOUNTING' })).user.id);
  const cust = await createCustomer(office, CUSTOMER as never);
  const veh = await createVehicle(office, cust.id, VEHICLE);
  const c = await createCase(office, { customerId: cust.id, vehicleId: veh.id, data: {} });
  await assignExpert(owner, c.id, exp.id);
  return { owner, office, exp, exp2, acc, c, cust };
}

test('Hilfen: Datumsrechnung und Gruppen', () => {
  assert.equal(addDays('2026-10-30', 3), '2026-11-02');
  assert.equal(dueBucket(null, '2026-10-08', '2026-10-15'), 'none');
  assert.equal(dueBucket('2026-10-07', '2026-10-08', '2026-10-15'), 'overdue');
  assert.equal(dueBucket('2026-10-08', '2026-10-08', '2026-10-15'), 'today');
  assert.equal(dueBucket('2026-10-15', '2026-10-08', '2026-10-15'), 'week');
  assert.equal(dueBucket('2026-10-16', '2026-10-08', '2026-10-15'), 'later');
});

test('Aufgabe anlegen: Standard = ich selbst, Pflichtfelder, Wiedervorlage braucht Datum', async () => {
  const w = await world();
  const t = await createTask(w.office, { title: 'Kunden zurückrufen', dueDate: today });
  assert.deepEqual([t.status, t.kind, t.assignee?.id, t.dueToday, t.overdue], ['OPEN', 'TASK', w.office.id, true, false]);
  await assert.rejects(createTask(w.office, { title: '  ' }), /Titel/);
  await assert.rejects(createTask(w.office, { title: 'x', kind: 'FOLLOW_UP' }), /Datum/);
  await assert.rejects(createTask(w.office, { title: 'x', caseId: w.c.id, customerId: w.cust.id }), /nur zu einem/);
  const f = await createTask(w.office, { title: 'Nachfassen Versicherung', kind: 'FOLLOW_UP', dueDate: addDays(today, 3), caseId: w.c.id });
  assert.deepEqual([f.kind, f.caseNumber], ['FOLLOW_UP', w.c.caseNumber]);
  assert.equal(await db.task.count(), 2);
});

test('Zuweisung an andere erzeugt eine Benachrichtigung; Gutachter dürfen nur sich selbst zuweisen', async () => {
  const w = await world();
  const t = await createTask(w.office, { title: 'Fotos nachfordern', assigneeId: w.exp.id, caseId: w.c.id });
  assert.equal(await unreadNotifications(w.exp), 1);
  const n = await myNotifications(w.exp);
  assert.match(n[0].text, /Fotos nachfordern/);
  assert.equal(n[0].href, `/admin/faelle/${w.c.caseNumber}/?tab=aufgaben`);
  await markNotificationsRead(w.exp, n[0].id);
  assert.equal(await unreadNotifications(w.exp), 0);
  await assert.rejects(createTask(w.exp, { title: 'Für Kollegin', assigneeId: w.exp2.id }), ForbiddenError);
  assert.equal((await createTask(w.exp, { title: 'Für mich' })).assignee?.id, w.exp.id);
  assert.equal(t.assignee?.id, w.exp.id);
  assert.equal((await assignees(w.exp)).length, 1);
  assert.ok((await assignees(w.office)).length >= 4);
  await assert.rejects(createTask(w.office, { title: 'x', assigneeId: 'gibtsnicht' }), /aktiv/);
});

test('Sichtbarkeit: Gutachter sehen nur eigene Aufgaben und nur Fälle ihres Bereichs', async () => {
  const w = await world();
  await createTask(w.office, { title: 'Büro-intern', assigneeId: w.office.id });
  const mine = await createTask(w.office, { title: 'Für Gutachter', assigneeId: w.exp.id, caseId: w.c.id });
  assert.equal((await listTasks(w.exp)).total, 1);
  assert.equal((await listTasks(w.office, { view: 'all' })).total, 2);
  assert.equal((await listTasks(w.office, { view: 'mine' })).total, 1);
  assert.equal((await listTasks(w.exp2)).total, 0);
  await assert.rejects(completeTask(w.exp2, mine.id), /nicht gefunden|Aufgabe/);
  await assert.rejects(caseTasks(w.exp2, w.c.id), /nicht gefunden|Fall/);
  await assert.rejects(createTask(w.exp2, { title: 'Fremder Fall', caseId: w.c.id }), /nicht gefunden|Fall/);
  assert.equal((await caseTasks(w.exp, w.c.id)).length, 1);
  const cm = await asAuthUser((await makeUser({ role: 'CONTENT_MANAGER' })).user.id);
  await assert.rejects(listTasks(cm), ForbiddenError);
  await assert.rejects(createTask(cm, { title: 'x' }), ForbiddenError);
  assert.equal(await taskStats(cm), null);
});

test('Erledigen, wieder öffnen, verschieben, abbrechen', async () => {
  const w = await world();
  const t = await createTask(w.office, { title: 'Prüfen', dueDate: addDays(today, -2) });
  assert.equal(t.overdue, true);
  assert.deepEqual(await taskStats(w.office), { open: 1, overdue: 1, dueToday: 0, followUpsDue: 0 });
  const to = await snoozeTask(w.office, t.id, { days: 1 });
  assert.equal(to, addDays(today, 1), 'ab heute, nicht ab dem alten Datum');
  assert.equal((await db.task.findUniqueOrThrow({ where: { id: t.id } })).snoozeCount, 1);
  await assert.rejects(snoozeTask(w.office, t.id, { date: today }), /Zukunft/);
  await completeTask(w.office, t.id);
  const done = await db.task.findUniqueOrThrow({ where: { id: t.id } });
  assert.deepEqual([done.status, done.completedById], ['DONE', w.office.id]);
  await assert.rejects(completeTask(w.office, t.id), /bereits/);
  await assert.rejects(updateTask(w.office, t.id, { title: 'neu' }), /nicht mehr geändert/);
  assert.equal((await listTasks(w.office, { status: 'done' })).total, 1);
  assert.equal((await listTasks(w.office)).total, 0);
  await reopenTask(w.office, t.id);
  assert.equal((await db.task.findUniqueOrThrow({ where: { id: t.id } })).completedAt, null);
  await cancelTask(w.office, t.id);
  assert.equal((await listTasks(w.office, { status: 'open' })).total, 0);
  await assert.rejects(db.task.update({ where: { id: t.id }, data: { status: 'DONE' } }), /tasks_completed_chk|check/i, 'DB: erledigt braucht Zeitpunkt');
});

test('Filter: überfällig, heute, Woche, Wiedervorlagen, Suche; „Heute“-Liste', async () => {
  const w = await world();
  await createTask(w.office, { title: 'Alt', dueDate: addDays(today, -3) });
  await createTask(w.office, { title: 'Heute fällig', dueDate: today });
  await createTask(w.office, { title: 'Nächste Woche', dueDate: addDays(today, 6) });
  await createTask(w.office, { title: 'Später', dueDate: addDays(today, 30) });
  await createTask(w.office, { title: 'Wiedervorlage X', kind: 'FOLLOW_UP', dueDate: today });
  assert.equal((await listTasks(w.office, { due: 'overdue' })).total, 1);
  assert.equal((await listTasks(w.office, { due: 'today' })).total, 2);
  assert.equal((await listTasks(w.office, { due: 'week' })).total, 4);
  assert.equal((await listTasks(w.office, { kind: 'FOLLOW_UP' })).total, 1);
  assert.equal((await listTasks(w.office, { q: 'später' })).total, 1);
  const due = await dueForToday(w.office);
  assert.deepEqual(due.map((d) => d.title), ['Alt', 'Heute fällig', 'Wiedervorlage X'].sort((a, b) => due.findIndex((x) => x.title === a) - due.findIndex((x) => x.title === b)));
  assert.equal(due.length, 3);
  assert.deepEqual(await taskStats(w.office), { open: 5, overdue: 1, dueToday: 2, followUpsDue: 1 });
});

test('Kommunikation: interne/externe Notizen, Sichtbarkeit nach Rolle', async () => {
  const w = await world();
  await addCommunication(w.office, w.c.id, { body: 'Intern: Kunde schwierig', external: false });
  await addCommunication(w.office, w.c.id, { body: 'Extern: Termin bestätigt', external: true });
  const all = await caseCommunication(w.office, w.c.id);
  assert.equal(all.length, 2);
  assert.equal(all.find((n) => n.external)?.body, 'Extern: Termin bestätigt');
  assert.equal((await caseCommunication(w.exp, w.c.id)).length, 2);
  await assert.rejects(caseCommunication(w.exp2, w.c.id), /nicht gefunden|Fall/);
  await assert.rejects(addCommunication(w.acc, w.c.id, { body: 'x' }), ForbiddenError);
  await assert.rejects(addCommunication(w.office, w.c.id, { body: '   ' }), /leer/);
});

test('Anrufprotokoll: Richtung Pflicht, Anrufdaten nur bei Anruf, DB-Regel', async () => {
  const w = await world();
  await assert.rejects(addCommunication(w.office, w.c.id, { body: 'Rückruf', kind: 'PHONE_CALL' }), /Richtung/);
  await assert.rejects(addCommunication(w.office, w.c.id, { body: 'x', kind: 'NOTE', call: { direction: 'INBOUND' } }), /nur zu einem Anruf/);
  const n = await addCommunication(w.office, w.c.id, { body: 'Kunde fragt nach Termin', kind: 'PHONE_CALL', call: { direction: 'INBOUND', phone: '0511 123', outcome: 'Rückruf vereinbart' } });
  assert.deepEqual([n.kind, n.callDirection, n.callPhone, n.callOutcome], ['PHONE_CALL', 'INBOUND', '0511 123', 'Rückruf vereinbart']);
  const list = await caseCommunication(w.office, w.c.id);
  assert.deepEqual(list[0].call, { direction: 'INBOUND', phone: '0511 123', outcome: 'Rückruf vereinbart' });
  await assert.rejects(db.note.update({ where: { id: (await addCommunication(w.office, w.c.id, { body: 'Notiz' })).id }, data: { callPhone: '1' } }), /notes_call_chk|check/i);
});

test('@Erwähnungen: nur bei Namen im Text, nur erlaubte Personen, mit Benachrichtigung', async () => {
  const w = await world();
  const people = await mentionable(w.office, w.c.id);
  const ownerP = people.find((p) => p.id === w.owner.id)!;
  assert.ok(ownerP && people.some((p) => p.id === w.exp.id), 'zugewiesener Gutachter erwähnbar');
  assert.ok(!people.some((p) => p.id === w.exp2.id), 'fremder Gutachter nicht');
  assert.ok(!people.some((p) => p.id === w.office.id), 'man selbst nicht');
  const ok = await addCommunication(w.office, w.c.id, { body: `Bitte prüfen @${ownerP.name}`, mentionIds: [w.owner.id, w.exp2.id, 'fremd'] });
  assert.deepEqual(ok.mentionIds, [w.owner.id]);
  assert.equal(await unreadNotifications(w.owner), 1);
  assert.equal(await unreadNotifications(w.exp2), 0);
  const noText = await addCommunication(w.office, w.c.id, { body: 'ohne Namen', mentionIds: [w.owner.id] });
  assert.deepEqual(noText.mentionIds, []);
  assert.equal((await caseCommunication(w.office, w.c.id)).find((n) => n.id === ok.id)?.mentions[0], ownerP.name);
  assert.match((await myNotifications(w.owner))[0].href ?? '', /tab=kommunikation/);
});

test('Angeheftete Hinweise stehen oben und sind getrennt abrufbar', async () => {
  const w = await world();
  const a = await addCommunication(w.office, w.c.id, { body: 'Erste' });
  await addCommunication(w.office, w.c.id, { body: 'Zweite' });
  await setPinned(w.office, a.id, true);
  const list = await caseCommunication(w.office, w.c.id);
  assert.equal(list[0].body, 'Erste');
  assert.deepEqual((await pinnedNotes(w.office, w.c.id)).map((n) => n.body), ['Erste']);
  await setPinned(w.office, a.id, false);
  assert.equal((await pinnedNotes(w.office, w.c.id)).length, 0);
  await assert.rejects(setPinned(w.exp2, a.id, true), /nicht gefunden|Fall|Notiz/);
  assert.equal((await db.note.findUniqueOrThrow({ where: { id: a.id } })).body, 'Erste', 'Text unverändert');
});
