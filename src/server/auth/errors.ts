import type { AuthUser } from './session-types';
import type { Permission } from './permissions';

/** Fehlertypen und reine Rechte-Helfer – bewusst ohne Next-Abhängigkeit (direkt testbar). */
export class ForbiddenError extends Error {
  constructor(message = 'Dafür fehlt die Berechtigung.') {
    super(message);
  }
}
export class AuthRequiredError extends Error {
  constructor() {
    super('Bitte erneut anmelden.');
  }
}

export const can = (user: Pick<AuthUser, 'permissions'>, permission: Permission) => user.permissions.has(permission);
export const canAny = (user: Pick<AuthUser, 'permissions'>, ...permissions: Permission[]) => permissions.some((p) => user.permissions.has(p));
