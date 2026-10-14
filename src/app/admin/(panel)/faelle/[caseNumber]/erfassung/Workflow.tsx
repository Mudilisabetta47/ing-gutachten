'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { Alert, Field } from '@/components/admin/ui';
import { DamageMap } from '@/components/admin/DamageMap';
import { MediaUploader } from '@/components/admin/work';
import { FormError } from '@/components/admin/forms';
import { useToast } from '@/components/admin/Toast';
import type { FormState } from '@/server/admin/form';
import { appointmentStatusAction, finishInspectionAction, saveInspectionAction } from '../../work-actions';

const STEPS = ['Fahrzeug', 'Fotos', 'Schäden', 'Notiz', 'Abschluss'] as const;
const WEATHER = ['Trocken', 'Regen', 'Bewölkt', 'Schnee/Eis', 'Dunkel/Halle'];
const MUST_PHOTOS: [string, string][] = [['OVERVIEW', 'Gesamtansicht'], ['PLATE', 'Kennzeichen'], ['VIN', 'Fahrgestellnummer'], ['ODOMETER', 'Tacho'], ['DAMAGE', 'Schadenstelle']];

type Props = {
  appointmentId: string;
  caseId: string;
  caseNumber: string;
  vehicle: { name: string; plate: string | null; vin: string | null; mileage: number | null };
  initial: { odometer: string; weather: string; note: string };
  photoCats: Record<string, number>;
  photoTotal: number;
  damages: { id: string; label: string; sub: string }[];
  photoCategories: [string, string][];
  areas: [string, string][];
  types: readonly string[];
  repairs: readonly string[];
  canPhotos: boolean;
  canDocs: boolean;
  docCategories: [string, string][];
  storage: boolean;
  canDamage: boolean;
  mapDamages: React.ComponentProps<typeof DamageMap>['damages'];
  mapPhotos: React.ComponentProps<typeof DamageMap>['photos'];
};

/** Hinweis, wenn die Verbindung fehlt: Es gibt bewusst keinen Offline-Betrieb – Eingaben werden erst gespeichert, wenn der Server erreichbar ist. */
function OnlineBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online ? null : <Alert tone="danger" icon="alert">Keine Verbindung. Offline-Betrieb ist nicht verfügbar – Fotos, Schäden und Notizen werden erst gespeichert, wenn die Verbindung wieder steht. Bitte nichts schließen, bis „Gespeichert“ erscheint.</Alert>;
}

/** Termin kann nicht stattfinden (Kunde nicht angetroffen, abgesagt): Status direkt am Fahrzeug setzen. */
function AppointmentIssue({ appointmentId, caseNumber }: { appointmentId: string; caseNumber: string }) {
  const router = useRouter();
  const [state, run, pending] = useActionState<FormState, FormData>(appointmentStatusAction, {});
  useEffect(() => { if (state.ok) router.push(`/admin/faelle/${caseNumber}/`); }, [state.ok, router, caseNumber]);
  return (
    <details className="wf-issue">
      <summary>Termin kann nicht stattfinden?</summary>
      <form action={run} style={{ display: 'grid', gap: 10, marginTop: 10 }}>
        <input type="hidden" name="id" value={appointmentId} />
        <input type="hidden" name="caseNumber" value={caseNumber} />
        <Field label="Status"><select name="status" className="adm-input" defaultValue="NO_SHOW"><option value="NO_SHOW">Kunde nicht angetroffen</option><option value="CANCELLED">Termin absagen</option></select></Field>
        <Field label="Grund (Pflicht)"><input name="reason" className="adm-input" maxLength={300} placeholder="z. B. niemand vor Ort, Rückruf vereinbart" /></Field>
        <FormError state={state} />
        <button type="submit" className="adm-btn adm-btn-secondary" disabled={pending}>Status setzen</button>
      </form>
    </details>
  );
}

