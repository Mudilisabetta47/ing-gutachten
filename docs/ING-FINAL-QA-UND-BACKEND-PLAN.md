# ING Gutachten – Abschluss-QA und Backend-Integrationsplan

Stand: 16.10.2026 · Branch `integration/old-site-premium-sections` · letzter Vorschau-Commit `b2398c5` · aktueller Stand `fc72ce1` (lokal, **nicht gepusht, nicht deployt**)

**Rahmen:** Alle Änderungen liegen ausschließlich auf dem Entwicklungsbranch. Es gab keinen Merge nach `main`, kein Produktionsdeployment, keinen neuen Freigabe-Link und keine Änderung an ING Studio, Datenbank, IONOS-VPS oder GoKlinik. Getestet wurde nur mit synthetischen Daten. **Keine rechtliche Freigabe** wird hiermit behauptet; alle Rechtsthemen sind als offen markiert.

---

## 1. Zusammenfassung des Projektstands

- Die alte Website bleibt die gestalterische Grundlage. Übernommen aus der Premium-Version: Fahrzeugklassen-Raster (3×3), Unfall-Film (neun Akte), Hero-Video, Fahrzeugmodell mit vier Ansichten. Ergänzt: Einsatzgebiet-Karte für Hannover, Hildesheim, Braunschweig und Hameln.
- Technisch ist die Seite **abnahmefähig für die Kunden-Vorschau**: Typprüfung und Build fehlerfrei, 28 Seiten in vier Größen ohne horizontales Scrollen, Lighthouse Barrierefreiheit/Best-Practices/SEO = 100, keine axe-Verstöße, Tastaturbedienung vollständig.
- **Nicht abnahmefähig für die Veröffentlichung:** Impressum und Datenschutzerklärung enthalten Platzhalter; mehrere fachliche und rechtliche Aussagen sind unbestätigt (Abschnitt 5). Das Anfrageformular sendet derzeit **nichts** an ein Backend (E-Mail-Fallback ohne Anhänge).
- Die Anbindung an ING Studio ist **vorbereitet, nicht verbunden** (Abschnitt 6). Der bestehende Studio-Endpunkt `POST /api/anfrage` deckt den größten Teil der Anforderungen bereits ab; es fehlen vor allem ein sicherer Zugangsweg von der öffentlichen Website (Origin/CORS), Idempotenz, Eingangsbestätigung, automatische Löschfristen und die Fahrzeugklassen-Liste.

## 2. Vollständige Liste der Änderungen (seit Vorschau-Commit `b2398c5`)

| Commit | Inhalt |
|---|---|
| `a469396` | „Einblicke“ ohne doppeltes Video (zwei Bildszenen bleiben); Einsatzgebiet vereinheitlicht (Hero, FAQ, Kontakt, Verlinkungskarten, Meta-Tags, JSON-LD `areaServed`); Kartenbeschriftung auf Smartphones 12,8 px; Hero-Kennzeichnung „Illustrative KI-Filmszene“; Fahrzeugklassen mit den freigegebenen Bezeichnungen (PKW · Elektrofahrzeuge · Hybridfahrzeuge · Motorräder · Transporter · Oldtimer & Youngtimer · LKW & Nutzfahrzeuge · Anhänger & Auflieger · Firmen- & Fuhrparkfahrzeuge) und kurzen Texten |
| `b61241f` | Unbelegte Aussagen entfernt oder abgeschwächt (Abschnitt 7); Barrierefreiheit (Kontrast der Protokollzeile, Überschriftenfolge, Landmark für die feste Kontaktleiste, größere Tippflächen); SVG-Konsolenfehler behoben; Anfrage-API-Vertrag `lib/inquiry-contract.ts` + Tests; npm-Skripte `typecheck`/`test` |
| `e64aa00` | Hero-Video wird erst nach dem Laden der Seite eingehängt (Poster zuerst); `/unfallgutachten` in der Sitemap; Tippflächen (Footer, Rechtliches, Kartenmarker); Platzhalterseite Vorschwunganalyse ohne abgeschnittene Überschrift; Ablauf-Zeitleiste kontrastreicher |
| `9e15fcf` | End-to-End-Prüfungen in `tests/e2e/` (Seiten-QA, Hero-Video, Tastatur, Formular gegen API-Mock) |
| `fc72ce1` | Fotos werden vor dem Senden immer neu kodiert (entfernt EXIF/GPS) |

