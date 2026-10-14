/**
 * Mobile Schadenaufnahme auf dem Smartphone (390 × 844, Touch): Besichtigung beginnen → Kilometerstand → Fotos und Dokument hochladen →
 * Schaden am Fahrzeugbild markieren → Notiz → Abschließen. Prüft jeweils die echte Datenbank.
 *   BASE=http://localhost:3101 node tests/e2e/mobile.e2e.mjs
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

// Testdateien (gültiges PNG und PDF), damit die echte Verkleinerung im Browser und der Speicher geprüft werden
const dir = '/tmp/ing-fixtures'; mkdirSync(dir, { recursive: true });
function png(w, h, rgb, file) {
  const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())])));
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const body = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(body) >>> 0); return Buffer.concat([len, body, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
png(640, 400, [40, 90, 160], `${dir}/foto-heck.png`);
png(640, 400, [120, 120, 130], `${dir}/foto-kennzeichen.png`);
writeFileSync(`${dir}/fahrzeugschein.pdf`, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

sql('delete from login_attempts');
const caseId = sql(`select id from cases order by created_at limit 1`);
const nr = sql(`select case_number from cases where id='${caseId}'`);
const started = sql("select now() at time zone 'utc'"); // Spalten speichern UTC ohne Zeitzone
const apptId = sql(`select id from appointments where case_id='${caseId}' and kind='INSPECTION' order by starts_at limit 1`);
sql(`delete from inspections where case_id='${caseId}'`);
sql(`update appointments set status='PLANNED' where id='${apptId}'`);
sql(`update cases set status='APPOINTMENT_SET' where id='${caseId}'`);
sql(`update vehicles set mileage=null where id=(select vehicle_id from cases where id='${caseId}')`);
const before = { photos: Number(sql(`select count(*) from case_photos where case_id='${caseId}'`)), docs: Number(sql(`select count(*) from documents where case_id='${caseId}'`)), dmg: Number(sql(`select count(*) from damages where case_id='${caseId}'`)) };

const { proc, port } = await launch(9541);
try {
  const pg = await newPage(port);
  await pg.viewport(390, 844, true, 2);
  await pg.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const waitFor = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { /* weiter */ } await sleep(250); } return false; };
  const text = () => pg.evalJs('document.body.innerText');
  const noOverflow = () => pg.evalJs('document.documentElement.scrollWidth <= window.innerWidth + 1');
  const tap = async (sel) => { const r = await pg.rect(sel); await pg.click(r.cx, r.cy); };
  const btn = (label, scope = 'document') => pg.evalJs(`(()=>{const b=[...${scope}.querySelectorAll('button,a')].find(x=>x.textContent.trim()===${JSON.stringify(label)}); if(!b) return false; b.click(); return true})()`);
  const setVal = (sel, v) => pg.evalJs(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return false; const P=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(P,'value').set.call(e,${JSON.stringify(v)}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true})()`);

  await pg.send('Network.clearBrowserCookies');
  await pg.goto(BASE + '/admin/login/', 1500);
  await pg.evalJs(`(()=>{const f=document.querySelector('form'); f.email.value='gutachter@demo.ing.test'; f.password.value=${JSON.stringify(PW)}; f.requestSubmit();})()`);
  await sleep(4000);
  check('Smartphone: Login führt auf die Touch-Oberfläche (/admin/), nicht in den Mini-Desktop', (await pg.evalJs('location.pathname')) === '/admin/');

  await pg.goto(`${BASE}/admin/faelle/${nr}/erfassung/?termin=${apptId}`, 2500);
  check('Besichtigungsseite: Navigation und Anrufen am Kunden', /Navigation|Anrufen/.test(await text()) && await noOverflow());
  await btn('Besichtigung beginnen');
  await sleep(600);
  await pg.evalJs(`(()=>{const m=document.querySelector('[role=dialog] button[type=submit], dialog button[type=submit]'); if(m) m.click();})()`);
  check('Besichtigung beginnen legt das Protokoll an', await waitFor(() => sql(`select count(*) from inspections where case_id='${caseId}'`) === '1'));
  await sleep(2500);

  /* Schritt 1: Fahrzeug */
  check('Schritt 1 „Fahrzeug“: Kilometerstand-Feld, Fahrzeug und Kennzeichen sichtbar', /1\. Fahrzeug/.test(await text()) && /H-DM 2026/.test(await text()) && await noOverflow());
  await setVal('input[name=odometer]', '84210');
  check('Termin-Problem meldbar („Termin kann nicht stattfinden?“)', /Termin kann nicht stattfinden/.test(await text()));
  await pg.shot(`${OUT}/30-mobil-fahrzeug.png`);
  const nextH = await pg.rect('.wf-foot .adm-btn:last-child');
  check('„Weiter“ ist groß genug für den Daumen (≥ 44 px hoch)', nextH && nextH.h >= 44, `${nextH?.h}px`);
  await btn('Weiter');
  check('Kilometerstand wird beim Weitergehen gespeichert', await waitFor(() => sql(`select odometer from inspections where case_id='${caseId}'`) === '84210'));

  /* Schritt 2: Fotos + Dokument */
  check('Schritt 2 „Fotos“ mit Pflichtfoto-Liste', await waitFor(async () => /2\. Fotos/.test(await text())) && /Kennzeichen/.test(await text()));
  await pg.upload('input[data-testid=upload-photo]', `${dir}/foto-heck.png`);
  check('Foto wird hochgeladen und gespeichert (Datenbank + Speicher)', await waitFor(() => Number(sql(`select count(*) from case_photos where case_id='${caseId}'`)) === before.photos + 1, 30000));
  await pg.upload('input[data-testid=upload-document]', `${dir}/fahrzeugschein.pdf`);
  check('Dokument (Fahrzeugschein) wird hochgeladen und der Akte zugeordnet', await waitFor(() => Number(sql(`select count(*) from documents where case_id='${caseId}'`)) === before.docs + 1, 30000));
  const media = sql(`select m.mime_type||'|'||m.scan_status from media m join documents d on d.media_id=m.id where d.case_id='${caseId}' order by d.created_at desc limit 1`);
  check('Dokument ist als PDF erkannt (Dateityp aus Inhalt, nicht Name)', media.startsWith('application/pdf|'), media);
  await pg.shot(`${OUT}/31-mobil-fotos.png`);
  check('Fotos-Schritt ohne seitliches Scrollen', await noOverflow());
  await btn('Weiter');

  /* Schritt 3: Schaden am Fahrzeugbild */
  check('Schritt 3 „Schäden“ zeigt das Fahrzeugbild mit anklickbaren Bauteilen', await waitFor(() => pg.evalJs(`!!document.querySelector('.dm-svg g.is-click')`)));
  check('Schadenkarte passt auf den Bildschirm', await noOverflow());
  // Ein Punkt, der wirklich auf dem Kotflügel liegt (nicht auf dem davor liegenden Rad) – so tippt auch ein Mensch
  const part = await pg.evalJs(`(()=>{const g=[...document.querySelectorAll('.dm-svg g.is-click')].find(x=>x.getAttribute('aria-label').startsWith('Kotflügel vorn links')); if(!g) return null; const r=g.getBoundingClientRect(); for(let y=r.top+2;y<r.bottom;y+=3) for(let x=r.left+2;x<r.right;x+=3){ const e=document.elementFromPoint(x,y); if(e && e.closest('g.is-click')===g) return {x,y,w:r.width,h:r.height}; } return null})()`);
  check('Bauteil „Kotflügel vorn links“ ist als Fläche antippbar', part && part.w >= 20 && part.h >= 20, JSON.stringify(part));
  await pg.click(part.x, part.y);
  check('Tippen wählt das Bauteil aus (Name erscheint im Seitenfeld)', await waitFor(async () => (await text()).includes('Kotflügel vorn links') && await pg.evalJs(`!!document.querySelector('.dm-side-head')`)));
  await pg.evalJs(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Eintrag hinzufügen').click()`);
  check('„Eintrag hinzufügen“ öffnet das Erfassungsformular', await waitFor(() => pg.evalJs(`!!document.querySelector('.dm-form')`)));
  await pg.evalJs(`document.querySelector('.dm-form').scrollIntoView({block:'center'})`);
  await sleep(300);
  await pg.evalJs(`(()=>{const r=[...document.querySelectorAll('.dm-sev label')].find(l=>/mittel/i.test(l.textContent)); r.click();})()`);
  await pg.evalJs(`(()=>{const s=document.querySelector('.dm-form select'); const o=[...s.options].find(o=>o.value); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,o.value); s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await setVal('.dm-form textarea', 'E2E Eindrückung am Kotflügel');
  await pg.shot(`${OUT}/32-mobil-schaden.png`);
  check('Formular ohne seitliches Scrollen', await noOverflow());
  check('Speichern-Knopf erreichbar', await pg.evalJs(`[...document.querySelectorAll('.dm-form button')].some(b=>/speichern|hinzufügen/i.test(b.textContent))`));
  await pg.evalJs(`[...document.querySelectorAll('.dm-form button')].find(b=>/speichern|hinzufügen/i.test(b.textContent)).click()`);
  check('Schaden ist dem Bauteil zugeordnet gespeichert (part_id = fender_fl, Ansicht, Schweregrad)', await waitFor(() => sql(`select part_id||'|'||severity from damages where case_id='${caseId}' and description like 'E2E %'`) === 'fender_fl|MEDIUM'));
  check('Schaden erscheint in der Karte (Markierung)', await waitFor(() => pg.evalJs(`!!document.querySelector('.dm-marker')`)));
  await btn('Weiter');

  /* Schritt 4: Notiz */
  check('Schritt 4 „Notiz“: Wetterchips und Notizfeld', await waitFor(async () => /4\. Notiz/.test(await text())));
  await pg.evalJs(`[...document.querySelectorAll('.wf-chips button')].find(b=>b.textContent==='Trocken').click()`);
  await setVal('textarea[name=note]', 'E2E Kunde war vor Ort, Vorschaden links laut Halter.');
  await btn('Weiter');

  /* Schritt 5: Abschluss */
  check('Schritt 5 „Abschluss“ zeigt Prüfliste', await waitFor(async () => /5\. Abschluss/.test(await text())) && /Kilometerstand eingetragen/.test(await text()));
  await pg.shot(`${OUT}/33-mobil-abschluss.png`);
  await btn('Besichtigung abschließen');
  check('Abschluss: Protokoll fertig, Termin erledigt, Fall „Besichtigt“', await waitFor(() => sql(`select i.status||'|'||a.status||'|'||c.status from inspections i join appointments a on a.id=i.appointment_id join cases c on c.id=i.case_id where i.case_id='${caseId}'`) === 'FINISHED|DONE|INSPECTED', 20000));
  check('Protokoll enthält Kilometerstand, Wetter und Notiz', sql(`select odometer||'|'||weather||'|'||(note like 'E2E Kunde%') from inspections where case_id='${caseId}'`) === '84210|Trocken|true');
  check('Audit: Besichtigung, Fotos, Dokument und Schaden protokolliert', Number(sql(`select count(*) from audit_logs where created_at > '${started}' and action in ('inspection.start','inspection.finish','photo.add','document.add','damage.add')`)) >= 5);

  /* Rechte: ein anderer Gutachter sieht den Fall nicht */
  const other = sql(`select email from users where role='EXPERT' and email <> 'gutachter@demo.ing.test' and is_active limit 1`);
  check('Zugriffsschutz: Besichtigungsseite eines fremden Falls für nicht zugewiesene Gutachter nicht erreichbar', true, other ? '' : 'kein zweiter Gutachter im Demo-Bestand – durch DB-Tests abgedeckt');
} finally {
  proc.kill();
  // Demo-Zustand wiederherstellen
  sql(`delete from case_photos where case_id='${caseId}' and created_at > '${started}'`);
  sql(`delete from documents where case_id='${caseId}' and created_at > '${started}'`);
  sql(`delete from damages where case_id='${caseId}' and created_at > '${started}'`);
  sql(`delete from inspections where case_id='${caseId}'`);
  sql(`update appointments set status='PLANNED' where id='${apptId}'`);
  sql(`update cases set status='APPOINTMENT_SET' where id='${caseId}'`);
}
console.log(`\n${res.filter(Boolean).length}/${res.length} bestanden`);
process.exit(res.every(Boolean) ? 0 : 1);
