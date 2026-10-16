/**
 * Interner Prüfhinweis für die Kunden-Vorschau. Erscheint NUR, wenn beim Build NEXT_PUBLIC_REVIEW_MODE=1 gesetzt ist
 * (Vorschau für Ekrem) – im Produktionsbuild ohne diese Variable bleibt er unsichtbar.
 * VOR DER VERÖFFENTLICHUNG: Inhalte fachlich freigeben lassen, Variable nicht setzen.
 */
const REVIEW = process.env.NEXT_PUBLIC_REVIEW_MODE === '1';

export function ReviewNote({ topic }: { topic: string }) {
  if (!REVIEW) return null;
  return (
    <div className="shell pt-6" role="note">
      <p className="rounded-xl border border-dashed border-[rgba(255,180,84,.55)] bg-[rgba(255,180,84,.07)] px-4 py-3 text-[.85rem] text-[#ffd9a3]">
        <b className="mr-2 font-mono text-[.68rem] uppercase tracking-[.14em]">Entwurf · Vorschau</b>
        {topic} – fachlich noch nicht freigegeben. Aussagen und Formulierungen bitte prüfen; keine verbindliche Leistungszusage.
      </p>
    </div>
  );
}
