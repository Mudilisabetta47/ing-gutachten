import { feedForToken } from '@/server/calendar/feed';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const H = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };
const notFound = () => new Response('Nicht gefunden', { status: 404, headers: { ...H, 'Content-Type': 'text/plain; charset=utf-8' } });

/**
 * Öffentlicher Kalender-Abo-Link (ICS): `/api/kalender/<Schlüssel>.ics`. Der 256-Bit-Schlüssel ersetzt die Anmeldung;
 * er wird nur als Hash gespeichert und lässt sich im Profil jederzeit widerrufen. Unbekannte Schlüssel → 404 (nicht unterscheidbar).
 * Der Inhalt folgt den Rechten des Benutzers (eigene bzw. alle Termine) und enthält standardmäßig keine Kundennamen/Orte.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unbekannt';
  if (!rateLimit(`cal:${ip}`, 120, 10 * 60_000).ok) return new Response('Zu viele Anfragen', { status: 429, headers: { ...H, 'Retry-After': '600' } });
  const { token } = await ctx.params;
  const ics = await feedForToken(token.replace(/\.ics$/i, '')).catch(() => null);
  if (!ics) return notFound();
  return new Response(ics, { status: 200, headers: { ...H, 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="ing-termine.ics"' } });
}
