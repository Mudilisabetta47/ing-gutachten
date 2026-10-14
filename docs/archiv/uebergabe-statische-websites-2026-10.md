> **VERALTET – nur zur Nachvollziehbarkeit archiviert (14.10.2026).**
> Dieses Dokument beschreibt eine frühere, **statische** Website-Architektur (kein Next.js, keine Datenbank, keine Anmeldung, zwei Marken MTC/ING).
> Das heutige System (Next.js, PostgreSQL, ING Operating System, ING Studio) ist **nicht** hier beschrieben. Maßgeblich: `docs/BESTANDSAUFNAHME.md`, `docs/PHASE4-UEBERSICHT.md`, `docs/PILOT-GO-NOGO.md`.
> Enthält keine Zugangsdaten (nur Beispielwerte).

# Technische Übergabe

Ein Entwickler soll die Architektur dieses Projekts verstehen, ohne vorher den Quelltext zu öffnen — und die tragenden Teile für kommende Projekte wiederverwenden können. Wo etwas bewusst nicht gebaut wurde, steht daneben, womit man es baut, wenn das nächste Projekt es braucht.

---

## 0. Stack-Abgleich — bitte zuerst lesen

Die Fragen im Auftrag setzen einen Next.js-Stack mit Prisma, PostgreSQL, Three.js, Authentifizierung und Admin-System voraus. **Dieses Projekt ist bewusst anders gebaut.** Bevor die Details kommen, hier der ehrliche Abgleich — sonst sucht jemand stundenlang nach Ordnern, die es nicht gibt.

| Erwartet | Tatsächlich | Warum |
|---|---|---|
| Next.js / React | **Keines von beiden.** Statisches HTML, handgeschrieben bzw. generiert | Zwei Marketing-Sites ohne Nutzerkonten. Ein Framework hätte Build-Pipeline, Hydration und Abhängigkeitspflege gebracht, ohne ein einziges Problem zu lösen |
| App Router, Server Components | Nicht vorhanden | Kein Server-Rendering nötig — die Seiten sind vollständig statisch |
| Tailwind / UI-Bibliothek | **Handgeschriebenes CSS auf Custom Properties** | Die gesamte Gestaltung hängt an ~60 Tokens. Zwei Marken teilen sich dieselbe Struktur und unterscheiden sich nur in einer Token-Datei |
| Framer Motion / GSAP | **Eigene Scroll-Engine, ~450 Zeilen** | Siehe §6. Die Kernidee (Scrollfortschritt → Fortschritt 0..1) sind 149 Zeilen; Bibliotheken hätten 40–120 KB gekostet |
| Three.js / R3F | **Canvas 2D mit eigener Lochkamera-Projektion** | Siehe §7. Die Szene ist eine Nachtstraße aus Farbverläufen — dafür braucht es keine GPU-Pipeline, keine Modelle, keine Texturen |
| Prisma / PostgreSQL | **Keine Datenbank** | Es gibt nichts zu speichern. Anfragen werden per E-Mail zugestellt |
| Auth / RBAC / Audit-Log | **Nicht vorhanden** | Kein Login, keine Rollen, keine geschützten Bereiche |
| Admin-System | **Nicht vorhanden** | Wurde nie beauftragt |
| API-Routen | **Genau eine**: `api/kontakt.js` (Vercel Serverless Function) | Siehe §8 |
| npm-Abhängigkeiten | **Null in Produktion** | Siehe §2 — das ist keine Sparsamkeit, sondern eine Entscheidung mit Begründung |

**Für alle nicht vorhandenen Bereiche** steht in diesem Dokument nicht „gibt es nicht", sondern eine konkrete Empfehlung, womit man sie im nächsten Projekt umsetzt (§17). Genau das war ja der Zweck der Übergabe.

### Warum überhaupt ohne Abhängigkeiten?

Nicht aus Prinzip, sondern aus drei konkreten Gründen:

1. **Die Seite lädt nichts von außen.** Keine Fonts von Google, keine Karten, keine Analytics, keine Icon-CDN. Das ist der Grund, warum die Seiten **kein Cookie-Banner** brauchen — es gibt technisch nichts einzuwilligen. Für ein deutsches KMU ist das ein echter Vorteil, kein Detail.
2. **Kein Build-Schritt beim Deployen.** Was im Repository liegt, wird ausgeliefert. Kein `npm install`, das in zwei Jahren an einer Transitive-Dependency scheitert.
3. **Die Animation wäre mit einer Bibliothek nicht besser geworden.** Der Film ist eine Canvas-Zeichnung, die pro Frame aus dem Scrollfortschritt berechnet wird. GSAP hätte die Tween-Verwaltung übernommen — die hier gar nicht gebraucht wird, weil es keine Tweens gibt, sondern eine reine Funktion.

**Der Preis:** Alles Nicht-Triviale ist selbst gebaut und muss selbst gewartet werden. Das ist bei ~6.000 Zeilen vertretbar. Bei einem Projekt mit Login, Datenbank und Admin wäre es das nicht — dann gilt §17.

---

## 1. Kompletter Technologie-Stack

### Was tatsächlich verwendet wird

| Bereich | Technologie | Wozu | Warum so | Wo im Projekt |
|---|---|---|---|---|
| **Sprache** | TypeScript 5.x, `strict` | Gesamte Client-Logik | Typsicherheit über 4.765 Zeilen Canvas-Mathematik ist der Unterschied zwischen wartbar und nicht | `src/**/*.ts` |
| **Ausgabe** | ES2022-Module, nativ im Browser | Kein Transpiling zu ES5 | Alle Zielbrowser können ES2022. Keine Polyfills, kein Babel | `assets/js/**` |
| **Markup** | Statisches HTML5 | Seitenstruktur | 16 Seiten, davon 6 generiert | `index.html`, `gutachten/`, `<slug>/` |
| **Styling** | Handgeschriebenes CSS, Custom Properties, `@layer`-frei | Gesamte Gestaltung | Token-System, siehe §5 | `assets/css/*.css` |
| **Layout** | CSS Grid + Flexbox, logische Eigenschaften (`inline-size`, `block-size`, `padding-block`) | Alle Layouts | Logische Eigenschaften, weil sie bei Mehrsprachigkeit ohne Umbau funktionieren | überall |
| **Farbmischung** | `color-mix(in oklab, …)` | Abgeleitete Farben, Linien, Glas-Effekte | Erlaubt, alle Abstufungen aus einem Token zu erzeugen. oklab statt sRGB, weil die Helligkeit dabei wahrnehmungsrichtig bleibt | `tokens.css`, `ing.css` |
| **Animation** | Eigene Scroll-Timeline + CSS-Transitions | Gesamte Bewegung | §6 | `src/core/timeline.ts`, `scroll.ts`, `reveal.ts` |
| **Szene** | Canvas 2D + eigene 3D-Projektion | Der Film | §7 | `src/scene/**` |
| **Schrift** | System-Font-Stack | Gesamte Typografie | `-apple-system, "SF Pro Display", "Segoe UI Variable"` — null Requests, auf Apple-Geräten exakt die Apple-Type. Kein FOUT, kein Layout-Shift | `tokens.css` |
| **Icons** | Inline-SVG im Markup | Pfeile, Telefon, Logo | Keine Icon-Bibliothek, keine Sprite-Datei. Jedes Icon ist 1–3 Pfade | direkt im HTML |
| **Karte** | Eigene SVG-Projektion aus echten Koordinaten | Einsatzgebiet MTC | Kein Google Maps → keine Einwilligung, kein Schlüssel, keine Kosten | `src/components/coverageMap.ts` |
| **Formularversand** | Vercel Serverless Function + Brevo API | Kontakt + Notfall-Assistent | §8, §11 | `api/kontakt.js` |
| **E-Mail** | Brevo Transactional API (`/v3/smtp/email`) | Zustellung | EU-Anbieter, AV-Vertrag verfügbar, 300 Mails/Tag im Gratistarif | `api/kontakt.js` |
| **SEO** | Statische Meta-Tags, JSON-LD, Sitemap | §14 | Handgepflegt bzw. mitgeneriert | je `index.html` |
| **Analytics** | **Keines** | — | Bewusst. Ein `track()`-Haken existiert und feuert `CustomEvent`s, an die sich später etwas hängen lässt | `src/core/util.ts:85` |
| **Build** | `tsc` + zwei eigene Node-Skripte | Kompilieren, bündeln, generieren | §2 | `build/*.mjs` |
| **Tests** | Playwright über 16 Seiten × 6 Auflösungen | Regressionsschutz | §15 | `build/qa.mjs` |
| **Hosting** | Vercel (statisch + eine Function) | Deployment | §16 | — |

### Was ausdrücklich nicht verwendet wird

**Datenbank, ORM, Authentifizierung, Autorisierung, Datei-Upload, Zustandsverwaltung, Routing-Bibliothek, Formular-Bibliothek, Validierungs-Bibliothek (Zod o. ä.), 3D-Engine, Icon-Paket, CSS-Framework, Analytics, Cookie-Consent.**

Die Validierung ist handgeschrieben und läuft an zwei Stellen: im Browser für die Rückmeldung (`contactForm.ts`) und **noch einmal auf dem Server** (`api/kontakt.js`), weil die Browser-Prüfung nur Komfort ist und niemals Sicherheit.

---

## 2. Paketliste

### Produktionsabhängigkeiten

**Keine.** Es gibt keine `package.json` und kein `node_modules` im ausgelieferten Stand. Das ist die wichtigste Einzelaussage dieses Dokuments.

Die einzige Laufzeitabhängigkeit ist die **Brevo-HTTP-API**, die per `fetch` aus der Serverless Function angesprochen wird — ohne SDK, weil ein einziger POST kein SDK braucht.

### Entwicklungsabhängigkeiten

Diese liegen **global** auf der Entwicklungsmaschine, nicht im Projekt:

| Paket | Version | Wozu | Pflicht? |
|---|---|---|---|
| `typescript` | ^5.5 | `tsc` kompiliert `src/` → `assets/js/` | **Ja** |
| `playwright` (+ Chromium) | ^1.4x | QA-Lauf, Screenshots, Performance-Messung | Nur für Tests |
| `sharp` | ^0.33 | Kontaktbögen aus Screenshots (`build/sheet.mjs`) | Optional |

Wenn Sie das Projekt in ein Repository mit `package.json` überführen wollen:

