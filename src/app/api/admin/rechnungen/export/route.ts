import { NextResponse } from 'next/server';
import { authorize } from '@/server/auth/guards';
import { AuthRequiredError, ForbiddenError } from '@/server/auth/errors';
import { invoicesCsv } from '@/server/pipeline/invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** CSV-Export der Rechnungen (Filter wie in der Liste). Nur mit Export-Recht. */
export async function GET(req: Request) {
  try {
    const user = await authorize('invoices.export');
    const u = new URL(req.url).searchParams;
    const csv = await invoicesCsv(user, { status: u.get('status') || undefined, q: u.get('q') || undefined, from: u.get('von') || undefined, to: u.get('bis') || undefined });
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="rechnungen.csv"', 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof AuthRequiredError) return NextResponse.json({ error: 'auth' }, { status: 401 });
    if (e instanceof ForbiddenError) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    console.error('[rechnungen-export] Fehler:', e instanceof Error ? e.message : 'unbekannt');
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}
