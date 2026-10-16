# Integrationsplan: öffentliche Website → geschützte Anfrage-API → ING Studio

Stand: 16.10.2026 · Branch `integration/old-site-premium-sections`
**Status: Plan und Simulation. Es besteht KEINE Verbindung zu einem echten System.** `FORM_ENDPOINT` ist leer, alle Tests nutzen synthetische Daten und lokale Mock-Server. Keine Änderung am VPS, an PostgreSQL, SeaweedFS, ING Studio oder GoKlinik. Rechtliche Aussagen sind Vorschläge zur Prüfung durch Fachleute, keine Rechtsberatung.

---

## 1. Ausgangslage (aus dem Code gelesen)

| Baustein | Ist-Zustand |
|---|---|
| Öffentliche Website | statischer Export (`output: 'export'`), kein Server; Formular sendet nur dann, wenn `FORM_ENDPOINT` gesetzt ist, sonst E-Mail-Fallback ohne Anhänge |
| Studio-Endpunkt | `POST /api/anfrage` (Next.js Route, Node-Laufzeit), `src/app/api/anfrage/route.ts` |
| Origin-Prüfung | `new URL(origin).host !== host` → 403. Fehlt `Origin`, wird nicht geprüft |
| Client-IP | erstes Element von `X-Forwarded-For` (Rate-Limit und gesalzener IP-Hash) |
| Rate-Limit | 12 Anfragen / 10 Min. je IP, **nur im Arbeitsspeicher der Instanz** (`lib/rate-limit.ts`) |
| Bot-Schutz | Honeypot `website`, Mindest-Ausfüllzeit 2,5 s (`t`) |
| Validierung | Server prüft Felder, Auswahllisten, Länge, E-Mail/Telefon, Einwilligung; Dateityp **aus Dateiinhalt** (JPEG/PNG/WebP/PDF), 8 Fotos, 1,6 MB je Datei, 4,3 MB gesamt (Wert aus der Vercel-Grenze 4,5 MB abgeleitet), `Content-Length` Pflicht |
| Speicherung | `Inquiry` (unveränderlich) + `Lead` + Verlauf + Audit in einer Transaktion; Einwilligungszeit, Formular-/Datenschutzversion, IP nur als HMAC-Hash |
| Dateien | `putMedia` → privater S3-Speicher (SeaweedFS), AES-256-GCM auf Anwendungsebene (in Staging/Produktion Pflicht, sonst „fail closed“); Status `STORED` / `MAIL_ONLY` / `NOT_STORED` |
| Benachrichtigung | E-Mail ans Büro mit Anhängen; Ergebnis am Lead (`SENT/FAILED/SKIPPED`); bei Totalausfall ehrliche Fehlermeldung mit Telefonnummer |
| Öffentlicher Zugang des Studios | **keiner**: Ports 80/443 des VPS gehören dem GoKlinik-Proxy; das ING-Netz ist intern |
| Löschfristen | Anonymisierung technisch vorbereitet, **kein automatischer Ablauf** (`docs/DATENSCHUTZ-TODO.md` im Studio-Repository) |

## 2. Ergebnis der Prüfung der Reverse-Proxy-Lösung

Simuliert mit `tests/proxy-origin.test.mjs` (lokaler Mini-Proxy, Studio-Prüflogik nachgebaut, 6 von 6 Tests bestanden):

1. **Ohne Proxy** (Browser auf `ing-gutachten.de` → Studio-Adresse): **403** – die Origin-Prüfung blockiert fremde Herkunft. Direktes Senden funktioniert nur mit einer Änderung am Studio.
2. **Proxy, der den `Host`-Header auf das Ziel umschreibt** (üblich bei Rewrites): ebenfalls **403**, solange das Studio keine Erlaubnisliste kennt.
3. **Proxy, der den ursprünglichen `Host` unverändert weitergibt** (Standardverhalten von Caddy `reverse_proxy`): **200**, Fremdherkunft bleibt **403** – ohne Codeänderung am Studio.
4. **Erlaubnisliste im Studio** (`ANFRAGE_ALLOWED_ORIGINS`): funktioniert auch bei umgeschriebenem Host; Fremdherkunft bleibt gesperrt.
5. **Risiko X-Forwarded-For:** Hängt der Proxy die Client-IP nur **an**, nimmt das Studio das **erste** Element – das kann ein Angreifer selbst setzen (Rate-Limit-Umgehung, verfälschter IP-Hash). Überschreibt der Proxy den Header mit der echten Verbindungs-IP, ist die Fälschung wirkungslos.

