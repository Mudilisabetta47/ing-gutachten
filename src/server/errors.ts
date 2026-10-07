/** Fachliche Fehler: Meldung ist für Mitarbeiter bestimmt und darf angezeigt werden. */
export class DomainError extends Error {
  constructor(message: string, public readonly code: 'not_found' | 'conflict' | 'invalid' | 'forbidden' = 'invalid') {
    super(message);
    this.name = 'DomainError';
  }
}
export const notFoundError = (what: string) => new DomainError(`${what} nicht gefunden.`, 'not_found');
