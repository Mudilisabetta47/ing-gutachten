import { BIZ } from '@/lib/content';
import { RequestForm } from '@/components/form/RequestForm';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';

export function RequestSection() {
  return (
    <section className="section border-y border-line bg-ink-850" id="anfrage" aria-labelledby="req-h">
      <div className="shell">
        <Slug left="Anfrage" right="4 Schritte · ca. 2 Minuten" />
        <div className="grid gap-[clamp(2rem,5vw,5rem)] lg:grid-cols-[.85fr_1.15fr]">
          <div className="grid content-start gap-6">
            <p className="eyebrow">Gutachten anfordern</p>
            <Reveal>
              <h2 id="req-h" className="display text-[clamp(1.9rem,4.4vw,3.4rem)]">
                Vier Fragen.
                <br />
                Dann kümmern wir uns.
              </h2>
            </Reveal>
            <Reveal delay={0.06}>
              <p className="lead">
                Kein Formularmarathon: Anlass, Fahrzeug, optional Fotos, Kontakt. Den Rest klären wir am Telefon.
              </p>
            </Reveal>
            <div className="card mt-4">
              <p className="eyebrow eyebrow-plain">Lieber direkt sprechen?</p>
              <p className="font-display text-[1.35rem] tracking-[-.02em]">
                <a href={`tel:${BIZ.phoneLink}`} className="transition-colors hover:text-signal">
                  {BIZ.phoneDisplay}
                </a>
              </p>
              <p className="text-[.9rem] text-fg-mute">
                Mobil{' '}
                <a href={`tel:${BIZ.mobileLink}`} className="transition-colors hover:text-signal">
                  {BIZ.mobileDisplay}
                </a>{' '}
                · {BIZ.hours}
              </p>
            </div>
          </div>
          <RequestForm />
        </div>
      </div>
    </section>
  );
}
