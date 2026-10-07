# ING GUTACHTEN — Operating System: Architektur & Plan

Stand: Planung vor Phase 1. Arbeitsbranch: `feature/ing-operating-system` (abgezweigt vom geprüften Stand `e59f5b5` des Redesign-Branchs).
Die öffentliche Website bleibt unverändert lauffähig; jede Phase wird einzeln gebaut, getestet und committet.

---

## 0. Ausgangslage (Analyse)

| Bereich | Ist-Zustand |
|---|---|
| App | Next.js 15 App Router, React 19, TS, Tailwind 3, Vercel-Serverbetrieb. 27 öffentliche Routen, alle statisch |
| Server | genau ein Route Handler (`/api/anfrage`): Validierung, Foto-Prüfung (Magic Bytes), Rate Limit (In-Memory), Mail über Brevo/Resend-Abstraktion. **Speichert nichts.** |
| Inhalte | `src/lib/content.ts` (Stammdaten, FAQ, Regionen, Leistungen) + `seo.ts` (Metadata/Schema). 6 Regionalseiten über `REGION_PROFILES` |
| Konfiguration | `SITE_URL`, `MAIL_*`, `ALLOW_PREVIEW_DRY_RUN`; keine Datenbank, kein Storage, keine Auth |
| Vercel | zwei Projekte am Repo (`ing-gutachten`, `ing-gutachten-entwurf.v.32`), Preview hinter Vercel-Login, Production-Domain `ing-gutachten.de` |
| **Vorhandener Prototyp** | `~/Downloads/ing-admin-complete` (Prisma 7 + `adapter-pg`, Argon2id, Sessions mit Token-Hash, RBAC mit Overrides, Audit-Log, Fallnummern-Zähler, 874 Zeilen Schema, Tailwind 4, eigene App auf Port 3001) und lokale DB `ing_admin`. **Wird nicht verändert**, dient als Vorlage |
| Lokale Umgebung | PostgreSQL 18.6 (Postgres.app) läuft; kein Docker, kein Homebrew |

**Entscheidung:** Der Prototyp ist fachlich gut (gehashte Session-Token, Soft Delete, Anonymisierung, Fallnummern-Zähler, Audit ohne Update/Delete). Er wird **in diese Anwendung integriert** (kein zweites Projekt) und um das erweitert, was fehlt: Lead-Pipeline getrennt vom Rohformular, Fotos/Schäden, Gutachten-Versionierung, CMS, Regionen, SEO, Redirects, Rollen laut Auftrag.

---

## 1. Systemarchitektur

```
                    ┌────────────────────────── Next.js (ein Projekt, Vercel) ──────────────────────────┐
Besucher ──► (site)  │ Öffentliche Seiten (SSG/ISR)  ──► liest veröffentlichte Inhalte                    │
                    │    /, /leistungen, /kfz-gutachter-…  (DB-CMS ab Phase 5, bis dahin content.ts)      │
                    │ POST /api/anfrage ──► Inquiry (DB) ─► Lead ─► Mail (Brevo/Resend) ─► Admin         │
Team ───► admin     │ /admin/**  (Server Components + Server Actions, Cookie-Session, RBAC serverseitig)  │
                    │ /api/admin/upload|download  (signierte, kurzlebige Zugriffe auf privaten Storage)   │
                    └───────┬───────────────────────────────┬───────────────────────────────┬───────────┘
                            │ Prisma 7 (adapter-pg)         │ S3-kompatibel (privat)        │ Mail-Abstraktion
                       PostgreSQL (Neon/Supabase/…)    R2 / S3 / MinIO / lokal-Dateisystem     Brevo | Resend
```

