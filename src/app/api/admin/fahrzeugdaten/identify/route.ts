import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { authorize } from '@/server/auth/guards';
import { AuthRequiredError, ForbiddenError } from '@/server/auth/errors';
import { identifyByHsnTsn, identifyByVin, searchCatalog } from '@/server/vehicledata/identify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const str = (v: unknown, max = 80) => (typeof v === 'string' ? v.slice(0, max) : '');

/**
 * Interne Fahrzeug-API für die Oberfläche (HSN/TSN, FIN, Freitext). Der Browser spricht NIE mit einem externen Anbieter:
 * Die Anfrage läuft über den VehicleDataService (eigene Datenbank → bei Freigabe externer Anbieter → Zwischenspeicher).
 * Es werden keine URLs aus der Anfrage übernommen.
 */
export async function POST(req: Request) {
  try {
    const user = await authorize('vehicledata.read');
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    switch (body.mode) {
      case 'hsn': return NextResponse.json(await identifyByHsnTsn(user, str(body.hsn, 12), str(body.tsn, 12)), { headers });
      case 'vin': return NextResponse.json(await identifyByVin(user, str(body.vin, 40)), { headers });
      case 'search': {
        const page = typeof body.page === 'number' ? Math.max(1, Math.min(500, Math.floor(body.page))) : 1;
        return NextResponse.json(await searchCatalog(user, { q: str(body.q, 80), page, limit: 20 }), { headers });
      }
      default: return NextResponse.json({ error: 'mode' }, { status: 400, headers });
    }
  } catch (err) {
    if (err instanceof AuthRequiredError) return NextResponse.json({ error: 'auth' }, { status: 401, headers });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers });
    if (err instanceof ZodError) return NextResponse.json({ error: 'invalid' }, { status: 400, headers });
    console.error('[fahrzeugdaten] Fehler:', err instanceof Error ? err.name : 'unbekannt');
    return NextResponse.json({ error: 'server' }, { status: 500, headers });
  }
}
