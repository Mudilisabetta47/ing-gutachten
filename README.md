# ING Gutachten — Premium-Website (Next.js · Vercel)

Website des Kfz-Sachverständigenbüros **ING Gutachten, Hannover**.
Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 3 · Framer Motion 11 · Lenis.
Produktivdomain: **https://ing-gutachten.de** · Hosting: **Vercel (Serverbetrieb)**.

Leitgedanke: *extrem wenig sichtbarer Text, extrem klare Information, eine scroll-gesteuerte Unfall-Sequenz,
echte technische Kompetenz, saubere semantische SEO-Struktur, schnelle Kontaktaufnahme.*

---

## 1. Starten

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # Produktions-Build (Serverbetrieb, kein statischer Export)
npm start            # Produktions-Server lokal
npm run typecheck
npm run lint
npm test             # Unit-Tests (Validierung, Dateitypen, Rate Limit, Mail-Provider, SITE_URL)
npm run qa:crawl     # SEO-/Link-Crawl gegen einen laufenden Server (siehe §8)
```

`next/font` lädt die Schriften beim Build und liefert sie vom eigenen Server aus (kein Google-Aufruf beim Besucher).

## 2. Architektur-Entscheidungen

| Thema | Entscheidung |
|---|---|
| Hosting | Vercel mit Node-Runtime. `output: 'export'` wurde **entfernt**: Route Handler für das Anfrageformular und echte Bildoptimierung (`next/image`, AVIF/WebP) |
| Domain | `SITE_URL` (ENV). Production-Fallback `https://ing-gutachten.de`; eine `*.vercel.app`-Adresse wird in Production **nie** Canonical. Preview-Deployments sind `noindex` und per `robots.txt` gesperrt |
| Server vs. Client | Standard ist Server-Komponente. `'use client'` nur für Interaktion/Motion (Hero-Parallax, Film, Konfigurator, Ablauf-Schiene, Formular, FAQ, Karte, Nav, Cursor) |
| Reveals | Reines CSS (`data-reveal` + `.is-in`), ausgelöst von **einem** IntersectionObserver. Inhalte sind ohne JavaScript und bei Reduced Motion sofort sichtbar |
| Farben | CSS-Variablen (`--c-*`) statt fester Hex-Werte: `.theme-dark` (Standard) und `.theme-light` ("kühles Hell") nutzen dieselben Tailwind-Utilities |

## 3. Seiten (alle indexierbar außer Impressum/Datenschutz)

```
/                              Startseite (10 Akte)
/kfz-gutachter-hannover        lokale Landingpage Hannover
/leistungen
/schadensgutachten  /unfallgutachten  /pkw-gutachten  /unfallanalyse
/unfallrekonstruktion  /edr-systeme  /wertgutachten
/lkw-gutachten  /e-auto-hybrid-gutachten  /motorrad-gutachten  /oldtimer-gutachten
/ablauf  /einsatzgebiet  /ueber-uns  /faq  /kontakt
/kfz-gutachter/{laatzen,langenhagen,garbsen,seelze,wunstorf,pattensen}
/impressum  /datenschutz       noindex
/api/anfrage                   POST – Anfrageformular (nicht in der Sitemap, per robots gesperrt)
```

Inhalte stehen zentral in `src/lib/content.ts` (Stammdaten, Navigation, Leistungen, FAQ, Ablauf, Regionen, Schadenzonen).

### Startseite in zehn Akten
1 Hero · 2 Fakten-Streifen · 3 Unfall-Film (Fahrt → Gutachten) · 4 Leistungen · 5 Schaden-Konfigurator ·
6 Warum ING · 7 Ablauf (Sticky-Schiene) · 8 Hannover / Vor-Ort · 9 FAQ (3 Fragen) · 10 Schaden melden.
Faustregel: 20–60 Wörter Fließtext je visueller Sektion. Ausführliche Inhalte liegen auf den Leistungsseiten.

## 4. Motion-System

Prinzip (HANDOVER § 6): **jede scrollgesteuerte Bewegung ist eine reine Funktion des Scrollfortschritts `p` (0..1).**
Kein Autoplay, kein Zustand – stoppt der Nutzer, steht exakt dieser Frame; zurückscrollen läuft framegenau rückwärts.

