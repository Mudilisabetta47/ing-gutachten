# Kostenübersicht Staging und Produktion

Stand 2026-10-14. **Es wurde nichts gebucht.** Alle Preise stammen von den **Anbieterseiten** (Abruf 2026-10-14; Quellen unten) in der dort genannten Währung, **ohne Gewähr** und ohne Umsatzsteuer, sofern nicht anders genannt. Wo Preise nicht öffentlich sind, steht „unbekannt“ – keine Schätzung. Wechselkurse sind bewusst nicht eingerechnet.

## Staging (Pilot mit Testdaten)

| Posten | Tarif | Preis | Anmerkung |
|---|---|---|---|
| Supabase (DB + Storage) | Free | **$0** | 500 MB Datenbank, 1 GB Dateien, 5 GB Egress, 50 MB Dateigröße; **keine Backups**, pausiert nach 1 Woche Inaktivität; 2 aktive Projekte (Staging + Restore-Test) |
| Vercel | **Pro** | **$20 / Monat je Entwickler-Platz** (1 Platz) | Hobby ist laut Vercel auf nicht-kommerzielle Nutzung beschränkt, auch „Entwicklung durch bezahlte Mitarbeiter“ zählt; Viewer-Plätze für Tester kostenlos laut Preisseite. Inklusive: 1 TB Datentransfer, Deployment Protection (Vercel Authentication), Bypass für Automation |
| Vercel Password Protection | optional | $20 / Monat je Projekt | **nicht nötig** – Vercel Authentication ist enthalten |
| Mail (Brevo) | Free | **$0** (300 Mails/Tag laut Drittquellen) | Starter ab $9/Monat nur bei Bedarf; Preise/Limit vor Nutzung auf brevo.com prüfen |
| Erreichbarkeitsprüfung | cron-job.org (kostenlos) **oder** UptimeRobot Solo | $0 **oder** €10/Monat | UptimeRobot-Gratis laut Anbieter für Hobby/Non-Profit; cron-job.org: Bedingungen für gewerbliche Nutzung **nicht belegt** → vorher prüfen |
| Domain/DNS | vorhanden | – | |
| Fahrzeugdaten (DAT/Schwacke/api4cars) | **nicht gebucht** | – | siehe `docs/ANBIETERVERGLEICH.md` |
| **Summe Staging (Minimum)** | | **≈ $20 / Monat** (+ ggf. €10 Prüfdienst) | zzgl. Umsatzsteuer; Kündigung monatlich laut Anbieter prüfen |

## Produktivbetrieb (Richtwerte, Basis ohne Fahrzeugdaten-Anbieter)

| Posten | Tarif | Preis | Anmerkung |
|---|---|---|---|
| Supabase | **Pro** | **ab $25 / Monat** | 8 GB Datenbank, 100 GB Dateien, 250 GB Egress, **7 Tage tägliche Backups**, nie pausiert, Micro-Compute enthalten, Spend-Cap standardmäßig an; darüber: Datenbank $0,125/GB, Dateien $0,0213/GB, Egress $0,09/GB |
| Supabase PITR (optional) | Add-on | **$100 / Monat** für 7 Tage Aufbewahrung (laut Backup-Doku ca. $200 für 14, $400 für 28 Tage) | verlangt mind. Small-Compute (Small laut Preisseite $15/Monat); Wiederherstellungspunkt bis ca. 2 Minuten; ersetzt tägliche Backups |
| Vercel | **Pro** | **$20 / Monat** (1 Platz) + Nutzung über dem enthaltenen Kontingent | |
| Mail | Brevo Free oder Starter | $0 – ab $9 / Monat | |
| Prüfdienst | je nach Wahl | $0 – €10 / Monat | |
| Dateisicherung außerhalb | z. B. zweiter Bucket/anderer Anbieter | **unbekannt** (Mengenabhängig, bei Pilotmengen gering) | |
| **Summe Produktion (Basis)** | | **≈ $45 – $55 / Monat** (Supabase Pro + Vercel Pro + Prüfdienst) | **+ $100 / Monat** mit PITR; zzgl. Umsatzsteuer |

## Fahrzeugdaten (offen – nur Listenpreise, falls öffentlich)

| Anbieter | Preis |
|---|---|
| DAT (SilverDAT, Schnittstelle) | nicht öffentlich – Angebot angefragt (Entwurf, nicht versendet) |
| Schwacke / Autovista | nicht öffentlich – Anfrage vorbereitet |
| api4cars | Free $0 (50 bzw. 500 Abfragen/Monat – Angaben widersprüchlich) · **€79/Monat** (10.000) · **€199/Monat** (100.000, danach €0,002/Abfrage) · jeweils zzgl. 19 % MwSt.; Jahrestarif −20 % |

## Einsparungen und Risiken

- Zwei getrennte Supabase-Projekte (Staging/Produktion) und getrennte Vercel-Projekte sind **Pflicht** (Trennung der Daten); Mehrkosten entstehen erst in Produktion.
- PITR lohnt sich erst, wenn ein Datenverlust von bis zu 24 Stunden (tägliche Sicherung) für die Geschäftsführung nicht tragbar ist.
- **Risiko Supabase Free in Staging:** Projekt-Pause nach einer Woche ohne Nutzung → vor Praxistagen im Dashboard wieder aktivieren.
- **Risiko Vercel Hobby:** Nicht verwenden (Bedingungen) – eine Nutzung ohne Pro könnte zur Sperrung führen.

## Quellen (Abruf 2026-10-14)

- Supabase Preise https://supabase.com/pricing · Backups https://supabase.com/docs/guides/platform/backups · Verbindungsarten https://supabase.com/docs/guides/database/connecting-to-postgres · S3-Kompatibilität https://supabase.com/docs/guides/storage/s3/compatibility
- Vercel Preise https://vercel.com/pricing · Fair Use/kommerzielle Nutzung https://vercel.com/docs/limits/fair-use-guidelines · Deployment Protection https://vercel.com/docs/deployment-protection und …/usage-and-pricing · Cron https://vercel.com/docs/cron-jobs/usage-and-pricing
- UptimeRobot https://uptimerobot.com/pricing/ · Brevo/Resend/cron-job.org: Angaben aus Websuche (Drittseiten), **vor Nutzung beim Anbieter prüfen**
- api4cars https://api4cars.com/ (Preise), …/api-nutzungsbedingungen, …/agb
