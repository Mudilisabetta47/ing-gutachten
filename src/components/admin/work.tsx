'use client';

import { useActionState, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AdminIcon } from './AdminIcon';
import { Field } from './ui';
import { ConfirmForm, FormError, SubmitRow, useFormFeedback, type Act } from './forms';
import { useToast } from './Toast';
import { prepareCasePhoto } from '@/lib/compress-image';
import type { FormState } from '@/server/admin/form';

/* ------------------------------------------------------------------ Upload */

type Item = { id: number; name: string; s: 'wait' | 'up' | 'ok' | 'err'; msg?: string };
const MAX_DOC_BYTES = 4_200_000;

/**
 * Mehrfach-Upload mit Fortschritt. Fotos werden im Browser verkleinert (≤ 2000 px) und bekommen eine kleine Vorschau;
 * Dokumente gehen unverändert hoch (PDF/Bild bis 4 MB wegen des Vercel-Limits). Fehler gelten je Datei.
 */
export function MediaUploader({
  target, caseId, customerId, categories, defaultCategory, damages = [], capture = false, compact = false,
}: {
  target: 'photo' | 'document';
  caseId?: string;
  customerId?: string;
  categories: [string, string][];
  defaultCategory: string;
  damages?: { id: string; label: string }[];
  capture?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [category, setCategory] = useState(defaultCategory);
  const [damageId, setDamageId] = useState('');
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const patch = (id: number, p: Partial<Item>) => setItems((l) => l.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const run = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setBusy(true);
      let ok = 0;
      const queued = files.map((f) => ({ f, id: ++seq.current }));
      setItems((l) => [...queued.map(({ f, id }) => ({ id, name: f.name, s: 'wait' as const })), ...l].slice(0, 12));
      for (const { f, id } of queued) {
        patch(id, { s: 'up' });
        try {
          const fd = new FormData();
          fd.set('target', target);
          if (caseId) fd.set('caseId', caseId);
          if (customerId) fd.set('customerId', customerId);
          fd.set('category', category);
          if (target === 'photo') {
            const { file, thumb } = await prepareCasePhoto(f).catch(() => {
              throw new Error('Dieses Bild konnte nicht gelesen werden (erlaubt: JPG, PNG, WebP).');
            });
            fd.set('file', file);
            fd.set('thumb', thumb);
            if (damageId) fd.set('damageId', damageId);
          } else {
            if (f.size > MAX_DOC_BYTES) throw new Error('Die Datei ist größer als 4 MB.');
            fd.set('file', f);
            fd.set('title', title.trim() || f.name.replace(/\.[^.]+$/, ''));
          }
          const res = await fetch('/api/admin/media/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
          const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
          if (!res.ok || !json.ok) throw new Error(json.message || 'Der Upload hat nicht geklappt.');
          patch(id, { s: 'ok' });
          ok += 1;
        } catch (e) {
          patch(id, { s: 'err', msg: e instanceof Error ? e.message : 'Fehler' });
        }
      }
      setBusy(false);
      if (ok) {
        toast(ok === 1 ? (target === 'photo' ? 'Foto hochgeladen.' : 'Dokument hochgeladen.') : `${ok} Dateien hochgeladen.`, 'ok');
        router.refresh();
      }
      if (ok < files.length) toast(`${files.length - ok} Datei(en) konnten nicht hochgeladen werden.`, 'error');
      if (input.current) input.current.value = '';
    },
    [target, caseId, customerId, category, damageId, title, router, toast],
  );

  return (
    <div>
      <div className="adm-form-grid" style={{ marginBottom: 10 }}>
        <Field label="Kategorie">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="adm-input">
            {categories.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {target === 'document' ? (
          <Field label="Titel (optional)" hint="Sonst der Dateiname">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="adm-input" maxLength={160} />
          </Field>
        ) : damages.length > 0 ? (
          <Field label="Zu Schaden (optional)">
            <select value={damageId} onChange={(e) => setDamageId(e.target.value)} className="adm-input">
              <option value="">Keinem zugeordnet</option>
              {damages.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </Field>
        ) : null}
      </div>
      <label
        className="adm-drop"
        data-over={over}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void run(Array.from(e.dataTransfer.files)); }}
        style={compact ? { padding: '14px 12px' } : undefined}
      >
        <AdminIcon name={target === 'photo' ? 'photo' : 'doc'} />
        <span><b>{target === 'photo' ? (capture ? 'Foto aufnehmen oder wählen' : 'Fotos wählen oder hierher ziehen') : 'Dokument wählen oder hierher ziehen'}</b></span>
        <span style={{ fontSize: 12 }}>{target === 'photo' ? 'JPG, PNG oder WebP – werden automatisch verkleinert' : 'PDF, JPG, PNG oder WebP bis 4 MB'}</span>
        <input
          ref={input}
          type="file"
          className="sr-only-adm"
          multiple
          accept={target === 'photo' ? 'image/jpeg,image/png,image/webp' : 'application/pdf,image/jpeg,image/png,image/webp'}
          {...(capture ? { capture: 'environment' as const } : {})}
          disabled={busy}
          data-testid={`upload-${target}`}
          onChange={(e) => void run(Array.from(e.target.files ?? []))}
        />
      </label>
      {items.length > 0 && (
        <ul className="adm-up" aria-live="polite">
          {items.map((i) => (
            <li key={i.id} data-s={i.s}>
              <span className="nm">{i.name}</span>
              <span>{i.s === 'wait' ? 'wartet' : i.s === 'up' ? 'lädt …' : i.s === 'ok' ? 'fertig' : i.msg}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Galerie */

export type PhotoView = { id: string; mediaId: string; category: string; title: string | null; description: string | null; damageId: string | null; damageLabel: string | null; when: string };

export function PhotoGallery({ photos, categories, damages, canWrite, caseNumber, updateAction, deleteAction }: {
  photos: PhotoView[];
  categories: [string, string][];
  damages: { id: string; label: string }[];
  canWrite: boolean;
  caseNumber: string;
  updateAction: Act;
  deleteAction: Act;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const [state, run, pending] = useActionState<FormState, FormData>(updateAction, {});
  useFormFeedback(state);
  const labels = Object.fromEntries(categories);
  const cur = index === null ? null : photos[index];

  useEffect(() => {
    if (index !== null && !dlg.current?.open) dlg.current?.showModal();
  }, [index]);
  useEffect(() => {
    if (index !== null && index >= photos.length) {
      dlg.current?.close();
      setIndex(null);
    }
  }, [photos.length, index]);
  const move = (d: number) => setIndex((i) => (i === null ? i : (i + d + photos.length) % photos.length));

  return (
    <>
      <div className="ph-grid">
        {photos.map((p, i) => (
          <button key={p.id} type="button" className="ph-item" onClick={() => setIndex(i)} aria-label={`Foto ${i + 1}: ${p.title ?? labels[p.category] ?? ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/admin/media/${p.mediaId}?v=thumb`} alt="" loading="lazy" width={300} height={225} />
            <span className="cat">{p.title || labels[p.category] || p.category}</span>
          </button>
        ))}
      </div>
      <dialog
        ref={dlg}
        className="adm-dialog adm-lightbox"
        aria-label="Foto"
        onClose={() => setIndex(null)}
        onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') move(1); if (e.key === 'ArrowLeft') move(-1); }}
      >
        {cur && (
          <>
            <div className="stage">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={cur.mediaId} src={`/api/admin/media/${cur.mediaId}`} alt={cur.title ?? labels[cur.category] ?? 'Foto'} />
              {photos.length > 1 && (
                <>
                  <button type="button" className="adm-btn adm-btn-secondary adm-btn-icon nav prev" onClick={() => move(-1)} aria-label="Vorheriges Foto"><AdminIcon name="chevronRight" className="rotate-180" /></button>
                  <button type="button" className="adm-btn adm-btn-secondary adm-btn-icon nav next" onClick={() => move(1)} aria-label="Nächstes Foto"><AdminIcon name="chevronRight" /></button>
                </>
              )}
            </div>
            <div className="side">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="t-3" style={{ fontSize: 12 }}>Foto {index! + 1} von {photos.length}</span>
                <button type="button" className="adm-btn adm-btn-quiet adm-btn-icon adm-btn-sm" onClick={() => dlg.current?.close()} aria-label="Schließen"><AdminIcon name="x" /></button>
              </div>
              {canWrite ? (
                <form action={run} key={cur.id} className="adm-fieldset">
                  <input type="hidden" name="id" value={cur.id} />
                  <input type="hidden" name="caseNumber" value={caseNumber} />
                  <Field label="Kategorie">
                    <select name="category" defaultValue={cur.category} className="adm-input">{categories.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  </Field>
                  <Field label="Titel"><input name="title" defaultValue={cur.title ?? ''} className="adm-input" maxLength={120} /></Field>
                  <Field label="Beschreibung"><textarea name="description" defaultValue={cur.description ?? ''} rows={3} className="adm-input" maxLength={1000} /></Field>
                  {damages.length > 0 && (
                    <Field label="Zu Schaden">
                      <select name="damageId" defaultValue={cur.damageId ?? ''} className="adm-input"><option value="">Keinem zugeordnet</option>{damages.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select>
                    </Field>
                  )}
                  <FormError state={state} />
                  <SubmitRow pending={pending} label="Speichern" />
                </form>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{cur.title || labels[cur.category]}</p>
                  <p className="t-2" style={{ margin: 0 }}>{labels[cur.category]}{cur.damageLabel ? ` · ${cur.damageLabel}` : ''}</p>
                  {cur.description && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{cur.description}</p>}
                </div>
              )}
              {canWrite && <ConfirmForm action={deleteAction} id={cur.id} extra={{ caseNumber }} label="Foto löschen" title="Foto löschen?" confirm="Das Foto wird ausgeblendet und kann nicht wiederhergestellt werden." danger />}
              <p className="t-3" style={{ margin: 0, fontSize: 12 }}>{cur.when}</p>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}

/* ------------------------------------------------------------------ Termin */

const DURATIONS: [string, string][] = [['30', '30 Minuten'], ['60', '1 Stunde'], ['90', '1,5 Stunden'], ['120', '2 Stunden'], ['180', '3 Stunden'], ['240', '4 Stunden'], ['480', 'Ganztägig (8 Std.)']];

export function AppointmentForm({ action, experts, canPickExpert, currentExpertId, caseOptions, caseId, caseNumber, appointmentId, initial = {}, submitLabel }: {
  action: Act;
  experts: { id: string; name: string }[];
  canPickExpert: boolean;
  currentExpertId?: string;
  caseOptions?: { id: string; label: string }[];
  caseId?: string;
  caseNumber?: string;
  appointmentId?: string;
  initial?: Record<string, string>;
  submitLabel: string;
}) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  useFormFeedback(state);
  const f = state.fields ?? {};
  const v = (k: string) => state.values?.[k] ?? initial[k] ?? '';
  return (
    <form action={run} className="adm-fieldset" noValidate>
      {appointmentId && <input type="hidden" name="id" value={appointmentId} />}
      {caseId && <input type="hidden" name="caseId" value={caseId} />}
      {caseNumber && <input type="hidden" name="caseNumber" value={caseNumber} />}
      {caseOptions && (
        <Field label="Fall" error={f.caseId}>
          <select name="caseId" className="adm-input" required defaultValue={v('caseId')}>
            <option value="" disabled>Fall wählen …</option>
            {caseOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
      )}
      <div className="adm-form-grid">
        <Field label="Art">
          <select name="kind" defaultValue={v('kind') || 'INSPECTION'} className="adm-input">
            <option value="INSPECTION">Besichtigung</option>
            <option value="CONSULTATION">Beratung</option>
            <option value="OTHER">Sonstiger Termin</option>
          </select>
        </Field>
        {canPickExpert ? (
          <Field label="Sachverständiger" error={f.expertId}>
            <select name="expertId" className="adm-input" required defaultValue={v('expertId') || currentExpertId || ''}>
              <option value="" disabled>Wählen …</option>
              {experts.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
        ) : <input type="hidden" name="expertId" value={currentExpertId ?? ''} />}
        <Field label="Beginn" error={f.startsAt}>
          <input type="datetime-local" name="startsAt" defaultValue={v('startsAt')} className="adm-input" required step={300} />
        </Field>
        <Field label="Dauer">
          <select name="duration" defaultValue={v('duration') || '60'} className="adm-input">{DURATIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
      </div>
      <Field label="Ort" hint="Wo steht das Fahrzeug? Wird für die Navigation genutzt.">
        <input name="location" defaultValue={v('location')} className="adm-input" maxLength={200} />
      </Field>
      <Field label="Hinweise">
        <textarea name="notes" defaultValue={v('notes')} rows={3} className="adm-input" maxLength={1000} />
      </Field>
      <FormError state={state} />
      <SubmitRow pending={pending} label={submitLabel} />
    </form>
  );
}

export function AppointmentStatusForm({ action, id, caseNumber, status, title, text, needsReason, label }: { action: Act; id: string; caseNumber: string; status: string; title: string; text: string; needsReason: boolean; label: string }) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  useFormFeedback(state);
  return (
    <form action={run} className="adm-fieldset">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="caseNumber" value={caseNumber} />
      <input type="hidden" name="status" value={status} />
      <p className="t-2" style={{ margin: 0 }}>{text}</p>
      {needsReason && (
        <Field label="Grund" hint="Wird in der Aktivität festgehalten.">
          <input name="reason" className="adm-input" required maxLength={300} autoFocus />
        </Field>
      )}
      <FormError state={state} />
      <SubmitRow pending={pending} label={label} />
      <span className="sr-only-adm">{title}</span>
    </form>
  );
}

/* ------------------------------------------------------------------ Schaden */

export function DamageForm({ action, caseId, caseNumber, damageId, initial = {}, areas, types, repairs, submitLabel }: {
  action: Act;
  caseId?: string;
  caseNumber: string;
  damageId?: string;
  initial?: Record<string, string>;
  areas: [string, string][];
  types: readonly string[];
  repairs: readonly string[];
  submitLabel: string;
}) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  useFormFeedback(state);
  const f = state.fields ?? {};
  const v = (k: string) => state.values?.[k] ?? initial[k] ?? '';
  return (
    <form action={run} className="adm-fieldset" noValidate>
      {caseId && <input type="hidden" name="caseId" value={caseId} />}
      {damageId && <input type="hidden" name="id" value={damageId} />}
      <input type="hidden" name="caseNumber" value={caseNumber} />
      <div className="adm-form-grid">
        <Field label="Bereich">
          <select name="area" defaultValue={v('area') || 'FRONT'} className="adm-input">{areas.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <Field label="Bauteil" error={f.component}>
          <input name="component" defaultValue={v('component')} className="adm-input" required maxLength={120} placeholder="z. B. Stoßfänger vorn" aria-invalid={Boolean(f.component)} />
        </Field>
        <Field label="Schadenart">
          <input name="damageType" list="damage-types" defaultValue={v('damageType')} className="adm-input" maxLength={60} />
          <datalist id="damage-types">{types.map((t) => <option key={t} value={t} />)}</datalist>
        </Field>
        <Field label="Reparaturart">
          <input name="repairKind" list="repair-kinds" defaultValue={v('repairKind')} className="adm-input" maxLength={60} />
          <datalist id="repair-kinds">{repairs.map((t) => <option key={t} value={t} />)}</datalist>
        </Field>
      </div>
      <Field label="Beschreibung">
        <textarea name="description" defaultValue={v('description')} rows={3} className="adm-input" maxLength={2000} />
      </Field>
      <FormError state={state} />
      <SubmitRow pending={pending} label={submitLabel} />
    </form>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>;
}
