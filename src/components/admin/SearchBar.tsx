import { AdminIcon } from './AdminIcon';
import { AutoForm } from './AutoForm';

/** Einfaches Suchfeld für Übersichtslisten (GET, Server-gerendert). */
export function SearchBar({ action, q, placeholder, hidden = {} }: { action: string; q?: string; placeholder: string; hidden?: Record<string, string | undefined> }) {
  return (
    <AutoForm action={action}>
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <div className="grow adm-input-group"><AdminIcon name="search" /><input name="q" defaultValue={q} className="adm-input" placeholder={placeholder} autoComplete="off" aria-label="Suche" /></div>
    </AutoForm>
  );
}