**Bewertung:** Die Proxy-Lösung ist machbar und braucht am Studio nur zwei kleine, sicherheitsrelevante Anpassungen (Erlaubnisliste für Herkunft; vertrauenswürdige Client-IP statt „erstes XFF-Element“). Das eigentliche Hindernis ist **nicht** der Proxy, sondern dass das Studio derzeit **von außen nicht erreichbar ist** (Abschnitt 3).

## 3. Entscheidung 1: Wie wird das Studio für die Anfrage-Route erreichbar?

Nur diese eine Route (`POST /api/anfrage`) darf öffentlich sein. Admin, Studio-Oberfläche, Datenbank und Speicher bleiben intern.

| Option | Beschreibung | Vorteile | Nachteile / Risiken |
|---|---|---|---|
| **O1 Cloudflare-Tunnel (benannt, dauerhaft)** | `cloudflared` im ING-Netz baut ausgehend eine Verbindung auf; Ingress-Regel nur für `/api/anfrage`; kein neuer Port | keine eingehenden Ports, GoKlinik unberührt, WAF/Rate-Limit am Rand möglich | Cloudflare sieht den Datenverkehr (Auftragsverarbeiter, Drittland-Fragen); Abhängigkeit von einem Dienst; benötigt eine Domain bei Cloudflare |
| **O2 Eigene IP/Server für ING** | zweite öffentliche IP oder kleiner eigener Server mit eigenem Caddy | stärkste Trennung zu GoKlinik, volle Kontrolle | Kosten, zusätzlicher Betrieb |
| **O3 Studio auf Vercel + verwaltete Datenbank** | Studio-Web wie im Studio-Repository vorgesehen auf Vercel, Daten in EU-Region | Standardbetrieb, kein VPS-Zugang nötig | Datenhaltung außerhalb des VPS, Kosten, Migration (siehe Studio-Dokumente zum Cloud-Staging) |
| O4 Eintrag im Caddy von GoKlinik | ING-Host im bestehenden Proxy | schnell | **nicht zulässig** (GoKlinik darf nicht verändert werden) und fehleranfällig |

**Empfehlung für Staging/Pilot:** O1 (kleinster Eingriff, reversibel, ohne Ports). **Für Dauerbetrieb:** O2 oder O3, abhängig von Datenschutz- und Kostenentscheidung. Die Wahl beeinflusst die Datenschutzerklärung (Empfänger, Drittland).

## 4. Entscheidung 2: Wie spricht die Website die Route an?

| Weg | Konfiguration (Skizze, **nicht angewendet**) | Bewertung |
|---|---|---|
| **P1 Same-Origin-Proxy** (Website wird selbst durch einen Caddy/Next-Server ausgeliefert) | `handle /api/anfrage* { reverse_proxy <Studio-Ziel> { header_up X-Forwarded-For {remote_host} } }` – `Host` bleibt original (Standard), XFF wird überschrieben | **empfohlen**; Origin-Prüfung besteht ohne Studio-Änderung; Browser sieht nur die eigene Herkunft (kein CORS) |
| P2 Vercel-Rewrite | `vercel.json`: `{ "source": "/api/anfrage", "destination": "https://<Studio>/api/anfrage" }` | Host wird auf das Ziel gesetzt → Erlaubnisliste im Studio nötig; Body-Grenzen und XFF-Verhalten vor Einsatz testen |
| P3 CORS-Freigabe am Studio | `Access-Control-Allow-Origin: https://ing-gutachten.de` nur für diese Route, Preflight `OPTIONS`, keine Cookies | funktioniert, macht die Studio-Adresse für Browser öffentlich nutzbar; strikte Liste nötig |

**Gemeinsame Pflichten bei jedem Weg:** TLS durchgehend; nur `POST /api/anfrage` weiterleiten; Antwort-Header `Cache-Control: no-store`; Body-Limit am Proxy (z. B. 14 MB nach Anhebung der Dateigrenzen, vorher 4,5 MB); Zeitlimit; keine Weitergabe von Cookies/Authorization; Fehlerseiten des Proxys dürfen keine internen Adressen verraten.

