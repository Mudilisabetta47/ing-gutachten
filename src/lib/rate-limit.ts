/**
 * Einfaches Fenster-Rate-Limit pro Schlüssel (IP).
 *
 * Grenze, ehrlich benannt: Der Speicher gilt nur für die laufende
 * Function-Instanz. Gegen verteilte Angriffe hilft das nicht, gegen einen
 * hängenden Client oder simplen Bot schon. Für mehr: Upstash Redis / Vercel KV
 * hinter dieselbe Funktion hängen.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max = 5, windowMs = 10 * 60 * 1000): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  // Speicher begrenzen
  if (hits.size > 2000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return { ok: true, retryAfter: 0 };
}
