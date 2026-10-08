'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { useToast } from '@/components/admin/Toast';
import { createReportAction } from '../../report-actions';

export function CreateReportButton({ caseId, caseNumber, label = 'Gutachten anlegen' }: { caseId: string; caseNumber: string; label?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="adm-btn" disabled={pending} onClick={() => start(async () => { const r = await createReportAction({ caseId, caseNumber }); toast(r.ok ? r.message ?? 'Angelegt.' : r.error ?? 'Das hat nicht geklappt.', r.ok ? 'ok' : 'error'); if (r.ok) router.refresh(); })}><AdminIcon name="plus" />{label}</button>
  );
}
