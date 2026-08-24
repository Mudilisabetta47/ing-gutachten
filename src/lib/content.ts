/**
 * Zentrale Inhaltsquelle. Alles, was ohne Code-Änderung gepflegt werden soll,
 * steht hier – Navigation, Leistungen, Regionen, FAQ, Ablauf.
 */

export const SITE_URL = 'https://ing-gutachten.de';

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
  /** TODO vor Livegang prüfen – nicht aus der Bestandsseite verifiziert. */
  email: 'info@ing-gutachten.de',
  /** TODO vor Livegang prüfen. */
  hours: 'Mo – Fr 08:00 – 18:00 Uhr · Sa nach Vereinbarung',
  lat: 52.3402,
  lng: 9.7742,
} as const;

export type NavItem = { label: string; href: string };

export const NAV: NavItem[] = [
  { label: 'Leistungen', href: '/leistungen' },
  { label: 'Schadenfall', href: '/unfallgutachten' },
  { label: 'Ablauf', href: '/ablauf' },
  { label: 'Über uns', href: '/ueber-uns' },
  { label: 'Einsatzgebiet', href: '/einsatzgebiet' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Kontakt', href: '/kontakt' },
];

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
    href: '/unfallgutachten',
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
    teaser: 'Gutachten für Motorräder, Roller und Krafträder – auch bei Sturz- und Bagatellschäden.',
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
    gradient: 'linear-gradient(150deg,#231d17,#0d0b09 62%)',
    icon: 'classic',
  },
  {
    href: '/bagatellschaeden',
    num: '06',
    title: 'Bagatellschäden',
    teaser: 'Kostenvoranschlag für kleinere Schäden – schnell, günstig und ohne Umwege.',
    tags: ['Parkschaden', 'Kratzer', 'Kurzfristig'],
    gradient: 'linear-gradient(150deg,#1b2028,#0a0d11 62%)',
    icon: 'dent',
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
  { name: 'Hannover-Mitte', x: 50, y: 47, note: 'Innenstadt, Calenberger Neustadt und Zooviertel – Vor-Ort-Termine meist am selben Tag.' },
  { name: 'List / Oststadt', x: 57, y: 36, note: 'Dichter Straßenverkehr, viele Parkrempler. Besichtigung auch am Straßenrand möglich.' },
  { name: 'Linden', x: 39, y: 50, note: 'Linden-Nord, -Mitte und -Süd inklusive Limmer und Ahlem.' },
  { name: 'Döhren / Wülfel', x: 55, y: 63, note: 'Direkt an unserem Büro in der Hildesheimer Straße – kürzeste Wege.' },
  { name: 'Bothfeld / Isernhagen-Süd', x: 66, y: 28, note: 'Begutachtung in Wohnstraßen, Höfen und auf Firmengeländen.' },
  { name: 'Misburg / Anderten', x: 75, y: 45, note: 'Gewerbegebiete und Nutzfahrzeuge – auch LKW-Termine vor Ort.' },
  { name: 'Laatzen', x: 58, y: 76, note: 'Laatzen, Rethen und Gleidingen – Vor-Ort-Service im gesamten Stadtgebiet.', slug: 'laatzen' },
  { name: 'Langenhagen', x: 52, y: 17, note: 'Inklusive Flughafenumfeld, Godshorn und Kaltenweide.', slug: 'langenhagen' },
  { name: 'Garbsen', x: 27, y: 30, note: 'Garbsen, Berenbostel und Havelse – Termine auch am Abend.', slug: 'garbsen' },
  { name: 'Seelze', x: 24, y: 44, note: 'Seelze, Letter und Almhorst.', slug: 'seelze' },
  { name: 'Wunstorf', x: 12, y: 36, note: 'Wunstorf und Steinhuder-Meer-Region.', slug: 'wunstorf' },
  { name: 'Pattensen', x: 44, y: 86, note: 'Pattensen, Koldingen und Schulenburg.', slug: 'pattensen' },
];

