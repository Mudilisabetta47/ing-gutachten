/** Zwei-Faktor-Anmeldung im echten Browser: einrichten, anmelden mit Code und Wiederherstellungscode, Pflicht für Administratoren, Zurücksetzen. */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { launch, newPage, sleep } from './cdp.mjs';

const BASE = process.env.BASE; if (!BASE) throw new Error('BASE setzen');
if (/:3100\b/.test(BASE) && !process.env.ALLOW_3100) throw new Error('Port 3100 gehört evtl. einem anderen Projekt.');
const PW = readFileSync(new URL('../../scripts/seed-demo.ts', import.meta.url), 'utf8').match(/DEMO_PASSWORD = '([^']+)'/)[1];
const PSQL = process.env.PSQL || '/Applications/Postgres.app/Contents/Versions/latest/bin/psql';
const DB = process.env.E2E_DB || 'ing_os_dev';
const sql = (q) => execSync(`${PSQL} -h localhost -U ${process.env.USER} -d ${DB} -At -c "${q.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
const res = []; const check = (n, ok, x = '') => { res.push(Boolean(ok)); console.log(`${ok ? '✔' : '✖'} ${n}${x ? ' — ' + x : ''}`); };

const b32 = (s) => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, v = 0; const out = []; for (const c of s.replace(/\s/g, '')) { v = (v << 5) | A.indexOf(c); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
const totp = (secret, atMs = Date.now()) => { const c = Math.floor(atMs / 30000); const m = Buffer.alloc(8); m.writeBigUInt64BE(BigInt(c)); const h = createHmac('sha1', b32(secret)).update(m).digest(); const o = h[19] & 15; return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0'); };

const auditBase = (a) => Number(sql(`select count(*) from audit_logs where action='${a}'`));
const base = { rec: auditBase('auth.mfa_recovery_used'), reset: auditBase('auth.mfa_reset') };
sql('delete from login_attempts');
sql(`update users set mfa_secret=null, mfa_enabled_at=null, mfa_last_step=null where email like '%@demo.ing.test'`);
sql('delete from mfa_recovery_codes'); sql('delete from mfa_challenges');
sql(`delete from system_settings where key='security'`);

const { proc, port } = await launch(9531);
try {
  const pg = await newPage(port); await pg.viewport(1400, 900);
  const waitFor = async (fn, ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { /* weiter */ } await sleep(200); } return false; };
  const text = () => pg.evalJs('document.body.innerText');
  const login = async (email, wait = 3500) => {
    await pg.send('Network.clearBrowserCookies');
    await pg.goto(BASE + '/admin/login/', 1200);
    await pg.evalJs(`(()=>{const f=document.querySelector('form'); f.email.value=${JSON.stringify(email)}; f.password.value=${JSON.stringify(PW)}; f.requestSubmit();})()`);
    await sleep(wait);
  };
  const setVal = (sel, v) => pg.evalJs(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value'); d.set.call(e,${JSON.stringify(v)}); e.dispatchEvent(new Event('input',{bubbles:true})); return true})()`);
  const btn = (label) => pg.evalJs(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(label)}); if(!b) return false; b.click(); return true})()`);

  /* ---------- Einrichten im Profil ---------- */
  await login('inhaber@demo.ing.test');
  await pg.goto(BASE + '/admin/profil/', 2500);
  check('Profil zeigt „Zwei-Faktor-Anmeldung“ mit Einrichten-Knopf', /Zwei-Faktor-Anmeldung/.test(await text()) && await btn('Einrichten'));
  check('Geheimer Schlüssel wird einmal angezeigt', await waitFor(() => pg.evalJs(`!!document.querySelector('[aria-label="Geheimer Schlüssel"]')`)));
  const secret = (await pg.evalJs(`document.querySelector('[aria-label="Geheimer Schlüssel"]').textContent`)).replace(/\s/g, '');
  check('Schlüssel ist ein gültiger Base32-Schlüssel (32 Zeichen)', /^[A-Z2-7]{32}$/.test(secret));
  check('Datenbank speichert das Geheimnis nicht im Klartext', !sql(`select mfa_secret from users where email='inhaber@demo.ing.test'`).includes(secret));
  await setVal('input[autocomplete="one-time-code"]', '000000');
  await btn('Bestätigen und aktivieren');
  check('Falscher Code bei der Einrichtung wird abgewiesen', await waitFor(async () => /Code stimmt nicht/.test(await text())) && sql(`select mfa_enabled_at is null from users where email='inhaber@demo.ing.test'`) === 't');
  await setVal('input[autocomplete="one-time-code"]', totp(secret));
  await btn('Bestätigen und aktivieren');
  check('Richtiger Code aktiviert und zeigt 8 Wiederherstellungscodes', await waitFor(() => pg.evalJs(`document.querySelectorAll('[aria-label="Wiederherstellungscodes"] li').length===8`)));
  const codes = await pg.evalJs(`[...document.querySelectorAll('[aria-label="Wiederherstellungscodes"] li')].map(l=>l.textContent.trim())`);
  check('Wiederherstellungscodes haben das Format xxxxx-xxxxx', codes.every((c) => /^[a-z2-9]{5}-[a-z2-9]{5}$/.test(c)));
  await pg.shot('/tmp/ing-shots/20-mfa-profil.png');

  /* ---------- Anmeldung mit zweitem Schritt ---------- */
  await login('inhaber@demo.ing.test', 2500);
  check('Nach dem Passwort folgt der zweite Schritt (kein Zutritt ohne Code)', (await text()).includes('Zweiter Schritt') && (await pg.evalJs('location.pathname')).startsWith('/admin/login'));
  check('Noch keine Sitzung in der Datenbank für diese Anmeldung', sql(`select count(*) from sessions where user_id=(select id from users where email='inhaber@demo.ing.test') and created_at > now() - interval '20 seconds'`) === '0');
  await pg.shot('/tmp/ing-shots/21-mfa-login.png');
  await setVal('input[name=code]', '111111');
  await btn('Bestätigen');
  check('Falscher Code im Login: Fehlermeldung, weiter im zweiten Schritt', await waitFor(async () => /Code stimmt nicht/.test(await text())) && (await text()).includes('Zweiter Schritt'));
  await pg.goto(BASE + '/admin/', 1200);
  check('Mit nur dem Passwort ist /admin/ nicht erreichbar', (await pg.evalJs('location.pathname')).startsWith('/admin/login'));
  await login('inhaber@demo.ing.test', 2500);
  // Code des nächsten Schritts (liegt im akzeptierten Fenster und ist neuer als der bei der Einrichtung benutzte)
  await setVal('input[name=code]', totp(secret, Date.now() + 30000));
  await btn('Bestätigen');
  check('Richtiger Code: Anmeldung gelingt und führt in den Desktop', await waitFor(async () => (await pg.evalJs('location.pathname')) === '/studio/', 15000));
  check('Eine Sitzung wurde angelegt, die Aufgabe ist verbraucht', sql(`select count(*) from mfa_challenges`) === '0');

  /* ---------- Wiederherstellungscode ---------- */
  await login('inhaber@demo.ing.test', 2500);
  await setVal('input[name=code]', codes[0]);
  await btn('Bestätigen');
  check('Wiederherstellungscode meldet an', await waitFor(async () => (await pg.evalJs('location.pathname')) === '/studio/', 15000));
  await login('inhaber@demo.ing.test', 2500);
  await setVal('input[name=code]', codes[0]);
  await btn('Bestätigen');
  check('Derselbe Wiederherstellungscode funktioniert nur einmal', await waitFor(async () => /Code stimmt nicht/.test(await text())));
  check('Audit-Protokoll enthält die Nutzung des Wiederherstellungscodes', auditBase('auth.mfa_recovery_used') === base.rec + 1);

  /* ---------- Pflicht für Administratoren ---------- */
  sql(`insert into system_settings (key, value, updated_at) values ('security', '{"requireMfaForAdmins": true}', now()) on conflict (key) do update set value=excluded.value`);
  await login('admin@demo.ing.test');
  check('Pflicht aktiv: Administrator ohne zweiten Faktor landet auf der Profilseite', (await pg.evalJs('location.pathname')).startsWith('/admin/profil'));
  await pg.goto(BASE + '/admin/faelle/', 1500);
  check('… und erreicht keine andere Seite', (await pg.evalJs('location.pathname')).startsWith('/admin/profil'));
  await pg.goto(BASE + '/studio/', 1500);
  check('… auch nicht den Studio-Desktop', (await pg.evalJs('location.pathname')).startsWith('/admin/profil'));
  const api = await pg.evalJs(`fetch('/api/studio/state/').then(r=>r.status)`);
  check('… und keine Schnittstelle (403)', api === 403, String(api));
  check('Profilseite weist auf die Pflicht hin', /verpflichtend/.test(await text()));
  await btn('Einrichten');
  await waitFor(() => pg.evalJs(`!!document.querySelector('[aria-label="Geheimer Schlüssel"]')`));
  const secret2 = (await pg.evalJs(`document.querySelector('[aria-label="Geheimer Schlüssel"]').textContent`)).replace(/\s/g, '');
  await setVal('input[autocomplete="one-time-code"]', totp(secret2));
  await btn('Bestätigen und aktivieren');
  await waitFor(() => pg.evalJs(`document.querySelectorAll('[aria-label="Wiederherstellungscodes"] li').length===8`));
  await pg.goto(BASE + '/admin/faelle/', 1800);
  check('Nach der Einrichtung ist alles wieder erreichbar', (await pg.evalJs('location.pathname')).startsWith('/admin/faelle'));
  await pg.goto(BASE + '/admin/profil/', 1800);
  check('Bei Pflicht gibt es keinen „Abschalten“-Knopf', !(await pg.evalJs(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Abschalten')`)));

  /* ---------- Zurücksetzen durch die Leitung ---------- */
  await login('inhaber@demo.ing.test', 2500);
  await setVal('input[name=code]', codes[1]);
  await btn('Bestätigen');
  await waitFor(async () => (await pg.evalJs('location.pathname')) === '/studio/', 15000);
  const adminId = sql(`select id from users where email='admin@demo.ing.test'`);
  await pg.goto(`${BASE}/admin/benutzer/${adminId}/`, 2000);
  check('Benutzerseite zeigt „Zwei-Faktor-Anmeldung: Aktiv“', /Zwei-Faktor-Anmeldung/.test(await text()) && /Aktiv\./.test(await text()));
  await pg.evalJs(`window.confirm = () => true`);
  await btn('Zurücksetzen');
  check('Leitung setzt den zweiten Faktor zurück (Datenbank, Sitzungen beendet)', await waitFor(() => sql(`select mfa_enabled_at is null from users where id='${adminId}'`) === 't') && sql(`select count(*) from sessions where user_id='${adminId}' and revoked_at is null`) === '0');
  check('Audit-Protokoll vermerkt das Zurücksetzen', auditBase('auth.mfa_reset') === base.reset + 1);
} finally {
  proc.kill();
  sql(`delete from system_settings where key='security'`);
  sql(`update users set mfa_secret=null, mfa_enabled_at=null, mfa_last_step=null where email like '%@demo.ing.test'`);
  sql('delete from mfa_recovery_codes'); sql('delete from mfa_challenges'); sql('delete from login_attempts');
}
console.log(`\n${res.filter(Boolean).length}/${res.length} bestanden`);
process.exit(res.every(Boolean) ? 0 : 1);