Prinzipien
* **Ein Repository, zwei Route-Gruppen:** `src/app/(site)/…` (öffentlich, mit Nav/Footer/Cursor) und `src/app/admin/…` (eigenes Layout, nie indexiert). URLs der Website ändern sich dadurch **nicht**.
* **Server first:** Seiten sind Server Components, Mutationen sind Server Actions (eingebauter Origin-Check) bzw. Route Handler mit eigenem `assertSameOrigin`. Jede Mutation: `requirePermission` → Zod-Validierung → Transaktion → Audit-Eintrag.
* **Domänenmodule** unter `src/server/<modul>/` (`leads`, `cases`, `customers`, …) enthalten Query- und Mutations-Funktionen; UI und Actions rufen nur diese auf. Kein Prisma-Aufruf in Komponenten.
* **Die öffentliche Seite darf nie von der DB abhängen:** `db` wird lazy initialisiert, Build und öffentliche Routen laufen ohne `DATABASE_URL`. Fällt die DB aus, sendet das Formular weiter die Mail (Inquiry-Speicherung ist „best effort mit Fehlerlog“, Mail ist die Sicherheitsleine) – erst wenn Phase 2 stabil ist, wird die DB zur führenden Quelle.
* **Kein Geschäftsdatum in URLs/Analytics.** IDs sind `cuid`, nie fortlaufend.

Stack-Ergänzungen: `prisma`/`@prisma/client`/`@prisma/adapter-pg`/`pg`, `@node-rs/argon2`, `zod`, `@aws-sdk/client-s3` + `s3-request-presigner` (Phase 3), `tsx` (Scripts/Tests).

---

## 2. Prisma-Datenmodell (Katalog)

Konventionen: `id cuid`, `createdAt/updatedAt`, `deletedAt` (Soft Delete) bei Geschäftsobjekten, snake_case-Spalten (`@map`), Geld `Decimal(12,2)`, Indizes auf jedem Filter-/Sortierfeld. Kein JSON als Ersatz für Modellierung – `Json` nur für Audit-Vorher/Nachher und Block-Inhalte im CMS.

| Phase | Modul | Modelle (wichtigste Felder) |
|---|---|---|
| **1** | Zugriff | `User` (email unique, passwordHash argon2id, firstName, lastName, role, isActive, failedLogins, lockedUntil, lastLoginAt, mfa-Felder vorbereitet), `Session` (tokenHash unique, ip, userAgent, expiresAt, revokedAt), `UserPermission` (Override je Recht), `LoginAttempt` (Drosselung, DB statt In-Memory), `Employee`-Profil (1:1 zu User: Kürzel, Telefon, Signatur, `isExpert`) |
| **1** | System | `AuditLog` (append-only: actor, action, entityType, entityId, summary, before/after Json, ip), `SystemSetting` (key unique, value Json, updatedBy) |
| 2 | Pipeline | `Inquiry` (**unveränderliches Rohformular**: Felder wie Website, ip, userAgent, honeypot-Flags), `Lead` (status, source, assignedTo, `inquiryId?` unique, `customerId?`, `caseId?`, nextActionAt, spam), `LeadNote` |
| 2 | Stammdaten | `Customer` (type PRIVATE/BUSINESS, company, Name, Adresse, Kontakt, `anonymizedAt`), `CustomerContact`, `Vehicle` (Hersteller, Modell, Typ, Kennzeichen, FIN, Erstzulassung, km, Antrieb, Leistung, Farbe), `VehicleOwner` (Halterhistorie: vehicleId, customerId, from/to) |
| 2 | Fälle | `Case` (number unique, kind, status, priority, customerId, vehicleId, ownerId, expertId, regionId?, Unfalldaten, Versicherungs-/Schadennummer, Beträge), `CaseCounter` (Jahr → lastValue, Transaktion), `CaseParty` (Rolle + Beteiligter: Gegner, Versicherungen, Anwalt, Werkstatt), `InsuranceCompany`, `CaseStatusHistory`, `CaseNote` (intern, nie nach außen) |
| 3 | Termine | `Appointment` (kind, status, caseId?, customerId?, expertId, startsAt, endsAt, Adresse, Notiz), `Inspection` (Besichtigungsprotokoll zum Termin: Start/Ende, Wetter/Ort, Notiz, Status) |
| 3 | Schäden | `Damage` (caseId, Bauteil, Position, Schadenart, Beschreibung, Reparaturart, Notiz), `DamageArea` (kontrolliertes Vokabular: Bereich/Bauteil, Reihenfolge – Basis für spätere Fahrzeuggrafik) |
| 3 | Medien/Dokumente | `Media` (Basis: storageKey unique, bucketKind PRIVATE/PUBLIC, mime, size, sha256, scanStatus, uploadedBy), `CasePhoto` (mediaId, caseId, category, title, description, sortOrder, damageId?), `Document` (mediaId, caseId?, customerId?, category, versionOf?) |
| 4 | Gutachten | `Report` (caseId, number, status DRAFT/REVIEW/FINAL/SENT, authorId), `ReportVersion` (reportId, version, mediaId, comment, createdBy, sentAt/sentTo) – **nie überschreiben** |
| 4 | Abrechnung | `Invoice` (number unique, caseId, customerId, status, net/tax/gross, issuedAt, dueAt, paidAt), `InvoiceItem`, `Payment` (invoiceId, amount, paidAt, method, reference) – Export (CSV/DATEV-vorbereitet), keine Buchhaltung |
| 4 | Aufgaben | `Task` (caseId?, title, description, status, priority, dueAt, assigneeId), `TaskComment` |
| 4 | Kommunikation | `Message` (kind: EMAIL_OUT/EMAIL_IN/PHONE/NOTE, internal bool, caseId/customerId, subject, body), `EmailTemplate` (key, subject, html, text, isActive), `EmailLog` (status, providerId, error) |
| 4 | Misc | `Notification` (userId, title, link, readAt), `Review` (nur echte, importierte Bewertungen; Quelle + Beleg-URL) |
| **5** | CMS/SEO | `Region` (name, slug, type STADT/LANDKREIS/GEBIET, state, parentId, lat/lng?, `serviceStatus` NONE/ON_REQUEST/ON_SITE, `distanceKmFromOffice?`, `coverageNote`), `RegionPage` (regionId unique, status, headline, intro, localContext, serviceText, arrivalText, cta, publishedAt, `primaryKeyword`, `secondaryKeywords[]`, `searchIntent`), `RegionNeighbour` (n:m), `Service` (slug, title, status, Inhalt strukturiert), `ServiceArea` (Service × Region: angeboten ja/nein), `Page` (slug unique, type, status), `ContentBlock` (pageId, type, order, data Json mit Zod-Schema je Typ), `Faq` (+ `FaqPlacement` je Seite/Region), `Article` (Ratgeber: status DRAFT/REVIEW/PUBLISHED, author, reviewer, legalReview bool), `SeoMeta` (polymorph über `entityType+entityId` unique: title, description, canonical, ogImageId, robots), `Redirect` (from unique, to, code 301/308, hits), `SeoIssue` (Audit-Ergebnis je URL), `ContentCheck` (Quality-Gate-Ergebnis je Version) |

