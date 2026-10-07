import type { Role } from '@prisma/client';
import type { Permission } from './permissions';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isExpert: boolean;
  mustChangePassword: boolean;
  permissions: ReadonlySet<Permission>;
  sessionId: string;
};
