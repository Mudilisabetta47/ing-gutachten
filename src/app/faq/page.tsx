import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { TwoCol } from '@/components/sections/TwoCol';
import { FAQS } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'FAQ | Häufige Fragen zum Kfz-Gutachten in Hannover',
  description:
    'Antworten zu Kfz-Gutachten in Hannover: Wer wählt den Sachverständigen, wer zahlt, wie lange dauert es, ab welcher Schadenhöhe lohnt sich ein Gutachten und was steht darin?',
  path: '/faq',
});

export default function Page() {
  return (
    <Landing
      eyebrow="Fragen & Antworten"
      title="Alles, was Sie vorher wissen wollen."
      lead="Die Fragen, die uns am Telefon am häufigsten gestellt werden – ausführlich beantwortet. Wenn etwas fehlt: einfach anrufen."
      chips={['Kosten', 'Ablauf', 'Fristen', 'Rechte']}
      trail={[{ name: 'FAQ', href: '/faq' }]}
      faqs={FAQS}
      related={[
        { title: 'Unfallgutachten', text: 'Rechte und Positionen nach dem Unfall.', href: '/unfallgutachten' },
        { title: 'Ablauf', text: 'Der Weg von der Anfrage bis zur Auszahlung.', href: '/ablauf' },
        { title: 'Kontakt & Termin', text: 'Frage nicht dabei? Rufen Sie an.', href: '/kontakt' },
      ]}
    >
      <TwoCol
        eyebrow="Vorab"
        heading="Die zwei Sätze, die am meisten sparen."
        asideTitle="Kurz gesagt"
        asideItems={[
          'Sachverständigen wählen Sie selbst',
          'Kosten trägt bei Haftpflichtschäden die Gegenseite',
          'Termin nach Absprache',
          'Bei sehr kleinen Schäden reicht oft ein Kostenvoranschlag',
          'Vor-Ort-Service in Hannover und Umgebung',
        ]}
        icon="doc"
      >
        <p>
          Erstens: Nach einem unverschuldeten Unfall wählen <em>Sie</em> den Sachverständigen – und die gegnerische
          Versicherung trägt die Kosten. Zweitens: erst begutachten, dann reparieren. Wer diese Reihenfolge
          einhält, verliert später keine Ansprüche.
        </p>
        <p>
          Alles Weitere steht unten. Wenn Ihre Frage nicht dabei ist, rufen Sie an – wir geben Ihnen gern eine kurze Einschätzung am
          Telefon.
        </p>
      </TwoCol>
    </Landing>
  );
}
