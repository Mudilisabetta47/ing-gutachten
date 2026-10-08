import { NextResponse } from 'next/server';
import { authorize } from '@/server/auth/guards';
import { AuthRequiredError, ForbiddenError } from '@/server/auth/errors';
import { EXPORT_KINDS, exportCsv, type ExportKind } from '@/server/pipeline/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** CSV-Datenexport (Fälle, Kunden). Nur mit Export-Recht; jeder Abruf wird protokolliert. */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const user = await authorize('data.export');
    const { kind } = await params;
    if (!(kind in EXPORT_KINDS)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const csv = await exportCsv(user, kind as ExportKind);
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${kind}.csv"`, 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof AuthRequiredError) return NextResponse.json({ error: 'auth' }, { status: 401 });
    if (e instanceof ForbiddenError) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    console.error('[export] Fehler:', e instanceof Error ? e.message : 'unbekannt');
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}