export const REGION_PAGES = REGIONS.filter((r): r is Region & { slug: string } => Boolean(r.slug));

export type Faq = { q: string; a: string };

export const FAQS: Faq[] = [
  {
    q: 'Wer darf den Kfz-Sachverständigen aussuchen?',
    a: 'Bei einem unverschuldeten Unfall wählen Sie den Sachverständigen selbst – nicht die gegnerische Versicherung. Sie sind nicht verpflichtet, einen von der Versicherung geschickten Prüfer zu akzeptieren. Ein unabhängiges Gutachten ist die Grundlage dafür, dass alle Positionen Ihres Schadens erfasst werden.',
  },
  {
    q: 'Wer trägt die Kosten für das Gutachten?',
    a: 'Bei einem Haftpflichtschaden, den die Gegenseite verursacht hat, gehören die Sachverständigenkosten zum erstattungsfähigen Schaden und werden von der gegnerischen Versicherung getragen. Bei einem Kaskoschaden beauftragt in der Regel Ihr eigener Versicherer die Begutachtung. Bei Bagatellschäden empfehlen wir einen Kostenvoranschlag – wir sagen Ihnen vorab, was in Ihrem Fall sinnvoll ist.',
  },
  {
    q: 'Wie schnell bekomme ich einen Termin?',
    a: 'Kurzfristig, in der Regel innerhalb von 24 bis 48 Stunden. Rufen Sie uns an oder senden Sie eine Anfrage über das Formular – auf Wunsch kommen wir zu Ihnen nach Hause, in die Werkstatt oder an den Abstellort.',
  },
  {
    q: 'Wie lange dauert die Erstellung des Gutachtens?',
    a: 'Nach der Besichtigung erstellen wir das Gutachten in der Regel innerhalb von ein bis zwei Werktagen. Sie erhalten es digital, die Versicherung und – wenn gewünscht – Ihr Anwalt bekommen es direkt von uns.',
  },
  {
    q: 'Ab welcher Schadenhöhe lohnt sich ein Gutachten?',
    a: 'Als Faustregel gilt eine Bagatellgrenze im Bereich von etwa 750 bis 1.000 Euro. Liegt der Schaden darunter, ist ein Kostenvoranschlag meist der richtige Weg. Darüber ist ein vollständiges Schadengutachten sinnvoll, weil nur so Wertminderung, Nutzungsausfall und Reparaturweg sauber belegt sind.',
  },
  {
    q: 'Was steht in einem Schadengutachten?',
    a: 'Schadenumfang und Reparaturweg, kalkulierte Reparaturkosten, Wiederbeschaffungs- und Restwert, merkantile Wertminderung, Nutzungsausfalldauer beziehungsweise Mietwagenklasse, Vorschäden sowie eine vollständige Fotodokumentation.',
  },
  {
    q: 'Kommen Sie zu mir vor Ort?',
    a: 'Ja. Der Vor-Ort-Service ist Standard, nicht Aufpreis. Wir begutachten in Hannover und der Region – zu Hause, am Arbeitsplatz, in der Werkstatt oder am Unfallort.',
  },
  {
    q: 'Begutachten Sie auch Elektro- und Hybridfahrzeuge?',
    a: 'Ja. Bei Elektro- und Hybridfahrzeugen kommen Besonderheiten hinzu: Hochvoltsystem, Batteriegehäuse, Ladetechnik und die Frage, ob nach einem Aufprall eine Batterieprüfung notwendig ist. Diese Punkte werden im Gutachten ausdrücklich bewertet.',
  },
  {
    q: 'Was ist eine merkantile Wertminderung?',
    a: 'Der Betrag, um den Ihr Fahrzeug nach einem fachgerecht reparierten Unfallschaden am Markt weniger wert ist – weil es beim Verkauf als Unfallwagen gilt. Diese Position wird häufig übersehen und gehört ins Gutachten.',
  },
  {
    q: 'Was mache ich direkt nach dem Unfall?',
    a: 'Unfallstelle sichern, Personen versorgen, bei Bedarf Polizei rufen. Danach: Fotos aus mehreren Abständen, Daten der Beteiligten und Kennzeichen notieren, nichts unterschreiben, was Sie nicht verstehen – und den Sachverständigen einschalten, bevor die Reparatur beginnt.',
  },
];

