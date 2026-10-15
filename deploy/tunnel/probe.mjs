// Prüfprogramm für den Test-Zugang (läuft kurzlebig in einem Container; gibt NIE Passwörter aus).
//   MODE=gate     TARGET=http://gate:8080            : ohne Anmeldung ist jede Route gesperrt, mit Anmeldung läuft ING Studio
//   MODE=isolate                                     : aus dem Tunnel-Netz sind web, PostgreSQL und SeaweedFS nicht erreichbar
//   MODE=public   TARGET=https://….trycloudflare.com : dasselbe über die öffentliche Adresse (HTTPS mit gültigem Zertifikat)
// Umgebung: GATE_USER, GATE_PW (nur für gate/public)
import net from 'node:net';
import dns from 'node:dns/promises';

const MODE = process.env.MODE;
const TARGET = (process.env.TARGET || '').replace(/\/+$/, '');
const USER = process.env.GATE_USER || 'ing-test';
const PW = process.env.GATE_PW || '';
const good = 'Basic ' + Buffer.from(`${USER}:${PW}`).toString('base64');
const bad = 'Basic ' + Buffer.from(`${USER}:falsches-passwort`).toString('base64');
let failed = 0;
const out = (ok, name, extra = '') => { if (!ok) failed++; console.log(`${ok ? 'OK  ' : 'FEHL'}  ${name}${extra ? ' — ' + extra : ''}`); };
const req = (path, o = {}) => fetch(TARGET + path, { redirect: 'manual', method: o.method || 'GET', headers: o.headers || {}, body: o.body, signal: AbortSignal.timeout(15000) });

