# ING Gutachten — Next.js / React / TypeScript / Tailwind / Framer Motion

Premium-Website für das Kfz-Sachverständigenbüro ING Gutachten in Hannover.
23 Routen, dunkles Automotive-Design, scroll-getriebene Animationen, interaktiver
Schaden-Konfigurator, mehrstufiger Anfrage-Flow mit Foto-Upload, vollständiges
SEO-Setup.

---

## 1. Starten

```bash
npm install
npm run dev        # http://localhost:3000
```

Weitere Skripte:

```bash
npm run build      # Produktions-Build → statischer Export nach out/
npm run typecheck  # TypeScript ohne Emit
npm run lint       # next lint
```

**Wichtig:** `npm install` braucht einmalig Internet – auch für die Schriftarten,
die `next/font` beim Build herunterlädt und danach vom eigenen Server ausliefert
(kein Google-Fonts-Aufruf beim Besucher, deshalb auch kein Drittanbieter in der
Datenschutzerklärung).

## 2. Stack

| Baustein | Version | Rolle |
|---|---|---|
| Next.js (App Router) | 15 | Routing, Metadata-API, statischer Export |
| React | 19 | Server- und Client-Komponenten |
| TypeScript | 5.7 | strict mode |
| Tailwind CSS | 3.4 | Design-Tokens und Utilities |
| Framer Motion | 11 | Reveals, Scroll-Progress, Layout-Transitions |
| Lenis | 1.1 | sanftes Scrollen (nur Maus, nur ohne reduced motion) |

`next.config.mjs` steht auf `output: 'export'` — der Build erzeugt statisches
HTML in `out/`, das auf jedem Webspace läuft. Wer auf Vercel/Netlify mit SSR,
ISR oder Route Handlers arbeiten will, entfernt diese eine Zeile.

## 3. Projektstruktur

```
src/
  app/
    layout.tsx              Fonts, Metadata, Nav/Footer/Cursor/Dock
    page.tsx                Startseite (komplette Scroll-Experience)
    <route>/page.tsx        14 statische Seiten
    kfz-gutachter/[stadt]/  6 Regionalseiten via generateStaticParams
    sitemap.ts, robots.ts   automatisch generiert
    not-found.tsx           404
    globals.css             Design-System (Tailwind-Layer)
  components/
    layout/    Nav, Footer, Dock, CookieNotice, SmoothScroll, CustomCursor, Landing
    sections/  Hero, Ticker, Stats, Position, CrashSequence, DamageConfigurator,
               Services, FlowTimeline, WhyGrid, ServiceMap, PhotoBand, Figure,
               RequestSection, Faq, CtaBand, PageHero, TwoCol, RelatedCards,
               ContactGrid
               TechScenes     – Sensorik, Struktur, Hochvoltsystem
               AnalysisScenes – Datenfluss, Datenpanel, Rekonstruktion
               ServiceScenes  – Regulierung, Wochen, Video, Fahrzeugklassen
    form/      RequestForm (4 Schritte, Validierung, Drag & Drop)
    ui/        Reveal, SplitLines, Magnetic, Tilt, CountUp, Icon, Slug, JsonLd
  lib/
    content.ts  Stammdaten, Navigation, Leistungen, Regionen, FAQ, Ablauf
    seo.ts      Metadata-Builder und Schema.org
```

**Inhalte ändern:** fast alles steht in `src/lib/content.ts` — Telefonnummern,
Leistungen, Regionen, FAQ, Ablaufschritte, Schadenzonen. Neue Region eintragen →
Regionalseite, Footer-Link, Karten-Pin, Sitemap und Schema entstehen automatisch.

**Server vs. Client:** Alles ist standardmäßig Server-Komponente. `'use client'`
steht nur dort, wo es Interaktion oder Motion gibt (Nav, Cursor, Konfigurator,
Slider, Timeline, Karte, Formular, FAQ, die vier UI-Animationshelfer). Dadurch
bleibt das ausgelieferte JavaScript klein.

## 4. Kollisionssequenz (`CrashSequence.tsx`)

Der scroll-gescrubbte Höhepunkt zwischen „Positionierung" und dem
Schaden-Konfigurator. Bewusst kein WebGL: eine SVG-Szene mit eigener Kamera
erreicht denselben cinematischen Eindruck, lädt sofort und läuft auch auf
älteren Telefonen.

