# Performance-Analyse Startseite (mobil) – Vorher/Nachher

Stand: 16.10.2026 · Messmethode: Lighthouse 12.3 (Emulation „Moto G Power“, simuliertes langsames 4G, 4× CPU) gegen die **geschützte Vercel-Vorschau** (echtes CDN mit Kompression, HTTP/2), je 3 Läufe, Median. Zusätzlich echtes Chrome mit Netz-/CPU-Drosselung (Latenz 150 ms, 1,6 Mbit/s, CPU ×4) und `PerformanceObserver`.

## 1. Warum die früheren Werte (74–80) irreführend waren
Die ersten Messungen liefen gegen einen lokalen, einfachen Entwicklungsserver (ohne Kompression, ohne HTTP/2, ohne CDN). Gegen die echte Vorschau liegt dieselbe Seite bei **Performance 92** (vorher) bzw. **95** (nachher). Die lokalen Zahlen sind für Entscheidungen nicht geeignet.

## 2. Befunde

| Thema | Messung | Bewertung |
|---|---|---|
| **LCP-Element** | `P.lead` (Einleitungstext im Hero), im Trace identisch mit dem ersten Paint; im gedrosselten echten Chrome **1,5–1,6 s** | Text, kein Bild; wird durch Latenz (TTFB 0,3 s) und die Größe von HTML + CSS bestimmt, nicht durch Video oder Poster |
| Lighthouse-LCP | 3,3 s (simuliert, pessimistischer als das echte Chrome) | Modellwert; Abweichung zum realen Wert erwartbar |
| **Hero-Video** | 3,78 MB (92 % des Seitengewichts), startet erst nach dem Laden (+0,8 s), blockiert weder LCP noch FCP | kein Engpass für die Ladezeit, aber der größte Datenposten (Mobilfunk) |
| **Poster** | 115 KB JPG, hohe Priorität, kein LCP-Kandidat | **optimiert** (siehe 3) |
| **JavaScript** | 204 KB komprimiert (React/Next ≈ 100 KB, Animationsbibliothek ≈ 40 KB, Seite 19 KB); Skriptzeit ≈ 0,3 s bei 4× CPU; TBT 7–28 ms; unbenutzt laut Lighthouse nur 21 KB | kein Engpass; Aufteilen einzelner Abschnitte brächte < 10 KB |
| **Hydration / DOM** | 1.265 Elemente (hauptsächlich Unfall-Film-SVG), Hauptthread 1,6 s gesamt (inkl. Rendern, Skripte) | akzeptabel; Verzögerung des Films (`ssr:false`) würde SEO-Text und Platzhalterhöhe berühren, Nutzen nicht belegt → **nicht** umgesetzt |
| **Schriften** | 3 Dateien, 89 KB (Archivo, Manrope, JetBrains Mono), `font-display: swap` | Vorladen der Mono-Schrift entfernt; Text wird sofort mit Ersatzschrift gezeichnet |
| **Animationen** | Hero-Text ohne Verzögerung (`initial={false}`), Reveal-Effekte erst im Sichtbereich | beeinflussen LCP nicht; Film nutzt reine `transform`-Schreibzugriffe |
| CLS | 0,001 | unauffällig |

## 3. Umgesetzte Optimierungen (Commit `814f202`)
1. **Poster als responsives WebP** (`showcase-begutachtung-640.webp` 12 KB, `-1280.webp` 38 KB) mit JPG-Rückfall; Hochpriorität entfernt (kein LCP-Kandidat). Bilder im Erstladen: **115 KB → 38 KB** (Lighthouse-Mobil lädt die 1280er-Fassung, weil 412 px × Pixeldichte > 640).
2. **Mono-Schrift ohne Preload** (weniger konkurrierende Anfragen im kritischen Pfad).
3. (Früher, `e64aa00`) Video erst nach dem Laden der Seite einhängen.

## 4. Messwerte

| | Vorher (`a4e842e`) | Nachher (`814f202`) |
|---|---|---|
| Lighthouse Performance (Median, mobil) | **92** (92/92/92) | **95** (84/95/96, ein Ausreißer) |
| FCP (simuliert) | 1,12 s | 1,39 s (Streuung) |
| LCP (simuliert) | 3,34 s | **2,89 s** |
| TBT | 7 ms | 28 ms (Streuung) |
| Seitengewicht gesamt | 4,14 MB | 4,07 MB |
| Gewicht ohne Video | 462 KB | **385 KB** (−17 %) |
| Echtes Chrome, gedrosselt: FCP = LCP | 1,60 s | 1,53–1,62 s (unverändert) |
| Echtes Chrome, gedrosselt: Load-Ereignis | 2,78 s | **2,48 s** (−11 %) |
| Desktop-Performance (Vercel) | 100 | – (nicht erneut gemessen) |

**Einordnung:** Die Verbesserung ist real, aber klein; die Seite war nach den Daten nicht „schwach“, sondern wurde lokal falsch gemessen. Streuung zwischen Läufen (Lighthouse, ein Lauf mit 84) ist größer als einzelne Optimierungen.

## 5. Bewusst nicht geändert
- **Video-Datei:** Mit den verfügbaren Bordmitteln (macOS `avconvert`) lässt sich nur wählen zwischen 2,8 MB (480p-SD-Voreinstellung, −27 %), 0,9 MB (568×320, sichtbar unschärfer) oder 7 MB. Der Gewinn rechtfertigt keinen Qualitätsverlust; die Datei besitzt bereits „Fast Start“ (Metadaten vorn). Empfehlung: bei Bedarf eine eigene 720p-Fassung mit niedrigerer Bitrate (Ziel ≈ 2 MB) mit einem Encoder-Programm erzeugen und nur für Smartphones ausliefern.
- **Animationsbibliothek** (`LazyMotion`) und **Aufteilen des Films**: Aufwand hoch, belegter Nutzen < 10 KB.
- **Schriftschnitte reduzieren** (Manrope hat 4 Gewichte): erst nach Design-Abstimmung.

## 6. Offene Messungen
- Desktop nach den Änderungen, weitere Seiten, echte Mobilgeräte, Felddaten (Chrome UX Report erst nach Veröffentlichung).
