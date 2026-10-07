/**
 * Zentrale Inhaltsquelle. Alles, was ohne Code-Änderung gepflegt werden soll,
 * steht hier – Navigation, Leistungen, Regionen, FAQ, Ablauf.
 */

export { SITE_URL } from './site';

export const BIZ = {
  name: 'ING Gutachten – KFZ-Sachverständigenbüro Hannover',
  short: 'ING GUTACHTEN',
  street: 'Hildesheimer Straße 229',
  zip: '30519',
  city: 'Hannover',
  phoneDisplay: '0511 – 543 00 976',
  phoneLink: '+4951154300976',
  mobileDisplay: '0173 – 72 79 763',
  mobileLink: '+491737279763',
  /**
   * VORHANDEN, ABER NICHT VERIFIZIERT (siehe BIZ_VERIFIED).
   * Wird angezeigt, bis der Betreiber die Angabe bestätigt – bitte prüfen.
   */
  email: 'info@ing-gutachten.de',
  /** Nicht verifiziert → wird weder angezeigt noch im Schema ausgegeben. */
  hours: null as string | null,
  hoursDraft: 'Mo – Fr 08:00 – 18:00 Uhr · Sa nach Vereinbarung',
  /** Näherungswerte, nicht verifiziert → nicht im Schema, nur Kartenmitte. */
  lat: 52.3402,
  lng: 9.7742,
} as const;

/**
 * Verifizierungsstatus der Firmendaten. Erst wenn ein Wert `true` ist, wird er
 * in strukturierten Daten (JSON-LD) ausgegeben. Stand laut Projekt-README.
 */
export const BIZ_VERIFIED = {
  address: true,
  phone: true,
  email: false,
  hours: false,
  geo: false,
  legal: false,
} as const;

/**
 * Belegte Kernfakten (README, Abschnitt „Vor dem Livegang prüfen").
 * Nur diese Aussagen dürfen als Tatsachen auf der Seite stehen.
 */
export const VERIFIED_FACTS = [
  { value: '15+', label: 'Jahre Erfahrung' },
  { value: 'Vor Ort', label: 'Besichtigung bei Ihnen' },
  { value: 'Messtechnik', label: 'Achs- & Karosserievermessung' },
] as const;

/** Optional: echte Google-Unternehmensprofil-URL → sameAs/hasMap im Schema. */
export const GOOGLE_PROFILE_URL = '';

export type NavItem = { label: string; href: string; children?: NavItem[] };

