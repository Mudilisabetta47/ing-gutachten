# Abgleich: Ekrems Änderungswünsche ↔ Integrationsbranch

Branch: `integration/old-site-premium-sections` (Basis: alte Website `origin/main`, Stand von ing-gutachten.vercel.app)
Status: **nur Entwicklungsbranch – nichts veröffentlicht, nichts gepusht.** Keine Änderungen an ING Studio, produktiver Datenbank, IONOS-VPS oder GoKlinik.

Legende: ✅ umgesetzt und getestet · 🟡 teilweise / vorbereitet · ⏳ offen · ❓ Rückfrage nötig

---

## 1. Übersicht nach Ekrems Punkten

| # | Wunsch | Stand | Anmerkung |
|---|---|---|---|
| 1 | Navigation: „Schadensgutachten“ (PKW-Gutachten, Unfallgutachten) und „Unfallanalyse“ (EDR-Systeme, Vorschwunganalyse, Unfallrekonstruktion) | ✅ | Beide Dropdowns umgesetzt (Desktop: Hover/Fokus, Mobil: Aufklappmenü). Alle Ziel-URLs existieren; keine bestehende URL ist entfernt. „Leistungen“, „Ablauf“, „Über uns“ liegen auf Ihren Wunsch in der Fußzeile. |
| 1 | Fachliche Prüfung „Vorschwunganalyse“ | ❓ | Siehe Abschnitt 3. Begriff ist kein bekannter Fachbegriff → neutrale Platzhalterseite (`noindex`, nicht in der Sitemap), keine fachlichen Aussagen. |
| 2 | EDR-Systeme: sachliche Erklärung der auslesbaren Daten | ✅ (Text) / ❓ (Fachfreigabe) | Neuer Abschnitt „Datenumfang“ mit Formulierung „je nach Fahrzeug und System“. Fachliche Bestätigung durch ING offen. |
| 2 | Unfallrekonstruktion: eigene, verständliche Darstellung | 🟡 | Seite besteht (Schemaszene, Hinweis „Ausführliche Informationen folgen“). Detailtexte liefert der Kunde. |
| 2 | Vorschwunganalyse: Vorbereitung einer eigenen Leistungsbeschreibung | 🟡 | Platzhalterseite angelegt; Text erst nach Klärung der Bedeutung. |
| 3 | Schadenabwicklung: beratende Unterstützung, ca. vier Wochen als Möglichkeit | ✅ (bereits vorhanden) | `/ablauf` enthält beides: „Wir beraten auch bei der weiteren Abwicklung“ und „Rechnen Sie mit Wochen … rund vier Wochen ist nicht ungewöhnlich“, dazu den Hinweis „Eine bestimmte Regulierungsentscheidung lässt sich nicht zusichern“. Keine Frist/Garantie. Offene Punkte: Abschnitt 4. |
| 4 | Unfallformular: optionaler, sicherer Fahrzeugschein-Upload | 🟡 / ⏳ | Oberfläche besteht bereits (optional, Bild/PDF, 1 Datei, max. 12 MB, Drag & Drop). **Sichere Verarbeitung existiert nicht:** `FORM_ENDPOINT` ist leer, die Seite ist ein statischer Export; Dateien werden nicht übertragen (E-Mail-Fallback). Ich habe einen ehrlichen Hinweis im Formular ergänzt. Backend-Entscheidung nötig (Abschnitt 5). |
| 5 | Interaktives Fahrzeugmodell | ✅ (Frontend) / ❓ (Fachfreigabe) | Vier Ansichten: Schadenzonen · Assistenzsysteme (7 Sensorgruppen, 15 Markierungen) · Hochvolt-Batterie im Unterboden mit dezent fließendem Strom · Struktur Heck (Längsträger, Ladeboden, Querträger). Alle Lagen als „typisch/schematisch“ gekennzeichnet; pauschale Schadenbehauptungen entschärft („häufig verzogen“ → „kann betreffen“). |
| 6 | Fahrzeugklassen: 3×3-Raster, fachliche Bezeichnungen/Texte, eigene Symbole für Motorrad und Oldtimer | ✅ | Raster beibehalten, Beschreibungen technisch formuliert, Motorrad (Rahmen, Gabel, Motorblock, Auspuff) und Oldtimer (Kotflügel, Trittbrett, Rundscheinwerfer) mit eigenen Symbolen. |
| 7 | Bereich „Bagatellschäden“ entfernen | ✅ (bereits entfernt) | Eigenständige Seite/Navigation gibt es im Stand nicht; `/bagatellschaeden` leitet dauerhaft auf `/pkw-gutachten` weiter (bleibt, damit alte Links nicht ins Leere laufen). Einzig verbleibend: **eine FAQ-Antwort** zur „Bagatellgrenze 750–1.000 €“ (Abschnitt 3, Frage 5). |
| 7 | Mobile Darstellung optimieren | 🟡 | Audit aller 22 Seiten bei 375 px: kein horizontaler Überlauf. Tippflächen < 44 px auf Touch-Geräten vergrößert (Textlinks, Brotkrumen, Telefon/E-Mail, Regionenkarte); Video-Rahmen auf Phones 4:3. Echtgerätetest steht aus. |
| 7 | CTA-Hover- und Fokus-Effekte | ✅ | „Anrufen“-Button: Fokus wirkt wie Hover (Fläche, Rahmen, Symbol). Textlinks: Fokus wie Hover. Rundes Fokus-Fenster verformt Buttons nicht mehr. (Haupt-CTAs hatten beides bereits.) |
| 7 | Unnötige Sektionen, Wiederholungen, überladene Animationen reduzieren | ⏳ ❓ | Kandidatenliste in Abschnitt 6. Ich entferne nichts ohne Ihre/Ekrems Auswahl. |
| 7 | Begutachtungsvideo integrieren | ✅ | Sektion „Einblicke“ nach dem Ablauf; lädt erst bei Sichtbarkeit, stumm, Pause-Knopf, reduced-motion ohne Autoplay. |
| 7 | Restliche alte Struktur erhalten | ✅ | Unfall-Film (jetzt Premium-Version, auf Ihre Bitte), Hero, Ablauf, Seiten, SEO unverändert. |

