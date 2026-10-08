import Link from 'next/link';
import type { AuthUser } from '@/server/auth/session-types';
import { caseReports, getReport, listTextBlocks } from '@/server/pipeline/reports';
import { STATUS_LABELS } from '@/lib/report';
import { EmptyState, Section } from '@/components/admin/ui';
import { ReportEditor, type RView } from '@/components/admin/ReportEditor';
import { CreateReportButton } from './CreateReportButton';

/** Reiter „Gutachten“: Anlegen, Bearbeiten, Prüfen, Freigeben, Versand erfassen. */
export async function ReportTab({ user, caseId, caseNumber, wanted, canCreate }: { user: AuthUser; caseId: string; caseNumber: string; wanted?: string; canCreate: boolean }) {
  const canRead = user.permissions.has('reports.read.all') || user.permissions.has('reports.read.own');
  if (!canRead) return <EmptyState icon="lock" title="Kein Zugriff">Für Gutachten fehlt die Berechtigung.</EmptyState>;
  const reps = await caseReports(user, caseId);
  const chosen = reps.find((r) => r.id === wanted) ?? reps.at(-1);
  if (!chosen) {
    return (
      <Section title="Gutachten">
        <EmptyState icon="doc" title="Noch kein Gutachten" action={canCreate ? <CreateReportButton caseId={caseId} caseNumber={caseNumber} /> : undefined}>
          Aus den erfassten Daten (Fahrzeug, Schäden, Kalkulation, Bewertung, Fotos) entsteht ein Entwurf mit Standardkapiteln, den Sie bearbeiten, zur Prüfung einreichen und als PDF freigeben.
        </EmptyState>
      </Section>
    );
  }
  const [v, blocks] = await Promise.all([getReport(user, chosen.id), listTextBlocks(user).catch(() => [])]);
  const iso = (d: Date | null) => d?.toISOString() ?? null;
  const view: RView = {
    id: v.report.id, number: v.report.number, status: v.report.status, revision: v.report.revision, saveCounter: v.report.saveCounter, title: v.report.title, content: v.content,
    snapshot: v.snapshot, issues: v.issues, changedSinceSnapshot: v.changedSinceSnapshot,
    comments: v.comments.map((c) => ({ id: c.id, chapterKey: c.chapterKey, body: c.body, revision: c.revision, author: c.author, resolvedAt: iso(c.resolvedAt), createdAt: c.createdAt.toISOString() })),
    versions: v.versions.map((x) => ({ id: x.id, revision: x.revision, kind: x.kind, note: x.note, createdAt: x.createdAt.toISOString(), by: x.by, documentId: x.documentId })),
    people: v.people, sent: { at: iso(v.report.sentAt), to: v.report.sentTo, channel: v.report.sentChannel, note: v.report.sentNote }, approvedAt: iso(v.report.approvedAt), submittedAt: iso(v.report.submittedAt), can: v.can,
  };
  return (
    <>
      {reps.length > 1 && (
        <nav className="adm-seg" aria-label="Gutachten des Falls">
          {reps.map((r) => <Link key={r.id} href={`/admin/faelle/${caseNumber}/?tab=gutachten&bericht=${r.id}`} aria-current={r.id === chosen.id ? 'page' : undefined}>{r.number} · {STATUS_LABELS[r.status]}</Link>)}
        </nav>
      )}
      <ReportEditor key={`${view.id}-${view.status}-${view.revision}`} view={view} caseNumber={caseNumber} blocks={blocks} />
      {canCreate && reps.every((r) => r.status === 'SENT') && <div style={{ marginTop: 12 }}><CreateReportButton caseId={caseId} caseNumber={caseNumber} label="Weiteres Gutachten (z. B. Nachtrag) anlegen" /></div>}
    </>
  );
}