```json
{
  "name": "mtc-ing-websites",
  "private": true,
  "scripts": {
    "build": "tsc -p tsconfig.json && node build/bundle.mjs && node build/services.mjs",
    "qa": "node build/qa.mjs",
    "perf": "node build/perf.mjs /",
    "dev": "node build/server.mjs",
    "artifact": "node build/artifact.mjs"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "playwright": "^1.47.0"
  }
}
```

**Achtung bei Vercel:** Sobald eine `package.json` existiert, versucht Vercel zu bauen. Entweder `"build"` weglassen oder in den Projekteinstellungen als Build-Command `tsc -p tsconfig.json && node build/bundle.mjs && node build/services.mjs` hinterlegen. **Und:** Ohne `"type": "module"` behandelt Vercel `api/*.js` als CommonJS — genau das erwartet `api/kontakt.js` (`module.exports`). Wird `"type": "module"` gesetzt, muss die Datei auf `export default` umgestellt werden.

---

## 3. Projektarchitektur

```
mtc/
├── index.html                 Startseite MTC AUTOSERVICE (16 Sections)
├── 404.html                   Fehlerseite
├── robots.txt, sitemap.xml    MTC-Site
├── .env.example               Vorlage für die Umgebungsvariablen (keine Werte!)
│
├── abschleppdienst/           ┐
├── pannenhilfe/               │ Sechs Leistungs-Landingpages.
├── unfallbergung/             │ GENERIERT aus build/services.mjs —
├── fahrzeugtransport/         │ nicht von Hand bearbeiten, Änderungen
├── oldtimer-transport/        │ gehen beim nächsten Lauf verloren.
├── werkstatt/                 ┘
│
├── impressum/  datenschutz/   Rechtsseiten MTC, handgepflegt
├── agb/  widerruf/            (Pflichtangaben tragen "bitte ergänzen")
├── cookie-richtlinie/
│
├── gutachten/                 ZWEITE MARKE: ING GUTACHTEN
│   ├── index.html             Eigene Startseite mit eigenem Film
│   ├── impressum/ datenschutz/
│   └── robots.txt, sitemap.xml
│
├── api/
│   └── kontakt.js             Einzige Serverless Function. Formularversand
│                              für BEIDE Marken über Brevo
│
├── assets/
│   ├── css/                   Sieben Dateien, bewusst kaskadierend geordnet
│   │   ├── tokens.css         ← EINZIGE QUELLE der Design-Entscheidungen
│   │   ├── base.css           Reset, Layout-Primitive, Barrierefreiheit
│   │   ├── components.css     Header, Buttons, Cursor, Modal, Formulare, Reveals
│   │   ├── sections.css       Vertrauen, Karte, Bewertungen, FAQ, Kontakt, Footer
│   │   ├── premium.css        Hero, Typo-Momente, Werkstatt, Leistungen, 24/7
│   │   ├── service.css        Leistungsseiten (Filmkopf, Umfang, Fakten, Gebiet)
│   │   └── ing.css            ← ÜBERSCHREIBT die Token-Ebene komplett auf Blau
│   ├── js/                    KOMPILAT — nicht bearbeiten, aber committen!
│   │   ├── core/ components/ scene/ pages/    Einzelmodule (Debugging)
│   │   └── *.bundle.js        Was die Seiten tatsächlich laden
│   └── brand/                 Logos, Favicon, OG-Bild
│
├── src/                       QUELLE — hier wird gearbeitet
│   ├── core/                  Infrastruktur, markenunabhängig (§4)
│   ├── components/            UI-Bausteine, an DOM-IDs gebunden
│   ├── scene/                 Canvas-Welt, Fahrzeuge, die zwei Filme (§7)
│   └── pages/                 Vier Einstiegspunkte = vier Bundles
│
├── build/                     Entwicklungswerkzeuge, werden NICHT ausgeliefert
└── dist-artifact/             Einzeldatei-Vorschauen (generiert)
```

### Die vier Ebenen und ihre Regel

Der Import darf immer nur **nach unten** zeigen. Wird das verletzt, entstehen Zyklen, die der eigene Bundler nicht auflösen kann.

```
pages/       Einstiegspunkte — kennen alles, werden von nichts importiert
   ↓
components/  kennen core/ und scene/, nie einander (Ausnahme: premium.ts → statements.ts)
   ↓
scene/       kennt nur core/
   ↓
core/        kennt nur sich selbst
```

### `src/core/` — die Infrastruktur

| Datei | Zeilen | Aufgabe |
|---|---|---|
| `env.ts` | 80 | Ermittelt **einmalig** Zeigegerät, Touch, Viewport-Größe, `prefers-reduced-motion`, DPR-Grenze und eine grobe Leistungsschätzung aus `hardwareConcurrency`/`deviceMemory`. Alles andere fragt dieses Objekt, statt selbst `matchMedia` aufzurufen |
| `raf.ts` | 55 | **Eine einzige** `requestAnimationFrame`-Schleife für die ganze Seite, mit Reihenfolge (Scroll = 0, Szenen = 10, Cursor = 20). Pausiert automatisch bei unsichtbarem Tab |
| `scroll.ts` | 211 | Smooth Scrolling nach Lenis-Prinzip (§6) |
| `timeline.ts` | 149 | Scroll-Timelines nach ScrollTrigger-Prinzip (§6) |
| `reveal.ts` | 121 | Text-Splitting und IntersectionObserver-Reveals (§6) |
| `easing.ts` | 67 | Easing-Kurven inkl. `cinematic`, `impact`, `shakeDecay` |
| `util.ts` | 89 | `clamp`, `lerp`, `damp`, `norm`, `window01`, `mulberry32`, `qs`/`qsa`, `on`, `debounce`, `track` |
| `cursor.ts` | 53 | Eigener Cursor mit Zuständen (nur Desktop) |
| `magnetic.ts` | 63 | Magnetische Buttons |
| `beat.ts` | 34 | `driveBeat`, `driveEnter`, `activateInView` — schaltet Szenen ab, sobald sie außer Sicht sind |
| `counter.ts` | 44 | Zählende Zahlen |

### `src/components/` — die UI-Bausteine

Jede Datei exportiert genau eine `init…()`-Funktion, sucht ihre Elemente über IDs oder Datenattribute und **steigt still aus, wenn sie nichts findet**. Deshalb kann jeder Einstiegspunkt beliebige Teilmengen aufrufen, ohne dass es kracht.

| Datei | Aufgabe |
|---|---|
| `header.ts` | Ein-/Ausblenden beim Scrollen, `is-solid`-Zustand |
| `mobileNav.ts` | Menü-Overlay, Fokusfalle |
| `anchors.ts` | Ankersprünge über die eigene Scroll-Engine |
| `faq.ts` | Akkordeon mit korrektem `aria-expanded` |
| `emergency.ts` | **Notfall-Assistent**, 5 Schritte, Modal, Versand (§11) |
| `contactForm.ts` | Kontaktformular, Validierung, Versand, mailto-Rückfall |
| `coverageMap.ts` | SVG-Karte aus echten Koordinaten |
| `loader.ts` | Ladebalken, wartet auf das erste Hero-Bild |
| `statements.ts` | Typografische Momente (`[data-statement]`) |
| `premium.ts` | Alle Bühnen der MTC-Startseite (Hero, Werkstatt, Leistungen, Fahrzeuge, Bergung, Prozesskette, 24/7) |
| `story.ts` | Bewertungen, Finale |
| `serviceHero.ts` | Filmkopf einer Leistungsseite |
| `ingHero.ts` | **Fünf-Akt-Bühne von ING** (§6) |
| `flowRail.ts` | Horizontale Ablauf-Sektion |

### `src/pages/` — vier Bundles

| Einstieg | Bundle | Größe | Seiten |
|---|---|---|---|
| `home.ts` | `home.bundle.js` | 144 KB | `/` |
| `service.ts` | `service.bundle.js` | 108 KB | die sechs Leistungsseiten |
| `ing.ts` | `ing.bundle.js` | 118 KB | `/gutachten/` |
| `simple.ts` | `simple.bundle.js` | 34 KB | alle Rechtsseiten, 404 |

Die Trennung ist der Grund, warum eine Rechtsseite nicht 144 KB Szenencode lädt.

### `build/` — die Werkzeuge

| Skript | Aufgabe |
|---|---|
| `bundle.mjs` | **Eigener 94-Zeilen-Bundler.** Liest die ESM-Module, sortiert sie topologisch, verpackt sie in eine Registry mit `__req()`. Erlaubt nur `export function/const/class`, `export {…}` und `export type` — alles andere wirft einen Fehler, statt still falschen Code zu erzeugen |
| `services.mjs` | **Generator der sechs Leistungsseiten.** Enthält das Datenmodell (`SERVICES`) und hebt Header, Menü, Notfall-Assistent, Footer und Callbar direkt aus `index.html` — eine Änderung an der Startseite wandert automatisch mit |
| `qa.mjs` | Playwright-Prüfung, 16 Seiten × 6 Auflösungen (§15) |
| `perf.mjs` | Misst Frame-Zeiten während eines vollständigen Scroll-Durchlaufs |
| `artifact.mjs` | Baut Einzeldatei-Vorschauen: CSS und JS eingebettet, Bilder als Data-URI, Rechtsseiten als `:target`-Overlays |
| `server.mjs` | 37-Zeilen-Dev-Server ohne Abhängigkeiten |
| `make-relative.mjs` | Schreibt absolute Pfade in relative um — nur für GitHub-Pages-Projektseiten |
| `shoot-at.mjs`, `shoot-page.mjs`, `interact.mjs`, `sheet.mjs` | Screenshots an definierten Scrollpositionen, Interaktionstests, Kontaktbögen |

---

## 4. Frontend-Architektur

Es gibt kein Framework. Statt dessen gilt ein Muster, das man in einem Absatz erklären kann:

> **HTML beschreibt die Struktur. CSS beschreibt alle Zustände. TypeScript setzt nur Klassen und CSS-Variablen — es baut niemals DOM auf, außer beim Text-Splitting.**

Daraus folgt alles Weitere.

### Lebenszyklus einer Seite

```
1. HTML wird geparst
2. <link> CSS  – blockierend, damit es keinen Flash gibt
3. <script type="module" defer>  – lädt parallel, führt nach dem Parsen aus
4. boot()
   ├─ scroll.init()        Scroll-Engine zuerst: alles andere misst gegen sie
   ├─ initHeader/MobileNav/Anchors/Faq/Emergency/ContactForm
   ├─ initReveals()        IntersectionObserver hängt sich an [data-reveal]
   ├─ initCursor/Magnetic  nur wenn env.hasPointer
   ├─ init<Bühnen>()       registrieren ihre Timelines
   └─ initLoader(heroReady)
5. on('load')  →  relayoutSplits() + timeline.refreshAll()
6. setTimeout(600)  →  refreshAll() erneut (Webfonts/späte Bilder)
```

