import { Skeleton } from '@/components/admin/ui';

/** Platzhalter beim Seitenwechsel – gleiche Grundstruktur wie die Seiten, damit nichts springt. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Wird geladen">
      <Skeleton w={140} h={12} />
      <div style={{ height: 14 }} />
      <Skeleton w={280} h={28} />
      <div style={{ height: 24 }} />
      <Skeleton h={64} r={12} />
      <div style={{ height: 20 }} />
      <div style={{ display: 'grid', gap: 10 }}>
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={44} r={8} />)}
      </div>
    </div>
  );
}
