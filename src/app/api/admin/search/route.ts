import { NextResponse } from 'next/server';
import { authorize } from '@/server/auth/guards';
import { AuthRequiredError, ForbiddenError } from '@/server/auth/errors';
import { globalSearch } from '@/server/pipeline/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

/** ⌘K-Suche: nur mit Sitzung und Recht `search.global`; Treffer sind bereits nach Rolle gefiltert. */
export async function GET(req: Request) {
  try {
    const user = await authorize('search.global');
    const q = new URL(req.url).searchParams.get('q') ?? '';
    return NextResponse.json(await globalSearch(user, q), { headers });
  } catch (err) {
    if (err instanceof AuthRequiredError) return NextResponse.json({ error: 'auth' }, { status: 401, headers });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers });
    console.error('[search] Fehler:', err instanceof Error ? err.name : 'unbekannt');
    return NextResponse.json({ error: 'server' }, { status: 500, headers });
  }
}
