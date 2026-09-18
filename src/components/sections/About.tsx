import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';

const POINTS = [
  { title: 'Hausgemacht', text: 'Gebäck, Kuchen und Desserts entstehen in unserer eigenen Küche — jeden Tag neu.' },
  { title: 'Handwerk beim Kaffee', text: 'Von der Röstung bis zum Aufguss: Wir nehmen uns Zeit für jede Tasse.' },
  { title: 'Ein Zuhause auf Zeit', text: 'Ob kurzer Espresso oder langer Nachmittag — Rose Café ist zum Verweilen gedacht.' },
];

export function About() {
  return (
    <section id="about" className="section bg-bone" aria-labelledby="about-h">
      <div className="shell">
        <Slug left="Über uns" right="Rose Café · Bremen" />
        <div className="grid gap-[clamp(2rem,5vw,5rem)] lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="eyebrow mb-6">Wer wir sind</p>
            <Reveal mode="up">
              <h2 id="about-h" className="display text-h2">
                Café,
                <br />
                nicht Konzept.
              </h2>
            </Reveal>
            <Reveal mode="soft" delay={120} className="mt-6">
              <p className="lead">
                Rose Café liegt mitten in Bremen-Schwachhausen. Wir glauben an gute Zutaten, ruhige Räume und
                Gastfreundschaft ohne Eile — an Vormittagen mit Zeitung und Espresso genauso wie an Nachmittagen
                mit Kuchen und Gesellschaft.
              </p>
            </Reveal>
          </div>

          <ul className="grid gap-5 content-start">
            {POINTS.map((p, i) => (
              <Reveal key={p.title} as="li" mode="up" delay={i * 90}>
                <div className="card">
                  <h3 className="font-display text-h3 font-medium">{p.title}</h3>
                  <p className="text-fg-dim">{p.text}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