## 2. Noch offen

1. Fachliche Freigabe: Vorschwunganalyse, EDR-Datenumfang, Sensor-/Batterie-/Strukturdarstellung (Abschnitt 3).
2. Upload: Entscheidung über Verarbeitungsweg (Abschnitt 5), dann Umsetzung im Backend.
3. Inhalte vom Kunden: Unfallrekonstruktion (Details), Vorschwunganalyse (nach Begriffsklärung).
4. Auswahl der zu reduzierenden Sektionen/Animationen (Abschnitt 6).
5. Echtgerätetest Mobil (iOS Safari, Android Chrome), Lighthouse-Messung auf der Preview-URL.
6. `/unfallgutachten` ist nicht in der Sitemap (Altbestand).
7. Dropdown-Unterpunkte erscheinen erst beim Öffnen und stehen nicht im HTML (für Suchmaschinen sind die Seiten über Sitemap, Fußzeile und Querverweise erreichbar). Ob die Unterpunkte zusätzlich dauerhaft im HTML stehen sollen, ist ein Eingriff in die Navigationskomponente – bitte entscheiden.

## 3. Fachliche Rückfragen an Ekrem

1. **Vorschwunganalyse – was ist gemeint?** Als feststehender Fachbegriff der Unfallanalyse/Kfz-Begutachtung ist er mir nicht bekannt. Mögliche Lesarten, die geklärt werden müssen: *Vorschadenanalyse* (Prüfung auf Vorschäden) · *Vorkollisionsanalyse* (Annäherungs-/Bremsphase vor dem Anstoß) · Bewegung/„Schwung“ der Fahrzeuge vor oder nach dem Anstoß · etwas anderes. Bitte Begriff, Leistung, Methode und verwendete Software/Daten benennen, bevor ein Text entsteht.
2. **Kollisionsanalyse / Auslaufverhalten** (aus dem vorherigen Auftrag): Bietet ING die Berechnung von Kollisionsgeschwindigkeit, Bewegungs- und Auslaufverhalten selbst an – mit welcher Qualifikation? Die Website beschreibt bisher nur Plausibilitätsprüfung und Deformationsbewertung. Ohne Bestätigung keine Werbeaussage.
3. **EDR-Auswertung:** Welche Auslesetechnik, welche Hersteller/Baujahre sind abgedeckt, auf welcher Rechtsgrundlage (Halter, Einwilligung, Behörde) wird gearbeitet, und was kostet es? Daraus folgt, was die Seite sagen darf. Ich habe bewusst keine Marken genannt.
4. **Sensor-/Batterie-/Strukturdarstellung:** Bitte durch den Sachverständigen gegenlesen: Sind die typischen Positionen (Front-Radar im Stoßfänger, Kamera hinter der Scheibe, Eckradare hinten, Ultraschall vorn/hinten, Batterie im Unterboden, Längsträger/Ladeboden/Querträger hinten) richtig bezeichnet? Fehlt etwas Wichtiges (z. B. Kalibrierpflicht je Hersteller)?
5. **Bagatellgrenze in der FAQ:** Die Antwort nennt „etwa 750 bis 1.000 Euro“. Diese Zahl hat keine einheitliche gesetzliche Grundlage und gilt als Rechtsprechungs-Faustregel; sie kann irreführend wirken. Soll die Antwort bleiben, umformuliert (ohne Zahl) oder entfallen?
6. **Fahrzeugklassen:** Bietet ING Gutachten für **Anhänger**, **Transporter** und **gewerbliche Flotten** wirklich an, oder sollen diese Kacheln entfallen/anders benannt werden? Aktuell verlinken sie auf die LKW-/PKW-Seite.
7. **Hinweis zum KI-Video:** Die Filmszene wird als „KI-generiert, illustrativ“ gekennzeichnet. Bitte bestätigen, dass das so bleiben soll (Transparenz, kein Eindruck echter Mitarbeiter/Kunden).
8. **Bestehende Aussagen mit rechtlichem Gewicht** (Überprüfung durch den Kunden bzw. einen Juristen; nicht von mir geändert):
   - Startseite „Die gegnerische Versicherung bezahlt. Aussuchen dürfen Sie.“ – gilt nur in bestimmten Fällen (z. B. unverschuldeter Unfall, Haftung dem Grunde nach).
   - `/unfallgutachten`: „Bei einem unverschuldeten Unfall haben Sie Anspruch auf ein eigenes, unabhängiges Gutachten“ und Aussagen zu den Kosten.
   - „Gutachten in 1–2 Werktagen“, „Termin in 24–48 h“ (an mehreren Stellen, auch in Meta-Beschreibungen): Als Zielwerte formuliert („meist“), nicht als Zusage – prüfen, ob „meist/in der Regel“ überall steht.
   - Datenschutzseite enthält noch Platzhalter („vor dem Livegang rechtlich prüfen“, Auftragsverarbeitung).

