import type { AuthUser } from '@/server/auth/session-types';
import { caseCommunication, mentionable } from '@/server/pipeline/communication';
import { EmptyState, Section } from '@/components/admin/ui';
import { CommunicationPanel } from '@/components/admin/CommunicationPanel';

/** Reiter „Kommunikation“: interne/externe Notizen, Anrufprotokoll, Erwähnungen. Es wird nichts versendet. */
export async function CommunicationTab({ user, caseId, caseNumber, assignedExpertId, phone }: { user: AuthUser; caseId: string; caseNumber: string; assignedExpertId: string | null; phone: string | null }) {
  const canRead = user.permissions.has('communication.read.all') || (user.permissions.has('communication.read.own') && assignedExpertId === user.id);
  if (!canRead) return <EmptyState icon="lock" title="Kein Zugriff">Für die Kommunikation dieses Falls fehlt die Berechtigung.</EmptyState>;
  const canWrite = user.permissions.has('communication.write.all') || (user.permissions.has('communication.write.own') && assignedExpertId === user.id);
  const [notes, people] = await Promise.all([caseCommunication(user, caseId), canWrite ? mentionable(user, caseId) : Promise.resolve([])]);
  return (
    <Section title="Kommunikation">
      <CommunicationPanel caseId={caseId} caseNumber={caseNumber} people={people} canWrite={canWrite} defaultPhone={phone}
        notes={notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))} />
    </Section>
  );
}