async function gate() {
  if (!TARGET) throw new Error('TARGET fehlt');
  const tok = 'a'.repeat(43);
  const paths = ['/', '/admin', '/admin/', '/admin/login/', '/admin/faelle/', '/admin/profil/', '/studio', '/studio/', '/api/health', '/api/health/', '/api/monitor/check/',
    '/api/studio/state/', '/api/studio/prefs/', '/api/studio/kalender/?monat=2026-10', '/api/admin/search/?q=a', '/api/admin/media/abc', '/api/admin/export/kunden',
    `/api/kalender/${tok}.ics`, '/assets/video/begutachtung.mp4', '/assets/img/showcase-begutachtung.jpg', '/_next/static/chunks/main.js', '/favicon.ico', '/sitemap.xml',
    '/admin/../studio/', '/%2e%2e/admin/', '/admin%2f', '//admin/', '/ADMIN/', '/studio%00', '/.env', '/.git/config', '/kontakt/', '/unfallgutachten/'];
  let n = 0, leaks = [];
  for (const p of paths) for (const m of ['GET', 'HEAD']) { n++; try { const r = await req(p, { method: m }); if (r.status !== 401) leaks.push(`${m} ${p} → ${r.status}`); } catch { /* Verbindungsfehler = nicht erreichbar */ } }
  out(leaks.length === 0, `Ohne Anmeldung ist jede Route gesperrt (${n} Aufrufe: ${paths.length} Pfade × GET/HEAD)`, leaks.slice(0, 5).join('; '));
  let mleaks = [];
  for (const [m, p] of [['POST', '/api/anfrage/'], ['POST', '/api/admin/media/upload'], ['POST', '/admin/login/'], ['PUT', '/api/studio/prefs/'], ['DELETE', '/admin/faelle/'], ['PATCH', '/api/studio/state/'], ['OPTIONS', '/api/health/']]) {
    try { const r = await req(p, { method: m, headers: { 'content-type': 'application/json', origin: TARGET }, body: ['GET', 'HEAD', 'OPTIONS'].includes(m) ? undefined : '{}' }); if (r.status !== 401) mleaks.push(`${m} ${p} → ${r.status}`); } catch { /* ok */ }
  }
  out(mleaks.length === 0, 'Ohne Anmeldung sind auch POST/PUT/DELETE/PATCH/OPTIONS gesperrt', mleaks.join('; '));
  let hleaks = [];
  for (const h of [{ 'x-forwarded-for': '127.0.0.1' }, { 'x-forwarded-host': 'localhost' }, { 'x-original-url': '/robots.txt' }, { 'x-rewrite-url': '/robots.txt' }, { 'x-forwarded-proto': 'https', host: 'localhost' }, { authorization: 'Bearer test' }, { authorization: bad }, { authorization: 'Basic ' }, { cookie: '__Host-ing_session=x; ing_session=x' }]) {
    try { const r = await req('/admin/', { headers: h }); if (r.status !== 401) hleaks.push(`${Object.keys(h).join('+')} → ${r.status}`); } catch { /* ok */ }
  }
  out(hleaks.length === 0, 'Header-Tricks, falsches Passwort, leere/falsche Authorization und Session-Cookies umgehen die Sperre nicht', hleaks.join('; '));
  const r401 = await req('/admin/');
  out(r401.status === 401 && /noindex/.test(r401.headers.get('x-robots-tag') || '') && /Basic/i.test(r401.headers.get('www-authenticate') || ''), 'Die 401-Antwort fordert Basic Auth und trägt X-Robots-Tag: noindex');
  const rb = await req('/robots.txt');
  const tb = await rb.text();
  out(rb.status === 200 && /Disallow:\s*\//.test(tb) && /noindex/.test(rb.headers.get('x-robots-tag') || ''), 'robots.txt ist öffentlich lesbar und sperrt alles (Disallow: /)');
  if (!PW) { out(false, 'GATE_PW fehlt – Prüfung mit Anmeldung nicht möglich'); return; }
  const l = await req('/admin/login/', { headers: { authorization: good } }); const lt = await l.text();
  out(l.status === 200 && lt.includes('name="password"') && !lt.includes('nicht freigeschaltet'), 'Mit Anmeldung: ING-Studio-Login erreichbar (Formular vorhanden, kein Vorschau-Modus)');
  const h = await req('/', { headers: { authorization: good } }); const ht = await h.text();
  out(h.status === 200 && ht.includes('id="fahrzeugklassen"') && /noindex/.test(h.headers.get('x-robots-tag') || ''), 'Mit Anmeldung: Premium-Startseite, Antwort trägt noindex');
  const s = await req('/studio/', { headers: { authorization: good } });
  out([307, 308].includes(s.status) && /admin\/login/.test(s.headers.get('location') || ''), 'Mit Anmeldung, ohne ING-Sitzung: /studio/ führt zum ING-Login (zweite Schranke)');
  const k = await req('/api/studio/kalender/?monat=2026-10', { headers: { authorization: good } });
  out(k.status === 401 || k.status === 403, 'Mit Basic Auth, ohne ING-Sitzung: interne API verweigert ebenfalls (Status ' + k.status + ')');
}

function tcp(host, port) {
  return new Promise((resolve) => { const s = net.connect({ host, port, timeout: 2500 }); s.once('connect', () => { s.destroy(); resolve(true); }); s.once('timeout', () => { s.destroy(); resolve(false); }); s.once('error', () => resolve(false)); });
}
async function isolate() {
  const targets = [['web', 3000], ['ing-staging-web-1', 3000], ['postgres', 5432], ['ing-staging-postgres-1', 5432], ['storage', 8333], ['storage', 9333], ['storage', 8888], ['ing-staging-storage-1', 8333], ['s3-tls', 8333], ['ing-staging-s3-tls-1', 8333]];
  const reach = [];
  for (const [h, p] of targets) { if (await tcp(h, p)) reach.push(`${h}:${p}`); }
  out(reach.length === 0, 'Aus dem Tunnel-Netz sind web, PostgreSQL und SeaweedFS/S3 nicht erreichbar', reach.join(', '));
  const names = []; for (const n of ['web', 'postgres', 'storage', 's3-tls']) { try { await dns.lookup(n); names.push(n); } catch { /* ok */ } }
  out(names.length === 0, 'Diese Namen sind im Tunnel-Netz nicht einmal auflösbar', names.join(', '));
  out(await tcp('gate', 8080), 'Erreichbar ist nur das Tor (gate:8080)');
}

async function publicCheck() {
  if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(TARGET)) throw new Error('TARGET muss eine https://….trycloudflare.com-Adresse sein');
  const a = await req('/admin/login/'); out(a.status === 401, 'Öffentliche Adresse ohne Anmeldung: 401');
  const b = await req('/admin/login/', { headers: { authorization: bad } }); out(b.status === 401, 'Öffentliche Adresse mit falschem Passwort: 401');
  const c = await req('/admin/login/', { headers: { authorization: good } }); const ct = await c.text();
  out(c.status === 200 && ct.includes('name="password"'), 'Öffentliche Adresse mit Anmeldung: ING-Studio-Login (HTTPS, gültiges Zertifikat)');
  const r = await req('/robots.txt'); out(r.status === 200 && /Disallow:\s*\//.test(await r.text()), 'robots.txt über die öffentliche Adresse sperrt alles');
  const s = await req('/studio/'); out(s.status === 401, 'Öffentlich ohne Anmeldung: /studio/ gesperrt (401)');
  const p = await req('/api/anfrage/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); out(p.status === 401, 'Öffentlich ohne Anmeldung: Anfrage-API gesperrt (401)');
}

try {
  if (MODE === 'gate') await gate(); else if (MODE === 'isolate') await isolate(); else if (MODE === 'public') await publicCheck(); else throw new Error('MODE unbekannt');
} catch (e) { out(false, 'Prüfung abgebrochen', e.message); }
console.log(failed === 0 ? 'ERGEBNIS: bestanden' : `ERGEBNIS: ${failed} Prüfung(en) fehlgeschlagen`);
process.exit(failed === 0 ? 0 : 1);
