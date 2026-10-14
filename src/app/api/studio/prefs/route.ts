import { NextResponse } from 'next/server';
import { authorize } from '@/server/auth/guards';
import { AuthRequiredError, ForbiddenError } from '@/server/auth/errors';
import { DomainError } from '@/server/errors';
import { appsFor } from '@/lib/studio-apps';
import { getStudioPrefs, resetStudioPrefs, saveStudioPrefs } from '@/server/studio/prefs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const H = { 'Cache-Control': 'no-store' };

const allowed = (user: Awaited<ReturnType<typeof authorize>>) => new Set(appsFor((p) => user.permissions.has(p)).map((a) => a.id));
const sameOrigin = (req: Request) => {
  const o = req.headers.get('origin'), h = req.headers.get('host');
  if (!o) return true;
  try { return new URL(o).host === h; } catch { return false; }
};
function errorResponse(e: unknown) {
  if (e instanceof AuthRequiredError) return NextResponse.json({ error: 'auth' }, { status: 401, headers: H });
  if (e instanceof ForbiddenError) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: H });
  if (e instanceof DomainError) return NextResponse.json({ error: 'invalid', message: e.message }, { status: 400, headers: H });
  console.error('[studio-prefs] Fehler:', e instanceof Error ? e.message : 'unbekannt');
  return NextResponse.json({ error: 'server' }, { status: 500, headers: H });
}

/** Eigene Studio-Einstellungen lesen/speichern/zurücksetzen. Nur für die angemeldete Person selbst. */
export async function GET() {
  try {
    const user = await authorize();
    return NextResponse.json({ ok: true, prefs: await getStudioPrefs(user, allowed(user)) }, { headers: H });
  } catch (e) { return errorResponse(e); }
}
export async function PUT(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: H });
    const user = await authorize();
    const body = await req.json().catch(() => null);
    return NextResponse.json({ ok: true, prefs: await saveStudioPrefs(user, body, allowed(user)) }, { headers: H });
  } catch (e) { return errorResponse(e); }
}
export async function DELETE(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: H });
    const user = await authorize();
    await resetStudioPrefs(user);
    return NextResponse.json({ ok: true }, { headers: H });
  } catch (e) { return errorResponse(e); }
}