| Baustein | Datei |
|---|---|
| Smooth Scroll (nur Maus, nie Touch, nie Reduced Motion; setzt den echten Scrollwert, damit `sticky` trägt) | `layout/SmoothScroll.tsx` |
| CSS-Reveals: `up, left, right, blur, scale, clip, clip-x, fade, mask, mask-fast, soft, line` | `globals.css`, `ui/Reveal.tsx`, `ui/Split.tsx`, `layout/RevealObserver.tsx` |
| Hero-Parallax (3 Ebenen) | `sections/HeroStage.tsx` |
| Sticky Storytelling (Track + Stage 100svh) | `CrashSequence`, `AblaufRail` |
| **Bühnen-Rückzug** (Stage skaliert, Ecken runden sich, heller Inhalt wird frei) | `motion/stage-retreat.ts` – am Ende von Film und Ablauf |
| Custom Cursor (VIEW/ANFRAGEN/MEHR/GUTACHTEN, nur Fine Pointer) | `layout/CustomCursor.tsx`, Attribute `data-cursor`, `data-cursor-label` |
| Magnetische Buttons | `ui/Magnetic.tsx` |
| Scroll-Fortschrittslinie | `layout/ScrollProgress.tsx` |

### Unfall-Film (`sections/CrashSequence.tsx`)
SVG-Szene mit eigener Kamera (bewusst kein WebGL), 660 vh Scrollstrecke (mobil 480 vh), Bühne `sticky 100svh`.
`useScroll` liefert `p`; **eine** Subscription schreibt `transform`/`opacity` direkt auf gecachte DOM-Knoten
(identische Werte werden nicht erneut geschrieben). React rendert die Sektion einmal.

| Akt | p | Inhalt |
|---|---|---|
| 01 Fahrt | 0 – 0,14 | Kamera folgt dem Fahrzeug, Straßenlampen und Boden vermitteln Tempo |
| 02 Gefahr | 0,14 – 0,26 | Kamera zieht auf, Fahrzeug voraus steht (Bremslicht) |
| 03 Bremsung | 0,26 – 0,40 | Bremslicht, Geschwindigkeitsabbau aus integriertem Profil, subtiles Nicken, Kameranäherung |
| 04 Aufprall | 0,40 – 0,50 | Lichtimpuls, Druckring, Pfad-Morph der Verformung, wenige Partikel, dezenter Kamerastoß |
| 05 Stillstand | 0,50 – 0,60 | Partikel/Staub klingen aus, Warnblinker (Uhr-getrieben) |
| 06 Gutachter | 0,60 – 0,72 | Silhouette mit Tablet nähert sich |
| 07 Befund | 0,72 – 0,80 | Dolly auf die Schadenstelle, Messmarken |
| 08 Analyse | 0,80 – 0,93 | **Signature-Übergang:** blauer Schleier fährt ein → Messraster → Konturen zeichnen sich → Schadenszone schraffiert → Bemaßung; die reale Szene blendet fließend aus |
| 09 ING Gutachten | 0,93 – 1 | Marke + CTA, danach Bühnen-Rückzug |

* **Messwerte** im Film (`Δ 118 mm` …) sind **Beispielwerte** und überall als „BSP." / „Beispielhafte Rekonstruktion" gekennzeichnet.
* **Mobil:** 12 statt 36 Partikel, kein SVG-Filter (Bewegungsunschärfe), kein Kamerastoß, gröberes Raster, 480 vh, kürzere Callout-Labels, Kamera-Zoom passt sich dem Seitenverhältnis an.
* **Reduced Motion:** kein Sticky, keine Bewegung. Der Film steht einmal bei `p = 0,9` (technische Darstellung mit Messmarken) plus Textblock und CTA.
* **Wichtig:** `body { overflow-x: clip }` – nie `hidden`, sonst bricht `position: sticky`.

## 5. Anfrageformular & Foto-Upload

4 Schritte: **Schaden → Kontakt → Fotos → Prüfen & senden.** Mobile first, Fehlermeldungen als `role="alert"`.

