'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { FormError, useFormFeedback } from '@/components/admin/forms';
import { resolveConflictAction } from '../actions';
import { FUEL_LABELS } from '@/lib/vehicle-data';
import type { FormState } from '@/server/admin/form';

type Own = { manufacturer: string | null; model: string | null; variant: string | null; powerKw: number | null; powerHp: number | null; displacementCc: number | null; fuelType: string | null };

export function ConflictActions({ id, own }: { id: string; own: Own }) {
  const [state, run, pending] = useActionState<FormState, FormData>(resolveConflictAction, {});
  useFormFeedback(state);
  const router = useRouter();
  useEffect(() => { if (state.ok) router.refresh(); }, [state, router]);
  const [manual, setManual] = useState(false);
  const f = state.fields ?? {};
  const btn = (action: string, label: string, primary = false) => (
    <form action={run}><input type="hidden" name="id" value={id} /><input type="hidden" name="action" value={action} /><button className={primary ? 'adm-btn' : 'adm-btn adm-btn-secondary'} disabled={pending}>{label}</button></form>
  );
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="adm-actions">
        {btn('MERGE', 'ZUSAMMENFÜHREN', true)}{btn('KEEP_OWN', 'EIGENE DATEN BEHALTEN')}{btn('TAKE_EXTERNAL', 'EXTERNE DATEN ÜBERNEHMEN')}
        <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setManual((m) => !m)} aria-expanded={manual}>MANUELL BEARBEITEN</button>
      </div>
      <p className="vi-hint">Zusammenführen: eigene Werte bleiben, nur Lücken werden aus der anderen Quelle gefüllt.</p>
      {manual && (
        <form action={run} className="vi-form" style={{ padding: 0 }}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="action" value="MANUAL" />
          {([['manufacturer', 'Hersteller', own.manufacturer], ['model', 'Modell', own.model], ['variant', 'Variante', own.variant], ['powerKw', 'kW', own.powerKw], ['powerHp', 'PS', own.powerHp], ['displacementCc', 'Hubraum cm³', own.displacementCc]] as const).map(([k, l, v]) => (
            <label key={k} className="adm-field"><span className="adm-label">{l}</span><input name={k} defaultValue={v ?? ''} className="adm-input" aria-invalid={Boolean(f[k])} /></label>
          ))}
          <label className="adm-field"><span className="adm-label">Kraftstoff</span><select name="fuelType" defaultValue={own.fuelType ?? ''} className="adm-input"><option value="">Nicht verfügbar</option>{Object.entries(FUEL_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <div style={{ alignSelf: 'end' }}><button className="adm-btn" disabled={pending}>Speichern</button></div>
        </form>
      )}
      <FormError state={state} />
    </div>
  );
}
