'use client';

import { useState } from 'react';
import { BIZ, FORM_ENDPOINT, PARTY_SIZES } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';
import { Magnetic } from '@/components/ui/Magnetic';
import { Slug } from '@/components/ui/Slug';

/**
 * LOCATION · RESERVIERUNG · KONTAKT — gemeinsam als "Besuch uns"-Bereich,
 * damit der letzte Streckenabschnitt der Seite nicht wieder in drei
 * gleichförmige Blöcke zerfällt.
 */
export function Visit() {
  return (
    <section id="visit" className="section bg-bone" aria-labelledby="visit-h">
      <div className="shell">
        <Slug left="Besuch uns" right="Location · Reservierung · Kontakt" />
        <div className="grid gap-[clamp(2rem,5vw,4rem)] lg:grid-cols-[1fr_1.1fr]">
          <div className="grid content-start gap-10">
            <div>
              <p className="eyebrow mb-6">Location</p>
              <Reveal mode="up">
                <h2 id="visit-h" className="display text-h2" style={{ maxWidth: '14ch' }}>
                  Komm vorbei.
                </h2>
              </Reveal>
            </div>

            <Reveal mode="soft" delay={80}>
              <div className="stage-radial-map relative aspect-[4/3] w-full overflow-hidden rounded-[22px]" style={{ background: 'radial-gradient(80% 70% at 50% 45%,#efe3d3,#e2d3bc 80%)' }}>
                <svg viewBox="0 0 300 220" className="h-full w-full" aria-hidden="true">
                  <path d="M0 140 H300 M60 0 V220 M180 0 V220 M0 60 H300" stroke="#241a16" strokeOpacity=".08" strokeWidth="1.5" />
                  <circle cx="150" cy="110" r="8" fill="#7d2f3a" />
                  <circle cx="150" cy="110" r="18" fill="none" stroke="#7d2f3a" strokeOpacity=".4" />
                </svg>
                <div className="absolute bottom-4 left-4 rounded-full bg-bone/90 px-4 py-2 font-mono text-[.7rem] uppercase tracking-[.14em] text-ink">
                  Bremen-Schwachhausen
                </div>
              </div>
            </Reveal>

            <address className="not-italic text-[.98rem] leading-[1.8] text-fg-dim">
              {BIZ.street}
              <br />
              {BIZ.zip} {BIZ.city}
              <br />
              <br />
              Telefon:{' '}
              <a href={`tel:${BIZ.phoneLink}`} className="cursor-none transition-colors hover:text-rose-deep" data-cursor="cta">
                {BIZ.phoneDisplay}
              </a>
              <br />
              E-Mail:{' '}
              <a href={`mailto:${BIZ.email}`} className="cursor-none transition-colors hover:text-rose-deep" data-cursor="cta">
                {BIZ.email}
              </a>
            </address>

            <dl className="grid gap-2 border-t border-line pt-6 font-mono text-[.85rem]">
              {BIZ.hours.map((h) => (
                <div key={h.d} className="flex justify-between gap-4 text-fg-dim">
                  <dt>{h.d}</dt>
                  <dd className="text-ink">{h.t}</dd>
                </div>
              ))}
            </dl>
          </div>

          <ReservationForm />
        </div>
      </div>
    </section>
  );
}

function ReservationForm() {
  const [sent, setSent] = useState(false);

  return (
    <Reveal mode="up" delay={80}>
      <form
        className="panel-form grid gap-5 rounded-[22px] border border-line p-[clamp(1.6rem,3vw,2.4rem)]"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.6), rgba(255,255,255,.2))' }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!FORM_ENDPOINT) {
            const data = new FormData(e.currentTarget);
            const body = Array.from(data.entries())
              .map(([k, v]) => `${k}: ${v}`)
              .join('%0D%0A');
            window.location.href = `mailto:${BIZ.email}?subject=${encodeURIComponent('Reservierung Rose Café')}&body=${body}`;
          }
          setSent(true);
        }}
      >
        <p className="eyebrow mb-1">Reservierung</p>
        <h3 className="display text-h3">Tisch anfragen</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" name="name" required />
          <Field label="E-Mail" name="email" type="email" required />
          <Field label="Datum" name="date" type="date" required />
          <Field label="Uhrzeit" name="time" type="time" required />
        </div>

        <label className="grid gap-2">
          <span className="field-label">Personenzahl</span>
          <select name="party" className="field-input cursor-none" defaultValue={PARTY_SIZES[0]} data-cursor="cta">
            {PARTY_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="field-label">Nachricht (optional)</span>
          <textarea name="message" rows={3} className="field-input resize-none" placeholder="Anlass, Wünsche, Anmerkungen" />
        </label>

        <Magnetic strength={0.24}>
          <button type="submit" className="btn justify-center" data-cursor="cta" data-cursor-label="RESERVE">
            {sent ? 'Danke — wir melden uns' : 'Reservierung senden'} <span aria-hidden="true" className="arw">→</span>
          </button>
        </Magnetic>
        <p className="text-[.78rem] text-fg-mute">
          Ihre Anfrage öffnet Ihr E-Mail-Programm. Für kurzfristige Reservierungen rufen Sie uns gerne direkt an.
        </p>
      </form>
    </Reveal>
  );
}

function Field({ label, name, type = 'text', required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <label className="grid gap-2">
      <span className="field-label">{label}</span>
      <input name={name} type={type} required={required} className="field-input cursor-text" />
    </label>
  );
}