Bewusst **nicht** getrennt: Unfalldaten bleiben am `Case` (1 Fall = 1 Ereignis), Beteiligte in `CaseParty` statt 12 Spalten, `Employee` als Profil statt eigener Identität.
`Lead` ≠ `Inquiry`: Inquiry ist die unveränderte Eingabe der Website (Beweis, Spam-Analyse), Lead der Arbeitsvorgang (Status, Notizen, Verantwortlicher). Telefonische Leads haben keine Inquiry.

### Wichtige Indizes
`Case(number)`, `Case(status, priority)`, `Case(expertId,status)`, `Case(customerId)`, `Case(vehicleId)`, `Vehicle(plate)`, `Vehicle(vin)`, `Customer(lastName,firstName)`, `Customer(email)`, `Customer(phone)`, `Appointment(expertId,startsAt,endsAt)`, `Appointment(startsAt)`, `Lead(status,createdAt)`, `Task(assigneeId,status,dueAt)`, `Invoice(status,dueAt)`, `AuditLog(entityType,entityId,createdAt)`, `Page(slug)`, `Region(slug)`, `Redirect(from)`; Volltextsuche (Phase 2): `pg_trgm`-GIN auf Kennzeichen/FIN/Name/E-Mail/Telefon/Schadennummer/Fallnummer.

---

## 3. Rollen- und Rechtematrix

Rollen: `OWNER`, `ADMIN`, `OFFICE`, `EXPERT`, `ACCOUNTING`, `CONTENT_MANAGER` (später `CUSTOMER`, eigenes Portal).
Die Matrix steht **im Code** (`src/server/auth/permissions.ts`) und wird bei jeder Server-Operation geprüft; zusätzlich `UserPermission` als Override (nach oben/unten). Zeilen = Bereich; ● voll, ◐ eingeschränkt, ○ lesen, – kein Zugriff.

