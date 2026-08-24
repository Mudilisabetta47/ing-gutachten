import Link from 'next/link';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';
import { Arrow } from '@/components/ui/Icon';

export function Position() {
  return (
    <section className="section" aria-labelledby="pos-h">
      <div className="shell">
        <Slug left="Positionierung" right="Kfz-Gutachter Hannover" />
        <div className="grid gap-[clamp(2rem,5vw,5rem)] lg:grid-cols-[.85fr_1.15fr]">
          <div className="grid content-start gap-6">
            <p className="eyebrow">Warum unabhängig zählt</p>
            <p className="max-w-[26ch] font-mono text-[.78rem] leading-relaxed tracking-[.1em] text-fg-mute">
              Die gegnerische Versicherung bezahlt. Aussuchen dürfen Sie.
            </p>
          </div>

          <div className="grid content-start gap-6">
            <Reveal>
              <h2 id="pos-h" className="display text-h2">
                Ein Gutachten ist kein Formular.
                <br />
                Es ist Ihre Beweislage.
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="lead">
                Nach einem unverschuldeten Unfall entscheidet ein einziges Dokument darüber, was Sie ersetzt
                bekommen: das Schadengutachten. Wird eine Position übersehen – merkantile Wertminderung,
                Nutzungsausfall, Verbringungskosten, notwendige Kalibrierung der Assistenzsysteme –, holen Sie
                sie später kaum zurück.
              </p>
            </Reveal>
            <Reveal delay={0.14}>
              <p className="text-fg-mute">
                Als unabhängiges Sachverständigenbüro in Hannover arbeiten wir weder für Versicherer noch für
                Werkstätten oder Autohäuser. Wir dokumentieren den Schaden so, wie er ist – vollständig,
                nachvollziehbar und belastbar gegenüber der Regulierungsstelle und vor Gericht.
              </p>
            </Reveal>
            <div className="mt-2 flex flex-wrap gap-8">
              <Link href="/ueber-uns" className="tlink">
                Über das Büro <Arrow />
              </Link>
              <Link href="/ablauf" className="tlink">
                Ablauf ansehen <Arrow />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