Frühere Commits dieser Phase (bereits in der Vorschau): Hero-Video als Hintergrund, Fahrzeugmodell mit Sensorik/Hochvolt/Struktur, siebte Zone „Assistenzsysteme“, Navigation (Schadensgutachten / Unfallanalyse mit Dropdowns), Platzhalterseite Vorschwunganalyse (`noindex`), Einsatzgebiet-Karte, Premium-Unfallfilm, Fahrzeugklassen-Raster.

## 3. Behobene Fehler (in dieser Phase gefunden und korrigiert)

| Fehler | Ursache | Korrektur |
|---|---|---|
| Kartenmarker saßen versetzt | Zentrierung per CSS-Klasse wurde vom Animations-Transform überschrieben | Zentrierung in eigener Hülle, Animation innen |
| Anrufen-Knopf im Kopf blieb auf dem Handy sichtbar | globale Touch-Regel setzte `display` mit höherer Spezifität | Regel auf Hauptinhalt begrenzt |
| Beschriftung „KI-Filmszene“ überdeckte die Überschrift (Android-Chrome) | Anordnung der Hero-Bedienelemente | eine Zeile, Beschriftung links vom Knopf |
| Hero-Video startete nach verzögertem Einhängen nicht | Effekt wurde bei später montiertem Video nicht erneut ausgeführt | Abhängigkeiten ergänzt; durch den Test gefunden |
| „Film überspringen“ übersprang das Fahrzeugmodell | falsches Sprungziel | springt zum Fahrzeugmodell |
| Konsole: `<circle> attribute cy` | SVG-Impuls ohne Startwerte | `initial` mit `cx`/`cy` |
| Überschriftenfolge (h3 vor h2) auf 16 Seiten | Titel der Seitenspalte war `h3` | als Absatz ausgezeichnet |
| Feste Leiste „Anrufen/Gutachten anfordern“ außerhalb eines Landmarks | `div` | `aside` mit Beschriftung |
| Kontrast Protokollzeile 2,8:1, Ablaufschritte 3,9:1 | zu dunkle Farbe/Abdunklung | ≥ 4,5:1 |
| Platzhalterseite: Überschrift auf 360 px abgeschnitten | langes Wort in Titelgröße | Titel „In Vorbereitung.“ |
| `/unfallgutachten` fehlte in der Sitemap | Altbestand | ergänzt |
| Fokus-Kontur verformte runde Knöpfe | globales `border-radius` im Fokuszustand | entfernt |
| Formular suggerierte Upload ohne Backend | E-Mail-Fallback überträgt keine Dateien | Hinweis im Formular; Fahrzeugschein ausgeblendet |
| Fotos wären mit EXIF/GPS gesendet worden | Originaldatei bei kleinen Bildern | immer neu kodiert, per Test belegt |

## 4. Offene technische Probleme