| Bereich | OWNER | ADMIN | OFFICE | EXPERT | ACCOUNTING | CONTENT |
|---|---|---|---|---|---|---|
| Leads / Anfragen | ● | ● | ● | – | – | – |
| Kunden | ● | ● | ● | ◐ nur eigene Fälle (lesen) | ○ | – |
| Fälle | ● | ● | ● (kein Löschen) | ◐ **nur zugewiesene** (lesen/schreiben) | ○ (ohne Fotos) | – |
| Fahrzeug, Schäden, Fotos | ● | ● | ○ | ◐ eigene Fälle | – | – |
| Termine | ● | ● | ● | ◐ eigene | – | – |
| Dokumente | ● | ● | ● | ◐ eigene | ◐ Rechnungsbezug | – |
| Gutachten | ● | ● | ○ + versenden | ◐ eigene (erstellen, Version hochladen) | – | – |
| Rechnungen / Zahlungen | ● | ● | ○ | – | ● | – |
| Aufgaben | ● | ● | ● | ◐ eigene | ◐ eigene | – |
| Kommunikation | ● | ● | ● | ◐ eigene Fälle (intern) | – | – |
| Website-CMS, Regionen, FAQ, Ratgeber | ● | ● | – | – | – | ● |
| SEO, Redirects, Medien (öffentlich) | ● | ● | – | – | – | ● |
| Veröffentlichen (Quality Gate) | ● | ● | – | – | – | ◐ nur nach „REVIEW“-Freigabe durch OWNER/ADMIN |
| Berichte / KPIs | ● | ● | ◐ operativ | ◐ eigene | ◐ Umsatz | – |
| Benutzer & Rollen | ● | ◐ (keine OWNER) | – | – | – | – |
| Einstellungen, Audit-Log | ● | ● | – (Audit: eigener Verlauf) | – | – | – |
| Export / Löschung / Anonymisierung | ● | ◐ | – | – | ◐ Rechnungsexport | – |

Objekt-Ebene: Funktionen wie `requireCaseAccess(user, caseId)` prüfen **Rolle + Zuweisung**; ein EXPERT kann fremde Fall-IDs nicht laden, auch nicht per URL-Erraten (Antwort 404, nicht 403).

---

## 4. Admin-Seitenbaum

```
/admin/login
/admin                         Dashboard (KPIs, Heute, Aufgaben, Aktivitätsfeed, Wiedervorlagen)
/admin/heute                   mobile „Mein Tag“ (Termine, nächste Fälle, Schnellaktionen)
/admin/leads                   Posteingang (Filter: Status, Quelle, Zuständiger)         [Ph.2]
/admin/leads/[id]
/admin/kunden  /[id]           Kundenakte mit Historie                                   [Ph.2]
/admin/faelle  /[id]           Tabs: Übersicht · Fahrzeug · Schaden · Fotos · Dokumente ·
                               Termine · Gutachten · Rechnung · Kommunikation · Historie [Ph.2–4]
/admin/faelle/[id]/erfassung   mobiler Gutachter-Workflow (Fahrzeug prüfen → Fotos → Schäden → Notiz → Abschluss) [Ph.3]
/admin/fahrzeuge  /[id]                                                                  [Ph.2]
/admin/termine                 Tag · Woche · Monat                                       [Ph.3]
/admin/aufgaben                                                                          [Ph.4]
/admin/gutachten  /rechnungen  /dokumente  /nachrichten (+ /vorlagen)                    [Ph.3–4]
/admin/website/{seiten,leistungen,regionen,faq,ratgeber,medien,weiterleitungen}          [Ph.5–6]
/admin/seo                     Dashboard, Audit, Keyword-Mapping, Qualitätsprüfung       [Ph.5–6]
/admin/berichte                KPIs nur aus echten Daten                                 [Ph.4]
/admin/benutzer  /protokoll  /einstellungen                                              [Ph.1]
Cmd/Ctrl-K                     globale Suche + Befehle (Phase 1: Befehle/Navigation, Phase 2: Datensuche)
```

