// Prüfprogramm für den Test-Zugang (läuft kurzlebig in einem Container; gibt NIE Passwörter aus).
//   MODE=gate     TARGET=http://gate:8080            : ohne Anmeldung ist jede Route gesperrt, mit Anmeldung läuft ING Studio
//   MODE=isolate                                     : aus dem Tunnel-Netz sind web, PostgreSQL und SeaweedFS nicht erreichbar
//   MODE=egress                                      : Tunnel-Netz erreicht das Internet (DNS, TCP 443, TLS, HTTPS) – Voraussetzung für cloudflared und Prüfung C
//   MODE=public   TARGET=https://….trycloudflare.com : dasselbe über die öffentliche Adresse (HTTPS mit gültigem Zertifikat)
// Umgebung: GATE_USER, GATE_PW (nur für gate/public)
import net from 'node:net';
import tls from 'node:tls';
import https from 'node:https';
import dnsCb from 'node:dns';
import dns from 'node:dns/promises';

const MODE = process.env.MODE;
const TARGET = (process.env.TARGET || '').replace(/\/+$/, '');
const USER = process.env.GATE_USER || 'ing-test';
const PW = process.env.GATE_PW || '';
const good = 'Basic ' + Buffer.from(`${USER}:${PW}`).toString('base64');
const bad = 'Basic ' + Buffer.from(`${USER}:falsches-passwort`).toString('base64');
let failed = 0;
const out = (ok, name, extra = '') => { if (!ok) failed++; console.log(`${ok ? 'OK  ' : 'FEHL'}  ${name}${extra ? ' — ' + extra : ''}`); };
const reqFetch = (path, o = {}) => fetch(TARGET + path, { redirect: 'manual', method: o.method || 'GET', headers: o.headers || {}, body: o.body, signal: AbortSignal.timeout(15000) });

// Fehlerursache für die Ausgabe: Node meldet bei fetch nur "fetch failed"; die eigentliche Ursache steckt in error.cause (Code, Systemaufruf, Adresse).
// Gibt nie Header, Passwörter oder Anfrageinhalte aus.
function errInfo(e) {
  const parts = []; let x = e, depth = 0;
  while (x && depth++ < 5) {
    const bits = [x.code, x.syscall, x.hostname && `Name ${x.hostname}`, x.address && `${x.address}${x.port ? ':' + x.port : ''}`].filter(Boolean);
    parts.push((x.name && x.name !== 'Error' ? x.name + ' ' : '') + (bits.join(' ') || String(x.message || x).slice(0, 120)));
    x = x.cause;
  }
  return parts.join(' ← ');
}
function phaseOf(e) { // Verbindungsphase aus dem Fehlercode ableiten
  let x = e; const codes = []; while (x) { if (x.code) codes.push(String(x.code)); x = x.cause; }
  const c = codes.join(' ');
  if (/ENOTFOUND|EAI_AGAIN|EAI_NODATA|EAI_FAIL|ESERVFAIL|ENODATA/.test(c)) return 'DNS-Auflösung';
  if (/CERT|SSL|TLS|ERR_TLS|UNABLE_TO_VERIFY|DEPTH_ZERO|SELF_SIGNED|HOSTNAME_MISMATCH/.test(c)) return 'TLS-Handshake / Zertifikat';
  if (/ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|ECONNRESET|EPIPE|UND_ERR_SOCKET/.test(c)) return 'TCP-Verbindung';
  if (/ETIMEDOUT|CONNECT_TIMEOUT|UND_ERR_CONNECT|TimeoutError|ABORT/i.test(c + ' ' + (e && e.name))) return 'Zeitüberschreitung';
  return 'unklar';
}