`POST /api/anfrage` (`src/app/api/anfrage/route.ts`), Node-Runtime:

* Same-Origin-Prüfung, Honeypot (`website`, nicht `display:none`), Mindest-Ausfüllzeit (2,5 s), Rate Limit 12 Anfragen / 10 min / IP (in-memory je Instanz – für verteilten Schutz Upstash/Vercel KV einhängen)
* Serverseitige Validierung aller Felder (`src/lib/request-schema.ts`, gleiche Regeln wie im Browser)
* Dateien: max. 8 Fotos, nur **JPG/PNG/WebP** (Typ per **Magic Bytes**, nicht per Dateiname/MIME; SVG, HTML, EXE werden abgelehnt), optional Fahrzeugschein (zusätzlich PDF), Dateinamen werden **neu vergeben** (`foto-1.jpg`)
* Größe: Fotos werden im Browser verkleinert (≤ 1600 px, JPEG); Server-Limit 4,3 MB gesamt (Vercel-Body-Limit 4,5 MB)
* **Keine Speicherung:** Dateien werden nicht abgelegt, sondern als E-Mail-Anhang weitergeleitet – es gibt keine öffentliche, erratbare URL
* Provider austauschbar (`src/lib/mail/`): **Brevo** oder **Resend**. Ohne Konfiguration antwortet die API ehrlich mit `503` – es wird **nie** ein Erfolg vorgetäuscht
* `MAIL_PROVIDER=dry-run` (nur außerhalb Production): validiert alles, versendet nichts – für lokale Tests

### Umgebungsvariablen (`.env.example`)
| Variable | Zweck |
|---|---|
| `SITE_URL` | Produktivdomain, `https://ing-gutachten.de` |
| `MAIL_PROVIDER` | `brevo` \| `resend` (\| `dry-run` lokal) |
| `BREVO_API_KEY` / `RESEND_API_KEY` | API-Key des gewählten Providers (nur serverseitig) |
| `MAIL_FROM`, `MAIL_FROM_NAME` | Absender (Domain beim Provider verifizieren: SPF/DKIM) |
| `MAIL_TO` | Empfänger der Anfragen |

> **Status:** Serverlogik, Validierung und Provider-Adapter sind implementiert und getestet (Unit-Tests mit
> gestubbtem `fetch`, API-Tests mit echten Dateien). **Ein echter Versand wurde nicht getestet** – dafür fehlen
> API-Key und verifizierte Absenderdomain. Er wartet auf die Environment Variablen.

## 6. SEO

* Metadata-API je Route (Title ≤ 60 Zeichen inkl. Suffix, Description ≤ 160), Canonicals mit Trailing Slash auf die Produktivdomain, Open Graph/Twitter mit eigenem Bild (`public/assets/img/og-ing-gutachten.png`, Skript `scripts/make-og.mjs`)
* Genau eine H1 je Seite. Startseite: **„Kfz-Gutachter & Sachverständiger in Hannover"** (sichtbare erste Zeile der H1) + emotionale Display-Zeile „Wenn es darauf ankommt." im selben H1
* JSON-LD: `ProfessionalService`/`LocalBusiness`, `WebSite`, `Service` je Leistungsseite, `BreadcrumbList`, `FAQPage` (nur sichtbare FAQ). **Kein** `AggregateRating`, **kein** `priceRange`
* Nur verifizierte Firmendaten im Schema (`BIZ_VERIFIED` in `content.ts`): Adresse + Telefon. E-Mail, Öffnungszeiten, Koordinaten erscheinen erst nach Freigabe
* `GOOGLE_PROFILE_URL` (leer) → bei Eintrag werden `sameAs`/`hasMap` ausgegeben
* FAQ-Antworten stehen immer im DOM (nur visuell eingeklappt)
* Sitemap/robots generiert (`sitemap.ts`, `robots.ts`); Impressum/Datenschutz `noindex`
* Regionalseiten: je Seite eigene Ortsangaben (`REGION_PROFILES`), enge Verlinkung auf `/kfz-gutachter-hannover` und Nachbarorte

## 7. Performance