---

## 5. Workflow Lead → Kunde → Fall → Gutachten → Rechnung

```
Website-Formular ─► POST /api/anfrage ─► Zod ─► Inquiry (unveränderlich) ─┐
Telefon/E-Mail (manuell)  ────────────────────────────────────────────────►├─► Lead NEU ──► Benachrichtigung (Mail + Dashboard)
                                                                          │
Lead:  NEU → KONTAKTIERT → TERMIN_VEREINBART → UMGEWANDELT | ABGESAGT | SPAM     (nie löschen; Verknüpfung bleibt)
                                           │ „In Fall umwandeln“ (eine Transaktion):
                                           ▼ Customer (Dublettenprüfung: E-Mail/Telefon/Name) + Vehicle + Case (Nummer aus CaseCounter) + Medien übernehmen
Fall:  ANGELEGT → TERMIN_OFFEN → TERMIN_GEPLANT → BESICHTIGT ⇄ UNTERLAGEN_FEHLEN → IN_BEARBEITUNG
       → GUTACHTEN_ERSTELLT → GUTACHTEN_VERSENDET → ABGERECHNET → ABGESCHLOSSEN           (STORNIERT jederzeit vor ABGESCHLOSSEN, mit Grund)
```
Übergangsregeln (serverseitig, nicht nur UI): `TERMIN_GEPLANT` braucht einen Termin · `GUTACHTEN_ERSTELLT` braucht eine Report-Version mit Datei · `GUTACHTEN_VERSENDET` braucht Versandprotokoll · `ABGERECHNET` braucht Rechnung ≠ Entwurf · `ABGESCHLOSSEN` braucht Rechnung bezahlt oder begründeten Verzicht (nur OWNER/ADMIN). Jeder Wechsel → `CaseStatusHistory` + `AuditLog`.

---

## 6. SEO-/Regionen-Datenmodell und Quality Gate

* **Region** = geografische Einheit; **RegionPage** = die veröffentlichbare Landingpage; **ServiceArea** sagt ehrlich, ob ING dort vor Ort arbeitet (`ON_SITE`) oder nur auf Anfrage. Daraus folgt der erlaubte Wortlaut (nie „Standort X“ ohne Büro; `distanceKmFromOffice` nur nach Prüfung).
* Status: `DRAFT → REVIEW → PUBLISHED`, getrennt davon `indexable` + `NOINDEX`. Kein automatisches Veröffentlichen.
* **Keyword-Mapping:** je Seite genau ein `primaryKeyword` + `secondaryKeywords`; harte Prüfung auf **Kannibalisierung** (zwei Seiten mit gleichem Primary oder gleicher Suchintention → Veröffentlichung gesperrt).
* **Quality Gate** (alle Punkte müssen grün sein, sonst bleibt die Seite `DRAFT/REVIEW`): eigener Title (≤ 60 Zeichen, einmalig) · eigene Description (≤ 155, einmalig) · eigene H1 · individuelle Einleitung (≥ Mindestlänge, **Ähnlichkeit zu jeder anderen Region < Schwellwert**, Shingle-/Jaccard-Vergleich) · lokaler Teil (`localContext` und `arrivalText` ausgefüllt, nicht identisch mit anderen Regionen) · mind. 2 interne Links (Leistung + Nachbarregion/Hub) · FAQ nicht identisch · CTA · kein Platzhalter (`TODO`, `[..]`, `Lorem`, Ortsname eines anderen Orts im Text) · kein Phrasen-Blocker (Liste verbotener Floskeln: „pulsierende Stadt“, „genau richtig“, „zuverlässiger Partner“, „maßgeschneidert“, „höchste Qualität“, „wir verstehen, dass …“, „Platz 1“, „bester“, „garantiert“ …) · Bild vorhanden.
* **Technik:** Title/Canonical/OG/Breadcrumb/Schema werden aus den Daten **generiert**, die Description nur als Entwurf; Admin kann überschreiben. Schema nur `ProfessionalService/LocalBusiness`, `Service`, `WebSite`, `BreadcrumbList`, `FAQPage` – nie Rating/Review/priceRange.
* **Sitemap:** dynamisch, nur `PUBLISHED && indexable`. **Redirects:** Tabelle, wird in `next.config`-Ebene/Middleware-nah ausgewertet, mit Schleifen-/Ketten-Prüfung beim Speichern.
* **URL-Schema:** flach `/kfz-gutachter-{slug}` (Beispiel `/kfz-gutachter-braunschweig`), Hub `/kfz-gutachter-niedersachsen`. Die heutigen `/kfz-gutachter/{slug}`-Seiten erhalten 301-Weiterleitungen (Phase 5). Umsetzung als eine dynamische Einzel-Segment-Route `[slug]`, die nur bei vorhandener veröffentlichter Seite rendert, sonst `notFound()`.

