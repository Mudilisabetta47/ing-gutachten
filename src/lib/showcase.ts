/** Only attach media after the real, reviewed files have been added to public/assets/video. */
export type ShowcaseScene = {
  id: string; title: string; detail: string; poster: string;
  sources: { src: string; type: 'video/mp4' | 'video/webm' }[];
};
export const SHOWCASE_SCENES: ShowcaseScene[] = [
  { id: 'begutachtung', title: 'Genau hinsehen.', detail: 'Fahrzeug und Zustand systematisch erfassen.', poster: '/assets/img/pruefstand-halle.webp', sources: [] },
  { id: 'schadenaufnahme', title: 'Details festhalten.', detail: 'Schadenbilder und Messpunkte nachvollziehbar dokumentieren.', poster: '/assets/img/begutachtung-protokoll.webp', sources: [] },
  { id: 'auswertung', title: 'Zusammenhänge verstehen.', detail: 'Aufnahmen und Befunde zu einem Gutachten zusammenführen.', poster: '/assets/img/car-hero.svg', sources: [] },
  { id: 'beratung', title: 'Klarheit schaffen.', detail: 'Befunde verständlich erklären und nächste Schritte besprechen.', poster: '/assets/img/team-begutachtung.webp', sources: [] },
];

/** Clips für den Hintergrund der Startseite (Slider, sobald mehr als einer eingetragen ist). Nur echte, geprüfte Dateien aus public/assets/video. */
export type HeroScene = { id: string; src: string; poster: string };
export const HERO_SCENES: HeroScene[] = [
  { id: 'begutachtung', src: '/assets/video/begutachtung.mp4', poster: '/assets/img/showcase-begutachtung.jpg' },
];