## 4. Technische Abhängigkeiten

- **Statischer Export** (`output: 'export'`, `trailingSlash`): keine serverseitige Logik im Frontend-Projekt möglich. Alles, was Daten verarbeitet (Formular, Upload), braucht einen externen Endpunkt oder eine Umstellung des Projekts auf serverseitiges Rendering mit API-Routen.
- **Formularendpunkt** (`FORM_ENDPOINT` in `src/lib/content.ts`): leer → E-Mail-Fallback ohne Anhänge.
- **Vercel-Projekt** (ing-gutachten.vercel.app) und **Quell-Repository** (`Mudilisabetta47/ing-gutachten`, `main`): Deployment erst nach Freigabe; Branch wurde nicht gepusht.
- **Medien:** `begutachtung.mp4` (3,9 MB) und `showcase-begutachtung.jpg` liegen in `public/assets`; die Datei ist KI-generiert.
- **Lint:** `next lint` läuft im alten Stand nicht (veraltete ESLint-Optionen) – Altlast, Typprüfung und Build sind fehlerfrei.

## 5. Änderungen mit Backend- oder Datenschutzrelevanz

**Nicht umgesetzt, Entscheidung nötig – Fahrzeugschein-Upload.** Der Fahrzeugschein enthält personenbezogene Daten (Name, Anschrift, Kennzeichen, Fahrzeug-Identnummer, ggf. Halterdaten). Anforderungen vor einer Freischaltung:

