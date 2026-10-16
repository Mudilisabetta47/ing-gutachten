// Simuliert die vorgeschlagene Reverse-Proxy-Anbindung der öffentlichen Website an die Anfrage-API von ING Studio.
// Rein lokal, nur synthetische Daten, kein Zugriff auf irgendein echtes System.
// Die Prüflogik des "Studio" ist aus src/app/api/anfrage/route.ts (ING-Studio-Repository) übernommen:
//   - Origin-Prüfung: Origin-Host muss dem Host-Header entsprechen, sonst 403
//   - Client-IP für Rate-Limit/IP-Hash: erstes Element von X-Forwarded-For
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const listen = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const seenByStudio = [];

function studio({ allowOrigins = [] } = {}) {
  return http.createServer((req, res) => {
    const origin = req.headers.origin, host = req.headers.host;
    let allowed = true;
    if (origin && host) { try { allowed = new URL(origin).host === host || allowOrigins.includes(origin); } catch { allowed = false; } }
    const ip = (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
    seenByStudio.push({ host, origin, ip, xff: req.headers['x-forwarded-for'] });
    res.writeHead(allowed ? 200 : 403, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: allowed }));
    req.resume();
  });
}

/** Mini-Reverse-Proxy. mode: 'rewrite-host' (Host = Zielhost, wie bei vielen Rewrites), 'keep-host' (Host bleibt, wie Caddy-Standard),
 *  xff: 'append' (hängt an, vorhandene Header bleiben) | 'overwrite' (setzt nur die echte Verbindungs-IP, wie Caddy ohne vertrauenswürdige Proxys) */
function proxy(targetPort, { mode, xff }) {
  return http.createServer((req, res) => {
    const headers = { ...req.headers };
    const peer = '203.0.113.9'; // dokumentierte Test-IP (RFC 5737) als „echte" Client-IP
    if (mode === 'rewrite-host') headers.host = `127.0.0.1:${targetPort}`;
    headers['x-forwarded-for'] = xff === 'append' ? [req.headers['x-forwarded-for'], peer].filter(Boolean).join(', ') : peer;
    const up = http.request({ host: '127.0.0.1', port: targetPort, method: req.method, path: req.url, headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    req.pipe(up);
  });
}

const post = (port, headers = {}) => new Promise((resolve) => {
  const r = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/api/anfrage', headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': 11, ...headers } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
  r.end('anlass=Test');
});

test('Direkter Browseraufruf von anderer Herkunft wird abgelehnt (Ist-Zustand ohne Proxy)', async () => {
  const s = studio(); const sp = await listen(s);
  assert.equal(await post(sp, { origin: 'https://ing-gutachten.de' }), 403);
  s.close();
});

test('Proxy mit überschriebenem Host-Header: Origin-Prüfung schlägt fehl, solange keine Erlaubnisliste gepflegt ist', async () => {
  const s = studio(); const sp = await listen(s); const p = proxy(sp, { mode: 'rewrite-host', xff: 'overwrite' }); const pp = await listen(p);
  assert.equal(await post(pp, { origin: 'https://ing-gutachten.de', host: 'ing-gutachten.de' }), 403);
  s.close(); p.close();
});

test('Proxy, der den Host-Header unverändert lässt: Origin-Prüfung besteht ohne Codeänderung am Studio', async () => {
  const s = studio(); const sp = await listen(s); const p = proxy(sp, { mode: 'keep-host', xff: 'overwrite' }); const pp = await listen(p);
  assert.equal(await post(pp, { origin: 'https://ing-gutachten.de', host: 'ing-gutachten.de' }), 200);
  assert.equal(await post(pp, { origin: 'https://boese.example', host: 'ing-gutachten.de' }), 403, 'fremde Herkunft bleibt gesperrt');
  s.close(); p.close();
});

test('Erlaubnisliste im Studio erlaubt die öffentliche Herkunft auch bei überschriebenem Host', async () => {
  const s = studio({ allowOrigins: ['https://ing-gutachten.de'] }); const sp = await listen(s); const p = proxy(sp, { mode: 'rewrite-host', xff: 'overwrite' }); const pp = await listen(p);
  assert.equal(await post(pp, { origin: 'https://ing-gutachten.de', host: 'ing-gutachten.de' }), 200);
  assert.equal(await post(pp, { origin: 'https://boese.example', host: 'ing-gutachten.de' }), 403);
  s.close(); p.close();
});

test('RISIKO: Hängt der Proxy X-Forwarded-For nur an, kann ein Client die für Rate-Limit/IP-Hash genutzte IP fälschen', async () => {
  const s = studio(); const sp = await listen(s); const p = proxy(sp, { mode: 'keep-host', xff: 'append' }); const pp = await listen(p);
  seenByStudio.length = 0;
  await post(pp, { origin: 'https://ing-gutachten.de', host: 'ing-gutachten.de', 'x-forwarded-for': '198.51.100.77' });
  assert.equal(seenByStudio.at(-1).ip, '198.51.100.77', 'Studio nimmt das erste Element – hier die gefälschte Adresse');
  s.close(); p.close();
});

test('Proxy, der X-Forwarded-For überschreibt: die echte Verbindungs-IP kommt an, Fälschung wirkungslos', async () => {
  const s = studio(); const sp = await listen(s); const p = proxy(sp, { mode: 'keep-host', xff: 'overwrite' }); const pp = await listen(p);
  seenByStudio.length = 0;
  await post(pp, { origin: 'https://ing-gutachten.de', host: 'ing-gutachten.de', 'x-forwarded-for': '198.51.100.77' });
  assert.equal(seenByStudio.at(-1).ip, '203.0.113.9');
  s.close(); p.close();
});
