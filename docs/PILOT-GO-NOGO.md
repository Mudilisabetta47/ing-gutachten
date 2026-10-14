# Pilotbetrieb ING Studio – GO/NO-GO-Bewertung

Stand: 2026-10-14, Branch `feature/ing-operating-system`. Kein Merge nach `main`, kein Deployment, keine Cloud-Konten, keine Verträge, keine echten Mails – alles unten bezieht sich auf **lokale** Prüfungen.

## Ergebnis in einem Satz

| Frage | Bewertung |
|---|---|
| Pilot mit **echten Kundendaten und echten Gutachten** | **NO-GO – heute noch nicht.** Die Software ist technisch weit, aber die Umgebung, in der sie laufen soll, existiert noch nicht und wurde deshalb nie unter Echtbedingungen geprüft (Abschnitt 3). |
| Pilot in **Staging** mit Testdaten und Testpersonen | **GO** – sobald Staging nach `docs/DEPLOYMENT.md` aufgebaut ist (Aufwand ca. 1–2 Tage reine Einrichtung, plus Freigabe der Geschäftsführung). |
| Übergang Staging → echter Pilot | **bedingtes GO**: nur wenn alle Punkte der Liste „Muss vor echten Daten“ (Abschnitt 3) erledigt und abgehakt sind. |

## 1. Was geprüft und in Ordnung ist (Nachweise von heute)

| Bereich | Nachweis |
|---|---|
| Qualität | `npm run lint` fehlerfrei · `tsc` fehlerfrei · `npm test` **50/50** · `npm run test:db` **247/247** (erneut nach allen letzten Änderungen) · Produktionsbuild erfolgreich |
| Browser-Tests gegen den Produktionsbuild | Rechte/HTTP-Zugriff **19/19** · mobile Schadenaufnahme **27/27** · Kette Schaden→Kalkulation→Gutachten→Freigabe→PDF **19/19** · öffentlicher Eingang→Fall **21/21** · Zwei-Faktor **26/26** · Studio **49/49** · Crawl/SEO ohne Fehler · Leistung (LCP Desktop ≤ 230 ms, Smartphone ≈ 0,8–2,0 s, CLS 0) |
| Anmeldung, Rollen, Zugriff | statische Prüfung aller 13 Schnittstellen, 112 Server-Aktionen, 56 Seiten (`npm run audit:auth`: keine ungeschützten); Zugriffsmatrix 7 Rollen × 16 Ressourcen; HTTP-Test mit fremdem Gutachter: Fotos, Dokumente, PDFs, Uploads fremder Fälle nicht erreichbar; Uploads nur mit Sitzung, gleicher Herkunft und Content-Length |
| Demo-Konten / Demo-Passwort | in Staging/Produktion **gesperrt** (Anmeldung wird abgewiesen und protokolliert; `db:check` meldet vorhandene Demo-Konten als Fehler; Skripte verweigern sich) |
| Schlüssel | `MFA_ENCRYPTION_KEY`, `STORAGE_ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY` usw. werden mit `npm run secrets:generate` nur auf dem Bildschirm erzeugt; **kein Schlüssel im Repository** (Geheimnis-Scan: nur Platzhalter/Testattrappen); 2FA-Einrichtung mit QR-Code; Schlüsselwechsel getestet |
| Verschlüsselter Dateispeicher | AES-256-GCM je Datei, Migration/Wechsel, fail-closed in Staging/Produktion; auch gegen einen lokalen S3-Testserver geprüft |
| Fehlerüberwachung | strukturierte Logs, Alarm-Webhook (https, Dedupe, Rate-Limit, ohne personenbezogene Daten), `/api/health` |
| Mail-Schutz | Empfänger-Positivliste; Staging verlangt sie; Testmail-Skript ohne Kundendaten |
| Migrationen | `npm run db:migtest` in Wegwerf-Datenbank: **10/10** (leere DB, Wiederholbarkeit, kein Drift, Betriebsprüfung, Aktualisierung mit Beispieldaten) |
| Sicherung/Wiederherstellung | `npm run backup:drill`: **15/15** (verschlüsselte Sicherung, Manipulation erkannt, Wiederherstellung in leere DB + leeren Speicher, alle Dateien entschlüsselbar, Stichproben) – 300 MB in 1,2 s gesichert / 2,0 s wiederhergestellt **lokal** |
| Repository | veraltete Übergabe archiviert (Historie erhalten), `deploy/.htaccess` entfernt, keine sensiblen Dateien versioniert |
| Während der Abschlussprüfung gefunden und behoben | (1) **Produktionsbuild scheiterte** an der Fehlerüberwachung (`node:crypto` im Edge-Bündel) → Instrumentierung aufgeteilt; (2) 10 Datenbank-Tests rot, weil der Test-Helfer keine Content-Length sendete (Test angepasst, 411-Fall neu getestet) |