Nach `resize` läuft `refreshAll()` entprellt (180 ms). Es ist **die einzige Stelle**, an der Positionen gemessen werden — alle Trigger auf einmal, danach wird nur noch gerechnet. Genau das verhindert Layout-Thrashing.

### Serverkomponenten, Layouts, Ladezustände, Fehlerbehandlung

Gibt es nicht, weil es keinen Server im Renderpfad gibt:

- **Layouts** → wiederholte HTML-Blöcke, die `build/services.mjs` aus `index.html` hebt
- **Ladezustände** → `loader.ts` zeigt einen Balken, bis das erste Hero-Bild steht. Sonst nichts: Die Seiten sind statisch und in ~200 ms interaktiv
- **Fehlerbehandlung** → jede `init…()` steigt still aus, wenn ihre Elemente fehlen. Ein fehlender Canvas nimmt nicht die ganze Seite mit. Versandfehler werden im Formular offen angezeigt statt verschluckt
- **404** → `404.html`, von Vercel automatisch bedient

### Formulare

Zwei Stück, beide nach demselben Muster:

1. **Browser-Validierung** ist nur Komfort: `.field.is-invalid` wird gesetzt, das erste fehlerhafte Feld bekommt Fokus
2. **Absenden** → `fetch` mit JSON gegen `/api/kontakt`
3. **Serverseitige Validierung** entscheidet — sie traut dem Browser nichts (§8)
4. **Rückfall**: Ist `ENDPOINT` leer, übergibt das Formular an `mailto:`. Die Online-Vorschau macht genau das automatisch, weil es dort keine Function gibt

Der **Notfall-Assistent** ist kein Formular, sondern ein fünfstufiger Dialog im Modal. Er führt bewusst zum Telefon — im Notfall ist das der schnellste Weg — und bietet das Absenden als Alternative an.

### Wiederverwendbare UI-Bausteine

Sie sind CSS-Klassen, keine Komponenten. Für eine neue Seite kopiert man Markup und bekommt Verhalten und Gestaltung geschenkt:

`.btn` (`--signal`/`--ghost`/`--light` × `--sm`/`--lg`) · `.field` (Input mit schwebendem Label, Fehlerzustand) · `.faq__item` · `.chip` · `.panel` · `.sec-head` · `.shell` (`--narrow`, `--text`) · `.scope__grid` · `.facts3__grid` · `.flow3__grid` · `.more__grid` · `.statement` · `.svc-cta`

### Responsives System

Mobile first, aber **ohne Breakpoint-Gerüst**. Der größte Teil skaliert stufenlos über `clamp()`; Breakpoints gibt es nur dort, wo sich die Anordnung wirklich ändern muss:

| Breite | Was passiert |
|---|---|
| ≤ 560 px | Einspaltige Raster |
| ≤ 620 px | Aktanzeige des Films verkleinert |
| ≤ 760 px | Filmspuren kürzer, Scrim stärker, Markenauflösung kompakter |
| ≤ 780 px | Leistungsumfang einspaltig |
| ≤ 860 px | `env.isSmall` — **auch die Canvas-Qualität sinkt** |
| ≤ 900 px | Bühnen-Layouts stapeln |
| ≤ 1000 px | Burger statt Navigation |

Getestet wird gegen 390 / 430 / 768 / 1440 / 1920 / 2560.

---

## 5. Design-System

### Die Token-Datei ist die Wahrheit

`assets/css/tokens.css` (157 Zeilen) enthält **jede** Gestaltungsentscheidung. Wer eine Farbe, einen Abstand oder eine Kurve ändern will, ändert sie dort — nicht in einer Komponente.

### Farbe

| Rolle | MTC | ING | Regel |
|---|---|---|---|
| Helle Fläche | `--bone: #F5F3EF` (warm) | `#F3F7FD` (kühl) | Haupt-Hintergrund |
| Tiefes Dunkel | `--ink: #0A0A0B` | `#05091A` (Navy) | Dunkle Sektionen, Text auf Hell |
| Signalfarbe | `--signal: #F8C210` | `#2E7CF6` | Akzent, direkt aus der Wort-Bild-Marke abgenommen |
| Fläche für Schaltflächen | — | `--signal-strong: #1C63DC` | ING: Blau trägt **weiße** Schrift; Gelb trägt dunkle |
| Akzent auf Hell | `--signal-deep: #8A6400` | `#0F4491` | **Wichtig:** Gelb bzw. helles Blau hat auf hellem Grund zu wenig Kontrast. Für kleine Labels gibt es deshalb eine dunkle Variante |
| Nacht | `--night: #05070C` | `#03060E` | Filmbühnen |
| Fehler | `--error: #C0392B` | dito | **Nur** Formularfehler |
| Bremslicht | `--brake: #FF2E1F` | dito | **Nur** echtes Bremslicht im Film |

Abgeleitete Werte werden nicht hartkodiert, sondern gemischt:

```css
--line:       color-mix(in oklab, var(--ink) 12%, transparent);
--glass-dark: color-mix(in oklab, var(--ink) 46%, transparent);
```

**Der Zwei-Marken-Trick:** `ing.css` wird als **letzte** Stylesheet-Datei geladen und definiert den kompletten `:root`-Block neu. Weil jede Regel im System über Tokens arbeitet, wird damit die ganze Site blau — Buttons, Linien, Karten, Glows, Schatten, Fokusringe, sogar das Szenenlicht. Es musste keine einzige Komponentenregel übermalt werden. **Das ist das wichtigste übertragbare Muster dieses Projekts.**

### Typografie

Reiner System-Stack, bewusst:

```css
--font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
                "Segoe UI Variable Display", "Segoe UI", Roboto, …;
--font-mono:    ui-monospace, SFMono-Regular, "SF Mono", "Segoe UI Mono", Menlo, …;
```

Elf Stufen, alle mit `clamp()` — es gibt keine Media Query für Schriftgrößen:

```
--step--2 … --step-8      0,69rem → 11,5rem
--display / --display-xl  bis 17rem für die ganz großen Momente
```

Dazu vier Tracking-Werte (`-0.035em` Display bis `0.22em` Mono-Labels) und vier Zeilenhöhen (0,90 Display bis 1,58 Fließtext). **Regel:** Große Schrift bekommt negatives Tracking, kleine Mono-Labels positives. Das ist der Unterschied zwischen „groß" und „hochwertig".

### Abstände, Radien, Schatten

```css
--gutter: clamp(1.25rem, 0.6rem + 3vw, 4.5rem);   Seitenrand
--sect-y: clamp(6rem, 3.4rem + 10vw, 15rem);      Sektionsabstand
--maxw: 1600px;  --maxw-text: 62ch;
--radius-xs 4 · sm 8 · (base) 14 · lg 22 · xl 34 · pill 999px
--shadow-panel: dreifach gestaffelt (2px / 18px / 60px) — ein Schatten allein wirkt flach
```

### Motion-Tokens

```css
--dur-xs 120ms · sm 240 · md 380 · lg 620 · xl 980
--ease-out-expo: cubic-bezier(0.16, 1, 0.30, 1)     Standard für Reveals
--ease-swift:    cubic-bezier(0.22, 0.61, 0.36, 1)  Standard für UI
```

### Komponenten im Detail

- **Buttons** — `.btn` mit lokalen Variablen `--btn-bg/--btn-fg/--btn-hover`. Varianten überschreiben nur diese drei. Mindesthöhe 44 px (`--lg`: 58 px)
- **Karten** — `.panel` (dunkle Medienfläche mit gestaffeltem Schatten), `.facts3__cell`, `.klass__cell`. **Nicht alles ist eine Karte:** Listen wie `.scope__grid` und `.club__list` arbeiten mit Haarlinien statt Rahmen
- **Tabellen** — gibt es auf den Seiten nicht. Wo Daten anfallen, stehen Definitionslisten (`.contact__fact`)
- **Formulare** — `.field` mit schwebendem Label über `:placeholder-shown`, animierter Unterlinie, `.is-invalid`-Zustand. **Nie nur Farbe als Fehlerhinweis** — es gibt zusätzlich Text
- **Modal** — `.emergency`, `role="dialog"`, `aria-modal`, Fokusfalle über `keydown`, Escape schließt, Scroll wird gesperrt (`scroll.stop()`)
- **Navigation** — `.site-header` (fixiert, blendet beim Hochscrollen ein), `.mobile-nav` (Overlay, gestaffelte Einblendung über `--i`), `.mobile-callbar` (nur mobil, fixiert unten)

### Was bei einer neuen Seite wiederverwendet wird

**Immer:** `tokens.css`, `base.css`, `components.css`
**Meistens:** `sections.css` (FAQ, Kontakt, Footer)
**Nach Bedarf:** `premium.css` (`.statement`, `.sec-head`, `.flow3`), `service.css` (`.scope`, `.facts3`, `.area`, `.more`, `.svc-cta`, `.crumb`)
**Nur ING:** `ing.css`

---

## 6. Motion-System

Der wichtigste Abschnitt. Alles hier ist selbst gebaut.

### Das Grundprinzip

> **Jede scrollgesteuerte Bewegung ist eine reine Funktion des Scrollfortschritts.**

Kein Zustand, keine Tweens, keine Zeitachse, die weiterlaufen könnte. Wer zurückscrollt, sieht **framegenau** dasselbe Bild wie beim Hinscrollen. Wer mit dem Finger mitten in den Unfall fährt und stehen bleibt, bekommt exakt den Frame, der zu dieser Position gehört. Das ist der eigentliche Grund, warum sich die Seite „direkt" anfühlt.

Ausnahme: Blinker, Blaulicht und Pulsringe laufen über die Uhr — sonst würden sie bei stehendem Scroll einfrieren.

### Schicht 1 — Smooth Scrolling (`scroll.ts`)

Nach Lenis-Prinzip, aber in 211 Zeilen:

```ts
onWheel:  target += deltaY * unit * 1.45      // Vorzeichen, Zeilen-/Seitenmodus
tick(dt): y = damp(y, target, 11.5, dt)       // rahmenratenunabhängig
          window.scrollTo(0, y)               // ← der echte Scrollwert
```