**So funktioniert das Scrubbing:** Die Sektion ist 340 vh hoch (mobil 260 vh)
und enthält ein `sticky`-Bühnenelement mit 100 svh. `useScroll` liefert den
Fortschritt 0–1; eine einzige `useMotionValueEvent`-Subscription schreibt
`transform` und `opacity` direkt auf die DOM-Knoten. **React rendert die
Sektion genau einmal** — kein State, kein Re-Render pro Frame, nur
Compositing-Eigenschaften.

**Phasen** (Fortschritt in Klammern):

| Phase | Was passiert |
|---|---|
| Annäherung (0 – 0,42) | Fahrzeug beschleunigt, Räder rollen weglängengetreu, Bewegungsunschärfe steigt, HUD zählt Abstand und Δv |
| Spannung (0,34 – 0,42) | Kurve streckt sich kurz vor Kontakt, Kamera schiebt sich heran |
| Aufprall (0,42 – 0,50) | Pfad-Morph an Heck und Front, Nickbewegung, Lichtblitz, Druckring, Partikelausbruch, kurzer Kamerastoß |
| Ausschwingen (0,50 – 0,68) | gedämpftes Nachfedern, Partikel fallen mit Gravitation, Staub verzieht |
| Befundaufnahme (0,68 – 1,0) | Kamera fährt auf die Schadenstelle, Messmarken mit Werten blenden ein, Übergang dunkelt ab |

**Verformung** entsteht durch Interpolation zweier Pfadzustände mit identischer
Kommandofolge (`morph()` in derselben Datei) — kein Austausch von Grafiken,
sondern echte Zwischenschritte. Heck- und Frontstoßfänger sind eigene Pfade,
damit Räder und Karosserie unverzerrt bleiben.

**Anpassen:** Phasengrenzen stehen als Konstanten oben in der Datei
(`P_IMPACT`, `P_SETTLE`, `P_REST`), die Messmarken in `CALLOUTS`, die
Fahrzeuggeometrie in `CarBody`. `100 px = 1 m` — die Abstandsanzeige rechnet
damit.

**Mobil:** 12 statt 36 Partikel, keine SVG-Filter (Bewegungsunschärfe ist auf
Mobilgeräten der teuerste Effekt), kein Kamerastoß, gröberes Raster, kürzere
Scrollstrecke.

**Reduced Motion:** kein Scrubbing, keine Sticky-Bühne — stattdessen ein
ruhiger Endzustand mit sichtbarem Schaden und den Messmarken. Die Aussage der
Sektion bleibt erhalten, die Bewegung entfällt vollständig.

> **Wichtig für spätere Änderungen:** In `globals.css` steht am `body`
> `overflow-x: clip`, nicht `hidden`. `hidden` würde einen Scroll-Container
> erzeugen und jedes `position: sticky` im Dokument aushebeln — die Sequenz
> würde einfach durchscrollen statt zu pinnen.

## 5. Navigation und Seitenbaum

Die Hauptnavigation trägt einen Bereich mit Untermenü. Struktur steht in
`src/lib/content.ts` unter `NAV` — ein Eintrag mit `children` erzeugt
automatisch das Desktop-Dropdown und das mobile Akkordeon.

```
Schadensgutachten ─┬─ Gutachter            /schadensgutachten
                   ├─ Unfallanalyse        /unfallanalyse
                   ├─ PKW-Gutachten        /pkw-gutachten
                   ├─ Unfallgutachten      /unfallgutachten
                   ├─ Unfallrekonstruktion /unfallrekonstruktion
                   └─ EDR-Systeme          /edr-systeme
```

Insgesamt 26 Routen. Das Dropdown öffnet bei Hover und bei Tastaturfokus,
schließt mit `Esc` und über eine kurze Verzögerung — sonst klappt es zu,
während der Zeiger die Lücke zum Panel überquert.

**Bagatellschäden entfernt.** Die Seite ist gelöscht, alle Verweise und die
Kategorie sind ersetzt. Damit die alte URL nicht ins Leere läuft, liegt eine
301-Weiterleitung auf `/pkw-gutachten` in `vercel.json` (und in
`deploy/.htaccess` für Apache). Der Fachbegriff *Bagatellgrenze* steht
weiterhin in den FAQ — das ist eine juristische Größe, kein Angebot.

## 6. Formulierungen zu Fahrzeugdaten und EDR

Die Texte auf `/unfallanalyse` und `/edr-systeme` sind bewusst
zurückhaltend formuliert: „je nach Fahrzeug, seinen Systemen und den
verfügbaren Daten". Das ist kein Stilmittel, sondern notwendig — Umfang und
Zugriff auf ereignisbezogene Daten unterscheiden sich stark, und der Zugriff
setzt technische wie rechtliche Voraussetzungen voraus.

