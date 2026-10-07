'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { BIZ, FORM_ENDPOINT } from '@/lib/content';
import {
  LIMITS,
  REQUEST_REASONS,
  REQUEST_VEHICLES,
  validateFields,
  type FieldErrors,
  type RequestFields,
} from '@/lib/request-schema';
import { compressImage } from '@/lib/compress-image';
import { Arrow } from '@/components/ui/Icon';
import { Magnetic } from '@/components/ui/Magnetic';

const STEPS = ['Schaden', 'Kontakt', 'Fotos', 'Prüfen & senden'] as const;
const CLIENT_TOTAL_BUDGET = 4_000_000;

const EMPTY: RequestFields = {
  anlass: '',
  fahrzeug: '',
  name: '',
  telefon: '',
  email: '',
  standort: '',
  nachricht: '',
  datenschutz: false,
};

type Photo = { file: File; url: string };

const mb = (n: number) => (n / 1024 / 1024).toFixed(1);

export function RequestForm() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [values, setValues] = useState<RequestFields>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [doc, setDoc] = useState<File | null>(null);
  const [fileMsg, setFileMsg] = useState('');
  const [busyFiles, setBusyFiles] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [done, setDone] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const touched = useRef(false);
  const startedAt = useRef(0);
  const honeypot = useRef<HTMLInputElement>(null);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  /* Object-URLs der Vorschau wieder freigeben. */
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  useEffect(() => {
    if (touched.current) headingRef.current?.focus();
  }, [step]);

  const totalBytes = photos.reduce((n, p) => n + p.file.size, 0) + (doc?.size ?? 0);

  const set = <K extends keyof RequestFields>(key: K, value: RequestFields[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const check = (index: number) => {
    const all = validateFields(values, index === 0 ? 'schaden' : index === 1 ? 'kontakt' : 'alle');
    const relevant: FieldErrors =
      index === 0
        ? { anlass: all.anlass, fahrzeug: all.fahrzeug }
        : index === 1
          ? { name: all.name, telefon: all.telefon, email: all.email }
          : index === 3
            ? { datenschutz: all.datenschutz }
            : {};
    const clean = Object.fromEntries(Object.entries(relevant).filter(([, v]) => v)) as FieldErrors;
    setErrors(clean);
    return Object.keys(clean).length === 0;
  };

  const go = (delta: 1 | -1, to?: number) => {
    touched.current = true;
    if (delta === 1 && to === undefined && !check(step)) return;
    setDir(delta);
    setStep((s) => (to !== undefined ? to : Math.min(Math.max(s + delta, 0), STEPS.length - 1)));
  };

  /* ---------- Dateien ---------- */
  const addPhotos = async (list: FileList | File[] | null) => {
    if (!list) return;
    setFileMsg('');
    setBusyFiles(true);
    try {
      const incoming = Array.from(list);
      const next: Photo[] = [];
      let bytes = totalBytes;
      let skipped = 0;
      for (const f of incoming) {
        if (photos.length + next.length >= LIMITS.maxPhotos) {
          setFileMsg(`Maximal ${LIMITS.maxPhotos} Fotos.`);
          break;
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
          setFileMsg('Erlaubt sind JPG, PNG und WebP.');
          skipped++;
          continue;
        }
        try {
          const small = await compressImage(f, photos.length + next.length + 1);
          if (bytes + small.size > CLIENT_TOTAL_BUDGET) {
            setFileMsg('Die Fotos sind zusammen zu groß – bitte ein paar weglassen.');
            break;
          }
          bytes += small.size;
          next.push({ file: small, url: URL.createObjectURL(small) });
        } catch {
          setFileMsg('Dieses Bild konnte nicht gelesen werden. Bitte als JPG, PNG oder WebP wählen.');
          skipped++;
        }
      }
      if (next.length) setPhotos((p) => [...p, ...next]);
      void skipped;
    } finally {
      setBusyFiles(false);
    }
  };

  const takeDoc = async (f: File | undefined | null) => {
    if (!f) return;
    setFileMsg('');
    if (f.type === 'application/pdf') {
      if (f.size > LIMITS.maxDocBytes) return setFileMsg('Das PDF ist größer als 1,5 MB.');
      if (totalBytes + f.size > CLIENT_TOTAL_BUDGET) return setFileMsg('Die Dateien sind zusammen zu groß.');
      return setDoc(f);
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return setFileMsg('Fahrzeugschein: JPG, PNG, WebP oder PDF.');
    try {
      const small = await compressImage(f, 0);
      setDoc(new File([small], 'fahrzeugschein.jpg', { type: 'image/jpeg' }));
    } catch {
      setFileMsg('Das Bild konnte nicht gelesen werden.');
    }
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    void addPhotos(e.dataTransfer.files);
  };

  /* ---------- Senden ---------- */
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    touched.current = true;
    const all = validateFields(values);
    if (Object.keys(all).length) {
      setErrors(all);
      setDir(-1);
      setStep(all.anlass || all.fahrzeug ? 0 : all.name || all.telefon || all.email ? 1 : 3);
      return;
    }

    setSending(true);
    setSendError('');
    try {
      const data = new FormData();
      (Object.keys(values) as (keyof RequestFields)[]).forEach((k) => data.append(k, String(values[k])));
      photos.forEach((p) => data.append('foto', p.file, p.file.name));
      if (doc) data.append('fahrzeugschein', doc, doc.name);
      data.append('website', honeypot.current?.value ?? '');
      data.append('t', String(startedAt.current));
      // Herkunft (optional, harmlos): UTM-Parameter, Referrer-Host, Einstiegsseite. Der Server verwirft alles Auffällige.
      try {
        const sp = new URLSearchParams(window.location.search);
        for (const k of ['utm_source', 'utm_medium', 'utm_campaign']) {
          const v = sp.get(k);
          if (v) data.append(k, v.slice(0, 80));
        }
        if (document.referrer) data.append('ref', document.referrer.slice(0, 300));
        data.append('lp', window.location.pathname.slice(0, 120));
      } catch { /* Herkunft ist optional */ }

      const res = await fetch(FORM_ENDPOINT, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; dryRun?: boolean; message?: string; fields?: FieldErrors };
      if (res.ok && json.ok) {
        setDryRun(Boolean(json.dryRun));
        setDone(true);
        return;
      }
      if (json.fields) setErrors(json.fields);
      setSendError(json.message ?? `Die Anfrage konnte nicht gesendet werden. Bitte rufen Sie uns an: ${BIZ.phoneDisplay}.`);
    } catch {
      setSendError(`Die Anfrage konnte nicht gesendet werden. Bitte rufen Sie uns an: ${BIZ.phoneDisplay}.`);
    } finally {
      setSending(false);
    }
  };

  /* ---------- Erfolg ---------- */
  if (done) {
    return (
      <div className="panel rounded-[26px]">
        <motion.div
          className="grid justify-items-start gap-5 py-6"
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="grid h-[68px] w-[68px] place-items-center rounded-full text-ok" style={{ background: 'rgba(95,214,164,.12)', boxShadow: 'inset 0 0 0 1px rgba(95,214,164,.4)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <h3 className="display text-[clamp(1.8rem,1.2rem+2.4vw,3rem)] uppercase leading-none tracking-[-.04em]">Anfrage gesendet.</h3>
          {dryRun ? (
            <p role="note" className="notice max-w-[44ch]">
              <strong>Testmodus (Vorschau):</strong> Die Anfrage wurde geprüft, aber <strong>nicht versendet</strong>.
            </p>
          ) : null}
          <p className="lead max-w-[40ch]">Wir melden uns bei Ihnen. Wenn es eilt, erreichen Sie uns jetzt direkt:</p>
          <div className="flex flex-wrap gap-3">
            <a href={`tel:${BIZ.phoneLink}`} className="btn">
              {BIZ.phoneDisplay}
            </a>
            <a href={`tel:${BIZ.mobileLink}`} className="btn btn-ghost">
              Mobil {BIZ.mobileDisplay}
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  const stepKey = STEPS[step];

  return (
    <div className="panel overflow-hidden rounded-[26px] p-[clamp(1.3rem,3.2vw,2.6rem)]">
      <form onSubmit={onSubmit} noValidate aria-label="Schaden melden">
        {/* Schrittanzeige */}
        <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Fortschritt">
          {STEPS.map((label, i) => (
            <li key={label} aria-current={i === step ? 'step' : undefined} className="grid gap-2">
              <span className="h-[2px] overflow-hidden rounded bg-line">
                <span className="block h-full origin-left bg-signal transition-transform duration-700 ease-out" style={{ transform: `scaleX(${i <= step ? 1 : 0})` }} />
              </span>
              <span className={`mono-label hidden text-[.6rem] sm:block ${i === step ? 'text-fg' : 'text-fg-mute'}`}>
                {String(i + 1).padStart(2, '0')} {label}
              </span>
              <span className={`mono-label text-[.6rem] sm:hidden ${i === step ? 'text-fg' : 'text-fg-mute'}`}>{String(i + 1).padStart(2, '0')}</span>
            </li>
          ))}
        </ol>

        {/* Honeypot: für Menschen unsichtbar, aber nicht display:none */}
        <div aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>
          <label>
            Website
            <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={step}
            initial={{ opacity: 0, x: dir * 22, filter: 'blur(5px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: dir * -22, filter: 'blur(5px)' }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className="grid gap-6"
            aria-label={`Schritt ${step + 1} von ${STEPS.length}: ${stepKey}`}
          >
            {step === 0 && (
              <>
                <StepHeading headingRef={headingRef} title="Was ist passiert?" />
                <Group label="Anlass" error={errors.anlass}>
                  <Options name="anlass" values={REQUEST_REASONS} selected={values.anlass} onSelect={(v) => set('anlass', v)} />
                </Group>
                <Group label="Fahrzeug" error={errors.fahrzeug}>
                  <Options name="fahrzeug" values={REQUEST_VEHICLES} selected={values.fahrzeug} onSelect={(v) => set('fahrzeug', v)} />
                </Group>
                <Field label="Wo steht das Fahrzeug? (optional)" id="standort">
                  <input id="standort" className="field-input" placeholder="z. B. Hannover-Döhren, Werkstatt, Unfallort" maxLength={LIMITS.place} value={values.standort} onChange={(e) => set('standort', e.target.value)} />
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                <StepHeading headingRef={headingRef} title="Wie erreichen wir Sie?" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" id="name" error={errors.name}>
                    <input id="name" className="field-input" autoComplete="name" placeholder="Vor- und Nachname" maxLength={LIMITS.name} value={values.name} data-invalid={Boolean(errors.name)} aria-invalid={Boolean(errors.name)} onChange={(e) => set('name', e.target.value)} />
                  </Field>
                  <Field label="Telefon" id="telefon" error={errors.telefon}>
                    <input id="telefon" type="tel" className="field-input" autoComplete="tel" placeholder="0170 0000000" maxLength={LIMITS.phone} value={values.telefon} data-invalid={Boolean(errors.telefon)} aria-invalid={Boolean(errors.telefon)} onChange={(e) => set('telefon', e.target.value)} />
                  </Field>
                  <Field label="E-Mail" id="email" error={errors.email} full>
                    <input id="email" type="email" className="field-input" autoComplete="email" placeholder="name@beispiel.de" maxLength={LIMITS.email} value={values.email} data-invalid={Boolean(errors.email)} aria-invalid={Boolean(errors.email)} onChange={(e) => set('email', e.target.value)} />
                  </Field>
                  <Field label="Kurz zum Schaden (optional)" id="nachricht" full>
                    <textarea id="nachricht" className="field-input min-h-[110px] resize-y" placeholder="Was ist passiert, wann, ist das Fahrzeug fahrbereit?" maxLength={LIMITS.message} value={values.nachricht} onChange={(e) => set('nachricht', e.target.value)} />
                  </Field>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <StepHeading headingRef={headingRef} title="Fotos" sub="Optional – hilft bei der Ersteinschätzung: Gesamtansicht, Schadenstelle, Kennzeichen." />
                <label
                  htmlFor="photos"
                  onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`relative grid cursor-pointer justify-items-center gap-2 rounded-[16px] border-[1.5px] border-dashed p-7 text-center transition-colors ${
                    dragging ? 'border-signal-bright bg-signal-soft' : 'border-line hover:border-signal-bright hover:bg-signal-soft'
                  }`}
                >
                  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" className="h-[30px] w-[30px] text-signal-bright">
                    <path d="M24 34V14m0 0-7 7m7-7 7 7M8 34v4a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4v-4" />
                  </svg>
                  <b className="font-display text-base">{busyFiles ? 'Fotos werden verkleinert …' : 'Fotos wählen oder hierher ziehen'}</b>
                  <small className="text-[.8rem] text-fg-mute">JPG, PNG oder WebP · maximal {LIMITS.maxPhotos} Fotos · werden automatisch verkleinert</small>
                  <input
                    id="photos"
                    name="fotos"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      void addPhotos(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>

                {photos.length > 0 && (
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2" aria-label="Ausgewählte Fotos">
                    {photos.map((p, i) => (
                      <li key={p.url} className="relative aspect-square overflow-hidden rounded-[12px]" style={{ boxShadow: 'inset 0 0 0 1px rgb(var(--c-line))' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={`Vorschau Foto ${i + 1}`} className="h-full w-full object-cover" />
                        <button type="button" aria-label={`Foto ${i + 1} entfernen`} onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))} className="absolute right-1 top-1 grid h-[24px] w-[24px] place-items-center rounded-full border-0 bg-black/70 text-[.7rem] text-white transition-colors hover:bg-danger">
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="grid gap-2">
                  <span className="field-label">Fahrzeugschein (optional)</span>
                  {doc ? (
                    <div className="flex items-center gap-3 rounded-[14px] border border-line p-4">
                      <span className="min-w-0 grid gap-[.1rem]">
                        <b className="truncate font-display text-[.92rem]">{doc.name}</b>
                        <small className="text-[.75rem] text-fg-mute">{mb(doc.size)} MB · bereit</small>
                      </span>
                      <button type="button" onClick={() => setDoc(null)} className="ml-auto grid h-8 w-8 flex-none place-items-center rounded-full text-fg-mute transition-colors hover:text-danger" style={{ boxShadow: 'inset 0 0 0 1px rgb(var(--c-line))' }} aria-label="Fahrzeugschein entfernen">
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label htmlFor="fahrzeugschein" className="relative flex cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] border-dashed border-line p-4 transition-colors hover:border-signal-bright hover:bg-signal-soft">
                      <b className="font-display text-[.95rem]">Zulassungsbescheinigung Teil I hochladen</b>
                      <input id="fahrzeugschein" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => { void takeDoc(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                  )}
                </div>

                <p className="text-[.78rem] text-fg-mute" aria-live="polite">
                  {photos.length} von {LIMITS.maxPhotos} Fotos · {mb(totalBytes)} MB
                </p>
                {fileMsg && (
                  <p role="alert" className="text-[.85rem] text-danger">
                    {fileMsg}
                  </p>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <StepHeading headingRef={headingRef} title="Prüfen & senden" />
                <dl className="grid gap-px overflow-hidden rounded-[16px] border border-line bg-line">
                  <Row label="Anlass" value={values.anlass} onEdit={() => go(-1, 0)} />
                  <Row label="Fahrzeug" value={values.fahrzeug} onEdit={() => go(-1, 0)} />
                  <Row label="Standort" value={values.standort || '–'} onEdit={() => go(-1, 0)} />
                  <Row label="Name" value={values.name} onEdit={() => go(-1, 1)} />
                  <Row label="Telefon" value={values.telefon} onEdit={() => go(-1, 1)} />
                  <Row label="E-Mail" value={values.email} onEdit={() => go(-1, 1)} />
                  <Row label="Fotos" value={`${photos.length}${doc ? ' + Fahrzeugschein' : ''}`} onEdit={() => go(-1, 2)} />
                </dl>

                <div>
                  <label className="flex cursor-pointer items-start gap-3 text-[.85rem] text-fg-mute">
                    <input type="checkbox" className="mt-1 h-[17px] w-[17px] flex-none accent-[#1f6fe0]" checked={values.datenschutz} aria-invalid={Boolean(errors.datenschutz)} onChange={(e) => set('datenschutz', e.target.checked)} />
                    <span>
                      Ich habe die{' '}
                      <Link href="/datenschutz" className="text-fg-dim underline underline-offset-2">
                        Datenschutzerklärung
                      </Link>{' '}
                      gelesen und bin damit einverstanden, dass meine Angaben und Fotos zur Bearbeitung der Anfrage verwendet werden.
                    </span>
                  </label>
                  <FieldError message={errors.datenschutz} />
                </div>
              </>
            )}
          </motion.section>
        </AnimatePresence>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {step > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => go(-1)}>
              Zurück
            </button>
          )}
          <span className="flex-1" />
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn" onClick={() => go(1)} disabled={busyFiles}>
              Weiter <Arrow />
            </button>
          ) : (
            <Magnetic strength={0.2}>
              <button type="submit" className="btn" disabled={sending}>
                {sending ? 'Wird gesendet …' : 'Anfrage senden'} <Arrow />
              </button>
            </Magnetic>
          )}
        </div>

        <div aria-live="polite">
          {sendError && (
            <p role="alert" className="mt-4 text-[.9rem] text-danger">
              {sendError}
            </p>
          )}
        </div>
        <p className="mt-4 text-[.8rem] text-fg-mute">
          Dringend? Direkt anrufen:{' '}
          <a href={`tel:${BIZ.phoneLink}`} className="text-signal-bright">
            {BIZ.phoneDisplay}
          </a>
        </p>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StepHeading({ title, sub, headingRef }: { title: string; sub?: string; headingRef: React.Ref<HTMLHeadingElement> }) {
  return (
    <div className="grid gap-2">
      <h3 ref={headingRef} tabIndex={-1} className="display text-[clamp(1.6rem,3.4vw,2.4rem)] outline-none">
        {title}
      </h3>
      {sub && <p className="text-fg-mute">{sub}</p>}
    </div>
  );
}

function Group({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-2 border-0 p-0">
      <legend className="field-label mb-2">{label}</legend>
      {children}
      <FieldError message={error} />
    </fieldset>
  );
}

function Row({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-4 bg-ink-850 px-4 py-3">
      <dt className="mono-label w-24 flex-none text-fg-mute">{label}</dt>
      <dd className="min-w-0 flex-1 truncate">{value}</dd>
      <button type="button" onClick={onEdit} className="mono-label cursor-pointer border-0 bg-transparent text-signal-bright underline-offset-4 hover:underline">
        ändern
      </button>
    </div>
  );
}

function Options({ name, values, selected, onSelect }: { name: string; values: readonly string[]; selected: string; onSelect: (value: string) => void }) {
  return (
    <div className="grid gap-[.6rem] min-[400px]:grid-cols-2 sm:grid-cols-3">
      {values.map((v) => {
        const on = selected === v;
        return (
          <label key={v} className="relative">
            <input type="radio" name={name} value={v} checked={on} onChange={() => onSelect(v)} className="peer absolute h-0 w-0 opacity-0" />
            <span
              className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-[14px] px-4 py-[.75rem] font-display text-[.92rem] font-semibold [overflow-wrap:anywhere] transition-all duration-300 ease-out peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal-bright hover:-translate-y-0.5 hover:bg-white/[.04] ${on ? 'bg-signal-soft' : ''}`}
              style={{ boxShadow: on ? 'inset 0 0 0 1.5px rgb(var(--c-signal-bright))' : 'inset 0 0 0 1px rgb(var(--c-line))' }}
            >
              <span className={`h-4 w-4 flex-none rounded-full ${on ? 'bg-signal' : ''}`} style={{ boxShadow: 'inset 0 0 0 1px rgb(var(--c-line))' }} />
              {v}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function Field({ label, id, error, full, children }: { label: string; id: string; error?: string; full?: boolean; children: ReactNode }) {
  return (
    <div className={`grid gap-[.4rem] ${full ? 'sm:col-span-2' : ''}`}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return (
    <span role="alert" className="min-h-[1.1em] text-[.78rem] text-danger">
      {message ?? ''}
    </span>
  );
}