export type FlowStep = {
  num: string;
  title: string;
  text: string;
  when: string;
  duration: string;
};

export const FLOW_STEPS: FlowStep[] = [
  {
    num: '01',
    title: 'Kontakt & Ersteinschätzung',
    text: 'Sie rufen an oder senden die Anfrage mit ein paar Fotos. Wir klären in wenigen Minuten, ob ein vollständiges Gutachten oder ein Kostenvoranschlag der richtige Weg ist – und wer die Kosten trägt.',
    when: 'Tag 0',
    duration: '10 Minuten',
  },
  {
    num: '02',
    title: 'Vor-Ort-Besichtigung',
    text: 'Wir kommen zu Ihnen: nach Hause, in die Werkstatt, an den Unfallort. Schadenaufnahme, Fotodokumentation, Messungen an Karosserie und Achse, Prüfung von Vorschäden.',
    when: 'Tag 0–2',
    duration: '45–90 Minuten',
  },
  {
    num: '03',
    title: 'Gutachtenerstellung',
    text: 'Kalkulation der Reparaturkosten, Wiederbeschaffungs- und Restwert, merkantile Wertminderung, Nutzungsausfalldauer. Alles belegt und nachvollziehbar aufgebaut.',
    when: 'Tag 1–3',
    duration: '1–2 Werktage',
  },
  {
    num: '04',
    title: 'Übermittlung an Versicherung & Anwalt',
    text: 'Sie erhalten das Gutachten digital. Auf Wunsch geht es direkt an die gegnerische Versicherung und Ihren Anwalt – damit die Regulierung ohne Rückfragen startet.',
    when: 'Tag 2–4',
    duration: 'sofort nach Freigabe',
  },
  {
    num: '05',
    title: 'Schadensregulierung',
    text: 'Wir bleiben ansprechbar: bei Rückfragen des Versicherers, bei Kürzungsversuchen und bei der Frage, ob Reparatur, Ersatzbeschaffung oder Abrechnung auf Gutachtenbasis für Sie sinnvoll ist.',
    when: 'danach',
    duration: 'so lange es nötig ist',
  },
];

export const WHY_ITEMS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'shield', title: '100 % unabhängig', text: 'Keine Beteiligung von Versicherern, Werkstätten oder Autohäusern. Unser Auftraggeber sind Sie – niemand sonst.' },
  { icon: 'clock', title: 'Termin in 24–48 Stunden', text: 'Kurzfristige Terminvergabe, auch abends und am Wochenende nach Absprache. Bei nicht fahrbereiten Fahrzeugen kommen wir zum Standort.' },
  { icon: 'pin', title: 'Vor-Ort-Service inklusive', text: 'Hannover und Umland – zu Hause, am Arbeitsplatz, in der Werkstatt oder am Unfallort. Ohne Aufpreis für die Anfahrt.' },
  { icon: 'ruler', title: 'Achs- & Karosserievermessung', text: 'Messtechnik statt Sichtprüfung: Wir belegen Verzug an Achse und Karosserie mit Werten – nicht mit Vermutungen.' },
  { icon: 'scale', title: 'Abwicklung mit der Gegenseite', text: 'Wir kommunizieren direkt mit der gegnerischen Versicherung und Ihrem Anwalt und begründen jede Position, die gekürzt werden soll.' },
  { icon: 'doc', title: 'Über 15 Jahre Erfahrung', text: 'Tausende begutachtete Fahrzeuge vom Kleinwagen bis zum Nutzfahrzeug – und die Routine, Vorschäden von Neuschäden zu trennen.' },
];

export type DamageZone = {
  key: string;
  index: string;
  title: string;
  text: string;
  points: string[];
  x: number;
  y: number;
};