Die Kennwerte im Datenpanel (`DATA_READOUTS` in `content.ts`) sind als
Beispiele gekennzeichnet und stammen aus keinem realen Fall. Bitte diese
Kennzeichnung beim Bearbeiten stehen lassen.

## 7. Video einsetzen

Videodatei nach `public/assets/video/` legen und in `content.ts` eintragen:

```ts
export const SETTLEMENT_VIDEO = {
  src: '/assets/video/regulierung.mp4',
  poster: '/assets/img/video-poster.webp',
  ...
};
```

Solange `src` leer ist, zeigt die Komponente einen ruhigen Platzhalter statt
eines kaputten Players. Der Player lädt mit `preload="none"`, spielt nie
automatisch und blendet die Bedienelemente erst nach dem Start ein.
Empfehlung: MP4/H.264, max. 1080p, unter 10 MB.

## 8. Vor dem Livegang prüfen (wichtig)

Diese Angaben ließen sich nicht aus der bestehenden Website verifizieren und sind
als Annahme eingesetzt — bitte in `src/lib/content.ts` (Block `BIZ`) korrigieren:

| Feld | aktuell | Status |
|---|---|---|
| E-Mail | `info@ing-gutachten.de` | **ungeprüft** |
| Öffnungszeiten | Mo–Fr 08:00–18:00, Sa nach Vereinbarung | **ungeprüft** |
| Geokoordinaten | 52.3402 / 9.7742 (Näherung) | **prüfen** |
| Impressum | strukturierter Platzhalter | **muss ersetzt werden** |
| Datenschutz | Entwurf | **rechtlich prüfen lassen** |

Verifiziert übernommen: Hildesheimer Straße 229, 30519 Hannover ·
0511 – 543 00 976 · 0173 – 72 79 763 · Leistungsspektrum · 15+ Jahre Erfahrung ·
Vor-Ort-Service · Achs- und Karosserievermessung.

**Bewertungen:** bewusst nicht eingebaut — es lagen keine echten Google-Rezensionen
vor, und erfundene Testimonials wären ein Rechts- und Vertrauensrisiko. Muster
unter Punkt 7.

**FAQ-Inhalte** sind fachlich formuliert (Bagatellgrenze, Wahlrecht des
Geschädigten, Kostentragung). Bitte einmal fachlich gegenlesen.

## 9. Formular anschließen

Ohne Endpunkt fällt das Formular sauber auf das E-Mail-Programm zurück. Für
echten Serverversand inklusive Fotos in `src/lib/content.ts`:

```ts
export const FORM_ENDPOINT = 'https://formspree.io/f/XXXX';
```

Erwartet wird ein Endpunkt, der `multipart/form-data` per POST annimmt und bei
Erfolg 2xx liefert. Fotos kommen als `foto_1 … foto_8`. Bei Fehler erscheint eine
Meldung mit Telefonnummer.

Alternative ohne Drittanbieter: `output: 'export'` entfernen und einen Route
Handler unter `src/app/api/anfrage/route.ts` anlegen, der die Daten per SMTP
weiterschickt. **DSGVO:** externer Dienst = Auftragsverarbeitungsvertrag plus
Eintrag in der Datenschutzerklärung.

## 10. Bilder ergänzen

Drei echte Aufnahmen sind eingebaut und farblich ins Graphit der Seite
gegradet (abdunkeln, entsättigen, Split-Toning in Blau/Amber, Vignette):

| Datei | Einsatz |
|---|---|
| `pruefstand-halle.webp` | Fotoband auf der Startseite nach „Warum ING" |
| `team-begutachtung.webp` | Fotoband auf „Über uns" |
| `begutachtung-protokoll.webp` | „Über uns" (Figure) und „Unfallgutachten" (Band) |

Weitere Fotos einfach im selben Look ergänzen und über `<PhotoBand>` oder
`<Figure>` einsetzen. Noch offen für Bildmaterial:

1. **Hero** — `public/assets/img/car-hero.svg` in `components/sections/Hero.tsx`
   ersetzen. Freigestelltes Fahrzeug, dunkler Hintergrund, WebP, max. 2000 px.
2. **Leistungskarten** — in `content.ts` das `gradient`-Feld durch `url(...)`
   ersetzen; der Hover-Zoom greift automatisch. Hochformat, 1200 × 1600.

