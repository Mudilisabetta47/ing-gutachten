import { NextResponse } from 'next/server';
import { authorize } from '@/server/auth/guards';
import { AuthRequiredError, ForbiddenError } from '@/server/auth/errors';
import { DomainError } from '@/server/errors';
import { readMedia } from '@/server/pipeline/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const base = { 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };

/**
 * Dateien gibt es NIE als öffentliche URL. Jeder Abruf braucht eine Sitzung, und der Server prüft die Rechte am
 * zugehörigen Fall/Kunden. S3: kurzlebige signierte URL (Weiterleitung); lokal: der Server liefert die Bytes selbst.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorize();
    const { id } = await ctx.params;
    const variant = new URL(req.url).searchParams.get('v') === 'thumb' ? 'thumb' : 'full';
    const m = await readMedia(user, id, variant);
    if (m.signedUrl) return NextResponse.redirect(m.signedUrl, { status: 302, headers: { ...base, 'Cache-Control': 'no-store' } });
    const body = new Blob([m.bytes as BlobPart], { type: m.mimeType });
    return new NextResponse(body, {
      headers: {
        ...base,
        'Content-Type': m.mimeType,
        'Content-Length': String(m.bytes!.byteLength),
        'Content-Disposition': `inline; filename="${m.fileName}"`,
        // PDFs/Bilder dürfen nichts nachladen oder ausführen
        'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
        'Cache-Control': variant === 'thumb' ? 'private, max-age=300' : 'private, no-store',
      },
    });
  } catch (err) {
    if (err instanceof AuthRequiredError) return NextResponse.json({ error: 'auth' }, { status: 401, headers: { ...base, 'Cache-Control': 'no-store' } });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: { ...base, 'Cache-Control': 'no-store' } });
    if (err instanceof DomainError) return NextResponse.json({ error: err.code === 'not_found' ? 'not_found' : 'invalid' }, { status: err.code === 'not_found' ? 404 : 400, headers: { ...base, 'Cache-Control': 'no-store' } });
    console.error('[media] Fehler beim Abruf:', err instanceof Error ? err.name : 'unbekannt');
    return NextResponse.json({ error: 'server' }, { status: 500, headers: { ...base, 'Cache-Control': 'no-store' } });
  }
}
