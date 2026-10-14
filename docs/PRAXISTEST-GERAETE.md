# Praxistest auf echten Geräten – Stand und Prüfplan

Stand: 2026-10-14. **Ehrlich vorweg: In dieser Arbeitsumgebung stand kein echtes Smartphone oder Tablet zur Verfügung, und es wurde keine echte E-Mail versendet** (es wurden keine Testadressen freigegeben). Dieses Dokument trennt deshalb sauber, was automatisiert nachgewiesen ist und was auf echten Geräten **noch von einer Person zu prüfen** ist. Der Gerätetest ist Voraussetzung für das GO des Pilotbetriebs (siehe `docs/PILOT-GO-NOGO.md`).

## 1. Was bereits automatisiert geprüft ist (Browser mit echten Eingaben)

Alle Tests laufen in einem echten Chrome (ohne Oberfläche) über das Entwicklerprotokoll mit echter Maus-/Tastatur-/Touch-Eingabe und prüfen danach die **echte Datenbank und den echten Dateispeicher**:

| Test | Was geprüft wird | Datei |
|---|---|---|
| Mobile Schadenaufnahme (390 × 844, Touch) | Besichtigung beginnen → Kilometerstand → Fotos und Dokument hochladen → Schaden am Fahrzeugbild markieren → Notiz → Abschließen | `tests/e2e/mobile.e2e.mjs` |
| Ganze Kette im Browser | Fahrzeugbild → Schadenposition → Reparaturposition → Kalkulation → Gutachten → Freigabe → **PDF**; ein markiertes Bauteil erscheint in allen Ansichten **und** in der Kalkulation | `tests/e2e/chain.e2e.mjs` |
| Öffentlicher Eingang | Anfrageformular (mit Foto und Fahrzeugschein) → Eingang → Kunde → Fahrzeug → Fall; Missbrauchsschutz | `tests/e2e/intake.e2e.mjs` |
| Zwei-Faktor-Anmeldung | Einrichten per QR/Schlüssel, Anmelden, Wiederherstellungscode, Zurücksetzen | `tests/e2e/mfa.e2e.mjs` |
| Rechte (HTTP-Ebene) | fremder Gutachter, Ausgeloggte, Rollen: Zugriff auf Fotos, Dokumente, PDFs, Uploads | `tests/e2e/access.e2e.mjs` |
| Studio (Desktop) | Fenster, Apps, Bridge, Einstellungen | `tests/e2e/studio.e2e.mjs` |
| Leistung | LCP, CLS, Übertragungsmenge der öffentlichen Seiten (Produktionsbuild) | `tests/e2e/perf.e2e.mjs` |

Konsistenz Schäden ↔ Kalkulation ↔ Gutachten-PDF wird zusätzlich im Dienst-Test (`npm run test:db`, Dateien zu Kalkulation/Gutachten) gegen die Datenbank geprüft: Ein Bauteil, ein Schaden, **eine** Position – die Summen im PDF stammen aus demselben eingefrorenen Stand wie die Freigabe.

