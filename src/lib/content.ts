/**
 * Zentrale Inhaltsquelle für ROSE CAFÉ, Bremen.
 * Alles, was ohne Code-Änderung gepflegt werden soll, steht hier.
 *
 * WICHTIG: Öffnungszeiten, Telefonnummer, Adresse, Bewertungen und Preise
 * sind Platzhalter und MÜSSEN vor Livegang durch echte Daten ersetzt werden.
 * Es wurden bewusst keine Zahlen oder Zitate erfunden.
 */

export const SITE_URL = 'https://rose-cafe-bremen.de';

export const BIZ = {
  name: 'Rose Café Bremen',
  short: 'ROSE CAFÉ',
  street: '[Straße Hausnummer]',
  zip: '[PLZ]',
  city: 'Bremen',
  district: 'Schwachhausen',
  /** TODO vor Livegang: echte Telefonnummer eintragen. */
  phoneDisplay: '[Telefonnummer]',
  phoneLink: '+49000000000',
  /** TODO vor Livegang: echte E-Mail-Adresse eintragen. */
  email: 'info@rose-cafe-bremen.de',
  /** TODO vor Livegang: echte Öffnungszeiten eintragen. */
  hours: [
    { d: 'Montag – Freitag', t: '[Uhrzeit]' },
    { d: 'Samstag', t: '[Uhrzeit]' },
    { d: 'Sonntag', t: '[Uhrzeit]' },
  ],
  instagram: '@rosecafe.bremen',
  instagramHref: 'https://instagram.com',
  /** TODO vor Livegang: echte Koordinaten eintragen. */
  lat: 53.0793,
  lng: 8.8017,
} as const;

export type NavItem = { label: string; href: string };

export const NAV: NavItem[] = [
  { label: 'Story', href: '#story' },
  { label: 'Frühstück', href: '#food' },
  { label: 'Signature', href: '#signature' },
  { label: 'Atmosphäre', href: '#atmosphere' },
  { label: 'Bewertungen', href: '#reviews' },
  { label: 'Besuch uns', href: '#visit' },
];

/* =====================================================================
   FOOD STORY — die Speisekarte als Szenenfolge, nicht als Tabelle.
   Jede Phase bekommt Kamera-Fokus, eigene Lichtstimmung und Typografie.
   ===================================================================== */

/**
 * Die Speisekarte — 1:1 aus der Original-Speisekarte des Rose Café
 * übernommen (Gerichte, Preise, Beschreibungen). Keine erfundenen
 * Inhalte. Bei fehlenden Angaben (z. B. Brunch-Preise) steht ein
 * ausdrücklicher Platzhalter statt einer Zahl.
 */
export type MenuItem = { name: string; price?: string; note?: string };
export type MenuCategory = {
  key: string;
  num: string;
  title: string;
  tone: 'dawn' | 'roast' | 'sugar' | 'signature' | 'green' | 'drink';
  intro?: string;
  items: MenuItem[];
  footnote?: string;
};

