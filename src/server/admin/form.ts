import { ZodError } from 'zod';
import { AuthRequiredError, ForbiddenError } from '@/server/auth/errors';
import { DomainError } from '@/server/errors';

export type FormState = { ok?: boolean; error?: string; fields?: Record<string, string>; message?: string; values?: Record<string, string>; /** Client navigiert nach Erfolg dorthin (statt `redirect()` in der Action) */ redirectTo?: string };

/** Eingaben für die erneute Anzeige nach einem Fehler (React 19 setzt Formulare zurück). Passwörter nie. */
export function echo(fd: FormData, ...exclude: string[]): Record<string, string> {
  const skip = new Set(['password', 'current', 'next', 'confirm', ...exclude]);
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === 'string' && !skip.has(k) && !k.startsWith('$')) out[k] = v;
  return out;
}

/** Übersetzt Fehler in einen Formularzustand; unbekannte Fehler werden NICHT an den Browser durchgereicht. */
export function toFormState(err: unknown, values?: Record<string, string>): FormState {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = String(issue.path[0] ?? '_');
      fields[key] ??= issue.message;
    }
    return { error: 'Bitte die markierten Angaben prüfen.', fields, values };
  }
  if (err instanceof ForbiddenError || err instanceof AuthRequiredError || err instanceof DomainError) return { error: err.message, values };
  console.error('[admin] unerwarteter Fehler:', err instanceof Error ? err.message : 'unbekannt');
  return { error: 'Das hat nicht geklappt. Bitte erneut versuchen.', values };
}

export const bool = (v: FormDataEntryValue | null) => v === 'on' || v === 'true';
