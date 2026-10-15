/** Dezentes Laufband mit den belegten Leistungen. Reine Dekoration (aria-hidden): pausiert bei Hover, steht bei reduzierter Bewegung still. */
const WORDS = ['Unfallgutachten', 'Schadengutachten', 'Wertgutachten', 'Oldtimergutachten', 'Beweissicherung', 'Leasingrückgabe', 'Unfallanalyse', 'Fahrzeugbewertung'];

export function ServiceMarquee() {
  const row = (dup: boolean) => (
    <ul className={`marquee-row${dup ? ' marquee-dup' : ''}`}>
      {WORDS.map((w) => <li key={w} className="display">{w}<span aria-hidden="true">✦</span></li>)}
    </ul>
  );
  return (
    <div className="marquee theme-dark border-y border-line" aria-hidden="true">
      <div className="marquee-track">{row(false)}{row(true)}</div>
    </div>
  );
}
