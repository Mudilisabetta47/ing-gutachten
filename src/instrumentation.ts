import type { Instrumentation } from 'next';

/** Next.js-Einstiegspunkt für Fehlerüberwachung (nur Node-Laufzeit). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { reportError } = await import('@/lib/error-report');
  process.on('unhandledRejection', (reason) => { void reportError(reason, { kind: 'unhandledRejection' }); });
  process.on('uncaughtException', (err) => { void reportError(err, { kind: 'uncaughtException' }); });
}

/** Jeder unbehandelte Fehler in Seiten, Server-Actions und Schnittstellen läuft hier durch (ohne Anfrage-Inhalt, ohne Query, ohne Cookies). */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { reportError } = await import('@/lib/error-report');
  const e = err as Error & { digest?: string };
  await reportError(e, { route: request.path, method: request.method, kind: context.routeType, digest: e.digest });
};
