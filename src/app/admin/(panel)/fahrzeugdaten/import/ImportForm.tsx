'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { Field } from '@/components/admin/ui';
import { FormError } from '@/components/admin/forms';
import { createImportAction } from '../actions';
import type { FormState } from '@/server/admin/form';

type Mode = { key: string; label: string; source: 'provider' | 'file'; available: boolean; why?: string };
type Prov = { key: string; name: string; licenseStatus: string; enabled: boolean };

export function ImportForm({ modes, providers }: { modes: Mode[]; providers: Prov[] }) {
  const [state, run, pending] = useActionState<FormState, FormData>(createImportAction, {});
  const router = useRouter();
  useEffect(() => { if (state.redirectTo) router.push(state.redirectTo); }, [state, router]);
  const [mode, setMode] = useState('CSV');
  const cur = modes.find((m) => m.key === mode)!;
  const f = state.fields ?? {};
  return (
    <form action={run} className="adm-panel" style={{ display: 'grid', gap: 16 }} noValidate encType="multipart/form-data">
      <input type="hidden" name="mode" value={mode} />
      <div className="vi-modes" role="group" aria-label="Importart">
        {modes.map((m) => <button key={m.key} type="button" aria-pressed={mode === m.key} onClick={() => setMode(m.key)} style={m.available ? undefined : { opacity: .55 }}>{m.label}</button>)}
      </div>
      {!cur.available && <div className="adm-alert adm-alert-warn" role="status">{cur.why}</div>}
      {cur.available && cur.source === 'provider' && (
        <Field label="Quelle">
          <select name="providerKey" className="adm-input" defaultValue="HSN_TSN">
            {providers.map((p) => <option key={p.key} value={p.key}>{p.name}{p.enabled ? '' : ' (deaktiviert)'}</option>)}
          </select>
        </Field>
      )}
      {cur.available && cur.key === 'SINGLE' && (
        <div className="adm-form-grid" style={{ maxWidth: 420 }}>
          <Field label="HSN"><input name="hsn" className="adm-input mono" maxLength={4} placeholder="0603" autoComplete="off" /></Field>
          <Field label="TSN"><input name="tsn" className="adm-input mono" maxLength={4} placeholder="ADT" autoComplete="off" /></Field>
        </div>
      )}
      {cur.available && cur.key === 'URL' && (
        <Field label="Seiten-URL(s), eine pro Zeile (max. 50)" hint="Nur Adressen des freigegebenen Anbieter-Hosts. Der Abruf läuft gedrosselt und pausiert bei Limit oder HTTP 429."><textarea name="urls" rows={4} className="adm-input mono" placeholder="https://…" spellCheck={false} /></Field>
      )}
      {cur.available && cur.source === 'file' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label={`${cur.key}-Datei (max. 2 MB)`} hint={cur.key === 'CSV' ? 'Kopfzeile mit hsn, tsn und optional hersteller, fahrzeug, leistung (z. B. „170 PS (125 kW)“) oder kw/ps, hubraum, kraftstoff. Trennzeichen ; , oder Tab.' : 'Liste von Objekten (oder { "records": [...] }) mit denselben Feldnamen.'}>
            <input type="file" name="file" accept={cur.key === 'CSV' ? '.csv,text/csv,text/plain' : '.json,application/json'} className="adm-input" />
          </Field>
          <Field label="… oder Inhalt einfügen"><textarea name="text" rows={5} className="adm-input mono" spellCheck={false} placeholder={cur.key === 'CSV' ? 'hsn;tsn;hersteller;fahrzeug;leistung;hubraum;kraftstoff\n0603;ADT;VW;VW Golf V GT 2.0 TDI;170 PS (125 kW);1968 ccm;Diesel' : '[{"hsn":"0603","tsn":"ADT","fahrzeug":"VW Golf V GT"}]'} /></Field>
          <Field label="Bezeichnung des Imports (optional)"><input name="label" className="adm-input" maxLength={120} placeholder="z. B. Lieferung 10/2026" /></Field>
        </div>
      )}
      <FormError state={state} />
      {f._ && <div className="adm-alert adm-alert-danger">{f._}</div>}
      <div className="adm-actions"><button type="submit" className="adm-btn" disabled={pending || !cur.available} aria-busy={pending}>{pending || state.redirectTo ? 'Erstellt Vorschau …' : 'IMPORT STARTEN (VORSCHAU)'}</button><span className="t-3" style={{ fontSize: 12.5 }}>Vor dem Speichern wird immer eine Vorschau angezeigt – es wird nichts überschrieben.</span></div>
    </form>
  );
}
