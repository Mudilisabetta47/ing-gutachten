import { BIZ } from '@/lib/content';
import { RequestForm } from '@/components/form/RequestForm';
import { Reveal } from '@/components/ui/Reveal';
import { SplitWords } from '@/components/ui/Split';

export function RequestSection({ title = 'Schaden melden.' }: { title?: string }) {
  return (
    <section className="theme-dark section cta-bg relative scroll-mt-16 overflow-hidden border-t border-line bg-ink-850" id="anfrage" aria-labelledby="req-h">
      <div className="shell grid gap-[clamp(2rem,5vw,6rem)] lg:grid-cols-[.8fr_1.2fr]">
        <div className="grid content-start gap-6">
          <p className="eyebrow">Anfrage · 4 Schritte</p>
          <h2 id="req-h" className="display text-[clamp(2.6rem,1.2rem+6vw,6.5rem)] uppercase leading-[.9] tracking-[-.045em]">
            <SplitWords text={title} />
          </h2>
          <Reveal delay={0.1}>
            <p className="lead">Kurz ausfüllen. Wir melden uns.</p>
          </Reveal>
          <Reveal delay={0.16} className="grid gap-1">
            <span className="mono-label text-fg-mute">Lieber direkt?</span>
            <a href={`tel:${BIZ.phoneLink}`} className="display text-[clamp(1.6rem,1rem+2vw,2.6rem)] tracking-[-.03em] transition-colors hover:text-signal-bright">
              {BIZ.phoneDisplay}
            </a>
            <a href={`tel:${BIZ.mobileLink}`} className="text-fg-dim transition-colors hover:text-signal-bright">
              Mobil {BIZ.mobileDisplay}
            </a>
          </Reveal>
        </div>
        <Reveal variant="up">
          <RequestForm />
        </Reveal>
      </div>
    </section>
  );
}
