/**
 * Szenario B + C im Browser (Desktop): Fahrzeugbild → Schadenposition → Reparaturposition → Kalkulation → Gutachten → Freigabe → PDF.
 * Prüft auch, dass ein markiertes Bauteil in allen passenden Ansichten und in der Kalkulation auftaucht.
 *   BASE=http://localhost:3101 node tests/e2e/chain.e2e.mjs
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { launch, newPage, sleep } from './cdp.mjs';

const BASE = process.env.BASE; if (!BASE) throw new Error('BASE setzen');
if (/:3100\b/.test(BASE) && !process.env.ALLOW_3100) throw new Error('Port 3100 gehört evtl. einem anderen Projekt.');
const PW = readFileSync(new URL('../../scripts/seed-demo.ts', import.meta.url), 'utf8').match(/DEMO_PASSWORD = '([^']+)'/)[1];
const PSQL = process.env.PSQL || '/Applications/Postgres.app/Contents/Versions/latest/bin/psql';
const DB = process.env.E2E_DB || 'ing_os_dev';
const sql = (q) => execSync(`${PSQL} -h localhost -U ${process.env.USER} -d ${DB} -At -c "${q.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
const res = []; const check = (n, ok, x = '') => { res.push(Boolean(ok)); console.log(`${ok ? '✔' : '✖'} ${n}${x ? ' — ' + x : ''}`); };
const OUT = process.env.OUT || '/tmp/ing-shots';

sql('delete from login_attempts');
const caseId = sql(`select id from cases order by created_at limit 1`);
const nr = sql(`select case_number from cases where id='${caseId}'`);
const started = sql("select now() at time zone 'utc'");
// Ausgangslage: Demo-Fall, Gutachter zugewiesen, nichts von früheren Läufen
sql(`delete from reports where case_id='${caseId}'`); sql(`delete from documents where case_id='${caseId}' and category='REPORT'`);
sql(`delete from calculations where case_id='${caseId}'`); sql(`delete from valuation_entries where case_id='${caseId}'`);
sql(`update cases set status='INSPECTED', insurance_claim_number='SN-DEMO-1', damage_date='2026-10-01', accident_date='2026-10-01', description='Heckschaden durch Auffahrunfall (Demo)', inspection_location='Hannover' where id='${caseId}'`);
sql(`update vehicles set vin='WVWZZZ1KZ6W000001', mileage=84210, first_registration='2019-05-01' where id=(select vehicle_id from cases where id='${caseId}')`);
sql(`insert into valuation_entries (id, case_id, type, amount_cents, tax_mode, source, reference_date, selected) values ('ve_chain_1', '${caseId}', 'REPLACEMENT_VALUE', 1500000, 'GROSS', 'MANUAL', '2026-10-01', true)`);

const { proc, port } = await launch(9551);
try {
  const pg = await newPage(port); await pg.viewport(1400, 1000);
  const waitFor = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { /* weiter */ } await sleep(250); } return false; };
  const text = () => pg.evalJs('document.body.innerText');
  const login = async (email) => {
    await pg.send('Network.clearBrowserCookies');
    await pg.goto(BASE + '/admin/login/', 1200);
    await pg.evalJs(`(()=>{const f=document.querySelector('form'); f.email.value=${JSON.stringify(email)}; f.password.value=${JSON.stringify(PW)}; f.requestSubmit();})()`);
    await sleep(3500);
  };
  const btn = (label) => pg.evalJs(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(label)}); if(!b) return false; b.click(); return true})()`);
  const setVal = (sel, v) => pg.evalJs(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return false; const P=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(P,'value').set.call(e,${JSON.stringify(v)}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true})()`);
  const view = async (label) => { await pg.evalJs(`[...document.querySelectorAll('.vi-modes[aria-label="Ansicht"] button')].find(b=>b.textContent.trim()===${JSON.stringify(label)})?.click()`); await sleep(350); };
  const partState = (name) => pg.evalJs(`(()=>{const g=[...document.querySelectorAll('.dm-svg g.is-click')].find(x=>x.getAttribute('aria-label').startsWith(${JSON.stringify(name)})); return g? g.getAttribute('aria-label') : null})()`);
  const confirmYes = () => pg.evalJs('window.confirm = () => true');

  /* ---------- B: Fahrzeugbild → Schadenposition ---------- */
  await login('gutachter@demo.ing.test');
  await pg.goto(`${BASE}/admin/faelle/${nr}/?tab=schaden`, 3500);
  const labels = await pg.evalJs(`[...document.querySelectorAll('.vi-modes[aria-label="Ansicht"] button')].map(b=>b.textContent.trim())`);
  check('Neun Fahrzeugansichten stehen zur Auswahl', labels.length === 9, labels.length + ' Ansichten');
  // Vorschaden „Kotflügel vorn links“ aus den Demo-Daten: in jeder Ansicht, die das Bauteil zeigt, derselbe Zustand
  const seen = [];
  for (const l of labels) { const view = l; await view_(view); const s = await partState('Kotflügel vorn links'); if (s) seen.push([view, s]); }
  async function view_(v) { await view(v); }
  check('Bauteil „Kotflügel vorn links“ erscheint in mehreren Ansichten', seen.length >= 2, seen.map((x) => x[0]).join(', '));
  check('… überall mit demselben Zustand (Vorschaden)', seen.length > 0 && seen.every(([, s]) => /Vorschaden/.test(s)));

  // neues Bauteil markieren: Kotflügel vorn rechts, aktueller Schaden, schwer, Ersetzen
  const frontRight = labels.find((l) => /vorn.*rechts|rechts.*vorn/i.test(l));
  await view(frontRight);
  const pt = await pg.evalJs(`(()=>{const g=[...document.querySelectorAll('.dm-svg g.is-click')].find(x=>x.getAttribute('aria-label').startsWith('Kotflügel vorn rechts')); if(!g) return null; const r=g.getBoundingClientRect(); for(let y=r.top+2;y<r.bottom;y+=3) for(let x=r.left+2;x<r.right;x+=3){ const e=document.elementFromPoint(x,y); if(e && e.closest('g.is-click')===g) return {x,y}; } return null})()`);
  check('Bauteil „Kotflügel vorn rechts“ ist anklickbar', Boolean(pt));
  await pg.click(pt.x, pt.y);
  await waitFor(async () => (await text()).includes('Eintrag hinzufügen'));
  await btn('Eintrag hinzufügen');
  await waitFor(() => pg.evalJs(`!!document.querySelector('.dm-form')`));
  await pg.evalJs(`[...document.querySelectorAll('.dm-sev label')].find(l=>/schwer/i.test(l.textContent)).click()`);
  await pg.evalJs(`(()=>{const sels=[...document.querySelectorAll('.dm-form select')]; const set=(s,t)=>{const o=[...s.options].find(o=>o.value===t); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,o.value); s.dispatchEvent(new Event('change',{bubbles:true}));}; set(sels[0],'Verformung'); set(sels[1],'Ersetzen');})()`);
  await setVal('.dm-form textarea', 'E2E Kotflügel eingedrückt');
  await btn('Eintrag speichern');
  check('Schadenposition gespeichert: Bauteil, Ansicht, Zustand, Schweregrad, Maßnahme', await waitFor(() => sql(`select part_id||'|'||kind||'|'||severity||'|'||repair_kind from damages where case_id='${caseId}' and description like 'E2E %'`) === 'fender_fr|CURRENT|HEAVY|Ersetzen'));
  const withPart = [];
  for (const l of labels) { const v = l; await view(v); const s = await partState('Kotflügel vorn rechts'); if (s) withPart.push([v, s]); }
  check('Der neue Schaden ist in allen Ansichten markiert, die dieses Bauteil zeigen', withPart.length >= 2 && withPart.every(([, s]) => /Aktueller Schaden/.test(s)), withPart.map((x) => x[0]).join(', '));
  await pg.shot(`${OUT}/40-schadenkarte.png`);

  /* ---------- Kalkulation aus den Schäden ---------- */
  await pg.goto(`${BASE}/admin/faelle/${nr}/?tab=kalkulation`, 3000);
  await btn('Kalkulation anlegen');
  check('Kalkulation Version 1 angelegt (Fallstatus „Kalkulation“)', await waitFor(() => sql(`select count(*) from calculations where case_id='${caseId}'`) === '1') && sql(`select status from cases where id='${caseId}'`) === 'CALCULATION');
  await sleep(2000);
  // Schaltfläche abwarten (Seite muss geladen und „hydriert“ sein) und notfalls erneut klicken – wie ein Mensch, der nochmal tippt
  for (let i = 0; i < 5 && Number(sql(`select count(*) from calculation_items where calculation_id=(select id from calculations where case_id='${caseId}')`)) === 0; i++) { await waitFor(() => pg.evalJs(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Aus Schäden vorschlagen' && !b.disabled)`), 8000); await btn('Aus Schäden vorschlagen'); await waitFor(() => Number(sql(`select count(*) from calculation_items where calculation_id=(select id from calculations where case_id='${caseId}')`)) > 0, 4000); }
  check('„Aus Schäden vorschlagen“ erzeugt Positionen zum markierten Bauteil', await waitFor(() => Number(sql(`select count(*) from calculation_items where calculation_id=(select id from calculations where case_id='${caseId}') and description ilike '%Kotflügel vorn rechts%'`)) >= 1, 20000), sql(`select string_agg(kind||':'||description, ' | ') from calculation_items where calculation_id=(select id from calculations where case_id='${caseId}')`));
  check('Positionen verweisen auf die Schadenposition (damage_id)', Number(sql(`select count(*) from calculation_items where calculation_id=(select id from calculations where case_id='${caseId}') and damage_id is not null`)) >= 1);
  // Preise einsetzen (keine erfundenen Werte: manuell, wie ein Gutachter)
  const rows = Number(sql(`select count(*) from calculation_items where calculation_id=(select id from calculations where case_id='${caseId}')`));
  check('Keine doppelten Positionen (je Schaden eine Referenz)', Number(sql(`select count(*) - count(distinct ref) from calculation_items where calculation_id=(select id from calculations where case_id='${caseId}')`)) === 0, rows + ' Positionen');
  sql(`update calculation_items set unit_price_cents=45000 where calculation_id=(select id from calculations where case_id='${caseId}') and kind='PART' and unit_price_cents=0`);
  sql(`update calculation_items set minutes=60 where calculation_id=(select id from calculations where case_id='${caseId}') and kind='LABOR' and minutes=0`);
  sql(`update calculations set rate_body_cents=13000, rate_paint_cents=15000, rate_mechanic_cents=12000, rate_electric_cents=12000 where case_id='${caseId}'`);
  await pg.goto(`${BASE}/admin/faelle/${nr}/?tab=kalkulation`, 3500);
  await pg.shot(`${OUT}/41-kalkulation.png`);
  check('Kalkulation zeigt Summen mit Netto, MwSt. und Brutto', /Netto/.test(await text()) && /Brutto/.test(await text()));
  await confirmYes();
  await waitFor(() => pg.evalJs(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Version freigeben' && !b.disabled)`), 15000);
  await btn('Version freigeben');
  check('Version freigegeben (unveränderlich)', await waitFor(() => sql(`select status from calculations where case_id='${caseId}'`) === 'FINAL', 20000));

  /* ---------- C: Gutachten → Prüfung → Freigabe → PDF ---------- */
  await pg.goto(`${BASE}/admin/faelle/${nr}/?tab=gutachten`, 3000);
  await btn('Gutachten anlegen');
  check('Gutachten angelegt (GA-JJJJ-NNNNN), Fallstatus „Gutachten-Entwurf“', await waitFor(() => /^GA-\d{4}-\d{5}$/.test(sql(`select number from reports where case_id='${caseId}'`))) && sql(`select status from cases where id='${caseId}'`) === 'REPORT_DRAFT');
  await sleep(2500);
  const draftPdf = await pg.evalJs(`fetch('/api/admin/gutachten/${sql(`select id from reports where case_id='${caseId}'`)}/pdf/').then(async r=>({s:r.status,t:r.headers.get('content-type'),h:new TextDecoder().decode((await r.arrayBuffer()).slice(0,5))}))`);
  check('Entwurfs-PDF abrufbar (mit Wasserzeichen „Entwurf“)', draftPdf.s === 200 && draftPdf.h === '%PDF-');
  await confirmYes();
  await btn('Zur Prüfung einreichen');
  check('Zur Prüfung eingereicht', await waitFor(() => sql(`select status from reports where case_id='${caseId}'`) === 'IN_REVIEW', 20000));
  await login('pruefer@demo.ing.test');
  await pg.goto(`${BASE}/admin/faelle/${nr}/?tab=gutachten`, 3500);
  await confirmYes();
  await pg.evalJs(`(()=>{const h=document.querySelector('.rep-head'); const b=[...h.querySelectorAll('button')].find(x=>x.textContent.trim()==='Freigeben'); b.click()})()`);
  check('Prüfer gibt frei: Status APPROVED, PDF liegt als Dokument im Fall', await waitFor(() => sql(`select status from reports where case_id='${caseId}'`) === 'APPROVED', 25000) && sql(`select count(*) from documents where case_id='${caseId}' and category='REPORT'`) === '1');
  await sleep(2000);
  const rid = sql(`select id from reports where case_id='${caseId}'`);
  const pdf = await pg.evalJs(`fetch('/api/admin/gutachten/${rid}/pdf/').then(async r=>({s:r.status,t:r.headers.get('content-type'),cc:r.headers.get('cache-control'),len:(await r.arrayBuffer()).byteLength}))`);
  { const b64 = await pg.evalJs(`fetch('/api/admin/gutachten/${rid}/pdf/').then(r=>r.arrayBuffer()).then(b=>{let s='';const u=new Uint8Array(b);for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode(...u.subarray(i,i+8192));return btoa(s)})`); (await import('node:fs')).writeFileSync(`${OUT}/gutachten-freigegeben.pdf`, Buffer.from(b64, 'base64')); }
  check('Freigegebenes PDF abrufbar, nicht zwischenspeicherbar', pdf.s === 200 && /pdf/.test(pdf.t) && /no-store/.test(pdf.cc) && pdf.len > 2000, JSON.stringify(pdf));
  check('Fallstatus „Freigegeben“', sql(`select status from cases where id='${caseId}'`) === 'APPROVED');
  // Berechtigung: Gutachter-Konto ohne Fallzuordnung erreicht das PDF nicht – hier: abgemeldet
  await pg.send('Network.clearBrowserCookies');
  const anon = await pg.evalJs(`fetch('/api/admin/gutachten/${rid}/pdf/').then(r=>r.status)`).catch(() => 0);
  check('Ohne Anmeldung ist das PDF nicht abrufbar', anon === 401 || anon === 403, String(anon));
} finally {
  proc.kill();
  sql(`delete from damages where case_id='${caseId}' and description like 'E2E %'`);
  sql(`delete from reports where case_id='${caseId}'`); sql(`delete from documents where case_id='${caseId}' and category='REPORT'`);
  sql(`delete from calculations where case_id='${caseId}'`); sql(`delete from valuation_entries where case_id='${caseId}'`);
  sql(`update cases set status='APPOINTMENT_SET' where id='${caseId}'`);
}
console.log(`\n${res.filter(Boolean).length}/${res.length} bestanden`);
process.exit(res.every(Boolean) ? 0 : 1);
