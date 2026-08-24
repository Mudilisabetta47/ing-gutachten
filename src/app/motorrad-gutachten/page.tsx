import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { TwoCol } from '@/components/sections/TwoCol';
import { FAQS } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

const DESCRIPTION =
  'Motorrad-Gutachten in Hannover: Schadengutachten und Wertgutachten für Motorräder, Roller und Krafträder. Sturzschäden, Rahmenvermessung, Anbauteile und Zubehör – unabhängig bewertet.';

export const metadata: Metadata = buildMetadata({
  title: 'Motorrad-Gutachten Hannover | Sachverständiger für Zweiräder',
  description: DESCRIPTION,
  path: '/motorrad-gutachten',
});

export default function Page() {
  return (
    <Landing
      eyebrow="Motorrad & Kraftrad"
      title="Beim Zweirad steckt der Schaden im Detail."
      lead="Rahmen, Gabel, Anbauteile, Zubehör: Bei Motorrädern entscheidet die genaue Aufnahme darüber, ob der Schaden vollständig ersetzt wird."
      chips={['Sturzschaden', 'Rahmen & Gabel', 'Zubehör', 'Wertgutachten']}
      trail={[
        { name: 'Leistungen', href: '/leistungen' },
        { name: 'Motorrad', href: '/motorrad-gutachten' },
      ]}
      service={{ name: 'Motorrad-Gutachten', description: DESCRIPTION, path: '/motorrad-gutachten' }}
      faqs={[FAQS[2], FAQS[4], FAQS[6]]}
      related={[
        { title: 'Bagatellschäden', text: 'Kleinere Schäden schnell und günstig kalkuliert.', href: '/bagatellschaeden' },
        { title: 'Wertgutachten', text: 'Marktwert für Verkauf oder Versicherung.', href: '/wertgutachten' },
        { title: 'Unfallgutachten', text: 'Ablauf und Rechte nach dem Unfall.', href: '/unfallgutachten' },
      ]}
    >
      <TwoCol
        eyebrow="Prüfumfang"
        heading="Was wir am Zweirad aufnehmen."
        asideTitle="Aufnahmeumfang"
        asideItems={[
          'Rahmen-, Gabel- und Schwingengeometrie',
          'Verkleidung, Tank und Anbauteile',
          'Zubehör, Koffer und Umbauten',
          'Schutzkleidung und Helm',
          'Wertminderung bei jungen Maschinen',
          'Saisonkennzeichen und Nutzungsausfall',
        ]}
        icon="bike"
      >
        <p>
          Nach einem Sturz sind Verzug an Gabel, Rahmen oder Schwinge oft nicht sichtbar, aber
          sicherheitsrelevant. Wir prüfen die Geometrie, bewerten Lackschäden an Verkleidungsteilen und erfassen
          Zubehör und Umbauten, die bei pauschalen Kalkulationen regelmäßig untergehen.
        </p>
        <p>
          Auch die Schutzkleidung gehört zum Schaden: Helm, Kombi, Handschuhe und Stiefel sind nach einem Sturz in
          der Regel unbrauchbar und werden mit erfasst.
        </p>
      </TwoCol>
    </Landing>
  );
}