## 5. Detailplan je Themenbereich

### 5.1 `POST /api/anfrage` – Vertrag
Felder (`multipart/form-data`): `anlass`, `fahrzeug`, `name`, `telefon`, `email`, `standort`, `nachricht`, `datenschutz` (`true`), `website` (Honeypot, leer), `t` (Formularstart in ms), `foto` (mehrfach), optional `fahrzeugschein`; **neu vorgeschlagen:** `idempotencyKey` (UUID).
Antworten: `200 {ok:true, reference}`; `400 validation|invalid_file|too_many_files`; `403 forbidden`; `411 length_required`; `413 too_large`; `429 rate_limited` (mit `Retry-After`); `5xx` mit Telefonnummer. Das Formular zeigt die serverseitige Meldung an (umgesetzt, getestet).

### 5.2 Sichere Weiterleitung
- Nur Methode `POST`, nur Pfad `/api/anfrage`; alle anderen Pfade am Rand 404.
- Header am Proxy: `X-Forwarded-For` **überschreiben** (echte Verbindungs-IP), `X-Forwarded-Proto`, `Host` unverändert (P1). Eingehende `X-Forwarded-*`, `Forwarded`, `Cookie`, `Authorization` entfernen.
- Studio: Client-IP **nicht** mehr als „erstes XFF-Element“ lesen, sondern über eine Konfiguration `TRUSTED_PROXY_HOPS` (letztes vertrauenswürdiges Element). Bis dahin gilt: nur mit überschreibendem Proxy betreiben (Test 5).
- Studio-Container nur aus dem Proxy-Netz erreichbar (internes Docker-Netz), kein veröffentlichter Port.

### 5.3 Herkunftsprüfung
- Beibehalten: Origin-Host = Host (Test 3).
- Neu: `ANFRAGE_ALLOWED_ORIGINS` (Liste, exakte Schemes/Hosts). Für P2/P3 erforderlich.
- Anfragen **ohne** `Origin`-Header (Skripte) zulassen, aber strenger drosseln und Honeypot/Zeitprüfung erzwingen; optional später Captcha (datensparsam).
- Keine Cookies, daher kein klassisches CSRF; der Schutz besteht aus Herkunftsprüfung + Zufallsschlüssel + Rate-Limit.

### 5.4 Rate-Limit (mehrschichtig)
1. **Rand** (Proxy/Cloudflare): z. B. 10 Anfragen/Minute je IP, harte Body-Grenze, Verbindungs-Timeout.
2. **Anwendung:** bestehendes Limit (12/10 Min.) behalten, aber persistent machen (Datenbank-Tabelle oder Redis), da der Speicher beim Neustart verloren geht.
3. **Fachlich:** höchstens N Anfragen je E-Mail/Telefon (gehasht) in 24 h; globale Notbremse (z. B. >200 Anfragen/Stunde → Meldung „bitte telefonisch“ + Alarm).
4. Antwort `429` mit `Retry-After`; das Formular zeigt die Meldung (getestet gegen Mock).

### 5.5 Upload-Sicherheit
Bereits vorhanden: Typ aus Inhalt, Größen- und Anzahlgrenzen, serverseitige Dateinamen, SHA-256, Verschlüsselung, zufällige Objektschlüssel.
Zusätzlich vorgeschlagen:
- **Neukodierung serverseitig** (z. B. mit `sharp`): entfernt EXIF/GPS und eingebettete Inhalte; PDF nur nach Prüfung, sonst ablehnen (Fahrzeugschein als Foto statt PDF bevorzugen).
- **Malware-Scan** (ClamAV) vor Ablage; bis zum Ergebnis Status `PENDING_SCAN`, danach `STORED` oder `QUARANTINE`.
- Grenzen auf dem VPS anheben (die 4,3 MB stammen aus der Vercel-Grenze) und am Proxy dieselbe Obergrenze setzen.
- Zugriff nur für angemeldete Mitarbeitende mit Berechtigung; Download über kurzlebige Adressen; jeder Zugriff im Audit-Protokoll.
- Fahrzeugschein: nur ein Dokument, eigener kürzerer Löschzeitraum, Hinweis im Formular („nur Vorderseite, nicht benötigte Angaben schwärzen“), niemals im Mail-Anhang an Dritte weiterleiten.
- Im Frontend umgesetzt: Fotos werden immer im Browser neu kodiert (≤ 1600 px, JPEG) – dabei fallen EXIF/GPS weg.

