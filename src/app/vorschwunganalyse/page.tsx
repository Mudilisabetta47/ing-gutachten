import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { ReviewNote } from '@/components/ui/ReviewNote';
import { TwoCol } from '@/components/sections/TwoCol';
import { buildMetadata } from '@/lib/seo';

/**
 * PLATZHALTER – bewusst ohne fachliche Aussagen.
 * OFFEN (Rückfrage an Ekrem): Was genau bedeutet „Vorschwunganalyse“? Der Begriff ist in der Unfallanalyse und im
 * Kfz-Sachverständigenwesen nicht als feststehender Fachbegriff bekannt. Mögliche Lesarten (nur zur Klärung, NICHT
 * veröffentlichen): Vorschadenanalyse · Analyse der Vorkollisionsphase (Annäherung, Bremsung, Ausweichen) ·
 * Bewegungen/„Schwung“ des Fahrzeugs vor dem Anstoß. Bis zur Bestätigung: noindex, nicht in der Sitemap.
 * Siehe docs/EKREM-ANFORDERUNGEN-ABGLEICH.md.
 */
const DESCRIPTION = 'Leistungsbeschreibung in Vorbereitung.';

export const metadata: Metadata = buildMetadata({
  title: 'Vorschwunganalyse | Leistungsbeschreibung in Vorbereitung',
  description: DESCRIPTION,
  path: '/vorschwunganalyse',
  noindex: true,
});

export default function Page() {
  return (
    <Landing
      eyebrow="Unfallanalyse"
      title="Vorschwunganalyse."
      lead="Zu dieser Leistung stellen wir derzeit eine ausführliche Beschreibung zusammen. Wenn Sie Fragen zu Ihrem Fall haben, sprechen Sie uns gern direkt an."
      trail={[
        { name: 'Unfallanalyse', href: '/unfallanalyse' },
        { name: 'Vorschwunganalyse', href: '/vorschwunganalyse' },
      ]}
      related={[
        { title: 'Unfallanalyse', text: 'Technische Auswertung von Schadenbild und Fahrzeugzustand.', href: '/unfallanalyse' },
        { title: 'EDR-Systeme', text: 'Ereignisbezogene Fahrzeugdaten und ihre Grenzen.', href: '/edr-systeme' },
        { title: 'Unfallrekonstruktion', text: 'Rekonstruktion des Ablaufs aus Positionen und Vektoren.', href: '/unfallrekonstruktion' },
      ]}
    >
      <ReviewNote topic="Leistung „Vorschwunganalyse“ (Begriff noch ungeklärt, Seite bleibt noindex)" />
      <TwoCol
        eyebrow="In Vorbereitung"
        heading="Ausführliche Informationen folgen."
        asideTitle="Bereits verfügbar"
        asideItems={[
          'Technische Auswertung von Schadenbild und Fahrzeugzustand',
          'Plausibilitätsprüfung des geschilderten Hergangs',
          'Auswertung verfügbarer Fahrzeugdaten',
        ]}
        icon="ruler"
      >
        <p className="notice">Die Leistungsbeschreibung wird in Kürze ergänzt.</p>
        <p>
          Welche Grundlagen in Ihrem Fall vorhanden sind und welches Vorgehen sinnvoll ist, klären wir gern
          im persönlichen Gespräch.
        </p>
      </TwoCol>
    </Landing>
  );
}