1. **Lint nicht lauffähig.** `eslint` 10 ist installiert, aber `eslint-config-next` und Plugins fehlen; `next lint` bricht ab. Nachrüsten heißt Abhängigkeiten ändern (Freigabe). Ersatz: strenger Typecheck.
2. **Mobile Ladezeit (Lighthouse, simuliert langsames 4G):** Performance 74–80, LCP 5,3–7,4 s. Ursachen vermutlich animierte Inhalte und JavaScript-Umfang (170 KB-Pakete), nicht das Video (wird erst nach dem Laden gestartet). Startseite lädt 4,9 MB, davon 3,8 MB Video. Eine kleinere Videofassung (z. B. 720p, 2 MB) konnte hier nicht erzeugt werden (kein Videokodierer vorhanden) – **offen**.
3. **Android:** Der erste Lauf mit echtem Chrome 134 (Android-Emulator, Android 16) bestand alle sieben Prüfungen. Nach der späteren Änderung (verzögertes Video) war ein zweiter Lauf **nicht möglich**: Nach einem Neustart des Emulators stellte Chrome keine DevTools-Schnittstelle mehr bereit. Der Screenshot zeigt die neue Startseite mit dem „Pause“-Knopf; ob das Video läuft, wurde dort **nicht erneut gemessen**. **Offen:** Test auf einem echten Android-Gerät.
4. **Echtes iPhone/Safari:** geprüft nur im iOS-Simulator (iPhone 17, Safari): Hero-Video läuft stumm, Knopf sichtbar. Kein echtes Gerät.
5. **Meta-Daten:** 20 Seitentitel über 70 und 11 Beschreibungen über 175 Zeichen (Suchmaschinen kürzen). Die bestehenden Titel wurden nicht umgeschrieben, um das bisherige SEO nicht zu verändern. Empfehlung: gemeinsam mit SEO-Verantwortlichen kürzen.
6. **Dropdown-Unterpunkte** stehen nicht im HTML (erscheinen erst bei Hover/Fokus). Auffindbarkeit über Sitemap, Fußzeile und Querverweise gegeben; Seite „Vorschwunganalyse“ hat keine eingehenden Links außer dem Menü (gewollt, `noindex`).
7. **Fahrzeugklassen im Formular:** Das Formular bietet nur fünf Fahrzeugarten (PKW, LKW, Motorrad, Elektro/Hybrid, Oldtimer); der Server akzeptiert genau diese fünf. Die neun Klassen der Website lassen sich damit nicht abbilden (Transporter, Anhänger & Auflieger, Fuhrpark).
8. **Hero-Video 3,8 MB** und KI-Kennzeichnung: bei „Datensparmodus“ und 2G startet kein Video (nur Poster).
9. **Karte** ist schematisch; die Lage der Städte stammt aus Koordinaten, nicht aus Kartendaten.
10. **Unfall-Film** belegt 24 % der Startseite (Desktop). Auf Wunsch kürzbar (≈ 320 vh statt 460 vh).

## 5. Offene fachliche Fragen an Ekrem (Bestätigungsliste)

**A. Leistungen und Fachbegriffe**
1. **Vorschwunganalyse:** Was bedeutet der Begriff genau (Vorschadenanalyse? Vorkollisionsphase? anderes)? Leistung, Methode, Software, Qualifikation. Bis dahin Platzhalterseite, `noindex`.
2. **Kollisionsanalyse/Auslaufverhalten:** Bietet ING Berechnungen zu Kollisionsgeschwindigkeit, Bewegungs- und Auslaufverhalten selbst an – mit welcher Qualifikation?
3. **EDR-Systeme:** Auslesetechnik, abgedeckte Hersteller/Baujahre, Rechtsgrundlage (Halter, Einwilligung, Behörde), Datenumfang (Liste auf der Seite), Kosten.
4. **Unfallrekonstruktion:** Detailtexte liefern.
5. **Hochvolt:** Welche Leistungen am Hochvoltsystem erbringt ING selbst (Freischaltung? Batterieprüfung?) und mit welcher Qualifikation? Die Texte sagen jetzt nur „gesondert betrachtet“ bzw. „nach Herstellervorgabe durch qualifiziertes Fachpersonal“.
6. **Fahrzeugmodell:** Sensor-, Batterie- und Strukturdarstellung durch den Sachverständigen gegenlesen.