**Die entscheidende Designentscheidung:** Es wird **nicht der Inhalt transformiert**, sondern der echte Scrollwert gesetzt. Dadurch funktionieren `position: sticky`, `position: fixed`, IntersectionObserver, Ankerlinks, Browser-Suche und Screenreader unverändert. Transformiert man den Inhalt (wie viele Smooth-Scroll-Bibliotheken), bricht `sticky` — und damit das gesamte Sticky-Storytelling.

Weitere Eigenschaften:
- **Nur Desktop.** Auf Touch bleibt natives Scrolling aktiv — bessere Haptik, keine iOS-Momentum-Probleme, weniger Last
- Bei `prefers-reduced-motion` abgeschaltet
- `window.__mtcNoSmooth = true` schaltet die Glättung ab — **Testhaken**, damit Playwright exakte Scrollpositionen setzen kann
- Springt der native Scroll um mehr als 1,5 Viewporthöhen (Ankersprung, Suche), synchronisiert die Engine hart statt hinterherzukriechen

### Schicht 2 — Scroll-Timelines (`timeline.ts`)

Ein minimales ScrollTrigger:

```ts
track(el, {
  start: 'top top',      // Elementkante  Viewportkante
  end:   'bottom bottom',
  onUpdate: (p) => { … } // p läuft 0 → 1
});
```

Die Kanten-Syntax versteht `top|center|bottom|<n>%`, dazu Offsets `+=120`, `-=10%` und die Kurzform `end: '+=1200'`.

**Warum das schnell ist:** `refreshAll()` misst **alle** Trigger in einem Durchgang und schreibt `startY`/`endY` fest. Der Tick rechnet danach nur noch `(y - startY) / (endY - startY)` — keine einzige Layout-Abfrage pro Frame.

### Schicht 3 — Reveals (`reveal.ts`)

`splitText()` zerlegt Überschriften in Wörter oder Zeichen und verpackt jedes in `.split__i > .split__in`. Der Originaltext wandert vorher in `aria-label`, die Fragmente bekommen `aria-hidden` — **Screenreader lesen den Satz, nicht 40 Einzelbuchstaben.**

Ein IntersectionObserver setzt `.is-in`. Alles Weitere ist CSS:

| Attribut | Wirkung |
|---|---|
| `data-reveal="fade"` | Opazität |
| `="up"` | 26 px nach oben + Opazität |
| `="blur"` | Unschärfe 14 px → 0, leichte Skalierung |
| `="clip"` | `clip-path` fährt auf |
| `="mask"` | Zeilen fahren aus der Maske, 42 ms Versatz je Fragment |
| `="mask-fast"` | dito, 22 ms |
| `="soft"` | Unschärfe + Versatz je Fragment |
| `="scale"` | von 1,06 herunter |

Verzögerungen kommen aus `--rv-delay`, der Fragmentindex aus `--i`. **Stagger ist damit reines CSS** — kein JavaScript pro Element.

### Sticky-Storytelling

Das wiederkehrende Muster für jede gepinnte Sektion:

```html
<section class="film">
  <div class="film__track" id="film-track">   <!-- block-size: 420vh — die Scrollstrecke -->
    <div class="film__stage">                 <!-- position: sticky; block-size: 100svh -->
      …
    </div>
  </div>
</section>
```

Die **Spur** legt fest, wie lange die Sektion dauert. Die **Bühne** klebt und wird bespielt. `track()` liefert den Fortschritt dazu. Mehr ist es nicht — und genau deshalb funktioniert es überall gleich.

Verwendet für: MTC-Hero (220vh), Werkstatt, Leistungen (420vh), Bergung (300vh), 24/7 (190vh), Aussagen (170vh), Leistungsseiten-Kopf (200vh), ING-Film (420vh).

### Weitere Bewegungen

- **Parallax** — sparsam, nur `transform: translate3d()` als Funktion des Sektionsfortschritts (Fahrzeugklassen-Zeichnungen, Werkstatt-Panel)
- **3D-Transformationen** — bewusst keine im DOM. Die Tiefe entsteht im Canvas, nicht über `perspective`
- **Seitenübergänge** — keine. Die Seiten laden in ~200 ms; ein Übergang würde sie langsamer machen
- **Hover** — magnetische Buttons (`data-magnetic="0.3"`, Stärke als Zahl), eigener Cursor mit Zuständen (`data-cursor="cta"`, `data-cursor-label="Notfall"`), Unterstreichungen, Icon-Versatz. Alles nur bei `env.hasPointer`
- **Bühnen-Rückzug** — am Ende jeder Filmbühne: `scale(1 − t·0.12)` plus `borderRadius: t·32px`. Daraus entsteht die Übergabe in den hellen Seitenkörper. Ein wiederkehrendes Motiv, kein Einzeleffekt

### `prefers-reduced-motion`

Kein nachträglicher Schalter, sondern ein zweiter Auslieferungszustand:

1. `env.prefersReducedMotion` schaltet Smooth Scrolling ab
2. `html[data-motion="reduced"]` setzt **alle** Spuren auf `block-size: auto` und alle Bühnen auf `position: static` — die Sticky-Dramaturgie verschwindet vollständig
3. Jede `init…()` prüft die Einstellung und stellt ihren Endzustand direkt her, statt zu animieren
4. Der Film wird **einmal** bei `p = 0.9` gezeichnet (`renderStatic`) und danach nie wieder
5. `qa.mjs` prüft ausdrücklich, dass in diesem Modus `h1` und alle Textmomente sichtbar sind

### Performance

| Maßnahme | Wirkung |
|---|---|
| Nur `transform`, `opacity`, `filter` animieren | Nichts löst Layout aus |
| Eine rAF-Schleife mit Reihenfolge | Keine konkurrierenden Loops |
| Gebündelte Messung in `refreshAll()` | Kein Layout-Thrashing |
| `activateInView()` | Szenen außer Sicht rechnen nicht |
| Gecachte Hintergrundebenen | Himmel, Boden, Vignette einmal zeichnen, pro Frame nur kopieren |
| Pixelbudget (§7) | Deckelt die Zeichenfläche auf großen Displays |
| Detailgrad an Fläche gekoppelt | Weniger Laternen, sobald die Fläche wächst |
| `needsRender`-Flag | Ohne Scroll und ohne Blinken wird gar nicht gezeichnet |

**Gemessen** (`build/perf.mjs`, vollständiger Scroll-Durchlauf, Median der Frame-Zeit):

| Seite | 390×844 | 1440×900 | 2560×1440 |
|---|---|---|---|
| `/gutachten/` (ING-Film) | **16,7 ms** | **16,7 ms** | **16,7 ms** |
| `/` (MTC-Startseite) | 16,7 ms | 16,6 ms | 16,9 ms |
| `/abschleppdienst/` | 16,6 ms | 16,6 ms | **46,9 ms** |

16,7 ms = 60 fps. **Der Ausreißer ist bekannt und erklärbar:** Die Leistungsseiten nutzen `createAmbient()`, das für kleine Vorschauflächen gebaut wurde und pro Frame die volle Szene neu zeichnet. Der ING-Film nutzt den gecachten Pfad (`createIngFilm`) und bleibt deshalb auch auf 5K bei 60 fps. **Behebbar**, indem man den Filmkopf der Leistungsseiten auf denselben gecachten Pfad umstellt.

### Die Filmarchitektur im Detail

Beide Filme (`film.ts` für MTC, `ingFilm.ts` für ING) folgen demselben Aufbau. Am Beispiel ING:

**Aufteilung in Akte**

```ts
export const ACT = {
  driveEnd: 0.200,  brakeFrom: 0.205, impactAt: 0.268, crashEnd: 0.330,
  policeFrom: 0.355, policeHere: 0.500,
  expertFrom: 0.590, expertHere: 0.720,
  techFrom: 0.800,
} as const;
```

**Wegstrecke aus einem Geschwindigkeitsprofil**

Das Fahrzeug darf sich nicht linear zum Scroll bewegen — es beschleunigt, bremst und steht. Also wird eine Geschwindigkeit definiert und **integriert**:

```ts
function speedAt(p) { … }                    // Meter pro Fortschrittseinheit
const DIST_TABLE = /* 600 Stützstellen, Trapezregel */;
function distanceAt(p) { /* Nachschlagen + lineare Interpolation */ }
const CRASH_Z = distanceAt(ACT.impactAt);    // Aufprallort, einmal berechnet
```

Damit ist die Position konstant schnell abfragbar und über die ganze Fahrt konsistent.

**Kamera als fünf Kurven**

`camBack`, `camSide`, `camHeight`, `camZoom`, `camYawAt` — jede eine stückweise `lerp` mit Easing über die Aktgrenzen. Beim Aufprall kommt Kameraschütteln dazu, mit abklingender Amplitude:

```ts
cam.shakeX = shakeAmp * shakeDecay(shakeT, 11, 5.4);
cam.roll   = shakeAmp * 0.0013 * shakeDecay(shakeT + 0.07, 8, 5);
```

**Zeichenreihenfolge pro Frame**

```
Hintergrund (gecacht) → Sterne → zwei Baumreihen → Fahrbahn → Mittelstreifen
→ Leitplanke (mit Schadenstelle) → Leitpfosten → Laternen
→ Scheinwerferkegel → Fahrzeuge nach Tiefe sortiert → Gutachter
→ Staub + Trümmer + Lichtblitz
→ [Akt 5] blauer Schleier + technische Zeichnung
→ Vignette/Post → Verlauf für die Typografie
```

**Akt 5 — aus der Szene wird die Aufnahme.** Kein Schnitt, sondern eine Überblendung: Ein Schleier legt sich über das Bild, darüber erscheinen Raster, schraffierte Schadenzone, drei Messpunkte mit Fahnen und eine Bemaßung. Alles ist an der **projizierten Lage des Fahrzeugs** verankert, damit die Zeichnung mit der Kamerafahrt zusammenbleibt statt darüber zu schweben. Zwei Sicherungen: Die Größe ist auf 30 % der Viewporthöhe gedeckelt (20 % mobil), und die Position wird in den sichtbaren Bereich geklemmt — sonst zeigt die Zeichnung ausgerechnet dort nichts, wo es um Vollständigkeit geht.

**Ansteuerung** (`ingHero.ts`): Eine Timeline treibt vier Dinge gleichzeitig — Film, Textmomente je Akt (Fenster als `[ein, voll, aus-beginn, aus-ende]`), Aktanzeige (fünf Segmente) und die Markenauflösung am Ende. Weil alles an derselben Timeline hängt, können Bild und Text nicht auseinanderlaufen.

---

## 7. Das „3D"-System

