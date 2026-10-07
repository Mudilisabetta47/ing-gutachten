import Link from 'next/link';
import { AdminIcon } from '@/components/admin/AdminIcon';

export default function PanelNotFound() {
  return (
    <div className="adm-empty" style={{ marginTop: 48 }}>
      <span className="ico"><AdminIcon name="search" /></span>
      <h3>Nicht gefunden</h3>
      <p>Diesen Eintrag gibt es nicht – oder Sie haben dafür keine Berechtigung.</p>
      <div className="act">
        <Link href="/admin" className="adm-btn">Zum Dashboard</Link>
        <Link href="/admin/heute" className="adm-btn adm-btn-secondary">Zu „Heute“</Link>
      </div>
    </div>
  );
}
