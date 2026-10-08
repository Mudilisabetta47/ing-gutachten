import { NextResponse } from 'next/server';
import { authorize } from '@/server/auth/guards';
import { AuthRequiredError, ForbiddenError } from '@/server/auth/errors';
import { DomainError } from '@/server/errors';
import { writeAudit } from '@/server/audit';
import { invoicePdf } from '@/server/pipeline/invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** rechnung-pdf: erzeugt on demand; nur mit Sitzung und Berechtigung. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorize('invoices.read');
    const { id } = await params;
    const { bytes, fileName } = await invoicePdf(user, id);
    await writeAudit({ actorId: user.id, action: 'invoice.pdf_view', entityType: 'Invoice', entityId: id, summary: `PDF ${fileName} abgerufen` });
    return new NextResponse(Buffer.from(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${fileName}"`, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  } catch (e) {
    if (e instanceof AuthRequiredError) return NextResponse.json({ error: 'auth' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    if (e instanceof ForbiddenError) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    if (e instanceof DomainError && e.code === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    console.error('[rechnung-pdf] Fehler:', e instanceof Error ? e.message : 'unbekannt');
    return NextResponse.json({ error: 'server' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