**Es gibt kein Three.js, kein React Three Fiber, kein WebGL, keine Modelle, keine Texturen.** Die gesamte räumliche Wirkung entsteht in **Canvas 2D** mit einer selbst geschriebenen Lochkamera-Projektion.

### Warum

Die Szene ist eine Landstraße bei Nacht: Himmel, Boden, Fahrbahn, Leitplanke, ein paar Laternen, zwei bis drei Fahrzeuge. Alles davon sind Farbverläufe und Polygone. Ein WebGL-Stack hätte 150 KB Bibliothek, ein Materialsystem und eine Ladezeit für Modelle gebracht — für ein Bild, das aus Verläufen besteht. Canvas 2D zeichnet Verläufe hervorragend.

### Die Projektion (`world.ts`, 24 Zeilen Kern)

```ts
export function project(wx, wy, wz, cam, vp): Projected {
  const dx = wx - cam.x, dz = wz - cam.z;
  const c = Math.cos(cam.yaw), sn = Math.sin(cam.yaw);
  const rx = dx * c - dz * sn;          // Kamera-Gierung
  const rz = dx * sn + dz * c;
  if (rz <= 0.7) return { ok: false };  // hinter der Kamera
  const s = cam.focal / rz;             // Skala = Brennweite / Tiefe
  return { x: vp.cx + rx * s, y: vp.horizon + (cam.y - wy) * s, s, ok: true };
}
```

Das ist die ganze 3D-Mathematik. Weltkoordinaten in Metern: **x** seitlich, **y** Höhe, **z** Tiefe. Die zurückgegebene Skala `s` wird überall als Maßstab verwendet — ein Rad mit Radius 0,32 m wird zu `0.32 * s` Pixeln. Dadurch stimmen die Größenverhältnisse automatisch über die ganze Tiefe.

### Kamera

```ts
interface Camera { x, y, z, focal, yaw, pitch, roll, shakeX, shakeY }
```

`focal` skaliert mit der Fensterbreite (`W * 0.62 + 320`), damit der Bildausschnitt auf allen Geräten vergleichbar bleibt. `pitch` verschiebt den Horizont, `roll` dreht den ganzen Kontext (nur beim Aufprall).

### Beleuchtung

Es gibt kein Lichtmodell. Licht ist gemalt:
- Laternen = radiale Verläufe plus ein elliptischer Lichtkegel auf der Fahrbahn
- Scheinwerfer = abgeflachter radialer Verlauf vor dem Fahrzeug
- Blaulicht = zwei gegenläufig pulsende Kuppeln plus ein linearer Streulicht-Verlauf über die Fahrbahn
- Tablet des Gutachters = die einzige Lichtquelle an der Figur — dadurch erzählt sie die Handlung

### Die Bausteine

**`world.ts` (559 Zeilen)** — die Welt:

| Funktion | Aufgabe |
|---|---|
| `project`, `viewport`, `makeCamera`, `roadX` | Projektion, Blickfeld, Straßenverlauf (Sinus-Schlängelung) |
| `makeSky`, `paintBackdrop` | **Gecachte** Hintergrundebene: Himmel, Horizontdunst, fernes Stadtlicht, Boden. Einmal gezeichnet, pro Frame nur vertikal versetzt kopiert — **der größte Performance-Hebel der Szene** |
| `makeStars`, `paintStars` | Sterne, gebündelt in einem Pfad |
| `paintTreeline` | Zwei Baumreihen in unterschiedlicher Tiefe |
| `paintRoad`, `paintLaneDashes`, `paintDelineators` | Fahrbahn mit Glanz, Mittelstreifen, Leitpfosten |
| `paintGuardrail` | Leitplanke, optional mit Schadenstelle an `damageZ` |
| `paintStreetlights` | Laternen mit Mast, Leuchte, Glühen und Lichtkegel |
| `makePostLayers`, `paintPost` | **Gecachte** Vignette und oberer Verlauf |
| `makeGrain` | Filmkorn als kacheln­des Muster (nur MTC, nur bei hoher Qualität) |
| `WorldTheme`, `setWorldTheme`, `NIGHT_BLUE` | **Umschaltbares Farbthema** — siehe unten |

**`vehicles.ts` (769 Zeilen)** — was sich bewegt:

| Funktion | Zustand | Beschreibung |
|---|---|---|
| `paintCar` | `{x, z, yaw, brake, hazard, tilt, damage}` | Pkw von hinten. Gierung über eine Scher-Transformation (`ctx.transform`), dadurch wirkt es gedreht, ohne echtes 3D-Modell |
| `paintTowTruck` | `{x, z, beaconPhase, headlights, approach}` | MTC-Bergungsfahrzeug in gelber Livree, Chevron-Stoßfänger |
| `paintPoliceCar` | `{x, z, beaconPhase, headlights, approach}` | Streifenwagen, Balken mit zwei gegenläufigen Kuppeln |
| `paintInspector` | `{x, z, appear, screen}` | Gutachter als Silhouette mit leuchtendem Tablet |
| `makeDebris`, `paintDebris` | Partikel | Trümmer mit Ballistik (`y + vy·t − ½g t²`). Flag `cool` schaltet von warmen auf kühle Partikel |
| `paintDust` | — | Wenige große, weiche Wolken statt vieler Partikel |
| `paintFlash` | — | Lichtblitz beim Aufprall |

**`canvas.ts` (55 Zeilen)** — die Zeichenfläche mit dem **Pixelbudget**:

```ts
const area = w * h;
const budget = env.isSmall ? 2_400_000 : area > 2_400_000 ? 2_300_000 : 3_200_000;
const fit = Math.sqrt(budget / area);
const dpr = Math.max(0.75, Math.min(devicePixelRatio, env.maxDpr, fit));
```

Auf einem 5K-Display würde die native Auflösung ~15 Megapixel bedeuten. Das Budget deckelt die tatsächliche Zeichenfläche — ein leicht hochskaliertes Bild ist allemal besser als eine ruckelnde Kamerafahrt. Die Untergrenze 0,75 erlaubt bewusst auch Werte unter 1.

**Das umschaltbare Farbthema** — das zweitwichtigste übertragbare Muster nach den Design-Tokens:

```ts
setWorldTheme(NIGHT_BLUE);   // vor createIngFilm()
const film = createIngFilm(canvas);
```

`world.ts` kennt seine Farben nicht mehr fest, sondern liest sie aus einem `WorldTheme`-Objekt (Himmel, Horizont, Boden, Laternen, Lichtkegel, nasse Streifen). Aus derselben Geometrie wird dadurch ohne zweite Engine eine andere Marke. Der Himmel wird beim Erzeugen der Szene einmal gecacht — deshalb muss das Thema **vor** `createFilm`/`createIngFilm` gesetzt werden.

### Wiederverwendbare Bausteine

| Baustein | Entspricht | Datei |
|---|---|---|
| `createFilm(canvas)` | `CollisionScene3D` | `scene/film.ts` |
| `createIngFilm(canvas)` | dito, fünf Akte | `scene/ingFilm.ts` |
| `createAmbient(canvas, variant)` | leichte Szene für Vorschauflächen, 8 Varianten | `scene/ambient.ts` |
| `createSurface(canvas)` | DPR-Handling + Pixelbudget | `scene/canvas.ts` |
| `paintCar` / `paintPoliceCar` / `paintTowTruck` / `paintInspector` | `Vehicle` | `scene/vehicles.ts` |
| `paintRoad` + `paintGuardrail` + `paintDelineators` | `Road` | `scene/world.ts` |
| `initIngHero()` / `initServiceHero()` | `SimulationController` | `components/` |

Alle Film-Handles haben dieselbe Schnittstelle:

```ts
interface FilmHandle {
  setProgress(p: number): void;   // 0..1, vom Scroll
  setActive(v: boolean): void;    // aus, wenn außer Sicht
  renderStatic(p: number): void;  // ein Bild für reduced-motion
  destroy(): void;
}
```

### Kollisionen

Es gibt **keine Kollisionsberechnung**. Der Unfall ist choreografiert: Der Aufprallzeitpunkt steht als Konstante (`ACT.impactAt`) fest, der Aufprallort ergibt sich aus der integrierten Wegstrecke (`CRASH_Z`). Alles Weitere — Gierung, Neigung, Verformung, Trümmer, Schütteln — sind Funktionen des Fortschritts ab diesem Punkt. Eine Physiksimulation wäre nicht nur teurer, sondern auch **nicht deterministisch** und damit unbrauchbar für einen Scroll-Scrub.

---

## 8. Backend-Architektur

Das gesamte Backend ist **eine Datei mit 150 Zeilen**: `api/kontakt.js`.

### Der Weg einer Anfrage

```
Browser
  │  Nutzer füllt Formular oder Notfall-Assistent aus
  ▼
contactForm.ts / emergency.ts
  │  Browser-Validierung (nur Komfort)
  │  POST /api/kontakt  ·  application/json
  │  { site, form, name, phone, email, topic, message, website, t }
  ▼
Vercel Serverless Function (Node, CommonJS)
  ├─ 1. Methode ≠ POST                → 405
  ├─ 2. Body kein Objekt              → 400
  ├─ 3. Honigtopf `website` gefüllt   → 200 (still verworfen)
  ├─ 4. Ausgefüllt in < 2 s           → 200 (still verworfen)
  ├─ 5. site → Empfänger aus ENV      (NIE aus dem Request)
  ├─ 6. Konfiguration unvollständig   → 500 + Serverlog
  ├─ 7. Ratenbegrenzung pro IP        → 429
  ├─ 8. Felder säubern und kürzen     (clean(), Längengrenzen)
  ├─ 9. Pflichtfelder fehlen          → 400
  ├─ 10. HTML maskieren               (esc())
  └─ 11. POST an Brevo /v3/smtp/email
         ├─ ok    → 200 { ok: true }
         └─ Fehler → 502 + Serverlog
  ▼
Postfach  (Reply-To = anfragende Person, falls E-Mail angegeben)
```

### Die drei tragenden Entscheidungen

**1. Die Empfängeradresse kommt niemals aus dem Formular.**

```js
const SITES = {
  mtc: { label: 'MTC AUTOSERVICE', env: 'MAIL_TO_MTC' },
  ing: { label: 'ING GUTACHTEN',   env: 'MAIL_TO_ING' },
};
const to = process.env[site.env] || process.env.MAIL_TO_MTC;
```