| Thema | Empfehlung |
|---|---|
| Rechtsgrundlage / Information | Einwilligung bzw. Vertragsanbahnung (Art. 6 Abs. 1 lit. a/b DSGVO); Datenschutzerklärung ergänzen: Zweck, Empfänger, Speicherdauer, Auftragsverarbeiter. |
| Datenminimierung | Optional lassen; Hinweis, dass nur die Vorderseite nötig ist und Felder ohne Bezug geschwärzt werden können. |
| Dateivalidierung (serverseitig) | Erlaubte Typen per Inhalt prüfen (JPEG/PNG/PDF, nicht nur Endung), max. Größe (z. B. 8–12 MB), Anzahl 1, Dateinamen neu vergeben, Metadaten (EXIF) entfernen, Malware-Scan. Die clientseitige Prüfung ersetzt das nicht. |
| Speicherort | EU-Region, verschlüsselt im Ruhezustand, **privater** Bucket (kein öffentlicher Link), Zugriff nur über kurzlebige signierte Adressen. |
| Zugriffsrechte | Nur Bearbeiter des Falls; Zugriffe protokollieren; kein Versand der Datei per unverschlüsselter E-Mail. |
| Löschfristen | Festlegen und automatisieren (z. B. Löschung nach Abschluss/Ablehnung des Auftrags plus gesetzliche Aufbewahrung, sonst spätestens nach 30–90 Tagen). Betroffenenrechte (Auskunft/Löschung) abbilden. |
| Missbrauchsschutz | Rate-Limit, Bot-Schutz, kein Upload ohne vollständige Anfrage. |
| Betrieb | Verarbeitung über den ING-Studio-Backend-Weg (Fahrzeugschein ↔ Fall) wäre naheliegend, berührt aber ING Studio/Datenbank – bewusst **nicht angefasst**. |

Bis dahin: Hinweis im Formular, dass der Fahrzeugschein per E-Mail angehängt werden soll (umgesetzt, ehrlich). Alternative bis zur Backend-Lösung: Upload-Feld ausblenden.

Weitere datenschutzrelevante Stellen: Kontaktformular (Name, Telefon, E-Mail, Fotos, Nachricht) – gleicher Verarbeitungsweg; Karten/Schriften/Videos: Video wird lokal ausgeliefert (kein Drittanbieter).

## 6. Kandidaten zum Reduzieren (Auswahl durch Kunde/Auftraggeber)

Startseite aktuell (von oben): Hero · Ticker · Kennzahlen · Positionierung · **Unfall-Film (sehr lang)** · Fahrzeugmodell · Fahrzeugklassen · Ablauf · Video „Einblicke“ · „Sechs Gründe“ · Foto-Band · Einsatzgebiet · Anfrage · FAQ · CTA-Band.

- **Ticker** und **Kennzahlen** wiederholen Leistungen/Termine, die Hero, Ablauf und FAQ ebenfalls nennen (24–48 h, 1–2 Werktage mehrfach).
- **„Sechs Gründe“** und **Positionierung** überschneiden sich inhaltlich (Unabhängigkeit, Beweislage).
- **Foto-Band** (Prüfhalle) – rein atmosphärisch.
- **Animationen:** Unfall-Film (460 vh Scrollstrecke auf Desktop), Karten-Reveal, Marker-Pulse. Bei Bedarf Unfall-Film kürzen.
Bitte Auswahl mitteilen, dann entferne/kürze ich gezielt.

## 7. Technische Prüfungen (lokal, statischer Build)

- Typprüfung und Produktionsbuild fehlerfrei, 32 Seiten.
- Alle bestehenden Seiten bleiben von mindestens 26 Seiten aus verlinkt (außer Dropdown-Unterseiten: EDR 4, Unfallrekonstruktion 4, Vorschwunganalyse 0 – Platzhalter ohne Index).
- `/vorschwunganalyse` hat `noindex, follow` und steht nicht in der Sitemap.
- Mobil (375 px): kein horizontaler Überlauf auf 22 geprüften Seiten; keine Konsolenfehler.
- Desktop-Dropdowns und Mobil-Akkordeon funktionieren; Fahrzeugmodell: alle vier Ansichten bedienbar.