export const MENU_CATEGORIES: MenuCategory[] = [
  {
    key: 'kaffee',
    num: '01',
    title: 'Kaffee',
    tone: 'roast',
    items: [
      { name: 'Espresso', price: '2,50 €' },
      { name: 'Espresso Doppelt', price: '3,50 €' },
      { name: 'Espresso Macchiato', price: '3,60 €' },
      { name: 'Americano', price: '3,00 €' },
      { name: 'Flat White', price: '4,50 €' },
      { name: 'Cappuccino', price: '4,20 €' },
      { name: 'Latte Macchiato', price: '4,50 €' },
      { name: 'Café con Leche', price: '3,50 €' },
      { name: 'Rose Latte', price: '4,90 €' },
      { name: 'Orientalisches Mocca', price: '3,00 €' },
      { name: 'Heiße Schokolade', price: '4,90 €' },
      { name: 'Chai Latte', price: '4,90 €' },
      { name: 'Café Crema', price: '2,50 €' },
    ],
  },
  {
    key: 'heissgetraenke',
    num: '02',
    title: 'Heißgetränke',
    tone: 'dawn',
    items: [
      { name: 'Schwarzer Tee', price: '3,00 €' },
      { name: 'Grüner Tee', price: '3,50 €' },
      { name: 'Frischer Minztee', price: '4,20 €' },
      { name: 'Rooibos Tee', price: '3,50 €' },
      { name: 'Ingwer-Tee', price: '4,20 €' },
      { name: 'Zitronen-Tee', price: '4,20 €' },
      { name: 'Vitaminbombe', price: '5,90 €' },
      { name: 'Capu-Schock', price: '4,80 €' },
    ],
  },
  {
    key: 'extras',
    num: '03',
    title: 'Extras & Milch',
    tone: 'dawn',
    items: [
      { name: 'Extra Shot Espresso', price: '1,00 €' },
      { name: 'Haferdrink', price: '0,50 €' },
      { name: 'Laktosefreie Milch', price: '0,50 €' },
    ],
  },
  {
    key: 'fruehstueck',
    num: '04',
    title: 'Frühstück',
    tone: 'dawn',
    items: [
      {
        name: 'Frühstück für eine Person',
        price: '15,95 €',
        note: 'Zwei knusprige Brötchen, serviert mit Butter, gekochtem Ei, Gouda, Schinken, Bacon sowie einer Auswahl an Marmelade und Honig.',
      },
      {
        name: 'Frühstücksplatte für zwei Personen',
        price: '35,90 €',
        note: 'Vier frische Brötchen, dazu eine feine Auswahl an Käse und Schinken. Frisch zubereitetes Rührei. Für den süßen Genuss Butter, Marmelade, Honig, Nutella sowie eine Auswahl an cremigen Aufstrichen.',
      },
    ],
  },
  {
    key: 'orientalisch',
    num: '05',
    title: 'Orientalisches Frühstück',
    tone: 'dawn',
    items: [
      {
        name: 'Omelette mit Sucuk',
        price: '12,90 €',
        note: 'Sucuk (Knoblauchwurst), Paprika und Tomaten, gebraten mit Eiern und Kräutern – in der Pfanne serviert mit frischem Brot.',
      },
      {
        name: 'Menemen',
        price: '12,90 €',
        note: 'Türkisches Rührei mit Gemüse: Eier, Zwiebeln und Tomaten, leicht gewürzt, in der Pfanne geschmort. Auf Wunsch mit frischer Chili. Serviert mit Brot zum Dippen.',
      },
    ],
  },
  {
    key: 'hauptgerichte',
    num: '06',
    title: 'Hauptgerichte',
    tone: 'green',
    items: [
      { name: 'Wechselnde Tagesgerichte', price: 'ab 10,90 €', note: 'Auch vegane und glutenfreie Speisen erhältlich (siehe Wochenkarte).' },
      { name: 'Hausgemachte Linsensuppe', price: '5,90 €' },
      { name: 'Falafel-Teller', price: '10,90 €', note: 'Mit Hummus und einem gemischten Salat serviert.' },
      {
        name: 'Falafel Bowl',
        price: '13,90 €',
        note: 'Serviert mit Salat, Reis, Hummus, frischem Gemüse, Kräutern und einem hausgemachten Dressing. Dazu knusprige Falafel.',
      },
      { name: 'Mujadara', price: '9,90 €', note: 'Linsen und Reis mit knusprigen Röstzwiebeln, serviert mit frischem Joghurt.' },
      { name: 'Hähnchenschnitzel', price: '13,90 €', note: 'Serviert mit Basmati-Reis, frischem Salat und einer hausgemachten Sauce.' },
      { name: 'Falafel-To-Go-Wrap', price: '9,90 €', note: 'Frisch gerollt mit knusprigen Falafel, Salat, Gemüse, Hummus und einer hausgemachten Sauce.' },
      {
        name: 'Schnitzel mit Pommes',
        price: '14,90 €',
        note: 'Knusprig paniertes Schnitzel, serviert mit knusprigen Pommes frites. Auf Wunsch auch mit Jägersoße oder Rahmsoße.',
      },
    ],
  },
  {
    key: 'salate',
    num: '07',
    title: 'Salate',
    tone: 'green',
    items: [
      { name: 'Burrata Salat', price: '10,90 €', note: 'Serviert mit cremigem Burrata, frischem Rucola, Cherrytomaten, Balsamico-Dressing und knusprigem Brot.' },
      { name: 'Gemischter Salat', price: '8,90 €', note: 'Frisch zubereitet mit verschiedenen Blattsalaten, Tomaten, Gurken, Paprika und einem hausgemachten Dressing.' },
      { name: 'Obstsalat', price: '10,90 €', note: 'Frisch geschnittenes, saisonales Obst – eine leichte und erfrischende Wahl.' },
    ],
  },
  {
    key: 'suesses',
    num: '08',
    title: 'Süßes',
    tone: 'sugar',
    items: [{ name: 'Hausgemachter Kuchen', price: 'ab 3,80 €', note: 'Auch vegan und glutenfrei erhältlich.' }],
  },
  {
    key: 'waffeln',
    num: '09',
    title: 'Waffeln',
    tone: 'sugar',
    items: [
      { name: 'Waffel mit Puderzucker', price: '4,50 €' },
      { name: 'Waffel mit heißen Kirschen', price: '7,90 €', note: 'Serviert mit Kirschen und Sahne.' },
      { name: 'Waffel mit heißer Schokolade', price: '6,90 €', note: 'Auf Wunsch mit Nutella und Sahne — zzgl. 0,50 €.' },
    ],
    footnote: 'Auch to go möglich.',
  },
  {
    key: 'softdrinks',
    num: '10',
    title: 'Softdrinks',
    tone: 'drink',
    items: [
      { name: 'Coca Cola', price: '3,00 €' },
      { name: 'Sprite', price: '3,00 €' },
      { name: 'Fanta', price: '3,00 €' },
      { name: 'Mezzo Mix', price: '3,00 €' },
      { name: 'ViO Wasser (mit Kohlensäure / still)', price: '3,00 €' },
      { name: 'Vita Malz', price: '3,00 €' },
      { name: 'Fritz, diverse Sorten', price: '3,00 €' },
    ],
    footnote: 'zzgl. Pfand.',
  },
  {
    key: 'brunch',
    num: '11',
    title: 'Brunch',
    tone: 'signature',
    intro: 'Brunch jeden Sonntag, 10:00 – 12:00 Uhr — nur mit Reservierung. Die Sitzplätze sind begrenzt; ohne Reservierung kann kein Platz garantiert werden.',
    items: [
      { name: 'Erwachsene', price: 'Preis pro Person — auf Anfrage' },
      { name: 'Kinder', price: 'Preis pro Person — auf Anfrage' },
    ],
  },
  {
    key: 'veranstaltungen',
    num: '12',
    title: 'Veranstaltungen',
    tone: 'signature',
    intro: 'Für private Feiern und Veranstaltungen im Rose Café sprechen Sie uns gerne persönlich oder telefonisch an.',
    items: [],
  },
];