Der Browser schickt nur einen Schlüssel (`"mtc"` / `"ing"`), die Adresse steht in den Umgebungsvariablen. Ein unbekannter Schlüssel fällt auf MTC zurück. **Ohne diese Trennung wäre das Formular ein offener Mailversender** — jeder könnte die Adresse manipulieren und über Ihre Domain versenden.

**2. Antworten sind absichtlich wortkarg.** Kein Endpunkt verrät, woran genau es gescheitert ist. Honigtopf und Zu-schnell-Absenden geben sogar `200` zurück — sonst lernt der Bot, was ihn verraten hat.

**3. Server-Validierung ist die einzige, die zählt.** Die Browser-Prüfung erzeugt Rückmeldung, mehr nicht.

### Ratenbegrenzung

```js
const LIMIT_WINDOW_MS = 10 * 60 * 1000;  // 10 Minuten
const LIMIT_MAX = 5;
const hits = new Map();  // IP → Zeitstempel[]
```

**Grenze, ehrlich benannt:** Der Speicher gilt nur für die aktuelle Function-Instanz. Gegen verteilte Angriffe hilft das nicht, gegen ein hängendes Skript oder einen einfachen Bot schon. Wer mehr braucht, hängt Vercel KV oder Upstash Redis dahinter — das sind etwa 15 Zeilen.

### Was es nicht gibt

**Serveraktionen, Datenbankzugriff, Prisma, Migrationen, Transaktionen, Sitzungen, Audit-Log.** Es wird nichts gespeichert — die Anfrage wird zugestellt und existiert danach nur noch im Postfach. Das ist datenschutzrechtlich die einfachste denkbare Lage: Es gibt keinen Datenbestand, über den Auskunft zu erteilen wäre.

---

## 9. Datenbank

**Es gibt keine.** Weder PostgreSQL noch Prisma, kein Schema, keine Modelle, keine Beziehungen, keine Indizes, keine Transaktionen, keine Aktenzeichenvergabe, kein Audit-Log.

Persistente Daten im Projekt sind:
- **Statische Inhalte** — im HTML
- **Das Datenmodell der Leistungsseiten** — als JavaScript-Array in `build/services.mjs`, zur Bauzeit
- **Koordinaten des Einsatzgebiets** — als Konstante in `coverageMap.ts`

Auch im Browser wird nichts gespeichert: kein `localStorage`, kein `sessionStorage`, keine Cookies, kein IndexedDB. Die Angaben im Notfall-Assistenten liegen im Arbeitsspeicher, bis abgesendet oder das Fenster geschlossen wird. **Das ist die Grundlage der Aussage in der Cookie-Richtlinie** — und geprüft, nicht behauptet.

Wenn ein Folgeprojekt eine Datenbank braucht: §17.

---

## 10. Admin-System

**Nicht vorhanden.** Es gibt kein Dashboard, keine Fälle, Kunden, Fahrzeuge, Termine, Dokumente, Berichte, Rechnungen, Nutzer oder Berechtigungen — das wurde nie beauftragt.

Was existiert, sind zwei Stellen, an denen ein Admin andocken würde:

| Stelle | Heute | Mit Admin |
|---|---|---|
| `api/kontakt.js` | schickt eine E-Mail | schreibt zusätzlich in `inquiries` |
| `track()` in `util.ts` | feuert `CustomEvent`s | Anbindung an Analytics oder ein eigenes Event-Log |

Der Bauplan dafür steht in §17.

---

## 11. Öffentliche Website → Backend

Heute gibt es genau eine Verbindung: das Formular zur Serverless Function. Ein Endpunkt `/api/public/inquiries` existiert **nicht**. Das Folgende beschreibt, was implementiert ist — und daneben, wie der Weg zu einem Anfragen-Workflow aussähe.

### Anfrageformat (implementiert)

```http
POST /api/kontakt
Content-Type: application/json

{
  "site":    "mtc" | "ing",     // Schlüssel, NICHT die Adresse
  "form":    "Kontaktformular" | "Notfall-Assistent",
  "name":    "Max Muster",       // Pflicht
  "phone":   "0151 1234567",     // Pflicht, wenn keine E-Mail
  "email":   "max@example.de",   // Pflicht, wenn kein Telefon
  "topic":   "Panne",
  "message": "…",
  "website": "",                 // Honigtopf — muss leer sein
  "t":       1726300000000       // Zeitpunkt des Seitenaufrufs
}
```

**Antworten:** `200 {ok:true}` · `400` fehlende Pflichtfelder · `405` falsche Methode · `429` Ratenbegrenzung · `500` Konfiguration fehlt · `502` Brevo nicht erreichbar.

### Token-Mechanismus und Origin-Prüfung

**Heute keiner** — bewusst. Ein Token im Browser ist kein Geheimnis: Wer das Formular öffnet, kann ihn auslesen. Er würde Sicherheit vortäuschen, ohne welche zu schaffen. Die tatsächliche Absicherung liegt woanders: Empfänger aus ENV, Honigtopf, Zeitsperre, Ratenbegrenzung, Längengrenzen.

Vercel setzt für Funktionen im selben Projekt keine CORS-Header, wodurch ein Aufruf aus einer fremden Seite im Browser scheitert. Gegen ein direktes `curl` hilft das nicht — dagegen hilft nur die Ratenbegrenzung. Wer strenger werden will:

```js
const ORIGINS = ['https://www.mtc-autoservice.de', 'https://ing-gutachten.de'];
if (!ORIGINS.includes(req.headers.origin)) return res.status(403).json({ ok: false });
```

### Spamschutz

| Mechanismus | Umsetzung | Warum so |
|---|---|---|
| Honigtopf | `<p class="hp">` mit `input[name=website]`, `tabindex="-1"` | Absichtlich **nicht** `display: none` — manche Bots überspringen genau das. Statt dessen 1×1 px, `clip-path: inset(50%)`, `overflow: hidden` |
| Zeitsperre | `t` = Ladezeitpunkt, Server verwirft unter 2 s | Menschen tippen |
| Ratenbegrenzung | 5 Anfragen / 10 Minuten / IP | Bremst Sturmläufe |
| Längengrenzen | Name 120, Betreff 200, Nachricht 4000 Zeichen | Verhindert aufgeblähte Payloads |
| **Kein Captcha** | — | reCAPTCHA würde Google auf jeder Seite mitlesen lassen und die Eigenschaft zerstören, dass die Seite nichts von außen lädt |

### Wenn daraus ein Anfragen-Workflow werden soll

```
POST /api/kontakt
  → alle bestehenden Prüfungen
  → INSERT INTO inquiries (status='neu', source, payload, created_at)
  → E-Mail an das Postfach (wie heute)
  → 200
```

Im Admin: Liste offener Anfragen → Detailansicht → **„In Kunde umwandeln"** legt `customers` + `cases` an und setzt `inquiries.status = 'converted'` mit Verweis auf den Fall. Wichtig: die Anfrage **nicht löschen**, sondern als umgewandelt markieren — sonst fehlt später die Spur. Und den E-Mail-Versand beibehalten, auch wenn die Datenbank schreibt: Ein Postfach ist ausfallsicherer als ein Dashboard, in das niemand schaut.

---

## 12. Umgebungsvariablen

Alle Variablen sind **serverseitig**. Es gibt keine einzige öffentliche Variable, weil es keinen Client-Build gibt, in den etwas eingebettet würde. Werte werden in Vercel unter *Settings → Environment Variables* gesetzt, für **Production und Preview**.

| Variable | Zweck | Verwendet in | Sichtbarkeit | Platzhalter |
|---|---|---|---|---|
| `BREVO_API_KEY` | Schlüssel für die Brevo-Transaktions-API | `api/kontakt.js` | **Geheim** — niemals ins Repository, niemals ins Bundle | `xkeysib-xxxxxxxx…` |
| `MAIL_FROM` | Absenderadresse. Die Domain muss in Brevo verifiziert sein | `api/kontakt.js` | Nicht geheim, aber serverseitig | `website@ihre-domain.de` |
| `MAIL_FROM_NAME` | Anzeigename des Absenders (optional) | `api/kontakt.js` | Nicht geheim | `Website-Formular` |
| `MAIL_TO_MTC` | Postfach für Anfragen von MTC AUTOSERVICE | `api/kontakt.js` | **Serverseitig** — darf nicht im Browser stehen, sonst wird das Formular umleitbar | `info@ihre-domain.de` |
| `MAIL_TO_ING` | Postfach für Anfragen von ING GUTACHTEN | `api/kontakt.js` | dito | `info@ing-domain.de` |

Die Vorlage liegt als `.env.example` im Repository — **ohne Werte**. `.gitignore` schließt `.env` aus.

### Was niemals in den Browser gehört

- Der Brevo-API-Schlüssel — wer ihn hat, versendet über Ihr Konto
- Die Empfängeradressen — sonst ist das Formular umleitbar
- Jeder künftige Datenbank-Connection-String
- Jedes künftige Session- oder JWT-Secret

Faustregel: **Alles, womit jemand etwas tun kann, das er nicht tun soll.** Adressen, die ohnehin im Impressum stehen, sind kein Geheimnis — aber sie gehören trotzdem nicht in einen Request-Body, weil sie dort veränderbar wären.

---

## 13. Sicherheitsarchitektur

### Implementiert

| Mechanismus | Umsetzung |
|---|---|
| Serverseitige Validierung | Typ, Länge, Pflichtfelder in `api/kontakt.js` |
| HTML-Maskierung | `esc()` vor dem Einsetzen in den Mail-Body — verhindert HTML-Injektion in die Mail |
| Eingabe-Normalisierung | `clean()` kollabiert Weißraum und kürzt hart |
| Empfänger aus ENV | Der wichtigste Einzelschutz — kein offener Mailversender |
| Ratenbegrenzung | 5 / 10 min / IP, in-memory |
| Honigtopf + Zeitsperre | Siehe §11 |
| Wortkarge Fehler | Keine Auskunft über den Grund |
| Keine Secrets im Repository | `.env.example` ohne Werte, `.gitignore` |
| Keine externen Ressourcen | Die Seiten laden nichts von Drittservern — kein Skript, das Sie nicht kontrollieren |
| Kein Browser-Speicher | Kein `localStorage`, keine Cookies — nichts zu stehlen |

### Nicht vorhanden

**Authentifizierung, Sitzungen, RBAC, Passwort-Hashing, CSRF-Token, Audit-Log.** Es gibt keine Nutzerkonten und keinen geschützten Bereich — diese Mechanismen hätten nichts zu schützen.

### Wenn ein Folgeprojekt Konten braucht

