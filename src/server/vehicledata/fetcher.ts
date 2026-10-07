import 'server-only';
import { lookup } from 'node:dns/promises';
import net from 'node:net';

/**
 * Sicherer serverseitiger Abruf öffentlicher Seiten.
 * Schutz: nur https auf Port 443, nur Hosts aus der Freigabeliste (keine Benutzer-URLs ins Blaue),
 * keine privaten/lokalen Zieladressen (SSRF), Redirect-Limit mit erneuter Prüfung jedes Ziels,
 * Zeitlimit, maximale Antwortgröße, Content-Type-Prüfung. Zertifikatsfehler werden NICHT umgangen.
 */

export type FetchErrorCategory =
  | 'BLOCKED_URL' | 'DNS_ERROR' | 'TLS_ERROR' | 'TIMEOUT' | 'NETWORK' | 'RATE_LIMITED' | 'HTTP_4XX' | 'HTTP_5XX' | 'TOO_LARGE' | 'BAD_CONTENT_TYPE' | 'TOO_MANY_REDIRECTS';

export class FetchError extends Error {
  constructor(public category: FetchErrorCategory, message: string, public httpStatus?: number, public retryAfterSec?: number) {
    super(message);
  }
}

export type SafeFetchOptions = {
  allowedHosts: string[];
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  accept?: string[];
};

const PRIVATE_V4 = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^192\.0\.0\./, /^198\.1[89]\./, /^2(2[4-9]|[3-5]\d)\./];
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return PRIVATE_V4.some((r) => r.test(ip));
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::' || v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  return true;
}

/** Prüft eine URL gegen die Regeln (ohne Netzzugriff). Wirft FetchError('BLOCKED_URL'). */
export function assertAllowedUrl(raw: string, allowedHosts: string[]): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new FetchError('BLOCKED_URL', 'Ungültige URL.'); }
  if (u.protocol !== 'https:') throw new FetchError('BLOCKED_URL', 'Nur https-Adressen sind erlaubt.');
  if (u.username || u.password) throw new FetchError('BLOCKED_URL', 'Zugangsdaten in der URL sind nicht erlaubt.');
  if (u.port && u.port !== '443') throw new FetchError('BLOCKED_URL', 'Nur Port 443 ist erlaubt.');
  const host = u.hostname.toLowerCase();
  if (net.isIP(host)) throw new FetchError('BLOCKED_URL', 'IP-Adressen sind nicht erlaubt.');
  if (!allowedHosts.map((h) => h.toLowerCase()).includes(host)) throw new FetchError('BLOCKED_URL', `Host „${host}“ ist nicht für diesen Anbieter freigegeben.`);
  return u;
}

async function assertPublicHost(host: string): Promise<void> {
  let addrs: { address: string }[];
  try { addrs = await lookup(host, { all: true }); } catch { throw new FetchError('DNS_ERROR', 'Der Host konnte nicht aufgelöst werden.'); }
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new FetchError('BLOCKED_URL', 'Die Zieladresse ist nicht öffentlich erreichbar.');
}

function classify(e: unknown): FetchError {
  if (e instanceof FetchError) return e;
  const err = e as { name?: string; code?: string; cause?: { code?: string } };
  const code = err.cause?.code ?? err.code ?? '';
  if (err.name === 'TimeoutError' || err.name === 'AbortError' || code === 'UND_ERR_CONNECT_TIMEOUT') return new FetchError('TIMEOUT', 'Zeitüberschreitung beim Abruf.');
  if (/CERT|TLS|SSL|ALTNAME|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(code)) return new FetchError('TLS_ERROR', 'Das Zertifikat des Anbieters ist ungültig oder passt nicht zum Host. Der Abruf wurde aus Sicherheitsgründen abgebrochen.');
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return new FetchError('DNS_ERROR', 'Der Host konnte nicht aufgelöst werden.');
  return new FetchError('NETWORK', 'Der Anbieter ist nicht erreichbar.');
}

export type SafeFetchResult = { status: number; body: string; contentType: string; finalUrl: string; durationMs: number; bytes: number };

export async function safeFetch(rawUrl: string, opts: SafeFetchOptions): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;
  const maxRedirects = opts.maxRedirects ?? 3;
  const accept = opts.accept ?? ['text/html', 'application/xhtml+xml'];
  const started = Date.now();
  let url = assertAllowedUrl(rawUrl, opts.allowedHosts);
  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      await assertPublicHost(url.hostname);
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: accept.join(','), 'user-agent': 'ING-Gutachten-Fahrzeugdaten/1.0 (+serverseitiger Abruf; kontakt über Betreiber)', 'accept-language': 'de-DE,de;q=0.9' },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        await res.body?.cancel();
        if (hop === maxRedirects) throw new FetchError('TOO_MANY_REDIRECTS', 'Zu viele Weiterleitungen.');
        url = assertAllowedUrl(new URL(res.headers.get('location')!, url).toString(), opts.allowedHosts);
        continue;
      }
      if (res.status === 429) {
        await res.body?.cancel();
        const ra = Number(res.headers.get('retry-after'));
        throw new FetchError('RATE_LIMITED', 'Der Anbieter hat die Anfragen begrenzt (HTTP 429).', 429, Number.isFinite(ra) && ra > 0 ? Math.min(ra, 86_400) : undefined);
      }
      if (res.status >= 500) { await res.body?.cancel(); throw new FetchError('HTTP_5XX', `Der Anbieter meldet einen Fehler (HTTP ${res.status}).`, res.status); }
      if (res.status >= 400) { await res.body?.cancel(); throw new FetchError('HTTP_4XX', `Seite nicht verfügbar (HTTP ${res.status}).`, res.status); }
      const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
      if (!accept.some((a) => contentType.startsWith(a))) { await res.body?.cancel(); throw new FetchError('BAD_CONTENT_TYPE', 'Unerwarteter Inhaltstyp.', res.status); }
      const declared = Number(res.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > maxBytes) { await res.body?.cancel(); throw new FetchError('TOO_LARGE', 'Die Antwort ist zu groß.', res.status); }
      // Begrenzt lesen – nicht auf den Content-Length-Header verlassen
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > maxBytes) { await reader.cancel(); throw new FetchError('TOO_LARGE', 'Die Antwort ist zu groß.', res.status); }
          chunks.push(value);
        }
      }
      const body = Buffer.concat(chunks).toString('utf8');
      return { status: res.status, body, contentType, finalUrl: url.toString(), durationMs: Date.now() - started, bytes };
    }
    throw new FetchError('TOO_MANY_REDIRECTS', 'Zu viele Weiterleitungen.');
  } catch (e) {
    throw classify(e);
  }
}