## 2. Was **nicht** geprüft werden konnte (ehrlich)

- **Echte Geräte:** keines verfügbar. Mobile Tests liefen im Browser mit Touch-Eingabe (390 × 844) und die Anmeldeseite im iOS-Simulator (Rendering ok, Anmeldung dort nicht bedienbar → Werkzeuggrenze, kein Befund). Kamera, Mobilfunk, iOS-/Android-Eigenheiten: **ungeprüft** → `docs/PRAXISTEST-GERAETE.md`.
- **Echter E-Mail-Versand:** nichts gesendet (keine Testadressen freigegeben). Zustellung, Spam-Verhalten, SPF/DKIM: ungeprüft.
- **Echtes Supabase/Vercel/S3:** keine Konten, keine Bereitstellung. Zeilensicherheit (RLS), Pooler-Verhalten, echte Bucket-Probe, Zeiten der Cloud-Wiederherstellung: ungeprüft.
- **Echte Fahrzeug-/Wertdaten:** keine lizenzierte Quelle angebunden (siehe 4).

## 3. Muss vor echten Kundendaten erledigt sein (Blocker)

| # | Blocker | Verantwortlich | Nachweis |
|---|---|---|---|
| 1 | Staging und Produktion nach `docs/DEPLOYMENT.md` aufbauen (getrennte Supabase-Projekte, private Buckets, Schlüssel), `npm run preflight` ohne Fehler | Inhaber/Technik | Preflight-Ausgabe |
| 2 | **Probe in Staging:** Speicher-Probe `/api/health` ok, Migration mit `db:check` „alles in Ordnung“, RLS aktiv | Technik | Health-/Check-Ausgabe |
| 3 | **Wiederherstellung in Staging** in leere Umgebung durchspielen, Dauer eintragen; Zeitplan der täglichen Sicherung + Offsite-Kopie festlegen; Schlüssel-Hinterlegung testen | Technik + Inhaber | `docs/BACKUP-WIEDERHERSTELLUNG.md` Abschnitt 7 |
| 4 | **Gerätetest** iPhone + Android nach Plan (Kamera, Fahrzeugschein, Schadenerfassung, PDF) | Gutachter/Technik | ausgefülltes Protokoll |
| 5 | **Mailtest** an 1–2 freigegebene Adressen (Testmail, Anfrageformular, Gutachtenmail); Absender-Domain (SPF/DKIM) beim Anbieter verifizieren | Inhaber (Adressen), Technik | Postfach-Nachweis |
| 6 | Alarmierung wirklich einrichten (Webhook-Ziel, externer Uptime-Dienst auf `/api/health`) und einmal auslösen | Technik | ankommende Testmeldung |
| 7 | Datenschutz: Auftragsverarbeitungsverträge (Supabase, Vercel, Speicher-/Mail-Anbieter), Verarbeitungsverzeichnis, Aufbewahrungs-/Löschfristen festlegen, Datenschutzerklärung aktualisieren (`docs/DATENSCHUTZ-TODO.md`) – **rechtliche Prüfung** | Inhaber (ggf. Datenschutzbeauftragter/Anwalt) | unterschriebene Verträge |
| 8 | Inhaber-Konto mit 2FA anlegen, „2FA verpflichtend für Inhaber/Administratoren“ einschalten, Demo-Konten existieren in Produktion nicht | Inhaber | `db:check` grün |
| 9 | Verbindliche Ziele für Datenverlust/Wiederanlauf von der Geschäftsführung bestätigen (Vorschlag: ≤ 24 h Datenverlust, Wiederanlauf innerhalb eines Arbeitstags) | Inhaber | Freigabe |