- **Passwörter**: `argon2id` (Alternative: `bcrypt`, Kostenfaktor ≥ 12). Niemals selbst hashen, niemals SHA-256 ohne Salt
- **Sitzungen**: HttpOnly-Cookie mit `SameSite=Lax`, `Secure`, serverseitig gehaltene Session-ID. JWT im `localStorage` ist der klassische Fehler — per XSS auslesbar
- **RBAC**: Rollen in der Datenbank, Prüfung **serverseitig** in jeder Route. Die Oberfläche versteckt nur, sie schützt nicht
- **Audit-Log**: Append-only-Tabelle mit Akteur, Aktion, Objekt, Zeitpunkt, IP. In derselben Transaktion schreiben wie die Änderung, sonst entstehen Lücken
- **CSRF**: bei Cookie-Sitzungen Pflicht — Double-Submit-Token oder `SameSite=Strict` bei zustandsändernden Routen

---

## 14. SEO

### Pro Seite

```html
<title>…</title>
<meta name="description" content="…">
<link rel="canonical" href="https://…/">
<meta property="og:type|site_name|locale|title|description|url|image">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="…">
```

Rechtsseiten tragen zusätzlich `<meta name="robots" content="noindex, follow">`.

### Strukturierte Daten (JSON-LD)

| Seite | Typen |
|---|---|
| `/` | `AutoRepair` (Adresse, Telefon, Öffnungszeiten, `OfferCatalog` mit fünf Leistungen) + `FAQPage` mit acht Fragen |
| Leistungsseiten | `Service` (+ `provider` → `AutoRepair` der Startseite) + `BreadcrumbList` + `FAQPage` |
| `/gutachten/` | `ProfessionalService` + `hasOfferCatalog` + `FAQPage` |

**Bewusst ohne `AggregateRating`.** Ein Sterne-Durchschnitt ohne belegbare Datenbasis ist wettbewerbsrechtlich riskant und in den Google-Richtlinien für Rich Results ausdrücklich unzulässig. Lieber keine Sterne im Suchergebnis als erfundene.

### Sitemaps und robots.txt

Zwei getrennte Sites, zwei Sätze:

```
/robots.txt              /sitemap.xml              12 URLs (MTC + Leistungen + Recht)
/gutachten/robots.txt    /gutachten/sitemap.xml     3 URLs (ING)
```

Die ING-Dateien sind für den eigenständigen Betrieb unter `ing-gutachten.de` gedacht — dort wandert der Inhalt von `/gutachten/` ins Root.

### SEO-Architektur