// Für die öffentliche Adresse: Der Resolver des Servers merkt sich "Name unbekannt" für neue trycloudflare.com-Namen 60 s lang (SOA-Minimum).
// Deshalb bei fehlender Auflösung zusätzlich direkt bei Cloudflare (1.1.1.1) nachfragen – genau das, was ein Außenstehender sieht. TLS wird weiter vollständig geprüft.
let dnsPathUsed = 'lokaler Resolver';
const pubResolver = new dns.Resolver(); pubResolver.setServers(['1.1.1.1', '1.0.0.1']);
function lookupWithFallback(hostname, opts, cb) {
  dnsCb.lookup(hostname, { ...opts, family: 4 }, (err, addr, fam) => {
    if (!err) return cb(null, addr, fam);
    pubResolver.resolve4(hostname).then((ips) => {
      dnsPathUsed = 'Cloudflare 1.1.1.1 (lokaler Resolver kannte den Namen noch nicht: ' + (err.code || err.message) + ')';
      if (opts && opts.all) cb(null, ips.map((address) => ({ address, family: 4 }))); else cb(null, ips[0], 4);
    }, () => cb(err));
  });
}
const reqPublic = (path, o = {}) => new Promise((resolve, reject) => {
  const u = new URL(TARGET + path);
  const r = https.request({ method: o.method || 'GET', hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, headers: { ...(o.headers || {}), ...(o.body ? { 'content-length': Buffer.byteLength(o.body) } : {}) }, lookup: lookupWithFallback, timeout: 15000 }, (res) => {
    const chunks = []; res.on('data', (c) => chunks.push(c));
    res.on('end', () => { const body = Buffer.concat(chunks).toString('utf8'); resolve({ status: res.statusCode, headers: { get: (k) => { const v = res.headers[k.toLowerCase()]; return Array.isArray(v) ? v.join(', ') : (v ?? null); } }, text: async () => body }); });
  });
  r.on('timeout', () => r.destroy(Object.assign(new Error('Zeitüberschreitung (15 s)'), { code: 'ETIMEDOUT' })));
  r.on('error', reject);
  if (o.body) r.write(o.body);
  r.end();
});
const req = MODE === 'public' ? reqPublic : reqFetch;

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
  const hdr = (r, k) => r.headers.get(k) || '';
  const shown = (r) => `Status ${r.status}; www-authenticate=[${hdr(r, 'www-authenticate')}]; x-robots-tag=[${hdr(r, 'x-robots-tag')}]; referrer-policy=[${hdr(r, 'referrer-policy')}]; x-content-type-options=[${hdr(r, 'x-content-type-options')}]; server=[${hdr(r, 'server')}]`;
  out(r401.status === 401, 'Ohne Anmeldung antwortet die Sperre mit Status 401', 'Status ' + r401.status);
  out(/^basic\b/i.test(hdr(r401, 'www-authenticate')), 'Die 401-Antwort enthält WWW-Authenticate: Basic', 'www-authenticate=[' + hdr(r401, 'www-authenticate') + ']');
  out(/noindex/.test(hdr(r401, 'x-robots-tag')) && /nofollow/.test(hdr(r401, 'x-robots-tag')) && /noarchive/.test(hdr(r401, 'x-robots-tag')), 'Die 401-Antwort enthält X-Robots-Tag: noindex, nofollow, noarchive', 'x-robots-tag=[' + hdr(r401, 'x-robots-tag') + ']');
  if (failed) console.log('      Header der 401-Antwort (zur Diagnose): ' + shown(r401));
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

