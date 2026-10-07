import 'server-only';
import { headers } from 'next/headers';

/** IP und User-Agent des aktuellen Requests (hinter Vercel: x-forwarded-for). */
export async function requestMeta(): Promise<{ ip: string; userAgent: string | null }> {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
  return { ip, userAgent: h.get('user-agent')?.slice(0, 500) ?? null };
}

/** Zusätzlicher Origin-Check für Route Handler (Server Actions prüfen Next selbst). */
export function assertSameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