Die sechs Leistungsseiten sind der Kern der SEO-Struktur. Jede ist eine eigene URL mit eigenem `title`, eigener Description, eigenem H1, eigenem Inhalt und eigenem `Service`-Markup — also eine vollwertige Landingpage für ihren Suchbegriff, nicht ein Anker auf der Startseite. Sie verlinken untereinander („Weitere Leistungen") und zurück zur Startseite; die Startseite verlinkt über „Jede Leistung hat ihre eigene Seite" in beide Richtungen.

**Dynamische Routen** gibt es nicht — alle URLs sind statisch. Neue Leistungsseiten entstehen durch einen Eintrag in `build/services.mjs` plus einen Lauf des Skripts.

**Checkliste vor dem Livegang:** Domain in `canonical`, `og:url`, `sitemap.xml` und `robots.txt` ersetzen (aktuell `www.mtc-autoservice.de` bzw. `ing-gutachten.de`).

---

## 15. Lokale Entwicklung

### Voraussetzungen

Node ≥ 18 (wegen des globalen `fetch`), TypeScript global oder lokal. Kein `npm install` nötig, weil es keine Produktionsabhängigkeiten gibt.

```bash
# 1. Projekt holen
unzip mtc-autoservice-website.zip && cd mtc

# 2. Werkzeuge (einmalig, global)
npm i -g typescript
npm i -g playwright && npx playwright install chromium   # nur für QA

# 3. Umgebungsvariablen
cp .env.example .env          # lokal nur nötig, wenn die Function getestet wird
                              # Werte NICHT committen

# 4. Datenbank
#    entfällt — es gibt keine

# 5. Prisma-Client
#    entfällt — kein Prisma

# 6. Migrationen
#    entfällt

# 7. Entwicklungsserver
node build/server.mjs         # → http://localhost:8099

# 8. Tests
node build/qa.mjs             # 16 Seiten × 6 Auflösungen
node build/perf.mjs /         # Frame-Zeiten, optional mit Pfad

# 9. Produktionsbau
npx tsc -p tsconfig.json      # src/ → assets/js/**
node build/bundle.mjs         # Module → assets/js/*.bundle.js
node build/services.mjs       # erzeugt die sechs Leistungsseiten neu
```

### Der übliche Arbeitszyklus

```bash
npx tsc -p tsconfig.json && node build/bundle.mjs && node build/qa.mjs
```

Wurden Header, Menü, Notfall-Assistent oder Footer in `index.html` geändert, zusätzlich `node build/services.mjs` — sonst laufen die Leistungsseiten auseinander.

### Was `qa.mjs` prüft

Pro Seite und Auflösung: JavaScript-Fehler und fehlgeschlagene Requests · horizontaler Überlauf · genau ein `<h1>` · tote Ankerziele · interaktive Elemente ohne zugänglichen Namen · Trefferflächen unter 40 px auf Mobil (Fließtext-Links ausgenommen — WCAG 2.5.8) · Format aller `tel:`-Links · interne Links, zu denen keine Datei existiert. Dazu ein eigener Durchlauf mit `prefers-reduced-motion`, der sicherstellt, dass `h1` und alle Textmomente sichtbar sind.

**Der Lauf muss ohne Befund durchgehen, bevor etwas live geht.**

---

## 16. Produktionsbetrieb

### Anforderungen

| Punkt | Wert |
|---|---|
| Hosting | Vercel (empfohlen) — statisch + eine Node-Function. Alternativ: jeder Static-Host, dann entfällt der Formularversand |
| Node | ≥ 18 für die Function |
| Build-Command | keiner nötig (ausgelieferter Stand ist gebaut). Mit `package.json`: `tsc -p tsconfig.json && node build/bundle.mjs && node build/services.mjs` |
| Start-Command | keiner — statisch |
| Ausgabeverzeichnis | Projektwurzel |
| Datenbank | keine |
| Migrationen | keine |
| SSL | von Vercel automatisch |

### Deployment

1. Repository mit Vercel verbinden (oder Ordner hochladen)
2. Framework Preset: **Other** / Static
3. Umgebungsvariablen setzen (§12), Production **und** Preview
4. Domain verbinden, DNS auf Vercel zeigen lassen
5. Deployen

**`assets/js/**` gehört mit ins Repository.** Der Server baut nichts — was im Repository liegt, wird ausgeliefert.

### Externe Dienste

| Dienst | Wofür | Kosten |
|---|---|---|
| Vercel | Hosting + Function | Hobby-Tarif genügt für den Umfang |
| Brevo | E-Mail-Versand | 300 Mails/Tag gratis |
| DNS-Anbieter | Domain, SPF/DKIM für Brevo | — |

**Der Schritt, den man nicht überspringen darf:** In Brevo die Absenderdomain verifizieren und die genannten DNS-Einträge (DKIM, DMARC, Brevo-Code) setzen. Ohne verifizierte Domain landen die Mails im Spam.

### Zwei Sites, zwei Domains

Heute liegt ING unter `/gutachten/`. Für den eigenständigen Betrieb:
1. Inhalt von `gutachten/` ins Root der zweiten Site
2. `assets/` daneben legen
3. Interne Pfade `/gutachten/impressum/` → `/impressum/` kürzen, ebenso die Logo-Links
4. `MAIL_TO_ING` im zweiten Vercel-Projekt setzen (oder beide Domains auf dasselbe Projekt zeigen lassen)

### GitHub Pages

Möglich, aber **ohne Formularversand** (keine Serverless Functions). Auf einer *Projektseite* zusätzlich `node build/make-relative.mjs` ausführen und `dist-pages/` deployen — sonst zeigen die absoluten Pfade ins Leere.

---

## 17. REUSABLE WEBSITE BLUEPRINT

Was lässt sich aus diesem Projekt in kommende Projekte übernehmen — und was nicht? Die ehrliche Antwort hängt davon ab, was das nächste Projekt braucht.

### Die Entscheidung zuerst

| Projekt | Empfehlung |
|---|---|
| Marketing-Site, Landingpages, Kampagne, Portfolio, Firmenauftritt | **Diese Architektur direkt.** Sie ist dafür gebaut und schlägt einen Framework-Stack in Ladezeit, Wartbarkeit und Datenschutz |
| Shop, Buchung, Login, Nutzerkonten, Admin, Mehrbenutzerbetrieb | **Nicht diese Architektur.** Nehmen Sie Next.js (App Router), Prisma, PostgreSQL, Auth.js. Übernehmen Sie daraus nur die Token-Ebene und das Motion-System — beides ist framework-unabhängig |
| Marketing-Site heute, Admin vielleicht später | Diese Architektur, aber von Anfang an auf Vercel mit `/api`. Der Umstieg auf Next.js ist später ein Umbau der Seiten, nicht der Gestaltung |

### Kernfundament — fast unverändert übernehmbar

| Teil | Dateien | Anpassung |
|---|---|---|
| **Design-Token-Ebene** | `tokens.css` | **Nur Farben tauschen.** Typo-Skala, Abstände, Radien, Easings passen für jedes Projekt. Das wertvollste Einzelstück |
| **Reset + Primitive** | `base.css` | Unverändert |
| **Laufzeit-Umgebung** | `core/env.ts` | Unverändert |
| **rAF-Schleife** | `core/raf.ts` | Unverändert |
| **Hilfsfunktionen** | `core/util.ts`, `core/easing.ts` | Unverändert |
| **Smooth Scrolling** | `core/scroll.ts` | Unverändert — allenfalls Faktor `1.45` und Dämpfung `11.5` nach Geschmack |
| **Scroll-Timelines** | `core/timeline.ts` | Unverändert |
| **Reveals** | `core/reveal.ts` + Reveal-Block in `components.css` | Unverändert |
| **Bundler** | `build/bundle.mjs` | Nur die Einstiegsliste anpassen |
| **Dev-Server** | `build/server.mjs` | Unverändert |
| **QA-Lauf** | `build/qa.mjs` | Seitenliste anpassen |

**Das sind rund 900 Zeilen, die ein neues Projekt sofort auf ein Niveau heben, das sonst drei Bibliotheken kostet.**

### Öffentliche Website — Muster übernehmen, Inhalt neu

| Teil | Anpassung |
|---|---|
| Kopf, Menü, Callbar, Modal (`components.css`) | Markup und Gestaltung weitgehend übernehmen, Marke tauschen |
| Sektionsbausteine (`.scope`, `.facts3`, `.flow3`, `.more`, `.statement`, `.svc-cta`) | Direkt übernehmen — sie sind inhaltsneutral |
| Seiten-Generator (`build/services.mjs`) | **Das Muster übernehmen, das Datenmodell neu schreiben.** Gemeinsame Bausteine aus einer Leitdatei heben statt kopieren |
| Bühnen (`premium.ts`) | Neu schreiben — sie erzählen eine bestimmte Geschichte |
| Texte | Immer neu |

### Admin-System — was zu bauen wäre

Nicht vorhanden. Für ein Folgeprojekt:

```
Next.js App Router
  app/(admin)/layout.tsx        Shell mit Navigation, Rollenprüfung
  app/(admin)/dashboard/        Kennzahlen, offene Anfragen
  app/(admin)/inquiries/        Eingang aus der öffentlichen Website
  app/(admin)/customers/[id]/   Kunde + zugehörige Fälle
  app/(admin)/cases/[id]/       Fall mit Dokumenten, Terminen, Kommunikation
  components/ui/                DataTable, FilterBar, StatusPill, DetailPanel …
```

Die vier Bausteine, die den Großteil eines Admins ausmachen und projektübergreifend gleich bleiben: **DataTable** (Sortierung, Filter, Seitenumbruch), **DetailPanel**, **StatusPill**, **AuditTrail**. Wer die einmal sauber baut, spart in jedem Folgeprojekt Wochen.

### Backend

| Heute | Für ein größeres Projekt |
|---|---|
| Eine Function, 150 Zeilen | Route Handler bzw. Server Actions |
| Handgeschriebene Validierung | **Zod** — ein Schema für Client und Server |
| Ratenbegrenzung in-memory | Vercel KV oder Upstash Redis |
| Kein Log | Strukturierte Logs, Sentry |

**Unverändert übernehmbar** sind die Prinzipien, nicht der Code: Empfänger und Berechtigungen nie aus dem Request · zweimal validieren · wortkarge Fehler · Honigtopf und Zeitsperre statt Captcha.

### Datenbank

Für ein Projekt mit Fällen und Kunden: **PostgreSQL + Prisma**. Ein tragfähiger Startpunkt:

```prisma
model Inquiry  { id String @id @default(cuid())
                 source String   status String @default("neu")
                 name String  phone String?  email String?  message String
                 caseId String?  createdAt DateTime @default(now())
                 @@index([status, createdAt]) }

model Customer { id String @id @default(cuid())
                 name String  phone String?  email String?
                 cases Case[]  createdAt DateTime @default(now()) }

model Case     { id String @id @default(cuid())
                 number String @unique          // z. B. 2026-0417
                 customerId String  customer Customer @relation(...)
                 status String  vehicle Json?
                 documents Document[]  events AuditEvent[]
                 createdAt DateTime @default(now())
                 @@index([status, createdAt]) }

model AuditEvent { id String @id @default(cuid())
                   caseId String  actorId String  action String
                   payload Json  at DateTime @default(now())
                   @@index([caseId, at]) }
```

Zwei Regeln aus der Praxis: **Aktenzeichen** in einer Transaktion mit einem Zähler pro Jahr vergeben, nicht über `count() + 1` — sonst gibt es bei gleichzeitigen Anlagen Dubletten. Und **Audit-Einträge in derselben Transaktion** schreiben wie die Änderung, sonst entstehen Lücken genau dort, wo man sie später braucht.

### Authentifizierung

Nicht vorhanden. Empfehlung: **Auth.js (NextAuth)** mit Credentials- oder E-Mail-Provider, `argon2id`, Sitzungen in der Datenbank, Rollen als Enum am `User`, Prüfung serverseitig in jeder Route. Details in §13.

### Motion-System — der stärkste Übertrag

`core/scroll.ts` + `core/timeline.ts` + `core/reveal.ts` + der Reveal-Block aus `components.css` sind zusammen **etwa 450 Zeilen** und framework-unabhängig. Sie funktionieren in einem statischen Projekt genauso wie in React — dort ruft man `track()` in einem `useEffect` auf und gibt die Aufräumfunktion zurück.

Das übertragbare Muster, unabhängig vom Code: **Scrollstrecke als Spur, Bühne als Sticky-Kind, Fortschritt 0..1, jede Bewegung eine reine Funktion davon.** Das lässt sich auch mit GSAP ScrollTrigger oder Framer Motions `useScroll` umsetzen — die Denkweise ist das Wertvolle, nicht die Implementierung.

### 3D-System

`scene/*` ist auf diese Geschichte zugeschnitten. Übertragbar sind vier Dinge:

1. **Die Lochkamera-Projektion** (24 Zeilen) — für jede Straßen-, Tunnel- oder Korridorszene
2. **Das Pixelbudget** in `canvas.ts` — für jedes Canvas-Projekt, unabhängig von der Technik
3. **Das umschaltbare Farbthema** — eine Geometrie, mehrere Marken
4. **Der deterministische Scrub** — Position aus integrierter Geschwindigkeit statt aus akkumulierter Zeit

Braucht ein Projekt echte Modelle, Materialien oder Schatten, ist **React Three Fiber + drei** der richtige Weg. Die Grenze verläuft etwa dort: Sobald Sie ein `.glb` laden wollen, ist Canvas 2D das falsche Werkzeug.

### SEO

Metastruktur, JSON-LD-Muster und die Trennung „eine Leistung = eine URL" sind direkt übertragbar. In Next.js entspricht das der `metadata`-Export-API und `generateMetadata()`; die JSON-LD-Blöcke wandern unverändert in ein `<script type="application/ld+json">`.

### Integrationen

| Heute | Übertragbar? |
|---|---|
| Brevo für E-Mail | **Ja** — `api/kontakt.js` funktioniert in jedem Node-Projekt fast unverändert |
| Eigene SVG-Karte | **Ja**, wenn nur ein Einsatzgebiet gezeigt wird. Für Routing oder interaktive Karten: MapLibre mit eigenem Tile-Server (Datenschutz) oder Google Maps mit Einwilligung |
| Kein Analytics | Für datenschutzfreundliche Messung: Plausible oder Matomo (selbst gehostet). Beide brauchen kein Banner, wenn richtig konfiguriert |
| Keine Zahlungen | Stripe, sobald nötig — niemals selbst bauen |

---

## 18. Wo was steht

| Bereich | Hauptdateien |
|---|---|
| **Einstiegspunkte** | `src/pages/home.ts` · `service.ts` · `ing.ts` · `simple.ts` |
| **Frontend-Struktur** | `index.html` · `gutachten/index.html` · `build/services.mjs` (erzeugt die Leistungsseiten) |
| **Design-System** | `assets/css/tokens.css` ← **hier zuerst nachsehen** · `base.css` · `components.css` |
| **Sektionen** | `assets/css/sections.css` · `premium.css` · `service.css` |
| **Zweite Marke** | `assets/css/ing.css` (überschreibt die komplette Token-Ebene) |
| **Scroll-Engine** | `src/core/scroll.ts` · `timeline.ts` · `raf.ts` |
| **Reveals / Text-Splitting** | `src/core/reveal.ts` + Reveal-Block in `components.css` |
| **Bühnen MTC** | `src/components/premium.ts` · `story.ts` · `statements.ts` |
| **Bühne ING** | `src/components/ingHero.ts` |
| **Bühne Leistungsseiten** | `src/components/serviceHero.ts` |
| **Szene: Welt** | `src/scene/world.ts` (Projektion, Straße, Licht, Farbthema) |
| **Szene: Fahrzeuge** | `src/scene/vehicles.ts` (Pkw, Bergungsfahrzeug, Streifenwagen, Gutachter, Partikel) |
| **Szene: Filme** | `src/scene/film.ts` (MTC) · `ingFilm.ts` (ING, fünf Akte) · `ambient.ts` (leichte Varianten) |
| **Canvas-Grundlage** | `src/scene/canvas.ts` (DPR, Pixelbudget) |
| **Formulare** | `src/components/contactForm.ts` · `emergency.ts` |
| **API / Backend** | `api/kontakt.js` — die einzige serverseitige Datei |
| **Umgebungsvariablen** | `.env.example` |
| **Datenbank** | — nicht vorhanden |
| **Auth** | — nicht vorhanden |
| **Admin** | — nicht vorhanden |
| **SEO** | `<head>` + JSON-LD je `index.html` · `sitemap.xml` · `robots.txt` · `gutachten/sitemap.xml` |
| **Build** | `tsconfig.json` · `build/bundle.mjs` · `build/services.mjs` |
| **Tests** | `build/qa.mjs` · `build/perf.mjs` |
| **Vorschau** | `build/artifact.mjs` → `dist-artifact/*.html` |
| **Dokumentation** | `README.md` (Betrieb, Checklisten) · `HANDOVER.md` (dieses Dokument) |

---

## Offene Punkte

Damit nichts davon untergeht:

1. **Impressum, AGB, Widerruf, Datenschutz** tragen an den Pflichtstellen `bitte ergänzen`. Ohne vollständige Angaben sind Impressum und AGB abmahnfähig. Die AGB gehören zusätzlich vor den Livegang zu einem Anwalt.
2. **Kontaktdaten ING** fehlen vollständig — Telefon, E-Mail, Anschrift, Berufsbezeichnung und Bestellung. Ebenso `MAIL_TO_ING`.
3. **Domains** in `canonical`, `og:url`, `sitemap.xml` und `robots.txt` ersetzen.
4. **Brevo-Domainverifizierung** mit DNS-Einträgen — sonst Spam.
5. **Bewertungen** auf der MTC-Startseite stammen aus dem bestehenden Entwurf. Falls nicht belegbar: ersetzen oder entfernen.
6. **Fotografie**: Alle Bildflächen sind Slots mit festem Seitenverhältnis. Ein `<img>` oder `<video>` mit `class="panel__fill"` und `object-fit: cover` ersetzt die generierte Szene eins zu eins.
7. **Bekannte Schwäche**: Die Leistungsseiten fallen auf sehr großen Displays (2560 px) während der Filmpassage unter 60 fps. Behebbar durch Umstellung des Filmkopfs auf den gecachten Pfad — siehe §6.