**B. Angebot und Region**
7. **Einsatzgebiet bestätigen:** Hannover, Hildesheim, Braunschweig, Hameln (nur diese; weitere Orte wurden nicht erfunden).
8. **Fahrzeugklassen:** Werden Transporter, Anhänger & Auflieger, Firmen- & Fuhrparkfahrzeuge tatsächlich begutachtet? (Verlinken derzeit auf PKW- bzw. LKW-Seite.)
9. **Termin- und Dauerangaben:** Welche Zeiten darf ING nennen (früher „24–48 h“, „1–2 Werktage“)? Die Seite sagt jetzt „nach Absprache“.
10. **Erfahrung:** „über 15 Jahre“ (früher im Hero, auf „Über uns“ und in Meta-Beschreibungen): Beleg oder Streichung. Aktuell entfernt.
11. **Öffnungszeiten** (im Code als „vor Livegang prüfen“ markiert), **E-Mail-Adresse** `info@ing-gutachten.de` und Telefonnummern bestätigen.
12. **Anfahrt/Kosten:** Aussagen zu kostenfreier Anfahrt entfernt. Soll etwas Verbindliches stehen?

**C. Rechtliche Formulierungen (juristisch prüfen lassen – nicht von mir geprüft)**
13. Gutachterwahl und Kostentragung bei unverschuldeten Unfällen (FAQ, Unfallgutachten, FAQ-Seite, Startseite): jetzt „in der Regel“/„im Einzelfall“.
14. Bagatellschaden: feste Grenze entfernt; Aussage „kann ein Kostenvoranschlag ausreichen“.
15. Regulierungsdauer „rund vier Wochen“ (Ablauf-Seite) – Wortlaut und Beleg bestätigen.
16. **KI-Video:** Kennzeichnung „Illustrative KI-Filmszene“ im Hero bestätigen.
17. **Impressum:** Vertretungsberechtigte/r, USt-IdNr., zuständige Kammer/Bestellung, Berufshaftpflicht, Verantwortliche/r nach § 18 Abs. 2 MStV, Aussage zur Streitschlichtung (derzeit „nicht bereit“ – Geschäftsentscheidung).
18. **Datenschutzerklärung:** Hosting-Anbieter, Auftragsverarbeitung, Empfänger (E-Mail-Dienst), Speicherdauer konkret, Upload (Fotos, Fahrzeugschein), Rechtsgrundlagen, Drittlandübermittlung, Cookie-Hinweis. Die Seite enthält noch den internen Redaktionshinweis und Platzhalter in eckigen Klammern.
19. **Fahrzeugschein-Upload:** Soll er nach Einrichtung des Backends kommen? (Aktuell ausgeblendet.)

## 6. Geplante Backend-Integration

### 6.1 Ist-Zustand ING Studio (Code gelesen, nichts verändert)

`POST /api/anfrage` (Next.js-Route, Node-Laufzeit) kann bereits:
- **Validierung serverseitig:** Pflichtfelder und Auswahllisten, Länge/Bereinigung (`clean`), E-Mail-/Telefonprüfung, Zustimmung zum Datenschutz (`validateFields`); Dateityp **aus dem Dateiinhalt** (Magic Bytes: JPEG, PNG, WebP, PDF – SVG/HTML/EXE fallen heraus), Größe je Datei 1,6 MB, höchstens 8 Fotos, gesamt 4,3 MB, serverseitig vergebene Dateinamen, SHA-256 je Datei.
- **Missbrauchsschutz:** Honeypot-Feld `website`, Mindest-Ausfüllzeit 2,5 s (`t`), Rate-Limit je IP (12 pro 10 Min., **nur im Arbeitsspeicher der Instanz**), Content-Length-Pflicht, Origin-Prüfung (Origin-Host muss gleich dem Host sein).
- **Speicherung:** `Inquiry` (unveränderlich) + `Lead` (bearbeitbar) + Status-Historie + Audit-Eintrag in **einer** Transaktion; Einwilligungszeitpunkt und Version der Datenschutzerklärung/des Formulars; IP nur als gesalzener Hash; Herkunftsdaten (UTM) bereinigt.
- **Dateien:** privater Speicher (S3/SeaweedFS), Anwendungs-Verschlüsselung AES-256-GCM (in Staging/Produktion Pflicht; ohne Schlüssel „fail closed“), zufällige Objektschlüssel, Status `STORED`/`MAIL_ONLY`/`NOT_STORED`.
- **Benachrichtigung:** E-Mail an das Büro mit Anhängen; Ergebnis am Lead (`SENT/FAILED/SKIPPED`); ehrliche Fehlermeldung mit Telefonnummer statt falschem Erfolg.
- **Weitere Studio-Endpunkte:** `/api/admin/media/upload` (nur angemeldet, Rechteprüfung, gleiche Dateiprüfung), Health, Monitor, Kalender, Export (nur intern).