### 5.6 Idempotenz
- Browser erzeugt pro Formularaufruf eine UUID (`idempotencyKey`), jeder Wiederholungsversuch trägt denselben Wert (umgesetzt).
- Studio (vorgeschlagen): Tabelle `InquiryRequest(key unique, inquiryId, referenz, createdAt)`; bei bekanntem Schlüssel keine neue Anfrage, sondern dieselbe Antwort (`duplicate: true`); Aufbewahrung 24 h.
- Ergänzend: Inhalts-Hash (E-Mail + Nachricht) innerhalb von 10 Min. als Warnung, nicht als harte Sperre.
- Getestet gegen Mock: Wiederholung liefert dieselbe Referenz und erzeugt keinen zweiten Datensatz.

### 5.7 Eingangsbestätigung
- Antwort enthält `reference` (z. B. `ING-JJMMTT-XXXX`, nicht fortlaufend erratbar); das Formular zeigt sie an (umgesetzt, gegen Mock getestet).
- Optional Bestätigungs-E-Mail an die angegebene Adresse **ohne** Anhänge und ohne sensible Inhalte: Referenz, Datum, Telefonnummer des Büros, Link zur Datenschutzerklärung. Eigene Absenderdomain mit SPF/DKIM/DMARC, sonst landet sie im Spam.
- Fällt die Mail aus, gilt die Anfrage als gespeichert (Lead-Status), das Büro sieht den Fehler; für die Person bleibt die Bildschirm-Bestätigung.
- Kein Versprechen von Antwortzeiten im Text.

### 5.8 Datenschutz und Löschfristen
Datenarten: Kontaktdaten und Nachricht (Name, Telefon, E-Mail, Standort), Schadenfotos (können Personen/Kennzeichen/Orte zeigen), Fahrzeugschein (Halterdaten, FIN, Kennzeichen), technische Daten (IP nur als Hash, UTM, Zeit der Einwilligung, Versionen).

| Datenart | Zweck | Vorschlag Aufbewahrung (**von Fachleuten zu bestätigen**) |
|---|---|---|
| Anfrage ohne Auftrag | Beantwortung der Anfrage | feste Frist definieren, z. B. wenige Monate; danach Anonymisierung |
| Fotos/Fahrzeugschein ohne Auftrag | Ersteinschätzung | kürzer als die Anfrage; Löschung automatisch |
| Aufträge/Gutachten | Vertragserfüllung, handels-/steuerrechtliche Aufbewahrung (siehe Hinweis zu § 147 AO im Studio-Code) | gesetzliche Fristen durch Steuerberatung festlegen |
| IP-Hash | Missbrauchserkennung | kurz (Tage bis Wochen) |
| Mail-Protokolle/Logs | Betrieb | kurz, ohne Inhalte |

Technische Umsetzung (vorgeschlagen): täglicher Löschlauf (Job) mit Trockenlauf und Bericht; Löschung im Speicher **und** in der Datenbank (Anonymisierung vorhanden: `data.anonymize`); Backups so rotieren, dass gelöschte Daten nach definierter Zeit auch dort verschwinden; Betroffenenanfragen (Auskunft/Löschung/Export) als dokumentierter Ablauf; Protokoll jeder Löschung.
Vor Livegang erforderlich: Datenschutzerklärung (Verantwortlicher, Zwecke, Rechtsgrundlagen, Empfänger/Auftragsverarbeiter wie Hosting, E-Mail-Dienst, ggf. Cloudflare/Vercel, Speicherdauer, Rechte, Hinweis zu Fotos und Fahrzeugschein), Verarbeitungsverzeichnis, Auftragsverarbeitungsverträge, Prüfung einer Datenschutz-Folgenabschätzung, Einwilligungstext im Formular.

### 5.9 Fehlerbehandlung und Beobachtung
- Verständliche Meldungen (umgesetzt): zu groß, falscher Typ, zu viele Anfragen, Server nicht erreichbar → Telefonnummer.
- Keine Formularinhalte in Logs; nur Fehlerart.
- Alarm bei: Mail-Fehlerquote, Speicherfehlern (`NOT_STORED`), 5xx-Rate, ungewöhnlich vielen 429/403.
- Gesundheitsprüfung des Pfads (`/api/health`) vom Rand aus, ohne die Anfrage-Route zu belasten.