Erst wenn 1–9 abgehakt sind, ist ein Pilot mit echten Gutachten verantwortbar.

## 4. Offene Integrationen und Einschränkungen

| Thema | Stand |
|---|---|
| **HSN/TSN / Fahrzeugdaten** | Quelle `hsn-tsn.de` **nicht verwendbar** (keine belegte Erlaubnis, Zertifikat gehört zu anderer Domain); Adapter bleibt gesperrt. Pilot: Fahrzeugdaten aus dem Fahrzeugschein. Anbietervergleich mit Kosten/Bedingungen und Vorschlag: `docs/HSN-TSN-ANBIETER.md` (**kein Vertrag abgeschlossen**) |
| Wiederbeschaffungs-/Restwert, Reparaturkosten | keine DAT-/Schwacke-/Audatex-Anbindung; Werte werden **manuell mit Quelle und Stand** erfasst. Gutachten enthalten nur, was ein Gutachter eingibt – nichts wird geschätzt oder erfunden |
| OCR Fahrzeugschein | nicht vorhanden (manuell erfassen und abgleichen) |
| Offline-Betrieb | **nicht gebaut** – ohne Netz keine Erfassung (Fotos sicherheitshalber zusätzlich auf dem Gerät behalten) |
| Mailversand | nur Benachrichtigung über neue Anfragen und Testmail; Gutachten/Rechnungen werden nicht automatisch versendet (nur als versendet vermerkt) |
| Digitale Signatur im Gutachten | nur Freigabe-Vermerk (Person, Datum), keine qualifizierte Signatur |
| Fahrzeugmodell | generisches Bauteilmodell, kein fahrzeugspezifisches 3D |
| Virenscan der Uploads | nicht vorhanden (Typprüfung aus Inhalt, nicht öffentlich, verschlüsselt); Status-Feld vorbereitet |
| Physisches Löschen nach Fristen | „Löschen“ blendet aus; automatischer Löschjob und Betroffenenrechte-Verfahren (Auskunft/Export) sind noch nicht gebaut |
| Studio-Fenster | iframes derselben Anwendung (robust, teilt Rechte); eigener Stil je App nicht vorgesehen |
| Build-Abhängigkeit | Der Build lädt Google-Schriften; ein einzelner Fehlversuch ist heute einmalig aufgetreten (zweiter Lauf ok). Auf Vercel unkritisch, bei Offline-Builds Schriften lokal einbinden |
| Supabase-Zeilensicherheit | lokal nicht prüfbar (keine Supabase-Rollen); in Staging mit `db:check` verifizieren |

## 5. Empfehlung

1. **Jetzt:** Staging aufbauen (Blocker 1–2), Test-Pilot mit **Testdaten** intern starten, parallel Gerätetest und Mailtest (4–5).
2. Wiederherstellungsprobe und Alarmierung (3, 6) in Staging abschließen.
3. Rechtliche Punkte (7) und Anbieter-Anfragen (DAT/Schwacke/api4cars, `docs/HSN-TSN-ANBIETER.md`) parallel anstoßen – sie haben Vorlauf.
4. **Dann** Neubewertung: Bei erledigten Blockern ist ein eng begrenzter Echt-Pilot (wenige Gutachter, wenige Fälle, Papier-/Altsystem als Rückfallebene) vertretbar.

## 6. Nützliche Befehle (alle lokal und ohne Wirkung auf echte Systeme)

```bash
npm run preflight -- <staging|production> --env-file <Datei>   # Konfiguration prüfen
npm run db:migtest                                              # Migrationen in Wegwerf-Datenbank
npm run backup:drill                                            # Sicherung + Wiederherstellung üben
npm run audit:auth                                              # Berechtigungs-Audit
npm run secrets:generate                                        # Zufallsschlüssel nur auf dem Bildschirm
```