### 6.2 Lücken zwischen Website und Studio

| Thema | Befund | Maßnahme (Backend, **nicht umgesetzt**) |
|---|---|---|
| Zugangsweg | Die statische Website liegt auf einer anderen Herkunft; die Origin-Prüfung lehnt fremde Herkunft mit 403 ab | Entscheidung A/B/C unten |
| Vertrag der Felder | alte Website sendete `foto_1…`, kein `website`/`t`, Originalfotos bis 12 MB | im Frontend angepasst (`lib/inquiry-contract.ts`), per Test mit API-Mock bestätigt |
| Fahrzeugarten | Server akzeptiert 5 Werte | Liste und `FORM_VERSION` erweitern (Transporter, Anhänger & Auflieger, Fuhrpark) |
| Doppelte Anfragen | keine Idempotenz | Idempotenz-Schlüssel (vom Browser erzeugte UUID, serverseitig eindeutig, 24 h) |
| Eingangsbestätigung | nur Meldung im Browser; keine Referenznummer, keine Bestätigungs-E-Mail | Referenz (z. B. `ING-2026-xxxxx`) anzeigen; optional Bestätigungs-E-Mail ohne sensible Inhalte |
| Rate-Limit | nur pro Instanz, geht bei Neustart verloren | auf dem VPS (eine Instanz) vertretbar; besser: Limit am Reverse-Proxy oder persistent (Datenbank/Redis) |
| Bot-Schutz | Honeypot + Zeit | optional datensparsames Captcha (z. B. Turnstile) – Datenschutz prüfen |
| Größenlimit | 4,3 MB gesamt (aus der Vercel-Grenze 4,5 MB abgeleitet) | auf dem VPS anheben (z. B. 8 Fotos × 1,6 MB ≈ 13 MB) und am Proxy ein Body-Limit setzen |
| Viren-/Malware-Prüfung | keine | Scan vor Ablage (z. B. ClamAV) oder Ablage in Quarantäne-Status |
| EXIF/Metadaten | Studio speichert Originalbytes | Frontend entfernt EXIF jetzt; zusätzlich serverseitig neu kodieren |
| Löschfristen | Anonymisierung vorbereitet, **kein automatischer Ablauf** (`docs/DATENSCHUTZ-TODO.md`) | Fristen festlegen und täglichen Löschlauf bauen (Fahrzeugschein kürzer als Fotos) |
| Datenschutzerklärung | Platzhalter; Upload nicht beschrieben | siehe 5.C |
| Monitoring | Health vorhanden | Alarm bei Mailfehlern/Speicherfehlern (Notification-Status), Erfolgsquote |

### 6.3 Zugangsweg – drei Optionen (Entscheidung nötig)

- **A. Öffentliche Seite zieht in das Studio-Projekt** (Route-Group `(site)`): gleiche Herkunft, die vorhandene API läuft **unverändert**, kein CORS. Aufwand: Migration der alten Komponenten (kein Redesign). Gegenpunkt: Das Studio-Projekt wird Hosting der öffentlichen Seite (Last, Verfügbarkeit, Updates).
- **B. Statische Seite bleibt; Reverse-Proxy leitet `/api/anfrage` an das Studio** (gleiche Herkunft aus Sicht des Browsers). Studio muss die öffentliche Herkunft als erlaubt führen (Origin-Allowlist). Geringster Eingriff, aber der Proxy muss Body-Größe und Header sauber durchreichen; bei Vercel-Rewrites Body-Limits prüfen.
- **C. CORS-Allowlist am Studio**: Browser sendet direkt an die Studio-Adresse. Funktioniert, öffnet aber die Studio-Adresse öffentlich für Browser-Anfragen; strikte Allowlist, nur diese Route, keine Cookies.