Bei statischem Export ist `next/image` auf `unoptimized` gestellt. Wer die
Bildoptimierung will, entfernt `output: 'export'` und hostet auf Vercel/Node.

## 11. Bewertungen später einbauen

```tsx
<section className="section">
  <div className="shell">
    <Slug left="Bewertungen" right="Google" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <figure className="card">
        <div className="tracking-[.2em] text-signal">★★★★★</div>
        <blockquote><p>… Originaltext der Rezension …</p></blockquote>
        <figcaption className="font-mono text-xs text-fg-mute">Vorname N. · Google</figcaption>
      </figure>
    </div>
  </div>
</section>
```

Nur echte, nachweisbare Bewertungen — und `AggregateRating`-Markup ausschließlich
dann, wenn die Bewertungen auch sichtbar auf der Seite stehen.

## 12. SEO

- Metadata-API: eigener Title/Description je Route, Canonicals mit Trailing Slash,
  Open Graph, Twitter Cards
- Schema.org über `lib/seo.ts`: `AutomotiveBusiness`/`ProfessionalService`/
  `LocalBusiness`, `Service` je Leistungsseite, `FAQPage`, `BreadcrumbList`, `WebSite`
- `sitemap.ts` und `robots.ts` erzeugen `/sitemap.xml` und `/robots.txt` beim Build
- Impressum und Datenschutz auf `noindex, follow`
- Regionalseiten mit eigenständigem Text statt Duplicate Content
- Genau eine H1 pro Seite, semantische Überschriftenhierarchie, Breadcrumbs

Nach dem Livegang: Google-Business-Profil verknüpfen, Search Console einrichten,
Sitemap einreichen, NAP-Daten überall identisch halten.

## 13. Performance & Barrierefreiheit

- Animationen laufen über `transform`/`opacity`; Scroll-Fortschritt kommt aus
  `useScroll`, nicht aus eigenen Scroll-Listenern mit Layout-Lesezugriff
- `prefers-reduced-motion` wird in jeder Animationskomponente abgefragt —
  Reveals, Parallax, Cursor, Magnet- und Tilt-Effekte schalten sich komplett ab
- Custom Cursor, Magnetismus und Tilt nur bei `hover: hover` und `pointer: fine`
- Sichtbarer Fokus, Skip-Link, `aria-expanded`/`aria-pressed`/`aria-live` an
  Menü, Akkordeon, Konfigurator, Karte und Formular
- Menü mit `Esc` schließbar, Slider mit Pfeiltasten bedienbar, Formular komplett
  per Tastatur nutzbar, Fehlermeldungen als `role="alert"`
- Object-URLs der Foto-Vorschau werden wieder freigegeben

## 14. Deployment

**Statisch (Standardeinstellung):**

```bash
npm run build      # erzeugt out/
```

`out/` auf beliebiges Hosting kopieren. Für Apache liegt eine `.htaccess`-Vorlage
im Repo-Stamm (`deploy/.htaccess`) mit 404-Seite, Kompression, Caching und
Security-Headern.

**Vercel/Netlify mit SSR:** `output: 'export'` in `next.config.mjs` entfernen und
das Repository verbinden — mehr ist nicht nötig.

## 15. Was geprüft wurde

| Bereich | Status |
|---|---|
| TypeScript | Syntax- und Strukturprüfung aller 57 Dateien fehlerfrei |
| Routen | 17 Seitendateien + 6 generierte Regionalseiten, alle internen Links aufgelöst |
| Struktur | genau eine H1 pro Seite, Breadcrumbs konsistent mit Schema |
| Client/Server | `'use client'` nur wo nötig |
| Reduced Motion | in jeder Animationskomponente behandelt, inkl. Kollisionssequenz |
| Sticky | `overflow-x: clip` statt `hidden`, damit das Pinning trägt |
| Bestehende Sektionen | unverändert, bestehende Animationssprache durchgehend weiterverwendet |
| Routen | 26 Stück, alle internen Links maschinell gegen den Seitenbaum geprüft |
| Metadaten | Title und Description auf jeder Seite, genau eine H1 |
| Entfernte Seite | keine toten Links, 301 auf /pkw-gutachten hinterlegt |

Nicht möglich in der Bauumgebung: `npm install` und damit ein echter
`next build` sowie das visuelle Rendering im Browser. Bitte einmal lokal
`npm install && npm run dev` laufen lassen und auf iPhone und in Chrome
durchscrollen – besonders Hero-Höhe, Konfigurator-Hotspots und Formular-Flow.