* Nur `transform`/`opacity`; keine DOM-Lesezugriffe im Scroll-Pfad (Messung nur bei Resize via `ResizeObserver`)
* Kein Re-Render pro Scrollframe – gemessen: während eines vollständigen Film-Durchlaufs ändern sich nur drei HUD-Textknoten
* Szenen außerhalb des Viewports erzeugen keine Arbeit (Scroll-Progress bleibt konstant → keine Events)
* Bilder über `next/image` (AVIF/WebP, responsive); Hero-Fahrzeug ist ein SVG mit `fetchPriority="high"`
* Hero-Eingang per CSS-Animation (läuft vor der Hydration)

## 8. Tests & QA

```bash
npm test                                   # 16 Unit-Tests
npm run build && MAIL_PROVIDER=dry-run npx next start -p 3200
node scripts/crawl.mjs http://localhost:3200
```

`scripts/crawl.mjs` prüft jede erreichbare interne Seite: Status, genau eine H1, Title, Description, Canonical
(= Produktivdomain), Open Graph, JSON-LD (gültig, kein Rating/priceRange), noindex-Konsistenz, doppelte
Titles/Descriptions, tote Links, Anker-Ziele, Sitemap-Abdeckung, robots.txt, 404-Verhalten.

## 9. Deployment (Vercel)

1. Repository mit Vercel verbinden (Framework: Next.js, keine Sonderkonfiguration).
2. Environment Variables setzen (Production **und** Preview), siehe oben.
3. Domain `ing-gutachten.de` verbinden. Vercel-URLs bleiben Preview/Staging (automatisch `noindex`).
4. Beim Mail-Provider die Absenderdomain verifizieren (SPF/DKIM/DMARC), sonst landen Mails im Spam.
5. Nach dem Livegang: Google-Unternehmensprofil verknüpfen (`GOOGLE_PROFILE_URL`), Search Console, Sitemap einreichen.

`vercel.json` enthält die 301-Weiterleitung `/bagatellschaeden` → `/pkw-gutachten`. `deploy/.htaccess` ist ein Überbleibsel
des statischen Exports und wird nicht mehr benötigt.

## 10. Vor dem Livegang prüfen (nicht verifiziert)

| Feld | Stand |
|---|---|
| E-Mail `info@ing-gutachten.de` | vorhanden, **ungeprüft** – wird angezeigt, aber nicht im Schema |
| Öffnungszeiten | **ungeprüft** – werden nirgends angezeigt (`BIZ.hoursDraft`) |
| Koordinaten 52.3402 / 9.7742 | Näherung, **nicht im Schema** |
| Impressum | strukturierter Platzhalter – **muss ersetzt werden** |
| Datenschutz | Entwurf (Hosting Vercel, E-Mail-Dienstleister in `[Klammern]`) – **rechtlich prüfen lassen** |
| FAQ-Antworten (Kostentragung, Wahlrecht) | fachlich gegenlesen lassen |
| Zeitversprechen, Zahlen, Preise | bewusst entfernt („24–48 h", „Tausende Fahrzeuge", „ohne Anfahrtskosten" …), nur wieder aufnehmen, wenn belegt |

Belegt und verwendet: Hildesheimer Straße 229, 30519 Hannover · 0511 – 543 00 976 · 0173 – 72 79 763 · 15+ Jahre Erfahrung · Vor-Ort-Service · Achs- und Karosserievermessung.

**Bewertungen:** bewusst nicht eingebaut (keine echten Rezensionen vorliegend). Nur echte, nachweisbare Bewertungen einsetzen,
`AggregateRating` ausschließlich zusammen mit sichtbaren Bewertungen.

## 11. Bilder / Assets

| Datei | Einsatz |
|---|---|
| `car-hero.svg` | Hero-Fahrzeug (technische Zeichnung). Kann durch ein hochwertiges, freigestelltes Foto ersetzt werden |
| `pruefstand-halle.webp`, `team-begutachtung.webp`, `begutachtung-protokoll.webp` | echte Fotos (Warum ING, Hannover-Seite, Über uns) |
| `og-ing-gutachten.png` | OG-Bild, erzeugt mit `node scripts/make-og.mjs` |