**Empfehlung:** B (oder A, wenn ohnehin ein Next-Server für die öffentliche Seite gewünscht ist). Nicht empfohlen: eine zweite Datenbank oder ein zweites Anfragesystem – das Studio erfüllt die Anforderungen bereits.

### 6.4 Umsetzungsschritte (jeweils mit Freigabe)

1. Entscheidung Zugangsweg und Hosting der öffentlichen Seite.
2. Staging des Studios (bereits vorbereitet, `docs/STAGING-AUFBAU.md`): Route freischalten, Origin-Allowlist, Fahrzeugarten erweitern, Idempotenz, Referenznummer.
3. Frontend: `FORM_ENDPOINT` setzen (nur Staging), Referenz anzeigen, Idempotenz-Schlüssel senden. Der Vertrag und die Verkleinerung sind schon umgesetzt und getestet.
4. Tests mit **synthetischen** Daten: Mock → Staging; Ablehnungsfälle (zu groß, falscher Typ, Honeypot, zu schnell, doppelt), Ausfall von Mail/Speicher, Lasttest (Rate-Limit).
5. Datenschutz: Erklärung, Verarbeitungsverzeichnis, Löschkonzept, Auftragsverarbeitung (Hosting, Mail).
6. Fahrzeugschein-Upload erst nach Schritt 5 einschalten (`SHOW_DOC_UPLOAD`).
7. Produktivschaltung nur nach schriftlicher Freigabe; Rollback = `FORM_ENDPOINT` leeren (E-Mail-Fallback).

### 6.5 Was bereits im Frontend vorbereitet und getestet ist

- `src/lib/inquiry-contract.ts`: Feldnamen und Grenzen entsprechen dem Servercode (Test vergleicht gegen den ING-Studio-Code), Prüfung vor dem Senden, Verkleinerung/Neukodierung der Fotos.
- `FORM_ENDPOINT` ist **leer**: es wird nichts übertragen.
- Fahrzeugschein-Feld ausgeblendet (`SHOW_DOC_UPLOAD = false`); Foto-Schritt weist ohne Endpunkt ehrlich auf den E-Mail-Anhang hin.
- Formular gegen einen **Mock** mit der echten Validierungslogik getestet (nur lokal, nur synthetische Daten).

## 7. Prüfung der Aussagen (Phase 7)

| Thema | Vorher | Jetzt |
|---|---|---|
| Erfahrung in Jahren | „über 15 Jahre“ (Hero, Kennzahlen, Über uns, Meta, Gründe) | entfernt |
| Termin | „24–48 Stunden“ (Hero, Kennzahlen, Gründe, FAQ, Ablauf, Meta, Regionen) | „nach Absprache“ |
| Gutachtendauer | „1–2 Werktage“ | abhängig vom Einzelfall |
| Regulierungsdauer | „rund vier Wochen nicht ungewöhnlich“ (Ablauf) | unverändert, mit Hinweis „keine Zusicherung“ (Wortlaut bestätigen) |
| Kostentragung | „Die gegnerische Versicherung bezahlt“, „Anspruch auf …“ | „in der Regel“, „im Einzelfall“, kein Anspruchsversprechen |
| Gutachterwahl | „Sie müssen keinen Prüfer akzeptieren“ | „grundsätzlich keine Pflicht“, Einzelfall |
| Bagatellgrenze | „750–1.000 Euro“ | feste Grenze entfernt |
| Anfahrt | „ohne Anfahrtskosten / berechnen wir nicht extra“ | entfernt |
| Vor-Ort-Service | „Standard, nicht Aufpreis“ | „wir kommen zum Fahrzeug“ |
| Hochvolt | „spezialisierte Begutachtung … inklusive Hochvoltsystem“, „Freischaltung dokumentieren“ | „gesondert betrachtet“, Nachweise „dokumentieren“ |
| Versicherer-Pauschalurteil | „Versicherer kalkulieren gelegentlich …“ | entfernt |
| Beschleunigungsversprechen | „schnellster Weg zu Ihrem Geld“, „Regulierung ohne Rückfragen“ | entfernt |
| Fotoupload | „inklusive Fotoupload“ | entfernt (Upload nicht aktiv) |
| EDR | Datenliste | „je nach Fahrzeug und System“, Review-Hinweis in der Vorschau |

