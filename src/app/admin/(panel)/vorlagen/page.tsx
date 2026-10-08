import type { Metadata } from 'next';
import { requirePagePermission } from '@/server/auth/guards';
import { listTextBlocks } from '@/server/pipeline/reports';
import { PageHeader } from '@/components/admin/ui';
import { TextBlockManager } from './TextBlockManager';

export const metadata: Metadata = { title: 'Vorlagen' };

export default async function TemplatesPage() {
  const user = await requirePagePermission('templates.write');
  const blocks = await listTextBlocks(user);
  return (
    <>
      <PageHeader title="Textbausteine" intro="Wiederverwendbare Texte für Gutachten. Variablen wie {{fahrzeug.typ}} werden beim Einfügen im Gutachten durch die Falldaten ersetzt. Rechtliche oder fachliche Standardformulierungen legt der Betrieb hier selbst an." />
      <TextBlockManager blocks={blocks} />
    </>
  );
}
