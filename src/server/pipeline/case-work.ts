import 'server-only';
import { db } from '@/server/db';
import type { AuthUser } from '@/server/auth/session-types';
import { canSeeCaseInternals } from './access';
import { canOnCase, loadCaseFor } from './case-access';
import { getStorage } from '@/server/storage';

/** Zähler und Rechte für die Reiter der Falldetailseite – nur, was die Rolle sehen darf. */
export async function caseWorkSummary(user: AuthUser, caseId: string) {
  const c = await loadCaseFor(user, caseId, 'read', { archived: true });
  const mayPhotos = canOnCase(user, 'photos', 'read', c);
  const mayDocs = canOnCase(user, 'documents', 'read', c);
  const mayAppts = canOnCase(user, 'appointments', 'read', c);
  const [photos, documents, appointments, damages, next] = await Promise.all([
    mayPhotos ? db.casePhoto.count({ where: { caseId, deletedAt: null, media: { deletedAt: null } } }) : 0,
    mayDocs ? db.document.count({ where: { caseId, deletedAt: null, media: { deletedAt: null } } }) : 0,
    mayAppts ? db.appointment.count({ where: { caseId } }) : 0,
    canSeeCaseInternals(user) ? db.damage.count({ where: { caseId, deletedAt: null } }) : 0,
    mayAppts
      ? db.appointment.findFirst({ where: { caseId, status: { in: ['PLANNED', 'CONFIRMED'] }, endsAt: { gt: new Date() } }, orderBy: { startsAt: 'asc' }, select: { id: true, startsAt: true, endsAt: true, kind: true, location: true } })
      : null,
  ]);
  return {
    counts: { photos, documents, appointments, damages },
    next,
    can: {
      photosRead: mayPhotos,
      photosWrite: canOnCase(user, 'photos', 'write', c),
      docsRead: mayDocs,
      docsWrite: canOnCase(user, 'documents', 'write', c),
      apptsRead: mayAppts,
      apptsWrite: canOnCase(user, 'appointments', 'write', c),
    },
    storage: getStorage() !== null,
  };
}