---

## 7. Niedersachsen-Rollout

Nicht „möglichst viele URLs“, sondern **gute Antworten**. Eine Region bekommt nur dann eine indexierbare Seite, wenn (a) der Inhaber den Einsatzstatus bestätigt hat (Vor-Ort / auf Anfrage / nicht), (b) ein Redakteur lokalen Mehrwert liefern kann, (c) das Quality Gate grün ist.

| Welle | Inhalt | Voraussetzung |
|---|---|---|
| 0 | Hannover + die 6 bestehenden Orte (heute live im Code) | bereits da; wird in DB migriert, Texte werden redaktionell überarbeitet |
| 1 | Region Hannover vertiefen (Langenhagen, Garbsen, Laatzen, Seelze, Wunstorf, Pattensen, Lehrte, Burgdorf, Burgwedel, Wedemark, Springe, Barsinghausen) – **Cluster statt Einzelseiten**: stark nur dort, wo Suchnachfrage und echter Service vorliegen; sonst im Hub/Einsatzgebiet erwähnen | Einsatzstatus je Ort bestätigt |
| 2 | Angrenzende Mittelzentren (Hildesheim, Celle, Peine, Gifhorn, Nienburg, Hameln, Stadthagen) | Fahr-/Einsatzradius bestätigt |
| 3 | Braunschweig/Wolfsburg/Salzgitter, Göttingen | realistische Anfahrt + Nachfrage geprüft |
| 4 | Osnabrück, Oldenburg, Lüneburg, Delmenhorst, Wilhelmshaven | nur wenn tatsächlich bedient, sonst Hub-Erwähnung „auf Anfrage“ |

Der Hub `/kfz-gutachter-niedersachsen` erklärt Einsatzgebiet und Leistungen und verlinkt nur auf **veröffentlichte** Regionen. Inhalte entstehen als Entwurf → Redaktion → Freigabe; keine Massenveröffentlichung, kein Template mit Ortstausch.

---

## 8. Storage-Konzept

* **Zwei Klassen:** `PRIVATE` (Unfallfotos, Fahrzeugschein, Gutachten, Kundendokumente) und `PUBLIC` (Website-Bilder, OG, Ratgeber). Getrennte Buckets/Präfixe, getrennte Berechtigungen.
* **Private Dateien:** S3-kompatibel (Cloudflare R2 / AWS S3 / MinIO), Bucket nicht öffentlich. Objektschlüssel = zufälliges `cuid`-Präfix + Pfad, **nie** Dateiname/Fallnummer. Zugriff nur über **signierte URLs (60–120 s)**, die der Server **nach** `requireCaseAccess` ausstellt; Audit-Eintrag je Download.
* **Upload:** direkt zum Storage per vorsignierter PUT-URL (umgeht das 4,5-MB-Vercel-Limit), danach serverseitiger Abschluss-Schritt: Größe/Magic Bytes/Checksumme prüfen, `Media`-Zeile anlegen. Begrenzungen: Typen JPG/PNG/WebP/HEIC→JPEG (Client-Konvertierung)/PDF, Größenlimit je Kategorie in `SystemSetting`.
* **Entwicklung:** `StorageDriver`-Schnittstelle mit `S3Driver` und `LocalDriver` (Dateisystem unter `.data/private/`, gitignored, **nur über authentifizierte Route** auslieferbar).
* **Scan-Status** (`PENDING/CLEAN/FAILED`) vorbereitet; Virenscan ist ein späterer Hook.
* Backup: Versionierung/Lifecycle im Bucket; Restore-Anleitung in `docs/BETRIEB.md` (Phase 7).

