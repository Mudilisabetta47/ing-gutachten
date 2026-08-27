'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode, type Ref } from 'react';
import { BIZ, FORM_ENDPOINT, REQUEST_REASONS, REQUEST_VEHICLES } from '@/lib/content';
import { Arrow } from '@/components/ui/Icon';
import { Magnetic } from '@/components/ui/Magnetic';

type Values = {
  anlass: string;
  fahrzeug: string;
  name: string;
  telefon: string;
  email: string;
  standort: string;
  nachricht: string;
  datenschutz: boolean;
};

const EMPTY: Values = {
  anlass: '',
  fahrzeug: '',
  name: '',
  telefon: '',
  email: '',
  standort: '',
  nachricht: '',
  datenschutz: false,
};

const STEP_COUNT = 4;
const MAX_FILES = 8;
const MAX_SIZE = 12 * 1024 * 1024;

export function RequestForm() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [done, setDone] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const touched = useRef(false);

  /* Vorschaubilder erzeugen und Object-URLs wieder freigeben. */
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  useEffect(() => {
    if (touched.current) headingRef.current?.focus();
  }, [step]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = useCallback(
    (index: number) => {
      const next: Partial<Record<keyof Values, string>> = {};
      if (index === 0 && !values.anlass) next.anlass = 'Bitte eine Option wählen.';
      if (index === 1 && !values.fahrzeug) next.fahrzeug = 'Bitte eine Option wählen.';
      if (index === 3) {
        if (!values.name.trim()) next.name = 'Dieses Feld wird benötigt.';
        if (values.telefon.replace(/\D/g, '').length < 6) next.telefon = 'Bitte eine erreichbare Telefonnummer angeben.';
        if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(values.email)) next.email = 'Bitte eine gültige E-Mail-Adresse angeben.';
        if (!values.datenschutz) next.datenschutz = 'Bitte der Datenschutzerklärung zustimmen.';
      }
      setErrors(next);
      return Object.keys(next).length === 0;
    },
    [values],
  );

  const go = (delta: 1 | -1) => {
    touched.current = true;
    if (delta === 1 && !validate(step)) return;
    setDir(delta);
    setStep((s) => Math.min(Math.max(s + delta, 0), STEP_COUNT - 1));
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => {
      const next = [...prev];
      Array.from(list).forEach((f) => {
        if (!f.type.startsWith('image/') || f.size > MAX_SIZE || next.length >= MAX_FILES) return;
        next.push(f);
      });
      return next;
    });
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    touched.current = true;
    if (!validate(3)) return;

    /* Ohne konfigurierten Endpunkt: sauberer Fallback ins E-Mail-Programm. */
    if (!FORM_ENDPOINT) {
      const body = [
        `Anlass: ${values.anlass}`,
        `Fahrzeug: ${values.fahrzeug}`,
        `Name: ${values.name}`,
        `Telefon: ${values.telefon}`,
        `E-Mail: ${values.email}`,
        values.standort ? `Standort: ${values.standort}` : '',
        values.nachricht ? `Nachricht: ${values.nachricht}` : '',
        files.length ? `(${files.length} Foto(s) bitte als Anhang beifügen)` : '',
      ]
        .filter(Boolean)
        .join('\n');
      window.location.href = `mailto:${BIZ.email}?subject=${encodeURIComponent(
        'Gutachten-Anfrage über die Website',
      )}&body=${encodeURIComponent(body)}`;
      setDone(true);
      return;
    }

    setSending(true);
    setSendError('');
    try {
      const data = new FormData();
      Object.entries(values).forEach(([k, v]) => data.append(k, String(v)));
      files.forEach((f, i) => data.append(`foto_${i + 1}`, f));
      const res = await fetch(FORM_ENDPOINT, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('request failed');
      setDone(true);
    } catch {
      setSendError(`Die Anfrage konnte nicht gesendet werden. Bitte rufen Sie uns an: ${BIZ.phoneDisplay}.`);
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="panel rounded-[22px]">
        <motion.div
          className="grid justify-items-center gap-4 py-8 text-center"
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <span
            className="grid h-[76px] w-[76px] place-items-center rounded-full text-ok"
            style={{ background: 'rgba(95,214,164,.12)', boxShadow: 'inset 0 0 0 1px rgba(95,214,164,.4)' }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <h3 className="display text-h3">Anfrage ist raus.</h3>
          <p className="lead max-w-[44ch]">
            Wir melden uns kurzfristig mit einem Terminvorschlag. Wenn es eilt, erreichen Sie uns sofort telefonisch.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href={`tel:${BIZ.phoneLink}`} className="btn">
              {BIZ.phoneDisplay} anrufen
            </a>
            <Link href="/" className="btn btn-ghost">
              Zur Startseite
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden rounded-[22px] p-[clamp(1.3rem,3.2vw,2.6rem)]">
      <form onSubmit={onSubmit} noValidate aria-label="Gutachten anfordern">
        <div className="mb-8 flex items-center gap-3">
          <span className="whitespace-nowrap font-mono text-[.66rem] uppercase tracking-[.18em] text-fg-mute">
            Schritt {step + 1} / {STEP_COUNT}
          </span>
          <span className="h-[2px] flex-1 overflow-hidden rounded bg-line">
            <motion.i
              className="block h-full origin-left bg-signal"
              animate={{ scaleX: (step + 1) / STEP_COUNT }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: 'block', width: '100%' }}
            />
          </span>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={step}
            initial={{ opacity: 0, x: dir * 22, filter: 'blur(5px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: dir * -22, filter: 'blur(5px)' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="grid gap-6"
            aria-label={`Schritt ${step + 1} von ${STEP_COUNT}`}
          >
            {step === 0 && (
              <>
                <StepHeading ref={headingRef} title="Was ist passiert?" sub="Damit wir sofort einschätzen, welche Art von Gutachten Sie brauchen." />
                <Options
                  name="anlass"
                  values={REQUEST_REASONS}
                  selected={values.anlass}
                  onSelect={(v) => {
                    set('anlass', v);
                    touched.current = true;
                    window.setTimeout(() => {
                      setDir(1);
                      setStep((s) => (s === 0 ? 1 : s));
                    }, 260);
                  }}
                />
                <FieldError message={errors.anlass} />
              </>
            )}

            {step === 1 && (
              <>
                <StepHeading ref={headingRef} title="Welches Fahrzeug?" sub="Für Elektro-, Nutz- und Klassikfahrzeuge gelten eigene Prüfpunkte." />
                <Options
                  name="fahrzeug"
                  values={REQUEST_VEHICLES}
                  selected={values.fahrzeug}
                  onSelect={(v) => {
                    set('fahrzeug', v);
                    touched.current = true;
                    window.setTimeout(() => {
                      setDir(1);
                      setStep((s) => (s === 1 ? 2 : s));
                    }, 260);
                  }}
                />
                <FieldError message={errors.fahrzeug} />
              </>
            )}

            {step === 2 && (
              <>
                <StepHeading
                  ref={headingRef}
                  title="Schaden fotografieren & hochladen"
                  sub="Optional, hilft aber bei der Ersteinschätzung: Gesamtansicht, Schadenstelle nah, Kennzeichen."
                />
                <label
                  htmlFor="photos"
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`relative grid cursor-pointer justify-items-center gap-2 rounded-[14px] border-[1.5px] border-dashed p-7 text-center transition-colors ${
                    dragging ? 'border-signal-bright bg-signal-soft' : 'border-line hover:border-signal-bright hover:bg-signal-soft'
                  }`}
                >
                  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" className="h-[30px] w-[30px] text-signal-bright">
                    <path d="M24 34V14m0 0-7 7m7-7 7 7M8 34v4a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4v-4" />
                  </svg>
                  <b className="font-display text-base">Fotos hierher ziehen oder auswählen</b>
                  <small className="text-[.8rem] text-fg-mute">JPG, PNG oder HEIC · bis 12 MB je Bild · maximal 8 Fotos</small>
                  {files.length > 0 && (
                    <small className="text-[.8rem] text-signal-bright">
                      {files.length} Foto{files.length > 1 ? 's' : ''} ausgewählt
                    </small>
                  )}
                  <input
                    id="photos"
                    name="fotos"
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => addFiles(e.target.files)}
                  />
                </label>

                {previews.length > 0 && (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(78px,1fr))] gap-2" aria-live="polite">
                    {previews.map((url, i) => (
                      <motion.div
                        key={url}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative aspect-square overflow-hidden rounded-[10px]"
                        style={{ boxShadow: 'inset 0 0 0 1px #232b33' }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Vorschau ${i + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          aria-label={`Foto ${i + 1} entfernen`}
                          onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute right-1 top-1 grid h-[22px] w-[22px] place-items-center rounded-full border-0 bg-ink-900/80 text-[.7rem] text-white transition-colors hover:bg-danger hover:text-ink-900"
                        >
                          ✕
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <StepHeading ref={headingRef} title="Wie können wir Sie erreichen?" sub="Wir melden uns in der Regel innerhalb weniger Stunden mit einem Terminvorschlag." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" id="name" error={errors.name}>
                    <input
                      id="name"
                      className="field-input"
                      autoComplete="name"
                      placeholder="Vor- und Nachname"
                      value={values.name}
                      data-invalid={Boolean(errors.name)}
                      onChange={(e) => set('name', e.target.value)}
                    />
                  </Field>
                  <Field label="Telefon" id="telefon" error={errors.telefon}>
                    <input
                      id="telefon"
                      type="tel"
                      className="field-input"
                      autoComplete="tel"
                      placeholder="0170 0000000"
                      value={values.telefon}
                      data-invalid={Boolean(errors.telefon)}
                      onChange={(e) => set('telefon', e.target.value)}
                    />
                  </Field>
                  <Field label="E-Mail" id="email" error={errors.email} full>
                    <input
                      id="email"
                      type="email"
                      className="field-input"
                      autoComplete="email"
                      placeholder="name@beispiel.de"
                      value={values.email}
                      data-invalid={Boolean(errors.email)}
                      onChange={(e) => set('email', e.target.value)}
                    />
                  </Field>
                  <Field label="Wo steht das Fahrzeug?" id="standort" full>
                    <input
                      id="standort"
                      className="field-input"
                      placeholder="z. B. Hannover-Döhren, Werkstatt Langenhagen, Unfallort"
                      value={values.standort}
                      onChange={(e) => set('standort', e.target.value)}
                    />
                  </Field>
                  <Field label="Kurz zum Schaden" id="nachricht" full>
                    <textarea
                      id="nachricht"
                      className="field-input min-h-[120px] resize-y"
                      placeholder="Was ist passiert, wann, und ist das Fahrzeug noch fahrbereit?"
                      value={values.nachricht}
                      onChange={(e) => set('nachricht', e.target.value)}
                    />
                  </Field>

                  <div className="sm:col-span-2">
                    <label className="flex cursor-pointer items-start gap-3 text-[.85rem] text-fg-mute">
                      <input
                        type="checkbox"
                        className="mt-1 h-[17px] w-[17px] flex-none accent-[#1f6fe0]"
                        checked={values.datenschutz}
                        onChange={(e) => set('datenschutz', e.target.checked)}
                      />
                      <span>
                        Ich habe die{' '}
                        <Link href="/datenschutz" className="text-fg-dim underline underline-offset-2">
                          Datenschutzerklärung
                        </Link>{' '}
                        gelesen und bin damit einverstanden, dass meine Angaben zur Bearbeitung der Anfrage
                        verwendet werden.
                      </span>
                    </label>
                    <FieldError message={errors.datenschutz} />
                  </div>
                </div>
              </>
            )}
          </motion.section>
        </AnimatePresence>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {step > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => go(-1)}>
              Zurück
            </button>
          )}
          <span className="flex-1" />
          {step < STEP_COUNT - 1 ? (
            <button type="button" className="btn" onClick={() => go(1)}>
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

        {sendError && (
          <p role="alert" className="mt-4 text-[.85rem] text-danger">
            {sendError}
          </p>
        )}
        <p className="mt-4 text-[.8rem] text-fg-mute">
          Dringend? Rufen Sie direkt an:{' '}
          <a href={`tel:${BIZ.phoneLink}`} className="text-signal-bright">
            {BIZ.phoneDisplay}
          </a>
        </p>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StepHeading({ title, sub, ref }: { title: string; sub: string; ref?: Ref<HTMLHeadingElement> }) {
  return (
    <div className="grid gap-2">
      <h3 ref={ref} tabIndex={-1} className="display text-[clamp(1.4rem,3.2vw,2.1rem)] outline-none">
        {title}
      </h3>
      <p className="text-fg-mute">{sub}</p>
    </div>
  );
}

function Options({
  name,
  values,
  selected,
  onSelect,
}: {
  name: string;
  values: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-[.6rem] sm:grid-cols-3">
      {values.map((v) => {
        const on = selected === v;
        return (
          <label key={v} className="relative">
            <input
              type="radio"
              name={name}
              value={v}
              checked={on}
              onChange={() => onSelect(v)}
              className="absolute h-0 w-0 opacity-0"
            />
            <span
              className={`flex min-h-[64px] cursor-pointer items-center gap-3 rounded-[14px] px-4 py-[.85rem] font-display text-[.95rem] font-semibold transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-white/[.04] ${
                on ? 'bg-signal-soft' : ''
              }`}
              style={{ boxShadow: on ? 'inset 0 0 0 1.5px #6ba8ff' : 'inset 0 0 0 1px #232b33' }}
            >
              <span
                className={`h-4 w-4 flex-none rounded-full ${on ? 'bg-signal' : ''}`}
                style={{ boxShadow: 'inset 0 0 0 1px #232b33' }}
              />
              {v}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function Field({
  label,
  id,
  error,
  full,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  full?: boolean;
  children: ReactNode;
}) {
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