/* =====================================================================
   SIGNATURE PRODUCT — der eine Hauptdarsteller.
   ===================================================================== */

export const SIGNATURE = {
  eyebrow: 'Rose Café Signature',
  name: 'Rose Latte',
  description: 'Das Signature-Getränk des Hauses.',
  price: '4,90 €',
};

/* =====================================================================
   GALERIE / ATMOSPHÄRE — Platzhalterbilder werden per data-tone gemalt,
   bis echtes Bildmaterial vorliegt (siehe README).
   ===================================================================== */

export type GalleryItem = {
  key: string;
  tone: 'interior' | 'window' | 'cup' | 'pastry' | 'flowers' | 'people' | 'counter' | 'exterior';
  caption: string;
  size: 'sm' | 'md' | 'lg';
  from: 'left' | 'right' | 'up';
};

export const GALLERY: GalleryItem[] = [
  { key: 'g1', tone: 'interior', caption: 'Innenraum, Vormittagslicht', size: 'lg', from: 'left' },
  { key: 'g2', tone: 'cup', caption: 'Rose Latte', size: 'sm', from: 'right' },
  { key: 'g3', tone: 'window', caption: 'Fensterplatz', size: 'md', from: 'up' },
  { key: 'g4', tone: 'pastry', caption: 'Gebäck des Tages', size: 'sm', from: 'left' },
  { key: 'g5', tone: 'flowers', caption: 'Rosen am Tresen', size: 'md', from: 'right' },
  { key: 'g6', tone: 'counter', caption: 'Der Tresen', size: 'lg', from: 'up' },
  { key: 'g7', tone: 'people', caption: 'Ein ruhiger Nachmittag', size: 'md', from: 'left' },
  { key: 'g8', tone: 'exterior', caption: 'Schaufenster, Bremen', size: 'sm', from: 'right' },
];

/* =====================================================================
   BEWERTUNGEN — Platzhalter. Vor Livegang durch echte, zitierfähige
   Bewertungen ersetzen (z. B. Google/Yelp mit Einverständnis).
   ===================================================================== */

export type Review = { name: string; text: string; rating: number };

export const REVIEWS: Review[] = [
  { name: '[Name]', text: '[Platzhalter für eine echte Gästebewertung.]', rating: 5 },
  { name: '[Name]', text: '[Platzhalter für eine echte Gästebewertung.]', rating: 5 },
  { name: '[Name]', text: '[Platzhalter für eine echte Gästebewertung.]', rating: 5 },
];

/* =====================================================================
   FAQ
   ===================================================================== */

export type Faq = { q: string; a: string };

export const FAQS: Faq[] = [
  {
    q: 'Nehmt ihr Reservierungen an?',
    a: 'Ja, für Gruppen empfehlen wir eine kurze Reservierung im Voraus. Nutzen Sie das Formular auf dieser Seite oder rufen Sie uns direkt an.',
  },
  {
    q: 'Gibt es vegane oder glutenfreie Optionen?',
    a: 'Wir kennzeichnen unsere Optionen auf der Karte vor Ort und beraten Sie gerne persönlich zu Alternativen.',
  },
  {
    q: 'Ist das Café barrierefrei erreichbar?',
    a: 'Bitte sprechen Sie uns bei Fragen zur Erreichbarkeit direkt an — wir helfen gerne weiter.',
  },
  {
    q: 'Gibt es WLAN und Arbeitsplätze?',
    a: 'Ja, WLAN steht für Gäste zur Verfügung. Für konzentriertes Arbeiten empfehlen wir die ruhigeren Vormittagsstunden.',
  },
];

/**
 * Endpunkt für das Reservierungsformular. Leer lassen = Fallback auf das
 * E-Mail-Programm des Nutzers.
 */
export const FORM_ENDPOINT = '';

export const PARTY_SIZES = ['1–2 Personen', '3–4 Personen', '5–8 Personen', 'mehr als 8 Personen'];