**Nicht geprüft/offen:** Texte der Regionalseiten außer den ersten Absätzen; die gesamte juristische Würdigung; Aussagen in `docs/` oder älteren Entwürfen.

## 8. Performance-Ergebnisse (Lighthouse 12.3, lokaler Build, Chrome headless)

| Seite | Gerät | Performance | Barrierefreiheit | Best Practices | SEO | FCP | LCP | TBT | CLS | Gewicht |
|---|---|---|---|---|---|---|---|---|---|---|
| Startseite | Desktop | 97 | 100 | 100 | 100 | 0,4 s | 1,3 s | 0 ms | 0 | 5,0 MB |
| Startseite | Mobil (simuliert 4G) | 74 | 100 | 100 | 100 | 2,0 s | 7,4 s | 10 ms | 0,001 | 4,9 MB |
| EDR-Systeme | Desktop / Mobil | 98 / 79 | 100 | 100 | 100 | 0,4 / 1,7 s | 1,1 / 5,6 s | 0 | 0 | 1,1 MB |
| Einsatzgebiet | Desktop / Mobil | 99 / 80 | 100 | 100 | 100 | 0,3 / 1,4 s | 1,0 / 5,4 s | 0 | 0 | 1,0 MB |
| Kontakt | Desktop / Mobil | 98 / 80 | 100 | 100 | 100 | 0,3 / 1,4 s | 1,1 / 5,3 s | 0 | 0 | 0,9 MB |

Einschränkung: lokaler Server ohne Kompression/CDN; Werte sind Richtwerte, **nicht** die Messung der veröffentlichten Seite. Messung auf der Preview-URL steht aus.

## 9. Testmethoden und Ergebnisse

| Prüfung | Methode | Ergebnis |
|---|---|---|
| TypeScript | `tsc --noEmit` | bestanden |
| Produktions-Build | `next build` (statischer Export, 32 Seiten) | bestanden |
| Lint | `next lint` / `eslint` | **nicht lauffähig** (fehlende Pakete) – offen |
| Vertrags-Test | `node --test` (4 Tests, inkl. Abgleich mit dem ING-Studio-Servercode) | 4/4 bestanden |
| Seiten-QA | echtes Chrome, 28 Seiten × 4 Größen (360, 430, 768, 1440) | kein horizontales Scrollen, kein abgeschnittener Text, keine Konsolen-/Netzwerkfehler, keine defekten Bilder |
| Barrierefreiheit | axe-core 4.10 (WCAG 2 A/AA, Best Practice) auf 28 Seiten, 2 Größen | **0 Verstöße**; Lighthouse 100/100 |
| Tippflächen (Touch) | Messung aller Bedienelemente | alle ≥ 40 px, außer die vier Kartenmarker (24 px sichtbar, 44 px wirksame Fläche über ein unsichtbares Feld) |
| Tastatur | CDP-Tastaturereignisse | bestanden: Tab-Reihenfolge, Skip-Link, Dropdown per Fokus, Escape, mobiles Menü, Knopf per Enter |
| Hero-Video | Chrome (Desktop) | läuft stumm; **Bewegung reduzieren:** kein Autoplay, Poster sichtbar, manuelles Abspielen funktioniert; **Autoplay blockiert:** Poster bleibt, „Abspielen“ funktioniert; pausiert beim Wegscrollen und bei verstecktem Tab |
| Android | Chrome 134 im Emulator (Android 16) | erster Lauf 7/7 bestanden; Wiederholung nach Änderung **nicht möglich** (siehe 4.3) |
| iPhone | Safari im iOS-Simulator (iPhone 17) | Hero-Video läuft, Knopf sichtbar; Seite lädt über den geschützten Vorschau-Link |
| Formular | Chrome gegen Mock der Studio-Validierung, synthetische Daten | bestanden: Fehlerhinweise, POST-Vertrag, Verkleinerung 6,4 MB → ~1 MB, EXIF entfernt, Erfolgsmeldung |
| Interne Links | statische Auswertung des Builds | 1.219 Links, 0 defekt, 0 fehlende Anker |
| Sitemap / robots.txt | Auswertung | 24 URLs; alle indexierbaren Seiten enthalten; `noindex`-Seiten nicht enthalten; `robots.txt` erlaubt alles und nennt die Sitemap |
| SEO-Meta | Auswertung | Titel/Beschreibung/Canonical/h1 auf jeder Seite; Länge siehe 4.5 |
| Echte Geräte (iPhone, Android), Safari Desktop/Firefox, Screenreader | – | **nicht durchgeführt** |
| Lasttest, Penetrationstest, Datenschutz-/Rechtsprüfung | – | **nicht durchgeführt** |

