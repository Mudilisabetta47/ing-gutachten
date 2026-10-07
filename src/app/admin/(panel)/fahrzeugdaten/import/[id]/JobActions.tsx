'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { FormError, useFormFeedback } from '@/components/admin/forms';
import { jobStateAction, runImportAction } from '../../actions';
import type { FormState } from '@/server/admin/form';

export function JobActions({ id, status, phase, conflicts, canImport }: { id: string; status: string; phase: string; conflicts: number; canImport: boolean }) {
  const [rs, run, runPending] = useActionState<FormState, FormData>(runImportAction, {});
  const [ss, st, stPending] = useActionState<FormState, FormData>(jobStateAction, {});
  useFormFeedback(rs); useFormFeedback(ss);
  // Nach jeder erfolgreichen Aktion den Stand sicher neu laden (Status, Zähler, Zeilen)
  const router = useRouter();
  useEffect(() => { if (rs.ok || ss.ok) router.refresh(); }, [rs, ss, router]);
  const open = !['COMPLETED', 'CANCELLED', 'FAILED'].includes(status);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="adm-actions">
        {open && phase === 'ready' && canImport && (
          <form action={run}><input type="hidden" name="id" value={id} /><button className="adm-btn" disabled={runPending || stPending} aria-busy={runPending}>{runPending ? 'Importiert …' : status === 'RUNNING' ? 'FORTSETZEN' : 'IMPORTIEREN'}</button></form>
        )}
        {open && phase === 'fetch' && (
          <form action={st}><input type="hidden" name="id" value={id} /><input type="hidden" name="action" value="resume" /><input type="hidden" name="fetch" value="1" /><button className="adm-btn" disabled={stPending}>ABRUF FORTSETZEN</button></form>
        )}
        {conflicts > 0 && <Link href="?ergebnis=CONFLICT" className="adm-btn adm-btn-secondary" scroll={false}>KONFLIKTE ANZEIGEN ({conflicts})</Link>}
        {open && (
          <form action={st}><input type="hidden" name="id" value={id} /><input type="hidden" name="action" value="cancel" /><button className="adm-btn adm-btn-ghost" disabled={stPending}>ABBRECHEN</button></form>
        )}
        {status === 'RUNNING' && <form action={st}><input type="hidden" name="id" value={id} /><input type="hidden" name="action" value="pause" /><button className="adm-btn adm-btn-ghost" disabled={stPending}>PAUSIEREN</button></form>}
      </div>
      <FormError state={rs.error ? rs : ss} />
    </div>
  );
}
