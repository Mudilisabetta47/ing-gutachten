import { NextResponse } from 'next/server';
import { authorize } from '@/server/auth/guards';
import { AuthRequiredError, ForbiddenError } from '@/server/auth/errors';
import { DomainError } from '@/server/errors';
import { assertSameOrigin } from '@/server/http';
import { addCasePhoto, addDocument } from '@/server/pipeline/media';
import { ZodError } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vercel Functions nehmen höchstens 4,5 MB Body an – der Browser verkleinert Fotos vorher (siehe MediaUploader).
const MAX_BODY = 4_400_000;
const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const fail = (status: number, error: string, message?: string) => NextResponse.json({ ok: false, error, message }, { status, headers });

const str = (fd: FormData, k: string) => (typeof fd.get(k) === 'string' ? (fd.get(k) as string) : '');
const bytesOf = async (v: FormDataEntryValue | null) => (v && typeof v !== 'string' && v.size > 0 ? new Uint8Array(await v.arrayBuffer()) : null);

/** Upload eines Fotos oder Dokuments zu einem Fall (oder Dokument zu einem Kunden). Rechte und Dateiprüfung im Service. */
export async function POST(req: Request) {
  if (!assertSameOrigin(req)) return fail(403, 'forbidden');
  if (Number(req.headers.get('content-length') ?? '0') > MAX_BODY) return fail(413, 'too_large', 'Die Datei ist zu groß. Fotos werden automatisch verkleinert – bei Dokumenten bitte höchstens 4 MB.');
  try {
    const user = await authorize();
    const fd = await req.formData();
    const file = await bytesOf(fd.get('file'));
    if (!file) return fail(400, 'no_file', 'Es wurde keine Datei gesendet.');
    const thumb = await bytesOf(fd.get('thumb'));
    const target = str(fd, 'target');
    if (target === 'photo') {
      const p = await addCasePhoto(user, str(fd, 'caseId'), { bytes: file, thumb }, { category: str(fd, 'category') || undefined, title: str(fd, 'title'), description: str(fd, 'description'), damageId: str(fd, 'damageId') });
      return NextResponse.json({ ok: true, id: p.id }, { headers });
    }
    if (target === 'document') {
      const caseId = str(fd, 'caseId');
      const d = await addDocument(user, caseId ? { caseId } : { customerId: str(fd, 'customerId') }, { bytes: file }, { category: str(fd, 'category') || undefined, title: str(fd, 'title') });
      return NextResponse.json({ ok: true, id: d.id }, { headers });
    }
    return fail(400, 'invalid', 'Unbekanntes Ziel.');
  } catch (err) {
    if (err instanceof AuthRequiredError) return fail(401, 'auth');
    if (err instanceof ForbiddenError) return fail(403, 'forbidden', 'Dafür fehlt die Berechtigung.');
    if (err instanceof DomainError) return fail(err.code === 'not_found' ? 404 : 400, err.code, err.message);
    if (err instanceof ZodError) return fail(400, 'validation', err.issues[0]?.message ?? 'Ungültige Angaben.');
    console.error('[media] Upload fehlgeschlagen:', err instanceof Error ? err.name : 'unbekannt');
    return fail(500, 'server', 'Der Upload hat nicht geklappt. Bitte erneut versuchen.');
  }
}