export const NAV: NavItem[] = [
  {
    label: 'Schadensgutachten',
    href: '/schadensgutachten',
    children: [
      { label: 'Schadengutachten', href: '/schadensgutachten' },
      { label: 'Unfallanalyse', href: '/unfallanalyse' },
      { label: 'PKW-Gutachten', href: '/pkw-gutachten' },
      { label: 'Unfallgutachten', href: '/unfallgutachten' },
      { label: 'Unfallrekonstruktion', href: '/unfallrekonstruktion' },
      { label: 'EDR-Systeme', href: '/edr-systeme' },
    ],
  },
  { label: 'Kfz-Gutachter Hannover', href: '/kfz-gutachter-hannover' },
  { label: 'Leistungen', href: '/leistungen' },
  { label: 'Ablauf', href: '/ablauf' },
  { label: 'Über uns', href: '/ueber-uns' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Kontakt', href: '/kontakt' },
];

/** Flache Liste aller Navigationsziele – für Sitemap und Link-Prüfung. */
export const NAV_FLAT: NavItem[] = NAV.flatMap((n) => (n.children ? [n, ...n.children] : [n]));
export type IconName =
  | 'car' | 'truck' | 'bolt' | 'bike' | 'classic' | 'dent'
  | 'shield' | 'clock' | 'pin' | 'scale' | 'doc' | 'ruler';

export type Service = {
  href: string;
  num: string;
  title: string;
  teaser: string;
  tags: string[];
  gradient: string;
  icon: IconName;
};

export const SERVICES: Service[] = [
  {
    href: '/pkw-gutachten',
    num: '01',
    title: 'PKW-Gutachten',
    teaser: 'Unfall- und Schadengutachten für Pkw und Transporter – beweissicher dokumentiert.',
    tags: ['Unfallschaden', 'Wertminderung', 'Nutzungsausfall'],
    gradient: 'linear-gradient(150deg,#1c242d,#0b0e12 62%)',
    icon: 'car',
  },
  {
    href: '/lkw-gutachten',
    num: '02',
    title: 'LKW & Nutzfahrzeuge',
    teaser: 'Gutachten für Transporter, LKW und Anhänger – inklusive Ausfall- und Ladungsfragen.',
    tags: ['Nutzfahrzeuge', 'Anhänger', 'Flotten'],
    gradient: 'linear-gradient(150deg,#1a232b,#0a0d11 62%)',
    icon: 'truck',
  },
  {
    href: '/e-auto-hybrid-gutachten',
    num: '03',
    title: 'Elektro & Hybrid',
    teaser: 'Spezialisierte Begutachtung moderner Elektro- und Hybridfahrzeuge inklusive Hochvoltsystem.',
    tags: ['Hochvolt', 'Batterie', 'Assistenzsysteme'],
    gradient: 'linear-gradient(150deg,#14232a,#0a0d11 62%)',
    icon: 'bolt',
  },
  {
    href: '/motorrad-gutachten',
    num: '04',
    title: 'Motorrad',
    teaser: 'Gutachten für Motorräder, Roller und Krafträder – auch bei Sturz- und Kleinschäden.',
    tags: ['Sturzschaden', 'Anbauteile', 'Wertgutachten'],
    gradient: 'linear-gradient(150deg,#1e2129,#0b0d11 62%)',
    icon: 'bike',
  },
  {
    href: '/oldtimer-gutachten',
    num: '05',
    title: 'Oldtimer',
    teaser: 'Wertgutachten und Zustandsdokumentation klassischer Fahrzeuge – belastbar für Versicherer.',
    tags: ['Marktwert', 'Zustandsnote', 'Dokumentation'],
    gradient: 'linear-gradient(150deg,#17202b,#0b0d11 62%)',
    icon: 'classic',
  },
];

export type Region = {
  name: string;
  x: number;
  y: number;
  note: string;
  slug?: string;
};

export const REGIONS: Region[] = [
  { name: 'Hannover-Mitte', x: 50, y: 47, note: 'Innenstadt, Calenberger Neustadt und Zooviertel.' },
  { name: 'List / Oststadt', x: 57, y: 36, note: 'Oststadt und List – Besichtigung vor Ort, auch am Abstellort.' },
  { name: 'Linden', x: 39, y: 50, note: 'Linden-Nord, -Mitte und -Süd inklusive Limmer und Ahlem.' },
  { name: 'Döhren / Wülfel', x: 55, y: 63, note: 'Unser Büro liegt in der Hildesheimer Straße – kurze Wege.' },
  { name: 'Bothfeld / Isernhagen-Süd', x: 66, y: 28, note: 'Begutachtung in Wohnstraßen, Höfen und auf Firmengeländen.' },
  { name: 'Misburg / Anderten', x: 75, y: 45, note: 'Gewerbegebiete und Nutzfahrzeuge – Besichtigung vor Ort.' },
  { name: 'Laatzen', x: 58, y: 76, note: 'Laatzen, Rethen und Gleidingen.', slug: 'laatzen' },
  { name: 'Langenhagen', x: 52, y: 17, note: 'Inklusive Flughafenumfeld, Godshorn und Kaltenweide.', slug: 'langenhagen' },
  { name: 'Garbsen', x: 27, y: 30, note: 'Garbsen, Berenbostel und Havelse.', slug: 'garbsen' },
  { name: 'Seelze', x: 24, y: 44, note: 'Seelze, Letter und Almhorst.', slug: 'seelze' },
  { name: 'Wunstorf', x: 12, y: 36, note: 'Wunstorf und Steinhuder-Meer-Region.', slug: 'wunstorf' },
  { name: 'Pattensen', x: 44, y: 86, note: 'Pattensen, Koldingen und Schulenburg.', slug: 'pattensen' },
];

export const REGION_PAGES = REGIONS.filter((r): r is Region & { slug: string } => Boolean(r.slug));

export type Faq = { q: string; a: string };

export const FAQS: Faq[] = [
  {
    q: 'Wann brauche ich einen Kfz-Gutachter?',
    a: 'Nach einem Unfall, den jemand anderes verursacht hat, und wenn der Schaden über Kleinstschäden hinausgeht. Auch zur Bewertung von Fahrzeugwert, Wertminderung oder Vorschäden ist ein Gutachten sinnvoll. Im Zweifel rufen Sie an – wir sagen Ihnen, ob ein Gutachten oder ein Kostenvoranschlag der bessere Weg ist.',
  },
  {
    q: 'Wer trägt die Kosten für das Gutachten?',
    a: 'Bei einem Haftpflichtschaden, den die Gegenseite verursacht hat, gehören die Sachverständigenkosten in der Regel zum erstattungsfähigen Schaden. Bei einem Kaskoschaden beauftragt meist Ihr eigener Versicherer die Begutachtung. Wie es in Ihrem Fall aussieht, klären wir vorab mit Ihnen.',
  },
  {
    q: 'Wie schnell kann mein Fahrzeug begutachtet werden?',
    a: 'Rufen Sie uns an oder senden Sie die Anfrage über das Formular – wir stimmen den Termin mit Ihnen ab. Auf Wunsch kommen wir zu Ihnen: nach Hause, an den Arbeitsplatz, in die Werkstatt oder zum Abstellort.',
  },
  {
    q: 'Wer darf den Kfz-Sachverständigen aussuchen?',
    a: 'Bei einem unverschuldeten Unfall wählen Sie den Sachverständigen selbst – nicht die gegnerische Versicherung. Sie sind nicht verpflichtet, einen von der Versicherung geschickten Prüfer zu akzeptieren.',
  },
  {
    q: 'Was steht in einem Schadengutachten?',
    a: 'Schadenumfang und Reparaturweg, kalkulierte Reparaturkosten, Wiederbeschaffungs- und Restwert, merkantile Wertminderung, Nutzungsausfall beziehungsweise Mietwagenklasse, Vorschäden sowie eine vollständige Fotodokumentation.',
  },
  {
    q: 'Ab welcher Schadenhöhe lohnt sich ein Gutachten?',
    a: 'Bei sehr kleinen Schäden, den sogenannten Bagatellschäden, kann ein Kostenvoranschlag ausreichen. Wo diese Grenze liegt, hängt vom Einzelfall ab. Wir sagen Ihnen ehrlich, was in Ihrem Fall sinnvoll ist.',
  },
  {
    q: 'Kommen Sie zu mir vor Ort?',
    a: 'Ja, Vor-Ort-Service ist Teil unseres Angebots. Wir begutachten in Hannover und Umgebung – zu Hause, am Arbeitsplatz, in der Werkstatt oder am Unfallort.',
  },
  {
    q: 'Begutachten Sie auch Elektro- und Hybridfahrzeuge?',
    a: 'Ja. Bei Elektro- und Hybridfahrzeugen kommen Hochvoltsystem, Batteriegehäuse und Ladetechnik hinzu. Diese Punkte werden im Gutachten ausdrücklich bewertet.',
  },
  {
    q: 'Was ist eine merkantile Wertminderung?',
    a: 'Der Betrag, um den Ihr Fahrzeug nach einem fachgerecht reparierten Unfallschaden am Markt weniger wert ist, weil es als Unfallwagen gilt. Diese Position wird häufig übersehen und gehört ins Gutachten.',
  },
  {
    q: 'Was mache ich direkt nach dem Unfall?',
    a: 'Unfallstelle sichern, Personen versorgen, bei Bedarf Polizei rufen. Danach Fotos aus mehreren Abständen machen, Daten der Beteiligten und Kennzeichen notieren, nichts unterschreiben, was Sie nicht verstehen – und den Sachverständigen einschalten, bevor die Reparatur beginnt.',
  },
  {
    q: 'Wie lange dauert die Erstellung des Gutachtens?',
    a: 'Nach der Besichtigung erstellen wir das Gutachten zeitnah. Den genauen Zeitrahmen nennen wir Ihnen bei der Terminvereinbarung, weil er vom Umfang des Schadens abhängt.',
  },
];

/** Die drei wichtigsten Fragen für die Startseite. */
export const HOME_FAQS: Faq[] = FAQS.slice(0, 3);

export type FlowStep = {
  num: string;
  title: string;
  text: string;
};

export const FLOW_STEPS: FlowStep[] = [
  { num: '01', title: 'Anfrage', text: 'Anruf oder Formular – mit ein paar Fotos.' },
  { num: '02', title: 'Besichtigung', text: 'Vor Ort bei Ihnen: Aufnahme, Fotos, Messung.' },
  { num: '03', title: 'Gutachten', text: 'Kosten, Wert und Wertminderung – nachvollziehbar belegt.' },
  { num: '04', title: 'Regulierung', text: 'Auf Wunsch direkt an Versicherung und Anwalt.' },
];

export const WHY_ITEMS: { icon: IconName; title: string; text: string; stat?: string }[] = [
  { icon: 'shield', title: 'Unabhängig bewertet', text: 'Ihr Auftrag, Ihr Gutachten.' },
  { icon: 'doc', title: 'Jahre Erfahrung', text: 'Routine bei Schadenbild und Vorschäden.', stat: '15+' },
  { icon: 'pin', title: 'Vor Ort', text: 'Wir kommen zu Ihnen in Hannover und Umgebung.' },
  { icon: 'ruler', title: 'Gemessen, nicht geschätzt', text: 'Achs- und Karosserievermessung mit Werten.' },
];

export type DamageZone = {
  key: string;
  index: string;
  title: string;
  text: string;
  checks: string[];
  kind: string;
  href: string;
  x: number;
  y: number;
};

export const DAMAGE_ZONES: DamageZone[] = [
  { key: 'front', index: 'ZONE 01', title: 'Front', x: 50, y: 7, text: 'Mehr als Blech: Sensorik und Träger.', checks: ['Sensorik', 'Längsträger', 'Kalibrierung'], kind: 'Unfallgutachten', href: '/unfallgutachten' },
  { key: 'side', index: 'ZONE 02', title: 'Seite', x: 13, y: 44, text: 'Türen, Schweller und Säulen.', checks: ['Spaltmaße', 'Säulen', 'Rückhaltesysteme'], kind: 'Schadengutachten', href: '/schadensgutachten' },
  { key: 'rear', index: 'ZONE 03', title: 'Heck', x: 50, y: 93, text: 'Auffahrunfall: oft mehr verzogen als sichtbar.', checks: ['Heckabschluss', 'Ladeboden', 'Anhängerkupplung'], kind: 'PKW-Gutachten', href: '/pkw-gutachten' },
  { key: 'paint', index: 'ZONE 04', title: 'Lack', x: 80, y: 63, text: 'Schichtdicke statt Schätzung.', checks: ['Schichtdicke', 'Beilackierung', 'Vorschäden'], kind: 'Schadengutachten', href: '/schadensgutachten' },
  { key: 'chassis', index: 'ZONE 05', title: 'Fahrwerk', x: 20, y: 78, text: 'Verzug an der Achse sieht man nicht.', checks: ['Achsvermessung', 'Lenkung', 'Räder'], kind: 'Unfallanalyse', href: '/unfallanalyse' },
  { key: 'structure', index: 'ZONE 06', title: 'Struktur', x: 50, y: 50, text: 'Tragende Teile bestimmen den Reparaturweg.', checks: ['Karosserievermessung', 'Bodengruppe', 'Reparaturweg'], kind: 'Unfallgutachten', href: '/unfallgutachten' },
];

export { REQUEST_REASONS, REQUEST_VEHICLES } from './request-schema';

export const TICKER_ITEMS = [
  'Unfallgutachten', 'Wertgutachten', 'Achs- & Karosserievermessung', 'Restwertermittlung',
  'Wertminderung', 'Nutzungsausfall', 'Oldtimer-Bewertung', 'Elektro & Hybrid', 'Unfallanalyse',
];


/** Anfrageformular → Route Handler (siehe src/app/api/anfrage/route.ts). */
export const FORM_ENDPOINT = '/api/anfrage';

/* =====================================================================
   Schadensgutachten-Cluster
   ===================================================================== */

export const ASSESSMENT_PAGES: { href: string; title: string; teaser: string; icon: IconName }[] = [
  { href: '/unfallanalyse', title: 'Unfallanalyse', teaser: 'Technische Auswertung von Fahrzeugzustand, Schadenbild und verfügbaren Daten.', icon: 'ruler' },
  { href: '/pkw-gutachten', title: 'PKW-Gutachten', teaser: 'Vollständige Aufnahme, Kalkulation und Bewertung für Pkw und Transporter.', icon: 'car' },
  { href: '/unfallgutachten', title: 'Unfallgutachten', teaser: 'Beweissichere Dokumentation nach dem Unfall – für Versicherung und Anwalt.', icon: 'doc' },
  { href: '/unfallrekonstruktion', title: 'Unfallrekonstruktion', teaser: 'Rekonstruktion des Ablaufs aus Spurenlage, Schadenbild und Fahrzeugpositionen.', icon: 'scale' },
  { href: '/edr-systeme', title: 'EDR-Systeme', teaser: 'Ereignisbezogene Fahrzeugdaten – abhängig von Fahrzeug, System und Zugriff.', icon: 'bolt' },
];

/** Fahrzeugklassen für den visuellen Selektor. */
export const VEHICLE_CATEGORIES: {
  key: string;
  title: string;
  icon: IconName;
  href: string;
  note: string;
  details: string[];
}[] = [
  {
    key: 'pkw', title: 'Personenkraftwagen', icon: 'car', href: '/pkw-gutachten',
    note: 'Pkw und Transporter aller Marken.',
    details: ['Karosserie- und Achsvermessung', 'Assistenzsysteme und Kalibrierung', 'Wertminderung und Restwert'],
  },
  {
    key: 'ev', title: 'Elektrofahrzeuge', icon: 'bolt', href: '/e-auto-hybrid-gutachten',
    note: 'Mit Blick auf Batterie und Hochvoltsystem.',
    details: ['Batteriegehäuse und Unterboden', 'Hochvoltpfad und Ladetechnik', 'Thermomanagement'],
  },
  {
    key: 'bike', title: 'Motorräder', icon: 'bike', href: '/motorrad-gutachten',
    note: 'Krafträder, Roller und Zubehör.',
    details: ['Rahmen- und Gabelgeometrie', 'Anbauteile und Umbauten', 'Schutzkleidung'],
  },
  {
    key: 'classic', title: 'Klassische Fahrzeuge', icon: 'classic', href: '/oldtimer-gutachten',
    note: 'Oldtimer und Youngtimer.',
    details: ['Zustandsnote und Originalität', 'Restaurierungsstand', 'Markt- und Versicherungswert'],
  },
];

/** Sensorpunkte am Fahrzeug (Prozentwerte auf der Silhouette). */
export const SENSOR_POINTS: { x: number; y: number; label: string; kind: 'radar' | 'kamera' | 'ultraschall' }[] = [
  { x: 92, y: 62, label: 'Frontradar', kind: 'radar' },
  { x: 86, y: 44, label: 'Frontkamera', kind: 'kamera' },
  { x: 96, y: 74, label: 'Parksensoren vorn', kind: 'ultraschall' },
  { x: 50, y: 40, label: 'Innenspiegelkamera', kind: 'kamera' },
  { x: 22, y: 52, label: 'Totwinkelradar', kind: 'radar' },
  { x: 8, y: 72, label: 'Parksensoren hinten', kind: 'ultraschall' },
  { x: 12, y: 44, label: 'Rückfahrkamera', kind: 'kamera' },
];

/** Datenfluss der EDR-Darstellung. */
export const EDR_STEPS: { title: string; text: string }[] = [
  { title: 'Fahrzeug', text: 'Steuergeräte erfassen im Fahrbetrieb laufend Zustandsgrößen.' },
  { title: 'Ereignis', text: 'Bei einem auslösenden Ereignis kann ein kurzes Zeitfenster gesichert werden.' },
  { title: 'Auslesen', text: 'Sofern Fahrzeug, System und Berechtigung es zulassen, lassen sich diese Daten auslesen.' },
  { title: 'Auswertung', text: 'Die Werte werden mit Spurenlage und Schadenbild abgeglichen.' },
];

/** Beispielhafte Kennwerte für das Datenpanel – stammen aus keinem realen Fall und werden überall als „Beispiel“ gekennzeichnet. */
export const DATA_READOUTS: { label: string; value: string; unit: string }[] = [
  { label: 'Geschwindigkeit', value: '48', unit: 'km/h' },
  { label: 'Bremsdruck', value: '82', unit: '%' },
  { label: 'Gurtstatus', value: 'angelegt', unit: '' },
  { label: 'Δv Aufprall', value: '17', unit: 'km/h' },
  { label: 'Lenkwinkel', value: '-12', unit: '°' },
  { label: 'Auslösung', value: 'Stufe 1', unit: '' },
];

/** Regulierungsablauf. */
export const SETTLEMENT_STEPS: { title: string; text: string }[] = [
  { title: 'Schaden', text: 'Der Schaden wird gemeldet und das Fahrzeug für die Besichtigung bereitgestellt.' },
  { title: 'Gutachten', text: 'Wir nehmen auf, messen, kalkulieren und erstellen das Gutachten.' },
  { title: 'Versicherung', text: 'Das Gutachten geht an die regulierende Versicherung und auf Wunsch an Ihren Anwalt.' },
  { title: 'Prüfung', text: 'Die Versicherung prüft. Bei Kürzungen nehmen wir fachlich Stellung.' },
  { title: 'Regulierung', text: 'Die Zahlung erfolgt – als Reparaturfreigabe oder auf Gutachtenbasis.' },
];

export const SETTLEMENT_WEEKS: { week: string; text: string }[] = [
  { week: 'Woche 1', text: 'Besichtigung, Gutachtenerstellung, Versand an die Versicherung.' },
  { week: 'Woche 2', text: 'Eingangsprüfung und Aktenanlage beim Versicherer.' },
  { week: 'Woche 3', text: 'Sachbearbeitung, gegebenenfalls Rückfragen oder eigene Prüfung.' },
  { week: 'Woche 4', text: 'Regulierungsentscheidung und Zahlungsanweisung.' },
];

/**
 * Video im Bereich Schadenregulierung.
 * Datei unter public/assets/video/ ablegen und hier eintragen.
 * Solange src leer ist, zeigt die Komponente einen sauberen Platzhalter
 * statt eines kaputten Players.
 */
export const SETTLEMENT_VIDEO = {
  src: '',
  poster: '/assets/img/begutachtung-protokoll.webp',
  title: 'Schadenregulierung erklärt',
  caption: 'ING Gutachten · Hannover',
};

/* =====================================================================
   Leistungs-Gruppierung für die Startseite und Strukturdaten
   ===================================================================== */

export type HomeService = {
  num: string;
  title: string;
  line: string;
  href: string;
  sub?: { label: string; href: string }[];
};

export const HOME_SERVICES: HomeService[] = [
  { num: '01', title: 'Unfallgutachten', line: 'Beweissicher nach dem Unfall.', href: '/unfallgutachten' },
  { num: '02', title: 'Schadengutachten', line: 'Schaden, Kosten, Wertminderung.', href: '/schadensgutachten' },
  { num: '03', title: 'PKW-Gutachten', line: 'Pkw und Transporter.', href: '/pkw-gutachten' },
  {
    num: '04',
    title: 'Unfallanalyse',
    line: 'Technisch ausgewertet.',
    href: '/unfallanalyse',
    sub: [
      { label: 'Unfallrekonstruktion', href: '/unfallrekonstruktion' },
      { label: 'EDR-Systeme', href: '/edr-systeme' },
    ],
  },
  {
    num: '05',
    title: 'Weitere Fahrzeuge',
    line: 'Auch jenseits des Pkw.',
    href: '/leistungen',
    sub: [
      { label: 'LKW', href: '/lkw-gutachten' },
      { label: 'Elektro & Hybrid', href: '/e-auto-hybrid-gutachten' },
      { label: 'Motorrad', href: '/motorrad-gutachten' },
      { label: 'Oldtimer', href: '/oldtimer-gutachten' },
      { label: 'Wertgutachten', href: '/wertgutachten' },
    ],
  },
];

/** Alle Leistungsseiten – Grundlage für Sitemap, Schema und interne Links. */
export const SERVICE_PAGES: { href: string; title: string }[] = [
  { href: '/schadensgutachten', title: 'Schadengutachten' },
  { href: '/unfallgutachten', title: 'Unfallgutachten' },
  { href: '/pkw-gutachten', title: 'PKW-Gutachten' },
  { href: '/unfallanalyse', title: 'Unfallanalyse' },
  { href: '/unfallrekonstruktion', title: 'Unfallrekonstruktion' },
  { href: '/edr-systeme', title: 'EDR-Systeme' },
  { href: '/wertgutachten', title: 'Wertgutachten' },
  { href: '/lkw-gutachten', title: 'LKW-Gutachten' },
  { href: '/e-auto-hybrid-gutachten', title: 'Elektro & Hybrid' },
  { href: '/motorrad-gutachten', title: 'Motorrad-Gutachten' },
  { href: '/oldtimer-gutachten', title: 'Oldtimer-Gutachten' },
];

/* =====================================================================
   Regionalseiten: eigenständige, überprüfbare Ortsangaben
   (nur Geografie – keine erfundenen Einsatzzahlen oder Zeitversprechen)
   ===================================================================== */

export type RegionProfile = {
  /** Lage relativ zu Hannover bzw. zum Büro. */
  where: string;
  /** Ortsteile bzw. Gebiete, die abgedeckt werden. */
  areas: string[];
  /** Typische Besichtigungsorte – allgemein gehalten. */
  places: string;
  /** Nachbarorte für die interne Verlinkung. */
  near: string[];
};

export const REGION_PROFILES: Record<string, RegionProfile> = {
  laatzen: {
    where: 'Laatzen grenzt direkt südlich an Hannover und damit auch an den Stadtteil Döhren-Wülfel, in dem unser Büro liegt.',
    areas: ['Laatzen', 'Rethen', 'Gleidingen'],
    places: 'Wohnstraßen, Firmengelände und Werkstätten im Stadtgebiet Laatzen',
    near: ['pattensen', 'seelze'],
  },
  langenhagen: {
    where: 'Langenhagen liegt nördlich von Hannover; im Stadtgebiet befindet sich der Flughafen Hannover.',
    areas: ['Langenhagen', 'Godshorn', 'Kaltenweide', 'Flughafenumfeld'],
    places: 'Gewerbegebiete, Wohngebiete und Abstellplätze rund um das Flughafenumfeld',
    near: ['garbsen', 'laatzen'],
  },
  garbsen: {
    where: 'Garbsen schließt sich nordwestlich an Hannover an.',
    areas: ['Garbsen', 'Berenbostel', 'Havelse'],
    places: 'Wohnstraßen, Betriebshöfe und Werkstätten in den Garbsener Ortsteilen',
    near: ['langenhagen', 'seelze'],
  },
  seelze: {
    where: 'Seelze liegt westlich von Hannover zwischen Stadtgebiet und Wunstorf.',
    areas: ['Seelze', 'Letter', 'Almhorst'],
    places: 'Wohngebiete, Werkstätten und Gewerbeflächen in Seelze und Letter',
    near: ['garbsen', 'wunstorf'],
  },
  wunstorf: {
    where: 'Wunstorf liegt westlich von Hannover, nahe dem Steinhuder Meer.',
    areas: ['Wunstorf', 'Steinhuder-Meer-Region'],
    places: 'Wohnadressen, Werkstätten und Betriebe in Wunstorf und Umgebung',
    near: ['seelze', 'garbsen'],
  },
  pattensen: {
    where: 'Pattensen liegt südlich von Hannover.',
    areas: ['Pattensen', 'Koldingen', 'Schulenburg'],
    places: 'Wohnadressen, Höfe und Werkstätten in Pattensen und den Ortsteilen',
    near: ['laatzen', 'seelze'],
  },
};
