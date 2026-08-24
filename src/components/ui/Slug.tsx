/** Protokollzeile über einer Sektion. */
export function Slug({ left, right }: { left: string; right: string }) {
  return (
    <div className="slug">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}
