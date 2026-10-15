# Präsentationsentwurf – 15.10.2026

## Umfang

Bestehende Next.js-/Prisma-/Studio-Architektur erhalten. Der Kunde hat die Priorität nach Infrastrukturprüfung auf **Website-Preview zuerst** eingegrenzt. Kein produktiver Studio-Go-live.

- Vorhandene Leistungssektion ersetzt durch differenziertes Bento-Raster mit neun Einträgen. Keine doppelte Leistungsliste.
- Neue Fahrzeugübersicht mit neun konsistent gezeichneten SVG-Silhouetten.
- Vier Szenen als manuell navigierbarer Showcase mit vorhandenen Postern. Noch keine Videodateien. Quellen ausschließlich aus `src/lib/showcase.ts`.
- Bestehende Hero-, Vertrauens-, Ablauf-, Kontakt-, FAQ- und Footer-Bereiche erhalten. Die Unfall-Animation (Fahrzeug fährt auf das andere auf, danach Gutachten) bleibt auf der Startseite erhalten – auf Wunsch des Auftraggebers wieder eingebunden (2026-10-15).
- `ING_PRESENTATION_PREVIEW=true`: sichtbarer Vorschauhinweis, deaktiviertes Anfrageformular, POST-Anfragen abgewiesen bevor Dateien gelesen werden, Datenbankzugriff und Sessions in dieser Präsentation deaktiviert. Flag nur auf dem manuellen Preview-Deployment setzen.
- Kalenderlinks in Taskleisten-API und ICS nutzen jetzt die Fallnummer statt der internen ID; die Fallseite sucht nach Fallnummer.

## Inhaltsgrundlage

Die vorhandenen Leistungsseiten sind die Grundlage, keine unabhängige neue Bestätigung durch den Betreiber:

| Inhalte | Bestehender Nachweis |
|---|---|
| Unfall, Haftpflicht, Beweissicherung | `/unfallgutachten` |
| Schadengutachten | `/schadensgutachten` |
| Wertgutachten, Fahrzeugbewertung, Leasingrückgabe | `/wertgutachten` |
| Oldtimer/Youngtimer | `/oldtimer-gutachten` |
| Technische Analyse | `/unfallanalyse` |
| Pkw, Transporter | `/pkw-gutachten` |
| Elektro, Hybrid | `/e-auto-hybrid-gutachten` |
| Motorräder | `/motorrad-gutachten` |
| Nutzfahrzeuge, Anhänger, Flotten | `/lkw-gutachten` |

Wohnmobile/Camper nicht ergänzt. Technische Stellungnahmen nicht als zusätzliche eigenständige Leistung behauptet. Kasko nur als Hinweis zur vorherigen Abstimmung mit dem Versicherer; kein uneingeschränktes Leistungsversprechen. Keine neuen Bewertungen, Auszeichnungen, Bearbeitungszeiten oder Zertifizierungen.

## Video

`docs/VEO-PROMPTS.md` enthält vier vollständige englische Prompts. Geprüfte echte Dateien später unter `public/assets/video/` ablegen und im Manifest als `sources` eintragen. MP4/H.264, optional WebM; feste 16:9-Fläche, vorhandenes Bild als Fallback, nur ausgewählte sichtbare Szene mit Videoelement. Muted/playsInline, Pause beim Verlassen des Bereichs bzw. Ausblenden des Tabs, manuelle Pause, reduzierte Bewegung ohne automatische Wiedergabe. Keine automatische Szenenrotation. Kennzeichnung als illustrative KI-Szene beibehalten. Keine Video-URL ist vorgetäuscht.

## Infrastruktur-Befund

- GitHub `Mudilisabetta47/ingstudionew92` ist privat. Ausgangsbranch `feature/ing-operating-system`.
- Vercel-Projekt `ingstudionew92`, Production-Branch laut Projektverknüpfung `main`; bestehende Adresse `https://ingstudionew92.vercel.app/` ist Production.
- Vercel Deployment Protection ist für geschützte Deployments konfiguriert. Nicht abgeschaltet.
- Die aufgelisteten DB-Variablen gelten zugleich für Preview und Production; keine getrennten Testressourcen vorhanden (vom Auftraggeber bestätigt). Keine Cloud-Migration oder Cloud-Datenänderung ausgeführt.
- Vorhandene AWS-Integrationsvariablen sind nicht die vom jetzigen Storage-Treiber erwarteten `STORAGE_DRIVER`, `S3_BUCKET_PRIVATE`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `STORAGE_ENCRYPTION_KEY`. Live-S3-Verbindung, Bucketrechte und Restore daher nicht als geprüft ausweisen.
- Dieser Branch löst kein automatisches Vercel-Deployment aus. Manuelle Website-Preview erhält den Präsentationsschalter und leere DB-Overrides. Production-Alias nicht verändert.

## Studio: geprüfter Code und offene Betriebsprüfung

Vorhanden: individuelle Konten und Rollen, Argon2-Passwortprüfung, gedrosselte Logins, serverseitig widerrufbare Sessions mit HttpOnly/Secure-Cookies, MFA inklusive Wiederherstellung, erzwungener Passwortwechsel, fallbezogene Zugriffskontrollen. Demo-Konten und bekanntes Entwicklungspasswort werden in Staging/Production abgewiesen. Statischer Audit ist kein Beweis für einen vollständig sicheren Betrieb.

Benutzeranlage erfolgt durch einen berechtigten Administrator mit Startpasswort und Pflichtwechsel. Einladungslink per E-Mail und Self-Service-Passwort-Reset sind nicht implementiert; Admin-Reset ist vorhanden. Keine öffentliche Kundenrolle mit Mandantentrennung: Büro-/Adminrollen sind Mitarbeiterrollen und sehen breitere Datenbestände. Kunden zur Präsentation deshalb nur in isolierter Testumgebung mit synthetischen Daten zulassen.