Zusätzlich am 2026-10-14: Die Anmeldeseite wurde im **iOS-Simulator (iPhone 17, Safari/WebKit)** geöffnet und rendert korrekt (Logo, Felder, Schaltfläche, Tastatur-Leiste, kein Überlauf). Die Anmeldung selbst ließ sich im Simulator nicht durchspielen: Die Eingabebrücke sendet US-Tastaturcodes an die deutsche Simulator-Tastatur (das „@“ wird zu „"“) und das Einfügen-Menü war nicht bedienbar. **Das ist eine Einschränkung des Testwerkzeugs, kein Befund der Anwendung** – aber es ist auch kein Nachweis. Ein Simulator ersetzt ohnehin kein echtes Gerät (keine echte Kamera, kein echtes Mobilfunknetz).

## 2. Was **nur** auf echten Geräten prüfbar ist

- Aufnahme mit der **echten Kamera** (Dateigröße, Ausrichtung/EXIF, Speicherdruck bei vielen Fotos, Dunkelheit).
- Verhalten im **echten Mobilfunknetz** (schwach, Abbrüche, Wechsel WLAN ↔ LTE).
- Safari auf iOS/Chrome auf Android: Tastatur-Verdeckung, Zoom beim Fokussieren, Datei-Auswahl („Foto aufnehmen / Mediathek / Dateien“), Scrollen im Fahrzeugbild, Touchziele mit Handschuhen/Sonnenlicht.
- Passwortmanager/Autofill/2FA-App auf dem **gleichen** Gerät.
- Echter **Mailempfang** (Zustellung, Spam-Ordner, Absender-Authentifizierung SPF/DKIM beim gewählten Anbieter).
- **Offline:** Es gibt **keinen Offline-Betrieb** (nicht gebaut, in der Oberfläche als „nicht verfügbar“ gekennzeichnet). Ohne Netz kann nichts erfasst werden – Gutachter müssen Fotos im Zweifel zusätzlich auf dem Gerät behalten (siehe Backup-Dokument, RPO).

## 3. Prüfplan für Geräte (Staging, nicht Produktion)

Geräte-Mindestumfang: ein aktuelles iPhone (Safari), ein aktuelles Android (Chrome), nach Möglichkeit ein älteres Gerät. Testkonto je Rolle, 2FA eingerichtet, **Staging** (`docs/DEPLOYMENT.md`), nie echte Kundendaten.

| # | Schritt | Erwartung | iPhone | Android |
|---|---|---|---|---|
| 1 | Anmelden mit Passwort + 2FA-Code; Sitzung bleibt beim App-Wechsel | klappt, kein Zoom-Sprung | ☐ | ☐ |
| 2 | Neuen Fall anlegen / zugewiesenen öffnen, „Besichtigung beginnen“ | Seite mobil bedienbar, Tastatur verdeckt keine Felder | ☐ | ☐ |
| 3 | Kilometerstand eintragen (Zahlenfeld) | numerische Tastatur | ☐ | ☐ |
| 4 | 10+ Fotos direkt mit der Kamera aufnehmen (Kategorie wählen) | alle erscheinen mit Vorschau, Ausrichtung korrekt, Upload < 4,5 MB je Foto (automatisch verkleinert) | ☐ | ☐ |
| 5 | Fahrzeugschein fotografieren/hochladen | Dokument im Fall, lesbar | ☐ | ☐ |
| 6 | Im Flugmodus Foto hochladen | verständliche Fehlermeldung, nichts halb gespeichert; nach Netz zurück erneut möglich | ☐ | ☐ |
| 7 | Schäden am Fahrzeugbild markieren (Antippen, Zoom/Scroll) | richtiges Bauteil, Mehrfachauswahl, Schadenart/-grad | ☐ | ☐ |
| 8 | Notiz diktieren (Diktierfunktion der Tastatur) | Text gespeichert | ☐ | ☐ |
| 9 | Besichtigung abschließen | Status ändert sich, Büro sieht Fotos/Schäden | ☐ | ☐ |
| 10 | **Am Schreibtisch:** Reparaturpositionen/Kalkulation prüfen: jeder markierte Schaden hat seine Position; Summen stimmen mit Handrechnung | Konsistenz Schäden = Kalkulation | ☐ | – |
| 11 | Gutachten erzeugen, freigeben, **PDF** auf dem Handy öffnen | Fotos, Schäden, Summen = Kalkulation; Seitenumbruch sauber; Datei öffnet in Safari/Chrome | ☐ | ☐ |
| 12 | Link/Anmeldung als **anderer** Gutachter ohne Berechtigung: Foto-/PDF-URL aufrufen | 403/404, nichts sichtbar | ☐ | ☐ |
| 13 | Abmelden, Zurück-Taste | keine Daten aus dem Cache sichtbar | ☐ | ☐ |

Protokoll je Lauf: Gerät, OS-Version, Browser, Datum, Ergebnis, Auffälligkeiten (Screenshot ohne Kundendaten).

## 4. E-Mail-Versand – ausschließlich an freigegebene Testadressen

Status: **Nichts versendet.** Bisher sind keine Testadressen freigegeben. Das System schützt davor:

- In **Staging** verweigert die App den Versand an jede Adresse, die nicht in `MAIL_ALLOWED_RECIPIENTS` steht (und verlangt die Liste für echte Anbieter).
- `npm run mail:test -- --to <Adresse>` sendet **eine** klar gekennzeichnete Testmail ohne Kundendaten und ohne Anhang. Es bricht ohne Versand ab, wenn die Positivliste leer ist, die Adresse nicht darin steht, Mail nicht konfiguriert ist oder (in Produktion) die ausdrückliche Bestätigung fehlt.

Ablauf nach Freigabe von 1–2 Testadressen durch die Geschäftsführung:
1. Adressen in Staging in `MAIL_ALLOWED_RECIPIENTS` eintragen.
2. `npm run mail:test -- --to <freigegebene Adresse>` → Eingang prüfen (Postfach, Spam, Absender, Umlaute).
3. Anfrageformular der Staging-Website ausfüllen (mit Foto): Mail an `MAIL_TO` (muss in der Positivliste stehen) prüfen, Anhänge, Reply-To.
4. Eine **Gutachten-/Rechnungsmail** aus dem Backend an die Testadresse senden; Anhang öffnen.
5. Ergebnis hier und im GO/NO-GO-Dokument eintragen.

## 5. Offene Punkte aus dem Praxistest

- [ ] Gerätetest nach Abschnitt 3 (iPhone + Android) durchführen und protokollieren
- [ ] Testadressen freigeben, Mailtest nach Abschnitt 4 durchführen
- [ ] Ergebnisse in `docs/PILOT-GO-NOGO.md` übernehmen; Befunde als Issues erfassen
