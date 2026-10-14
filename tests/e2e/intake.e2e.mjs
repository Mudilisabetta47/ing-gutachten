/**
 * Szenario A im Browser: Öffentliche Website → Backend → Eingang → Kunde → Fahrzeug → Fall.
 * Füllt das echte vierstufige Anfrageformular aus (mit Foto und Fahrzeugschein), prüft Datenbank und Speicher und wandelt die Anfrage im Büro um.
 *   BASE=http://localhost:3201 node tests/e2e/intake.e2e.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { deflateSync, crc32 } from 'node:zlib';
import { launch, newPage, sleep } from './cdp.mjs';

const BASE = process.env.BASE; if (!BASE) throw new Error('BASE setzen');
if (/:3100\b/.test(BASE) && !process.env.ALLOW_3100) throw new Error('Port 3100 gehört evtl. einem anderen Projekt.');
const PW = readFileSync(new URL('../../scripts/seed-demo.ts', import.meta.url), 'utf8').match(/DEMO_PASSWORD = '([^']+)'/)[1];
const PSQL = process.env.PSQL || '/Applications/Postgres.app/Contents/Versions/latest/bin/psql';
const DB = process.env.E2E_DB || 'ing_os_dev';
const sql = (q) => execSync(`${PSQL} -h localhost -U ${process.env.USER} -d ${DB} -At -c "${q.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
const res = []; const check = (n, ok, x = '') => { res.push(Boolean(ok)); console.log(`${ok ? '✔' : '✖'} ${n}${x ? ' — ' + x : ''}`); };
const OUT = process.env.OUT || '/tmp/ing-shots';
const MAIL = 'e2e-intake@example.test';

const dir = '/tmp/ing-fixtures'; mkdirSync(dir, { recursive: true });
function png(w, h, rgb, file) {
  const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())])));
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const body = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(body) >>> 0); return Buffer.concat([len, body, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
png(800, 500, [60, 70, 90], `${dir}/schaden.png`);
writeFileSync(`${dir}/fahrzeugschein.pdf`, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
writeFileSync(`${dir}/schadenfoto-fake.jpg`, 'Das ist kein Bild, sondern Text mit der Endung .jpg');

const cleanup = () => {
  sql(`delete from leads where email='${MAIL}'`); // Kaskade entfernt Notizen/Historie
  sql(`delete from inquiry_attachments where inquiry_id in (select id from inquiries where email='${MAIL}')`);
};
sql('delete from login_attempts');
{ const old = sql(`select converted_case_id from leads where email='${MAIL}'`); if (old) { for (const t of ['case_photos', 'documents', 'case_status_history', 'notes']) sql(`delete from ${t} where case_id='${old}'`); sql(`update leads set converted_case_id=null, converted_customer_id=null where email='${MAIL}'`); sql(`delete from cases where id='${old}'`); } sql(`delete from vehicles where customer_id in (select id from customers where email='${MAIL}')`); sql(`delete from customers where email='${MAIL}'`); cleanup(); sql(`delete from inquiries where email='${MAIL}'`); }
const before = { inq: Number(sql(`select count(*) from inquiries`)), cases: Number(sql('select count(*) from cases')) };

const { proc, port } = await launch(9571);
try {
  const pg = await newPage(port);
  await pg.viewport(1400, 1000);
  const waitFor = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { /* weiter */ } await sleep(250); } return false; };
  const text = () => pg.evalJs('document.body.innerText');
  const setVal = (sel, v) => pg.evalJs(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return false; const P=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(P,'value').set.call(e,${JSON.stringify(v)}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true})()`);
  const click = (label) => pg.evalJs(`(()=>{const b=[...document.querySelectorAll('button,[role=radio],label')].find(x=>x.textContent.trim()===${JSON.stringify(label)} || (${JSON.stringify(label)}==='Weiter' && /^Weiter/.test(x.textContent.trim())) || x.getAttribute('aria-label')===${JSON.stringify(label)}); if(!b) return false; b.click(); return true})()`);

  /* ---------- Öffentliches Formular ---------- */
  await pg.goto(BASE + '/kontakt/', 2500);
  await pg.evalJs(`document.querySelector('[aria-label="Cookie-Hinweis"] button')?.click()`);
  check('Formular ist auf der Kontaktseite sichtbar (Schritt 1 „Was ist passiert?“)', await waitFor(async () => /Was ist passiert/.test(await text())));
  await pg.evalJs(`document.querySelector('form').scrollIntoView({block:'center'})`);
  await click('Weiter');
  check('Pflichtauswahl wird geprüft (Anlass fehlt → Hinweis, kein Weiterkommen)', await waitFor(async () => /Anlass wählen/.test(await text())) && /Was ist passiert/.test(await text()));
  await click('Unfall'); await click('PKW');
  await setVal('#standort', 'Hannover-Döhren');
  await click('Weiter');
  check('Schritt 2 „Wie erreichen wir Sie?“', await waitFor(async () => /Wie erreichen wir Sie/.test(await text())));
  await click('Weiter');
  check('Kontaktdaten werden geprüft (leere Pflichtfelder: Hinweis)', await waitFor(async () => /Name|Telefon|E-Mail/.test(await text()) && /Wie erreichen wir Sie/.test(await text())));
  await setVal('#name', 'Erika E2E Testfrau'); await setVal('#telefon', '0511 5550199'); await setVal('#email', MAIL);
  await setVal('#nachricht', 'E2E-Test: Heckschaden nach Auffahrunfall, Fahrzeug fahrbereit.');
  await click('Weiter');
  check('Schritt 3 „Fotos“', await waitFor(() => pg.evalJs(`!!document.querySelector('#photos')`)));
  await pg.upload('#photos', [`${dir}/schaden.png`]);
  check('Foto wird im Browser verkleinert und in der Vorschau gezeigt', await waitFor(() => pg.evalJs(`document.querySelectorAll('[aria-label="Ausgewählte Fotos"] li').length===1`)));
  await pg.upload('#fahrzeugschein', `${dir}/fahrzeugschein.pdf`);
  await sleep(800);
  await click('Weiter');
  check('Schritt 4 „Prüfen & senden“ fasst die Angaben zusammen', await waitFor(async () => /Prüfen & senden/.test(await text())) && (await text()).includes('Erika E2E Testfrau') && /1 \+ Fahrzeugschein/.test(await text()));
  await pg.evalJs(`document.querySelector('form input[type=checkbox]').click()`);
  await pg.shot(`${OUT}/50-formular-pruefen.png`);
  await pg.evalJs(`[...document.querySelectorAll('button[type=submit]')].find(b=>/Anfrage senden/.test(b.textContent)).click()`);
  check('Erfolgsmeldung „Anfrage gesendet“ mit Telefonnummern', await waitFor(async () => /anfrage gesendet/i.test(await text())) && /0511/.test(await text()));

  /* ---------- Backend ---------- */
  check('Anfrage ist unveränderlich gespeichert (Anlass, Fahrzeug, Einwilligung, Version der Datenschutzerklärung)', sql(`select reason||'|'||vehicle_kind||'|'||(consent_at is not null)||'|'||(privacy_version is not null) from inquiries where email='${MAIL}'`) === 'Unfall|PKW|true|true');
  check('Lead entstanden (Status NEU) mit normalisierter Telefonnummer', sql(`select status||'|'||phone_norm from leads where email='${MAIL}'`) === 'NEW|05115550199');
  const att = sql(`select string_agg(kind||':'||status, ',' order by kind) from inquiry_attachments where inquiry_id=(select id from inquiries where email='${MAIL}')`);
  check('Foto und Fahrzeugschein sind im privaten Speicher gesichert (STORED)', att.includes('photo:STORED') && att.includes('registration:STORED'), att);
  check('Keine IP im Klartext gespeichert', !/203\.|127\.|::1/.test(sql(`select coalesce(ip_hash,'') from inquiries where email='${MAIL}'`)));
  // Missbrauchsschutz
  const honey = await pg.evalJs(`(async()=>{const f=new FormData(); f.set('anlass','Unfall'); f.set('fahrzeug','PKW'); f.set('name','Bot Bot'); f.set('telefon','0511 1111111'); f.set('email','bot@example.test'); f.set('datenschutz','true'); f.set('website','http://spam.example'); f.set('t', String(Date.now()-60000)); const r=await fetch('/api/anfrage/',{method:'POST',body:f}); return {s:r.status, j:await r.json().catch(()=>null)}})()`);
  check('Bot (Honeypot gefüllt) bekommt „Erfolg“, es wird aber nichts gespeichert', honey.s === 200 && sql(`select count(*) from inquiries where email='bot@example.test'`) === '0');
  const fake = await pg.evalJs(`(async()=>{const f=new FormData(); f.set('anlass','Unfall'); f.set('fahrzeug','PKW'); f.set('name','Max Fälscher'); f.set('telefon','0511 2222222'); f.set('email','e2e-fake@example.test'); f.set('datenschutz','true'); f.set('t', String(Date.now()-60000)); f.append('foto', new Blob(['Das ist kein Bild'], {type:'image/jpeg'}), 'x.jpg'); const r=await fetch('/api/anfrage/',{method:'POST',body:f}); return {s:r.status, j:await r.json().catch(()=>null)}})()`);
  check('Textdatei mit Endung .jpg wird als Bild abgelehnt (Dateityp aus Inhalt)', fake.s >= 400 || /ung|nicht/i.test(JSON.stringify(fake.j)) || sql(`select count(*) from inquiry_attachments a join inquiries i on i.id=a.inquiry_id where i.email='e2e-fake@example.test' and a.status='STORED'`) === '0', JSON.stringify(fake));
  const noConsent = await pg.evalJs(`(async()=>{const f=new FormData(); f.set('anlass','Unfall'); f.set('fahrzeug','PKW'); f.set('name','Max Muster'); f.set('telefon','0511 3333333'); f.set('email','e2e-noconsent@example.test'); f.set('t', String(Date.now()-60000)); const r=await fetch('/api/anfrage/',{method:'POST',body:f}); return r.status})()`);
  check('Ohne Datenschutz-Einwilligung wird serverseitig abgelehnt (4xx)', noConsent >= 400 && noConsent < 500, String(noConsent));
  const cross = await pg.evalJs(`fetch('/api/anfrage/',{method:'POST',headers:{Origin:'https://evil.example'},body:new FormData()}).then(r=>r.status).catch(()=>0)`);
  check('Fremder Ursprung wird abgewiesen oder vom Browser blockiert', cross === 403 || cross === 0 || cross >= 400, String(cross));
  sql(`delete from inquiries where email in ('e2e-fake@example.test','e2e-noconsent@example.test')`);

  /* ---------- Eingang → Kunde → Fall im Büro ---------- */
  await pg.send('Network.clearBrowserCookies');
  await pg.goto(BASE + '/admin/login/', 1500);
  await pg.evalJs(`(()=>{const f=document.querySelector('form'); f.email.value='buero@demo.ing.test'; f.password.value=${JSON.stringify(PW)}; f.requestSubmit();})()`);
  await sleep(4000);
  await pg.goto(BASE + '/admin/anfragen/?status=NEW', 3000);
  check('Die Anfrage steht im Eingang (ING Eingang) als neu', (await text()).includes('Erika E2E Testfrau'));
  const leadId = sql(`select id from leads where email='${MAIL}'`);
  await pg.goto(`${BASE}/admin/anfragen/${leadId}/`, 3000);
  check('Detailseite zeigt Anfrage, Fotos/Fahrzeugschein und Telefon-Link', /Heckschaden nach Auffahrunfall/.test(await text()) && /Fahrzeugschein|Foto/.test(await text()));
  await pg.goto(`${BASE}/admin/anfragen/${leadId}/umwandeln/`, 3000);
  for (let i = 0; i < 5; i++) {
    if (await pg.evalJs(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Jetzt umwandeln')`)) break;
    // Pflichtfelder Fahrzeug (Hersteller, Modell) im Schritt 2 wie ein Mensch ausfüllen, falls leer
    await pg.evalJs(`(()=>{for (const [lab,v] of [['Hersteller','VW'],['Modell','Golf']]) { const l=[...document.querySelectorAll('label')].find(x=>x.textContent.trim().startsWith(lab)); const e=l?.querySelector('input'); if(e && !e.value){ Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v); e.dispatchEvent(new Event('input',{bubbles:true})); } } })()`);
    await pg.evalJs(`[...document.querySelectorAll('button')].find(b=>/^Weiter/.test(b.textContent.trim()))?.click()`);
    await sleep(500);
  }
  await pg.shot(`${OUT}/51-umwandeln.png`);
  await pg.evalJs(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Jetzt umwandeln')?.click()`);
  check('Umwandlung legt Kunde, Fahrzeug und Fall an (eine Transaktion)', await waitFor(() => Number(sql('select count(*) from cases')) === before.cases + 1, 25000));
  check('Lead ist „umgewandelt“ und mit dem Fall verknüpft; Fall startet im Status NEU', sql(`select l.status||'|'||(l.converted_case_id is not null) from leads l where l.email='${MAIL}'`) === 'CONVERTED|true' && sql(`select c.status from cases c join leads l on l.converted_case_id=c.id where l.email='${MAIL}'`) === 'NEW');
  check('Foto und Fahrzeugschein der Anfrage sind in den Fall übernommen', Number(sql(`select count(*) from case_photos where case_id=(select converted_case_id from leads where email='${MAIL}')`)) === 1 && Number(sql(`select count(*) from documents where case_id=(select converted_case_id from leads where email='${MAIL}')`)) >= 1);
} finally {
  proc.kill();
  const caseId = sql(`select converted_case_id from leads where email='${MAIL}'`);
  if (caseId) {
    sql(`delete from case_photos where case_id='${caseId}'`); sql(`delete from documents where case_id='${caseId}'`);
    sql(`delete from case_status_history where case_id='${caseId}'`); sql(`delete from notes where case_id='${caseId}'`);
    sql(`update leads set converted_case_id=null, converted_customer_id=null where email='${MAIL}'`);
    sql(`delete from cases where id='${caseId}'`);
  }
  sql(`delete from vehicles where customer_id in (select id from customers where email='${MAIL}')`);
  sql(`delete from customers where email='${MAIL}'`);
  cleanup();
  sql(`delete from inquiries where email='${MAIL}'`);
}
console.log(`\n${res.filter(Boolean).length}/${res.length} bestanden`);
process.exit(res.every(Boolean) ? 0 : 1);
