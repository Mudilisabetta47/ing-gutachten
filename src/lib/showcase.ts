/**
 * Szenen der Sektion „Einblicke“. Nur echte, geprüfte Dateien aus public/assets/video eintragen.
 * Die Bildvorschauen (poster) sind bewusst Aufnahmen, die an anderer Stelle der Startseite nicht vorkommen.
 */
export type ShowcaseScene = {
  id: string; title: string; detail: string; poster: string;
  sources: { src: string; type: 'video/mp4' | 'video/webm' }[];
};
export const SHOWCASE_SCENES: ShowcaseScene[] = [
  { id: 'begutachtung', title: 'Genau hinsehen.', detail: 'Fahrzeug und Zustand systematisch erfassen.', poster: '/assets/img/showcase-begutachtung.jpg', sources: [{ src: '/assets/video/begutachtung.mp4', type: 'video/mp4' }] },
  { id: 'schadenaufnahme', title: 'Details festhalten.', detail: 'Schadenbilder und Messpunkte nachvollziehbar dokumentieren.', poster: '/assets/img/begutachtung-protokoll.webp', sources: [] },
  { id: 'beratung', title: 'Klarheit schaffen.', detail: 'Befunde verständlich erklären und nächste Schritte besprechen.', poster: '/assets/img/team-begutachtung.webp', sources: [] },
];