export const DAMAGE_ZONES: DamageZone[] = [
  {
    key: 'front', index: 'ZONE 01', title: 'Frontschaden', x: 50, y: 7,
    text: 'Stoßfänger, Kühlerpaket, Scheinwerfer und Assistenz-Sensorik: Frontschäden sind heute selten nur Blech. Wir dokumentieren jede betroffene Baugruppe einzeln.',
    points: ['Prüfung von Radar-, Kamera- und Ultraschall-Sensorik', 'Kalibrierungsaufwand der Assistenzsysteme wird beziffert', 'Beurteilung von Längsträger und Schlossträger'],
  },
  {
    key: 'side', index: 'ZONE 02', title: 'Seitenschaden', x: 13, y: 44,
    text: 'Türen, Schweller und Säulen bestimmen die Fahrzeugsteifigkeit. Wir unterscheiden klar zwischen Instandsetzung und notwendigem Teiletausch.',
    points: ['Spaltmaß- und Karosserievermessung', 'Beurteilung von Seitenairbags und Gurtstraffern', 'Lackangrenzende Bauteile werden mit erfasst'],
  },
  {
    key: 'rear', index: 'ZONE 03', title: 'Heckschaden', x: 50, y: 93,
    text: 'Der klassische Auffahrunfall. Auch bei scheinbar kleinem Schadenbild sind Heckabschlussblech und Ladeboden häufig verzogen.',
    points: ['Prüfung von Heckklappe, Schlossträger und Ladeboden', 'Anhängerkupplung und Verkabelung inklusive', 'Dokumentation für die gegnerische Haftpflicht'],
  },
  {
    key: 'paint', index: 'ZONE 04', title: 'Lackschaden', x: 80, y: 63,
    text: 'Schichtdickenmessung statt Schätzung. Wir belegen, ob nachlackiert wurde, wie tief der Schaden geht und welcher Lackaufbau notwendig ist.',
    points: ['Schichtdickenmessung an allen Anbauteilen', 'Beurteilung von Beilackierung und Farbtonangleich', 'Nachweis von Vorschäden und Altlackierungen'],
  },
  {
    key: 'chassis', index: 'ZONE 05', title: 'Fahrwerk & Achsen', x: 20, y: 78,
    text: 'Nach jeder Kollision mit Bordstein oder Fahrzeug gehört die Achsvermessung dazu. Verzogene Achsgeometrie ist von außen nicht sichtbar.',
    points: ['Achsvermessung mit Protokoll', 'Prüfung von Lenkung, Federbeinen und Radträgern', 'Bewertung von Reifen- und Felgenschäden'],
  },
  {
    key: 'structure', index: 'ZONE 06', title: 'Strukturschaden', x: 50, y: 50,
    text: 'Die entscheidende Frage bei größeren Schäden: Ist die tragende Struktur betroffen? Davon hängen Reparaturweg, Restwert und Wertminderung ab.',
    points: ['Karosserievermessung gegen Herstellersollwerte', 'Bewertung von Rahmen, Längsträgern und Bodengruppe', 'Klare Aussage zu Reparaturwürdigkeit und Totalschaden'],
  },
];

export const TICKER_ITEMS = [
  'Unfallgutachten', 'Wertgutachten', 'Achs- & Karosserievermessung', 'Restwertermittlung',
  'Wertminderung', 'Nutzungsausfall', 'Oldtimer-Bewertung', 'Elektro & Hybrid', 'Bagatellschäden',
];

export const REQUEST_REASONS = ['Unfall', 'Parkschaden', 'Wertgutachten', 'Fahrzeugbewertung', 'Leasingrückgabe', 'Sonstiges'];
export const REQUEST_VEHICLES = ['PKW', 'LKW', 'Motorrad', 'Elektro / Hybrid', 'Oldtimer'];

/**
 * Endpunkt für das Anfrageformular. Leer lassen = Fallback auf das
 * E-Mail-Programm des Nutzers. Siehe README, Abschnitt "Formular anschließen".
 */
export const FORM_ENDPOINT = '';
