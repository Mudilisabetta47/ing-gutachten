import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { getSystemStatus } from '@/server/admin/status';
import { Alert, Badge, PageHeader } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Schnittstellen' };

type Card = { name: string; text: string; state: 'ok' | 'none' | 'review'; label?: string; href?: string };

export default async function IntegrationsPage() {
  await requirePagePermission('integrations.read', 'settings.read');
  const s = getSystemStatus();
  const cards: Card[] = [
    { name: 'E-Mail-Versand', text: 'Benachrichtigungen über neue Anfragen. Gutachten und Rechnungen werden bewusst nicht automatisch versendet.', state: s.mail.ok ? 'ok' : 'none', label: s.mail.ok ? 'Aktiv' : 'Nicht konfiguriert' },
    { name: 'Dateispeicher', text: 'Privater Speicher für Fotos und Dokumente (Abruf nur mit Anmeldung).', state: s.storage.ok ? 'ok' : 'none', label: s.storage.ok ? s.storage.label : 'Nicht konfiguriert' },
    { name: 'Fahrzeugdatenbank (HSN/TSN)', text: 'Eigene Datenbank zuerst; externe Anbieter nur mit geklärter Lizenz. Standard-Anbieter steht auf „Prüfung erforderlich“.', state: 'review', label: 'Lizenz in Prüfung', href: '/admin/fahrzeugdaten/quellen' },
    { name: 'DAT / Audatex / GT Motive', text: 'Kalkulations- und Bewertungsdaten. Es besteht keine Verbindung; Werte werden manuell mit Quelle und Stand erfasst.', state: 'none', label: 'Nicht konfiguriert' },
    { name: 'Restwertbörse', text: 'Restwertangebote. Keine Anbindung – Angebote werden manuell erfasst.', state: 'none', label: 'Nicht konfiguriert' },
    { name: 'KBA / FIN-Decoder', text: 'Abfrage nach FIN oder Schlüsselnummer. Nicht angebunden; Dekodierung nur aus der eigenen Fahrzeugdatenbank.', state: 'none', label: 'Nicht konfiguriert' },
    { name: 'Kalender (Google / Outlook)', text: 'Synchronisation von Besichtigungsterminen. Nicht angebunden; der interne Kalender ist aktiv.', state: 'none', label: 'Nicht konfiguriert' },
    { name: 'Buchhaltung (z. B. DATEV)', text: 'Übergabe von Rechnungen und Zahlungen. Nicht angebunden; CSV-Export ist verfügbar.', state: 'none', label: 'Nicht konfiguriert', href: '/admin/archiv' },
    { name: 'SMS / Messenger', text: 'Terminerinnerungen. Nicht angebunden.', state: 'none', label: 'Nicht konfiguriert' },
    { name: 'Zahlungsanbieter', text: 'Online-Zahlung von Rechnungen. Nicht angebunden; Zahlungen werden manuell erfasst.', state: 'none', label: 'Nicht konfiguriert' },
    { name: 'E-Signatur', text: 'Digitale Unterschrift von Aufträgen und Vollmachten. Nicht angebunden.', state: 'none', label: 'Nicht konfiguriert' },
  ];
  return (
    <>
      <PageHeader title="Schnittstellen" intro="Externe Dienste und ihr tatsächlicher Stand. Geheimnisse (Zugangsdaten) liegen ausschließlich in den Umgebungsvariablen bei Vercel – nie hier im Browser." />
      <Alert tone="info" icon="info">Nichts hier ist vorgetäuscht: „Nicht konfiguriert“ bedeutet, dass keine Verbindung besteht und keine Daten von dort stammen.</Alert>
      <div className="int-grid" style={{ marginTop: 14 }}>
        {cards.map((c) => (
          <section key={c.name} className="int-card" aria-label={c.name}>
            <h3>{c.name}<Badge tone={c.state === 'ok' ? 'ok' : c.state === 'review' ? 'warn' : 'muted'}>{c.label}</Badge></h3>
            <p>{c.text}</p>
            {c.href && <Link href={c.href} className="adm-link">Öffnen</Link>}
          </section>
        ))}
      </div>
    </>
  );
}
