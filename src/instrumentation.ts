import type { Instrumentation } from 'next';

/**
 * Next.js-Einstiegspunkt für Fehlerüberwachung (nur Node-Laufzeit).
 * Die Node-Teile stehen in `instrumentation-node.ts` und werden nur hinter der positiven Laufzeitprüfung importiert –
 * nur so entfernt der Build sie aus dem Edge-Bündel (dort gibt es kein `node:crypto`).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerNode } = await import('./instrumentation-node');
    registerNode();
  }
}

/** Jeder unbehandelte Fehler in Seiten, Server-Actions und Schnittstellen läuft hier durch (ohne Anfrage-Inhalt, ohne Query, ohne Cookies). */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { reportRequestError } = await import('./instrumentation-node');
    await reportRequestError(err, request, context);
  }
};