Kalenderfeed: zufälliger Token, nur Hash gespeichert, Erneuerung/Widerruf, aktuelle Rollenprüfung, Details optional. Ohne Details bleiben Fallnummer und ggf. Sachverständigenname enthalten; Feed-Link vertraulich behandeln. Keine vertraulichen Links in Berichten speichern.

Für eine Studio-Präsentation folgen getrennte Testdatenbank, privater Test-Bucket, Verschlüsselungsschlüssel, Mail-Positivliste, persönliches Konto mit MFA und reale End-to-End-Prüfung. Für Kundenbetrieb zusätzlich Backup/Restore, Geräte-, Berechtigungs- und Datenschutznachweise gemäß vorhandener Betriebsdokumentation.

## Übernahme und Wiederherstellung (2026-10-15)

Der Arbeitsstand der Vorbearbeitung lag als Kopie unter `/tmp/ing-premium-20261015/source` (ohne `.git`, ohne `node_modules`). Übernommen wurden alle neuen Dateien und alle echten Änderungen. **Nicht übernommen** wurden vier Dateien, die in der Kopie leer (0 Byte, durch den abgebrochenen Synchronlauf beschädigt) waren: `src/lib/content.ts`, `src/lib/mail/index.ts`, `src/lib/vehicle-data.ts`, `src/components/admin/CommunicationPanel.tsx` – dort gilt der intakte Repository-Stand. `.env.local` (enthält nur ein kurzlebiges Vercel-Token) und `.vercel/` bleiben lokal und werden nicht versioniert (`.gitignore`).

Wichtig für die Vorschau: `ING_PRESENTATION_PREVIEW` wird beim **Bauen** ausgewertet (statische Seiten). Beim Deployment deshalb als Build-Variable setzen (`--build-env ING_PRESENTATION_PREVIEW=true`) und zusätzlich als Laufzeitvariable; Datenbank- und Speicher-Variablen für die Vorschau leer überschreiben.

Nachgebessert: Der Testlauf `tests/e2e/premium.e2e.mjs` hatte falsch maskierte Selektoren und eine unrealistische Enter-Taste; beides korrigiert.

## Vorschau-Deployment (2026-10-15)

- Vercel-Projekt `ingstudionew92`, **Preview** (nicht Production), Commit-Stand Branch `codex/premium-presentation`: `https://ingstudionew92-5ahy0xc4z-fahrschulemetropolhb-8267s-projects.vercel.app` (Status „Ready“, Funktionsregion `fra1`).
- Geschützt durch Vercel Authentication (anonyme Aufrufe werden zu Vercel-Login weitergeleitet, HTTP 302; auch `/studio/` und `/api/anfrage/`). Zugriff nur für angemeldete Mitglieder des Teams.
- Gebaut mit `ING_PRESENTATION_PREVIEW=true` (Build- und Laufzeitvariable) und **leeren Überschreibungen** für `DATABASE_URL`, `PRISMA_DATABASE_URL`, `POSTGRES_URL`, `S3_BUCKET_NAME`, `AWS_RESOURCE_ARN`, `AWS_ACCOUNT_ID`, `AWS_ROLE_ARN`; zusätzlich ignoriert der Code in diesem Modus jeden Datenbankzugriff. Die Projekt-Variablen selbst (gelten für Preview **und** Production) wurden nicht verändert.
- Kein Production-Deployment, keine Domain-Zuordnung, keine Migration.
- Befehl (zur Wiederholung): `vercel deploy --target=preview -b ING_PRESENTATION_PREVIEW=true -e ING_PRESENTATION_PREVIEW=true -b DATABASE_URL= -e DATABASE_URL= …` (vollständige Liste oben).

## Zusätzliche Bewegung (2026-10-15)

Auf Wunsch des Auftraggebers: Überschriften der neuen Bereiche laufen wortweise aus der Maske (bestehendes `SplitWords`), Karten blenden gestaffelt ein, Leistungskarten mit Lichtkegel am Mauszeiger, Icon-Impuls und Pfeil-Versatz beim Hover, Fahrzeug-Silhouetten zeichnen sich beim Einblenden und fahren beim Hover ein Stück, Laufband mit den belegten Leistungen (pausiert bei Hover), Zähler „15+“ im Vertrauensstreifen, im Einblicke-Slider sanfter Szenenwechsel mit langsamem Zoom, einfahrendem Titel und sich füllendem Tab-Balken. Alles ist bei `prefers-reduced-motion` abgeschaltet (Endzustand sofort sichtbar), ohne JavaScript ist der Inhalt sichtbar. Keine neue Abhängigkeit.

## Erstes Video eingebaut (2026-10-15)

Szene 1 („Begutachtung“, Titel „Genau hinsehen.“) spielt jetzt `public/assets/video/begutachtung.mp4` (10,6 s, 1280×720, H.264, ohne Ton, ca. 3,9 MB, Fast-Start) mit Poster `public/assets/img/showcase-begutachtung.jpg`. Das gelieferte Original (2560×1440 HEVC, 56 MB) liegt **außerhalb des Projekts** unter `~/Movies/ING-Originalvideos/1015.mp4`. Wiedergabe: stumm, Schleife, startet nur im sichtbaren Bereich, pausiert beim Wegscrollen/Tab-Wechsel, bei „Bewegung reduzieren“ nur per Knopf; Kennzeichnung „Illustrative Filmszene“ bleibt. Im Clip erscheinen eingeblendete Messwerte, die nicht lesbar bzw. nicht echt sind (KI-Erzeugnis) – sie zeigen keine tatsächlichen Messungen.
