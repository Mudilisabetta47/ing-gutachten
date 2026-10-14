/**
 * Zugriffsschutz auf HTTP-Ebene (Browser, echte Sitzungen): Fotos/Dokumente, Gutachten-PDF, Rechnungs-PDF, Uploads, Exporte, Suche.
 * Identitäten: anonym · fremder Gutachter (nicht zugewiesen) · zugewiesener Gutachter · Buchhaltung · Prüfer · Website-Rolle · Inhaber.
 *   BASE=http://localhost:3101 node tests/e2e/access.e2e.mjs
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

const FOREIGN = 'e2e-fremder-gutachter@demo.ing.test';
sql('delete from login_attempts');
const caseId = sql(`select id from cases order by created_at limit 1`);
const nr = sql(`select case_number from cases where id='${caseId}'`);
// fremder Gutachter: gleiches Demo-Passwort, aber dem Fall NICHT zugewiesen
sql(`delete from users where email='${FOREIGN}'`);
sql(`insert into users (id, email, password_hash, first_name, last_name, role, is_active, failed_logins, must_change_password, created_at, updated_at) select 'u_e2e_foreign', '${FOREIGN}', password_hash, 'Fremder', 'Gutachter', 'EXPERT', true, 0, false, now(), now() from users where email='gutachter@demo.ing.test'`);
sql(`insert into employees (id, user_id, is_expert, created_at, updated_at) values ('emp_e2e_foreign', 'u_e2e_foreign', true, now(), now())`);
// Prüfobjekte: ein Gutachten (Entwurf) und eine Rechnung (Entwurf) am Fall
sql(`delete from reports where id='rep_e2e_access'`);
sql(`insert into reports (id, case_id, number, status, revision, content, save_counter, created_at, updated_at) values ('rep_e2e_access', '${caseId}', 'GA-E2E-ACCESS', 'DRAFT', 1, '{"chapters":[]}', 0, now(), now())`);
const custId = sql(`select customer_id from cases where id='${caseId}'`);
sql(`delete from invoices where id='inv_e2e_access'`);
sql(`insert into invoices (id, case_id, customer_id, status, recipient_name, payment_terms_days, net_cents, vat_cents, gross_cents, created_at, updated_at) values ('inv_e2e_access', '${caseId}', '${custId}', 'DRAFT', 'E2E Zugriffstest', 14, 0, 0, 0, now(), now())`);
const started = sql("select now() at time zone 'utc'");

const { proc, port } = await launch(9591);
let mediaPhoto = '', mediaDoc = '';
try {
  const pg = await newPage(port); await pg.viewport(1200, 800);
  const login = async (email) => { await pg.send('Network.clearBrowserCookies'); await pg.goto(BASE + '/admin/login/', 1000); if (!email) return; await pg.evalJs(`(()=>{const f=document.querySelector('form'); f.email.value=${JSON.stringify(email)}; f.password.value=${JSON.stringify(PW)}; f.requestSubmit();})()`); await sleep(3200); await pg.goto(BASE + '/admin/login/', 300); };
  const status = (url, init = '{}') => pg.evalJs(`fetch(${JSON.stringify(url)}, Object.assign({redirect:'manual'}, ${init})).then(r=>({s:r.status===0?'redirect':r.status, cc:r.headers.get('cache-control'), ct:r.headers.get('content-type'), nosniff:r.headers.get('x-content-type-options')})).catch(()=>({s:'error'}))`);
  const upload = (target, file = 'png', extra = '') => pg.evalJs(`(async()=>{ const c=document.createElement('canvas'); c.width=40;c.height=30; c.getContext('2d').fillRect(0,0,40,30); const blob = ${file === 'png' ? "await new Promise(r=>c.toBlob(r,'image/png'))" : "new Blob(['Das ist kein Bild'],{type:'image/png'})"}; const f=new FormData(); f.set('target','${target}'); f.set('caseId','${caseId}'); f.set('category','${target === 'photo' ? 'DAMAGE' : 'OTHER'}'); f.set('title','E2E Zugriff'); f.set('file', blob, 'x.png'); ${extra} const r=await fetch('/api/admin/media/upload/',{method:'POST',body:f}); return {s:r.status, j:await r.json().catch(()=>null)}})()`);

  /* ---------- Zugewiesener Gutachter legt Foto + Dokument an ---------- */
  await login('gutachter@demo.ing.test');
  const up1 = await upload('photo');
  check('Zugewiesener Gutachter darf ein Foto hochladen', up1.s === 200 && up1.j?.ok, JSON.stringify(up1));
  mediaPhoto = sql(`select media_id from case_photos where case_id='${caseId}' order by created_at desc limit 1`);
  const doc = await pg.evalJs(`(async()=>{ const f=new FormData(); f.set('target','document'); f.set('caseId','${caseId}'); f.set('category','OTHER'); f.set('title','E2E Dokument'); f.set('file', new Blob([new Uint8Array([37,80,68,70,45,49,46,52,10,37,37,69,79,70,10])],{type:'application/pdf'}), 'x.pdf'); const r=await fetch('/api/admin/media/upload/',{method:'POST',body:f}); return {s:r.status, j:await r.json().catch(()=>null)}})()`);
  check('… und ein PDF-Dokument', doc.s === 200, JSON.stringify(doc));
  mediaDoc = sql(`select media_id from documents where case_id='${caseId}' and title='E2E Dokument'`);
  const M = (id) => `/api/admin/media/${id}/`;
  const own = await status(M(mediaPhoto));
  check('Zugewiesener Gutachter ruft das Foto ab; Antwort ist nicht zwischenspeicherbar, ohne Typ-Raten und in Sandbox', own.s === 200 && /no-store/.test(own.cc) && own.nosniff === 'nosniff', JSON.stringify(own));
  const csp = await pg.evalJs(`fetch('${M(mediaPhoto)}').then(r=>r.headers.get('content-security-policy'))`);
  check('Auslieferung trägt eine Content-Security-Policy mit sandbox', /sandbox/.test(csp ?? ''), String(csp));
  const typeTrick = await upload('photo', 'fake');
  check('Textdatei mit Bild-Typ wird abgelehnt (Dateityp aus Inhalt)', typeTrick.s === 400, JSON.stringify(typeTrick));
  // Fremder Ursprung: ein Browser erlaubt den Origin-Header nicht zu setzen – deshalb mit gestohlener Sitzung direkt von außen (Node)
  const jar = (await pg.send('Network.getAllCookies')).cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const form = new FormData(); form.set('target', 'photo'); form.set('caseId', caseId); form.set('file', new Blob([new Uint8Array([1, 2, 3])]), 'x.png');
  const evil = await fetch(BASE + '/api/admin/media/upload/', { method: 'POST', body: form, headers: { Cookie: jar, Origin: 'https://evil.example' } });
  check('Upload mit gültiger Sitzung, aber fremdem Origin (CSRF-Versuch) wird mit 403 abgewiesen', evil.status === 403, String(evil.status));
  const noOrigin = await fetch(BASE + '/api/admin/media/upload/', { method: 'POST', body: form, headers: { Cookie: jar } });
  check('Upload ohne Origin-Header wird ebenfalls abgewiesen', noOrigin.status === 403, String(noOrigin.status));
  const big = await pg.evalJs(`(async()=>{ const f=new FormData(); f.set('target','document'); f.set('caseId','${caseId}'); f.set('file', new Blob([new Uint8Array(4_600_000)],{type:'application/pdf'}), 'groß.pdf'); const r=await fetch('/api/admin/media/upload/',{method:'POST',body:f}); return r.status})()`);
  check('Zu große Datei wird mit 413 abgelehnt', big === 413, String(big));

  /* ---------- Matrix je Identität ---------- */
  const PDFS = { report: '/api/admin/gutachten/rep_e2e_access/pdf/', invoice: '/api/admin/rechnungen/inv_e2e_access/pdf/' };
  const matrix = [
    // [Anzeige, Anmeldung, Foto, Dokument, Gutachten-PDF, Rechnungs-PDF, Rechnungs-Export, Fälle-Export, Upload]
    ['anonym', null, [401, 401, 401, 401, 401, 401, 401]],
    ['fremder Gutachter', FOREIGN, [404, 404, 404, 403, 403, 403, 404]],
    ['zugewiesener Gutachter', 'gutachter@demo.ing.test', [200, 200, 200, 403, 403, 403, 200]],
    ['Buchhaltung', 'buchhaltung@demo.ing.test', [403, 403, 403, 200, 200, 403, 403]],
    ['Prüfer', 'pruefer@demo.ing.test', [200, 200, 200, 403, 403, 403, 403]],
    ['Website-Rolle', 'redaktion@demo.ing.test', [403, 403, 403, 403, 403, 403, 403]],
    ['Inhaber', 'inhaber@demo.ing.test', [200, 200, 200, 200, 200, 200, 200]],
  ];
  const labels = ['Foto', 'Dokument', 'Gutachten-PDF', 'Rechnungs-PDF', 'Rechnungs-Export', 'Fälle-Export', 'Upload'];
  for (const [who, email, expected] of matrix) {
    await login(email);
    const got = [
      (await status(M(mediaPhoto))).s, (await status(M(mediaDoc))).s, (await status(PDFS.report)).s, (await status(PDFS.invoice)).s,
      (await status('/api/admin/rechnungen/export/')).s, (await status('/api/admin/export/faelle/')).s,
      email ? (await upload('photo')).s : (await pg.evalJs(`fetch('/api/admin/media/upload/',{method:'POST',body:new FormData()}).then(r=>r.status)`)),
    ];
    const bad = got.map((g, i) => [g, expected[i], labels[i]]).filter(([g, e]) => g !== e);
    check(`${who}: Zugriffe wie vorgesehen`, bad.length === 0, bad.map(([g, e, l]) => `${l}: ${g} (erwartet ${e})`).join('; ') || got.join('/'));
  }
  // Hinweis: Reihenfolge der Spalten oben = [Foto, Dokument, Gutachten-PDF(Bytes 3.→ Report), Rechnungs-PDF, …] siehe `labels`

  /* ---------- Seiten und Suche ---------- */
  await login(FOREIGN);
  const page = await pg.evalJs(`fetch('/admin/faelle/${nr}/').then(async r=>({s:r.status, t:(await r.text()).includes('${nr}')&&!(/Nicht gefunden/.test(await Promise.resolve('')))}))`);
  await pg.goto(`${BASE}/admin/faelle/${nr}/`, 2500);
  check('Fremder Gutachter: Fallseite zeigt „Nicht gefunden“ (kein Hinweis, dass der Fall existiert)', /Nicht gefunden/i.test(await pg.evalJs('document.body.innerText')) && !(await pg.evalJs('document.body.innerText')).includes('Fixture'));
  const search = await pg.evalJs(`fetch('/api/admin/search/?q=${nr}').then(r=>r.json())`);
  check('Fremder Gutachter: die Suche findet den Fall nicht', (search.cases?.length ?? 0) === 0 && (search.customers?.length ?? 0) === 0);
  await pg.goto(`${BASE}/admin/kunden/${custId}/`, 2500);
  check('Fremder Gutachter: Kundenseite des Falls nicht erreichbar', /Nicht gefunden/i.test(await pg.evalJs('document.body.innerText')) && !(await pg.evalJs('document.body.innerText')).includes('Fixture'));
  // Studio-Einstellungen: keine Fremd-Einsicht (nur eigenes Konto)
  const prefs = await pg.evalJs(`fetch('/api/studio/prefs/').then(r=>r.json())`);
  check('Studio-Einstellungen gehören nur zum eigenen Konto', prefs.ok === true);
} finally {
  proc.kill();
  sql(`delete from case_photos where case_id='${caseId}' and created_at > '${started}'`);
  sql(`delete from documents where case_id='${caseId}' and created_at > '${started}'`);
  sql(`delete from media where created_at > '${started}' and id not in (select media_id from case_photos) and id not in (select media_id from documents) and id not in (select media_id from inquiry_attachments where media_id is not null)`);
  sql(`delete from reports where id='rep_e2e_access'`); sql(`delete from invoices where id='inv_e2e_access'`);
  sql(`delete from sessions where user_id='u_e2e_foreign'`); sql(`delete from audit_logs where actor_id='u_e2e_foreign'`);
  sql(`delete from employees where id='emp_e2e_foreign'`); sql(`delete from users where id='u_e2e_foreign'`);
}
console.log(`\n${res.filter(Boolean).length}/${res.length} bestanden`);
process.exit(res.every(Boolean) ? 0 : 1);
