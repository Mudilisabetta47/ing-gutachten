import Link from 'next/link';

const ITEMS: [string, string, string][] = [['db', 'HSN/TSN-Datenbank', '/admin/fahrzeugdaten'], ['quellen', 'Datenquellen', '/admin/fahrzeugdaten/quellen'], ['import', 'Import', '/admin/fahrzeugdaten/import'], ['konflikte', 'Datenkonflikte', '/admin/fahrzeugdaten/konflikte']];

export function DataNav({ active, conflicts }: { active: string; conflicts?: number }) {
  return (
    <nav className="adm-seg" aria-label="Fahrzeugdaten">
      {ITEMS.map(([k, l, href]) => (
        <Link key={k} href={href} aria-current={k === active ? 'page' : undefined}>{l}{k === 'konflikte' && conflicts ? <span className="n">{conflicts}</span> : null}</Link>
      ))}
    </nav>
  );
}