/** Mobiler Gutachter-Workflow: Fahrzeug prüfen → Fotos → Schäden → Notiz → Abschluss. Eingaben werden bei jedem Schritt gesichert. */
export function InspectionWorkflow(p: Props) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [odometer, setOdometer] = useState(p.initial.odometer);
  const [weather, setWeather] = useState(p.initial.weather);
  const [note, setNote] = useState(p.initial.note);
  const [saveState, save] = useActionState<FormState, FormData>(saveInspectionAction, {});
  const [finState, finish, finishing] = useActionState<FormState, FormData>(finishInspectionAction, {});
  const [, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  const payload = () => {
    const fd = new FormData();
    fd.set('appointmentId', p.appointmentId);
    fd.set('caseNumber', p.caseNumber);
    fd.set('odometer', odometer);
    fd.set('weather', weather);
    fd.set('note', note);
    return fd;
  };
  const saveNow = () => start(() => save(payload()));
  const go = (n: number) => {
    saveNow();
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  const checks: [boolean, string][] = [
    [odometer.trim() !== '', 'Kilometerstand eingetragen'],
    [p.photoTotal > 0, `${p.photoTotal} Foto(s) aufgenommen`],
    [(p.photoCats.PLATE ?? 0) > 0, 'Kennzeichen fotografiert'],
    [p.damages.length > 0, `${p.damages.length} Schaden erfasst`],
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <ol className="wf-steps" aria-label="Fortschritt">{STEPS.map((s, i) => <li key={s} data-on={i <= step} aria-current={i === step ? 'step' : undefined} title={s} />)}</ol>
      <h2 style={{ margin: 0, fontSize: 20 }}>{step + 1}. {STEPS[step]}</h2>
      <OnlineBanner />
      {saveState.error && <Alert tone="danger">{saveState.error}</Alert>}

      {step === 0 && (
        <div className="adm-panel" style={{ display: 'grid', gap: 14 }}>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{p.vehicle.name}</p>
            <p className="t-2" style={{ margin: '2px 0 0' }}>{p.vehicle.plate ? <span className="mono">{p.vehicle.plate}</span> : 'Kein Kennzeichen erfasst'}{p.vehicle.vin ? <> · FIN <span className="mono" style={{ fontSize: 12 }}>{p.vehicle.vin}</span></> : null}</p>
          </div>
          <Field label="Kilometerstand (Tacho)" hint={p.vehicle.mileage ? `Erfasst: ${p.vehicle.mileage.toLocaleString('de-DE')} km` : 'Bitte am Fahrzeug ablesen'}>
            <input inputMode="numeric" value={odometer} onChange={(e) => setOdometer(e.target.value)} className="adm-input" placeholder="z. B. 84210" name="odometer" />
          </Field>
          <AppointmentIssue appointmentId={p.appointmentId} caseNumber={p.caseNumber} />
          <p className="t-3" style={{ margin: 0 }}>Stimmen Kennzeichen und FIN mit dem Fahrzeug überein? Abweichungen bitte im nächsten Schritt als Foto und in der Notiz festhalten.</p>
        </div>
      )}

      {step === 1 && (
        <div style={{ display: 'grid', gap: 14 }}>
          <ul className="wf-check">
            {MUST_PHOTOS.map(([k, l]) => (
              <li key={k} data-ok={(p.photoCats[k] ?? 0) > 0}><AdminIcon name={(p.photoCats[k] ?? 0) > 0 ? 'check' : 'camera'} /><span>{l}</span><span className="t-3" style={{ marginLeft: 'auto' }}>{p.photoCats[k] ?? 0}</span></li>
            ))}
          </ul>
          {p.canPhotos && p.storage ? (
            <MediaUploader target="photo" caseId={p.caseId} categories={p.photoCategories} defaultCategory="OVERVIEW" capture damages={p.damages.map((d) => ({ id: d.id, label: d.label }))} />
          ) : (
            <Alert tone="warn">Der Foto-Upload ist nicht verfügbar (kein Speicher eingerichtet oder keine Berechtigung).</Alert>
          )}
          <p className="t-3" style={{ margin: 0 }}>Gesamt: {p.photoTotal} Foto(s). Jedes Foto ist sofort gespeichert.</p>
          {p.canDocs && p.storage && (
            <section aria-label="Dokumente" style={{ display: 'grid', gap: 8 }}>
              <h3 style={{ margin: '6px 0 0', fontSize: 15 }}>Dokumente (Fahrzeugschein, Vollmacht …)</h3>
              <MediaUploader target="document" caseId={p.caseId} categories={p.docCategories} defaultCategory="REGISTRATION" capture compact />
            </section>
          )}
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'grid', gap: 14 }}>
          {p.canDamage ? (
            <DamageMap caseId={p.caseId} caseNumber={p.caseNumber} canWrite damages={p.mapDamages} photos={p.mapPhotos} damageTypes={p.types} repairKinds={p.repairs} />
          ) : (
            <Alert tone="warn">Für die Schadenerfassung fehlt die Berechtigung.</Alert>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="adm-panel" style={{ display: 'grid', gap: 14 }}>
          <Field label="Wetter / Bedingungen">
            <div className="wf-chips">{WEATHER.map((w) => <button key={w} type="button" aria-pressed={weather === w} onClick={() => setWeather(weather === w ? '' : w)}>{w}</button>)}</div>
          </Field>
          <Field label="Notiz zur Besichtigung" hint="Besonderheiten, Vorschäden, Absprachen vor Ort.">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} className="adm-input" maxLength={4000} name="note" />
          </Field>
        </div>
      )}

      {step === 4 && (
        <form ref={form} action={finish} style={{ display: 'grid', gap: 14 }}>
          <input type="hidden" name="appointmentId" value={p.appointmentId} />
          <input type="hidden" name="caseNumber" value={p.caseNumber} />
          <input type="hidden" name="odometer" value={odometer} />
          <input type="hidden" name="weather" value={weather} />
          <input type="hidden" name="note" value={note} />
          <ul className="wf-check">{checks.map(([ok, l]) => <li key={l} data-ok={ok}><AdminIcon name={ok ? 'check' : 'alert'} /><span>{l}</span></li>)}</ul>
          <p className="t-2" style={{ margin: 0 }}>Beim Abschließen wird der Termin als erledigt markiert und der Fall auf „Besichtigt“ gesetzt. Fehlende Punkte blockieren nicht – sie lassen sich später im Fall ergänzen.</p>
          <FormError state={finState} />
          <button type="submit" className="adm-btn" disabled={finishing} style={{ minHeight: 52 }} onClick={() => toast('Besichtigung wird abgeschlossen …', 'info')}>{finishing ? 'Wird abgeschlossen …' : 'Besichtigung abschließen'}</button>
        </form>
      )}

      {step < 4 && (
        <div className="wf-foot">
          {step > 0 && <button type="button" className="adm-btn adm-btn-secondary" onClick={() => go(step - 1)}>Zurück</button>}
          <button type="button" className="adm-btn" onClick={() => { go(step + 1); if (step === 1 || step === 2) router.refresh(); }}>Weiter</button>
        </div>
      )}
      {step === 4 && <div className="wf-foot"><button type="button" className="adm-btn adm-btn-secondary" onClick={() => go(3)}>Zurück</button></div>}
    </div>
  );
}