## 9. Auth-Konzept

* E-Mail + Passwort, **Argon2id** (`@node-rs/argon2`, parameterisiert), Mindestlänge 12, Prüfung gegen häufige Passwörter.
* **Session = zufälliger 256-Bit-Token im Cookie, nur dessen SHA-256 in der DB** (Serversession, sofort widerrufbar). Cookie: `__Host-ing_session` (Production), `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`; Gültigkeit 12 h gleitend, harte Obergrenze 7 Tage; Wechsel des Tokens bei Login. Kein `localStorage`.
* **Drosselung:** `LoginAttempt` (IP + E-Mail-Hash) in der DB, Sperre nach 5 Fehlversuchen/15 min, neutrale Fehlermeldung (kein Hinweis, ob die E-Mail existiert), konstante Zeit durch Dummy-Hash.
* **CSRF:** Server Actions prüfen Origin; Route Handler nutzen `assertSameOrigin`; State-ändernde Aktionen nie per GET.
* Middleware prüft nur die **Existenz** des Cookies (Edge); echte Prüfung in jeder Seite/Action über `requireUser()` bzw. `requirePermission()`.
* 2FA (TOTP) vorbereitet (Felder), Aktivierung später. Passwort-Reset über signierten Einmal-Link (Phase 1b, sobald Mail-Provider konfiguriert ist).
* Admin-Antworten: `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `robots.txt` sperrt `/admin` und `/api/admin`.

## 10. Migrationsplan vom aktuellen System

1. **Branch** `feature/ing-operating-system` (kein Merge nach `main` ohne Freigabe). Route-Gruppen-Umbau per `git mv` – Crawl bestätigt: gleiche URLs, gleiche Metadaten.
2. **Phase 1** fügt DB/Auth/Admin hinzu, ohne die öffentliche Seite funktional zu ändern; ohne `DATABASE_URL` verhält sich die Website exakt wie heute (nur `/admin` zeigt „nicht konfiguriert“).
3. **Phase 2** schaltet `/api/anfrage` auf *Inquiry → Lead → Mail*; Mail bleibt Fallback bei DB-Fehler.
4. **Phase 5** migriert `content.ts` (Regionen, FAQ, Leistungen) per **idempotentem Seed-Skript** in die DB; die Website liest über eine Fassade `getContent()` – Umschalter `CMS_SOURCE=static|db`, bis Parität per Crawl-Diff bewiesen ist. Danach Redirects `/kfz-gutachter/{slug}` → `/kfz-gutachter-{slug}`.
5. **Prototyp `ing_admin`:** bleibt unberührt. Falls dort bereits reale Daten liegen, entsteht ein einmaliges, geprüftes Importskript (Trockenlauf, Mapping-Report) – nie automatisch.
6. **Datenbank:** nur `prisma migrate` (Dev: `migrate dev`, Production: `migrate deploy`), **kein** `db push --force-reset`. Seeds sind Demo-only und verweigern sich bei Nicht-Lokal-DB bzw. Production.
7. **Betrieb:** DB/Storage-Anbieter in EU-Region (Vorschlag: Neon Frankfurt + Cloudflare R2 EU), Backups/Restore/Aufbewahrung in `docs/BETRIEB.md`, Datenschutzerklärung wird mit Phase 2 um DB/Speicherung ergänzt.

---

## Phasenplan (je Phase: Build · TypeScript · Lint · Tests · Commit · Bericht)

1. **DB + Auth + Admin-Shell** (Route-Gruppen, Prisma/Migration, Login, RBAC, Audit, Benutzer, Einstellungen, Protokoll, Befehlspalette)
2. Leads + Kunden + Fahrzeuge + Fälle (inkl. Formular → Inquiry → Lead)
3. Termine + Fotos + Schäden + Dokumente (Storage, mobiler Workflow)
4. Gutachten (Versionen) + Rechnungen + Aufgaben + Kommunikation/Vorlagen + KPIs
5. CMS + Regionen + SEO-Dashboard + Redirects + dynamische Sitemap
6. Ratgeber + redaktioneller Workflow + Content-Quality-System
7. QA, Migrationen, Backups/Restore, Produktion