## 6. Arbeitspakete

| Nr. | Paket | Wo | Aufwand | Freigabe nötig |
|---|---|---|---|---|
| 1 | Entscheidung O1/O2/O3 und P1/P2/P3 | – | Entscheidung | ja |
| 2 | Vertrag + Frontend (Verkleinerung, Schlüssel, Referenz, Fehlermeldungen) | Website | **erledigt** | – |
| 3 | Studio: Herkunfts-Erlaubnisliste, vertrauenswürdige Client-IP | Studio-Code | klein | ja |
| 4 | Studio: Idempotenz-Tabelle, Referenznummer, Antwort `reference` | Studio-Code + Migration | mittel | ja |
| 5 | Studio: persistentes Rate-Limit, Fahrzeugarten-Liste und Formularversion erweitern, Dateigrenzen anheben | Studio-Code | mittel | ja |
| 6 | Studio: serverseitige Neukodierung, Malware-Scan, Status `PENDING_SCAN` | Studio + Betrieb | mittel–groß | ja |
| 7 | Bestätigungs-E-Mail (optional), Absenderdomain | Studio + DNS | mittel | ja |
| 8 | Löschlauf + Betroffenenrechte-Ablauf | Studio + Organisation | groß | ja |
| 9 | Datenschutzpaket (Erklärung, Verzeichnis, AV-Verträge) | Recht/Organisation | extern | ja |
| 10 | Staging-Anbindung mit synthetischen Daten, Abnahmetests | Staging | mittel | ja |
| 11 | Produktivschaltung (`FORM_ENDPOINT` setzen) | Website | klein | ja, ausdrücklich |

Fahrzeugschein-Upload (`SHOW_DOC_UPLOAD`) erst nach Paket 6, 8 und 9.

## 7. Abnahmekriterien (Auszug)
- Gültige synthetische Anfrage → gespeichert, Datei verschlüsselt, Referenz sichtbar, Mail/Alarm wie erwartet.
- Doppelklick und Wiederholung → genau ein Datensatz.
- Zu große Datei, falscher Typ, SVG/HTML als „Foto“, 9 Fotos, fehlende Länge → saubere Ablehnung.
- Fremde Herkunft, gefälschtes `X-Forwarded-For`, Honeypot, zu schnelles Absenden → wirkungslos bzw. abgelehnt.
- Lasttest: Rate-Limit greift, Server bleibt erreichbar.
- Ausfall von Mail oder Speicher → ehrliche Meldung, Anfrage nicht verloren (soweit gespeichert).
- Löschlauf entfernt Testdaten vollständig (Datenbank + Speicher + Backup-Rotation geprüft).

## 8. Rollout und Rückfall
1. Staging mit synthetischen Daten (Schalter nur dort). 2. Prüfprotokoll. 3. Freigabe durch dich. 4. Produktiv: `FORM_ENDPOINT` setzen. **Rückfall:** `FORM_ENDPOINT` leeren → E-Mail-Fallback; Proxy-Regel entfernen; Tunnel stoppen.

## 9. Bereits geprüft und umgesetzt (Website-Seite, nur synthetische Daten)
- Vertragstests (`tests/inquiry-contract.test.mjs`, 5 Tests, Abgleich mit dem echten Servercode).
- Proxy-/Herkunftssimulation (`tests/proxy-origin.test.mjs`, 6 Tests).
- Formular im echten Chrome gegen einen Mock mit der echten Validierungslogik (`tests/e2e/form.e2e.mjs`): Fehlerhinweise, Verkleinerung 6,4 MB → ~1 MB, EXIF entfernt, 429-Meldung, Referenz, Idempotenz.

## 10. Offene Risiken
- Studio nicht öffentlich erreichbar (Entscheidung 1).
- `X-Forwarded-For`-Vertrauen und Herkunftsliste noch nicht im Studio angepasst.
- Rate-Limit nur im Speicher; kein Malware-Scan; keine automatische Löschung.
- Drittanbieter auf dem Weg der Daten (Cloudflare/Vercel) – Datenschutzprüfung.
- Datenschutzerklärung und Impressum unvollständig.
