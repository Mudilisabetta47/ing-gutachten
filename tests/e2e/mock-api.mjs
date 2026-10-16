// Mock der ING-Studio-Anfrage-API (Logik aus src/app/api/anfrage/route.ts, nur Validierung – nichts wird gespeichert).
import http from 'node:http';
import { createHash } from 'node:crypto';
const SRC = process.env.ING_STUDIO_SRC;
const { LIMITS, validateFields, detectType, clean, PHOTO_MIME, DOC_MIME } = await import(`${SRC}/src/lib/request-schema.ts`);
export const received = [];
const keys = new Map(); // Idempotenz: Schlüssel → Referenz (Simulation der geplanten Serverfunktion)
let rateHits = 0;
let counter = 0;
const ALLOW = 'http://127.0.0.1:4312';
export function start(port = 4311) {
  const srv = http.createServer(async (req, res) => {
    const cors = { 'Access-Control-Allow-Origin': ALLOW, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
    const send = (code, obj) => { res.writeHead(code, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    if (req.method !== 'POST' || !req.url.startsWith('/api/anfrage')) return send(404, { ok: false });
    if (!req.headers['content-length']) return send(411, { ok: false, error: 'length_required' });
    if (Number(req.headers['content-length']) > LIMITS.maxTotalBytes + 200000) return send(413, { ok: false, error: 'too_large' });
    const chunks = []; for await (const c of req) chunks.push(c);
    const form = await new Request('http://x/', { method: 'POST', headers: { 'content-type': req.headers['content-type'] }, body: Buffer.concat(chunks) }).formData();
    if (form.get('website')) return send(200, { ok: true, note: 'honeypot' });
    const t = Number(form.get('t')); if (Number.isFinite(t) && t > 0 && Date.now() - t < LIMITS.minFillMs) return send(200, { ok: true, note: 'too_fast' });
    const f = { anlass: clean(form.get('anlass'), 60), fahrzeug: clean(form.get('fahrzeug'), 60), name: clean(form.get('name'), LIMITS.name), telefon: clean(form.get('telefon'), LIMITS.phone), email: clean(form.get('email'), LIMITS.email), standort: clean(form.get('standort'), LIMITS.place), nachricht: clean(form.get('nachricht'), LIMITS.message, true), datenschutz: form.get('datenschutz') === 'true' };
    const errors = validateFields(f); if (Object.keys(errors).length) return send(400, { ok: false, error: 'validation', fields: errors });
    const photos = form.getAll('foto').filter((v) => typeof v !== 'string' && v.size > 0);
    if (photos.length > LIMITS.maxPhotos) return send(400, { ok: false, error: 'too_many_files' });
    let total = 0; const files = [];
    for (const p of photos) { if (p.size > LIMITS.maxPhotoBytes) return send(400, { ok: false, error: 'invalid_file', message: 'zu groß' }); const bytes = new Uint8Array(await p.arrayBuffer()); const k = detectType(bytes); if (!k || !PHOTO_MIME.includes(k.mime)) return send(400, { ok: false, error: 'invalid_file' }); total += bytes.length; files.push({ exif: Buffer.from(bytes).includes(Buffer.from('Exif\0\0')), mime: k.mime, size: bytes.length, sha: createHash('sha256').update(bytes).digest('hex').slice(0, 12) }); }
    if (total > LIMITS.maxTotalBytes) return send(413, { ok: false, error: 'too_large' });
    const key = String(form.get('idempotencyKey') || '');
    if (f.email === 'ratelimit@example.invalid' && rateHits++ === 0) return send(429, { ok: false, error: 'rate_limited', message: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut oder rufen Sie uns an: 0511 – 543 00 976.' });
    if (key && keys.has(key)) return send(200, { ok: true, reference: keys.get(key), duplicate: true });
    const reference = `ING-TEST-${String(++counter).padStart(4, '0')}`; if (key) keys.set(key, reference);
    received.push({ idempotencyKey: key, reference, fields: { ...f, name: '***', telefon: '***', email: '***' }, files, fieldNames: [...new Set([...form.keys()])] });
    send(200, { ok: true, reference });
  });
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r(srv)));
}