const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error(label + ': Zeitüberschreitung'), { code: 'ETIMEDOUT' })), ms))]);
function tcpOnce(host, port, ms = 6000) {
  return new Promise((resolve, reject) => { const s = net.connect({ host, port, timeout: ms }); s.once('connect', () => { s.destroy(); resolve(); }); s.once('timeout', () => { s.destroy(); reject(Object.assign(new Error('Zeitüberschreitung'), { code: 'ETIMEDOUT', syscall: 'connect', address: host, port })); }); s.once('error', reject); });
}
function tlsOnce(host, ip, ms = 8000) { // vollständige Zertifikatsprüfung gegen den Namen, Verbindung zur bereits aufgelösten Adresse
  return new Promise((resolve, reject) => { const s = tls.connect({ host: ip, port: 443, servername: host, timeout: ms }, () => { const ok = s.authorized, why = s.authorizationError; const c = s.getPeerCertificate(); s.destroy(); ok ? resolve(c && c.issuer && c.issuer.O) : reject(Object.assign(new Error(String(why)), { code: String(why) })); }); s.once('timeout', () => { s.destroy(); reject(Object.assign(new Error('Zeitüberschreitung'), { code: 'ETIMEDOUT' })); }); s.once('error', reject); });
}
// Zerlegt eine HTTPS-Verbindung in ihre Phasen und meldet für jede getrennt Erfolg oder Fehlerursache. Rückgabe: true, wenn alle Phasen bestanden.
async function phases(host, label) {
  let allOk = true; const step = (ok, name, extra) => { if (!ok) allOk = false; out(ok, `${label}: ${name}`, extra); };
  let local = [], pub = [];
  try { local = (await withTimeout(dns.lookup(host, { all: true, family: 4 }), 8000, 'DNS')).map((a) => a.address); step(local.length > 0, 'DNS über den lokalen Resolver', local.join(', ')); }
  catch (e) { step(false, 'DNS über den lokalen Resolver', `${phaseOf(e)}: ${errInfo(e)}`); }
  try { pub = await withTimeout(pubResolver.resolve4(host), 8000, 'DNS'); step(pub.length > 0, 'DNS direkt bei Cloudflare (1.1.1.1, UDP 53)', pub.join(', ')); }
  catch (e) { step(false, 'DNS direkt bei Cloudflare (1.1.1.1, UDP 53)', `${phaseOf(e)}: ${errInfo(e)}`); }
  const ip = local[0] || pub[0];
  if (!ip) return false;
  try { await tcpOnce(ip, 443); step(true, `TCP-Verbindung zu ${ip}:443`); } catch (e) { step(false, `TCP-Verbindung zu ${ip}:443`, `${phaseOf(e)}: ${errInfo(e)}`); return false; }
  try { const iss = await tlsOnce(host, ip); step(true, 'TLS-Handshake mit gültigem Zertifikat', iss ? 'Aussteller: ' + iss : ''); } catch (e) { step(false, 'TLS-Handshake mit gültigem Zertifikat', `${phaseOf(e)}: ${errInfo(e)}`); return false; }
  return allOk;
}
async function egress() {
  await phases('api.trycloudflare.com', 'Tunnel-Netz → Internet');
  try { await tcpOnce('region1.v2.argotunnel.com', 7844); out(true, 'Tunnel-Netz → Cloudflare-Tunnelanschluss (TCP 7844, nur Information)'); } catch (e) { console.log(`INFO  TCP 7844 zu Cloudflare nicht erreichbar (${errInfo(e)}) – cloudflared nutzt dann UDP/QUIC, nur zur Einordnung`); }
  const dnsList = (await import('node:fs')).readFileSync('/etc/resolv.conf', 'utf8').split('\n').filter((l) => /^nameserver/.test(l)).join(', ');
  console.log('INFO  Resolver im Container: ' + dnsList);
}

async function publicCheck() {
  if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(TARGET)) throw new Error('TARGET muss eine https://….trycloudflare.com-Adresse sein');
  const host = new URL(TARGET).hostname;
  if (!(await phases(host, 'Öffentliche Adresse'))) return;   // Ursache der Verbindungsphase ist ausgegeben; die inhaltlichen Prüfungen folgen erst, wenn die Verbindung steht
  const a = await req('/admin/login/'); out(a.status === 401, 'Öffentliche Adresse ohne Anmeldung: 401');
  const b = await req('/admin/login/', { headers: { authorization: bad } }); out(b.status === 401, 'Öffentliche Adresse mit falschem Passwort: 401');
  const c = await req('/admin/login/', { headers: { authorization: good } }); const ct = await c.text();
  out(c.status === 200 && ct.includes('name="password"'), 'Öffentliche Adresse mit Anmeldung: ING-Studio-Login (HTTPS, gültiges Zertifikat)');
  const r = await req('/robots.txt'); out(r.status === 200 && /Disallow:\s*\//.test(await r.text()), 'robots.txt über die öffentliche Adresse sperrt alles');
  const s = await req('/studio/'); out(s.status === 401, 'Öffentlich ohne Anmeldung: /studio/ gesperrt (401)');
  const p = await req('/api/anfrage/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); out(p.status === 401, 'Öffentlich ohne Anmeldung: Anfrage-API gesperrt (401)');
  console.log('INFO  Namensauflösung der Prüfung zuletzt über: ' + dnsPathUsed);
}

try {
  if (MODE === 'gate') await gate(); else if (MODE === 'isolate') await isolate(); else if (MODE === 'egress') await egress(); else if (MODE === 'public') await publicCheck(); else throw new Error('MODE unbekannt');
} catch (e) { out(false, 'Prüfung abgebrochen', `${phaseOf(e)}: ${errInfo(e)}`); }
console.log(failed === 0 ? 'ERGEBNIS: bestanden' : `ERGEBNIS: ${failed} Prüfung(en) fehlgeschlagen`);
process.exit(failed === 0 ? 0 : 1);