## 10. Sicherheitsrisiken

| Risiko | Stufe | Anmerkung |
|---|---|---|
| Fahrzeugschein enthält personenbezogene Daten (Halter, FIN, Kennzeichen) | hoch (sobald aktiv) | erst nach Löschkonzept, Datenschutzerklärung, Verschlüsselung und Zugriffsprotokoll aktivieren |
| Cross-Origin-Zugang zum Studio (CORS statt Proxy) | mittel | strikte Allowlist, nur eine Route, keine Cookies |
| Rate-Limit nur im Arbeitsspeicher | mittel | Neustart setzt Zähler zurück; verteilte Angriffe nicht abgedeckt |
| Keine Malware-Prüfung bei Uploads | mittel | magische Bytes schützen vor falschen Typen, nicht vor präparierten Bildern/PDF |
| Keine automatische Löschung | mittel | Verstoß gegen Speicherbegrenzung möglich |
| EXIF/GPS in Fotos | mittel | im Frontend jetzt entfernt, serverseitig zusätzlich absichern |
| Doppelte/gefälschte Anfragen | niedrig–mittel | Honeypot und Zeitprüfung vorhanden, keine Idempotenz |
| E-Mail als Fallback ohne Anhang | niedrig | Nutzer sendet Dateien selbst per Mail |
| Unbestätigte Rechts-/Leistungsaussagen | mittel (Abmahnrisiko) | Liste in Abschnitt 5; vor Livegang prüfen lassen |
| Interne Review-Hinweise sichtbar, wenn `NEXT_PUBLIC_REVIEW_MODE=1` im Produktionsbuild gesetzt wird | niedrig | Variable nur in der Vorschau setzen (Freigabe-Checkliste) |

## 11. Konkrete Empfehlung für den nächsten Schritt

1. **Ekrem die Bestätigungsliste (Abschnitt 5) vorlegen**, zuerst die Punkte 1–3, 7–9, 17–18; ohne diese keine Veröffentlichung.
2. **Entscheidung zum Zugangsweg** (Abschnitt 6.3, Empfehlung B) und zum Hosting der öffentlichen Seite.
3. **Staging-Anbindung** mit synthetischen Daten, danach Datenschutz-Paket (Erklärung, Löschfristen, Verarbeitungsverzeichnis) – erst dann Fahrzeugschein-Upload.
4. **Technik-Schulden klein halten:** Lint-Pakete nachrüsten (mit Freigabe), Videofassung für Mobil verkleinern, Titel/Beschreibungen mit SEO-Verantwortlichen kürzen, Test auf echten Geräten (iPhone, Android).
5. **Freigabepunkte (benötigen deine ausdrückliche Zustimmung):** Push des Branches und neue Vorschau/neuer Freigabe-Link · Abhängigkeiten ändern (Lint) · Änderungen am ING-Studio-Code (Origin-Allowlist, Fahrzeugarten, Idempotenz) · Staging-Verbindung · Veröffentlichung/Merge.
