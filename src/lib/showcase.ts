/**
 * Szenen der Sektion „Einblicke“. Nur echte, geprüfte Dateien aus public/assets/video eintragen.
 * Das Begutachtungsvideo läuft im Hero (HERO_SCENES) und wird hier bewusst nicht wiederholt; die Bilder kommen sonst nicht auf der Startseite vor.
 */
export type ShowcaseScene = {
  id: string; title: string; detail: string; poster: string;
  sources: { src: string; type: 'video/mp4' | 'video/webm' }[];
};
export const SHOWCASE_SCENES: ShowcaseScene[] = [
  { id: 'schadenaufnahme', title: 'Details festhalten.', detail: 'Schadenbilder und Messpunkte nachvollziehbar dokumentieren.', poster: '/assets/img/begutachtung-protokoll.webp', sources: [] },
  { id: 'beratung', title: 'Klarheit schaffen.', detail: 'Befunde verständlich erklären und nächste Schritte besprechen.', poster: '/assets/img/team-begutachtung.webp', sources: [] },
];

/** Clips für den Hintergrund der Startseite (Slider, sobald mehr als einer eingetragen ist). Nur echte, geprüfte Dateien aus public/assets/video. */
export type HeroScene = { id: string; src: string; poster: string; /** Responsive WebP-Fassungen des Posters (kleine Datei für Smartphones). */ posterSet?: { src: string; w: number }[] };
export const HERO_SCENES: HeroScene[] = [
  { id: 'begutachtung', src: '/assets/video/begutachtung.mp4', poster: '/assets/img/showcase-begutachtung.jpg', posterSet: [{ src: '/assets/img/showcase-begutachtung-640.webp', w: 640 }, { src: '/assets/img/showcase-begutachtung-1280.webp', w: 1280 }] },
];
