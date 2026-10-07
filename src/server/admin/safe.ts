import { notFound } from 'next/navigation';
import { DomainError } from '@/server/errors';
import { ForbiddenError } from '@/server/auth/errors';

/**
 * Seiten: „nicht gefunden“ und „nicht erlaubt“ sehen für den Besucher gleich aus (404) –
 * so verrät die Seite nicht, dass es einen fremden Datensatz überhaupt gibt.
 */
export async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if ((e instanceof DomainError && e.code === 'not_found') || e instanceof ForbiddenError) notFound();
    throw e;
  }
}
