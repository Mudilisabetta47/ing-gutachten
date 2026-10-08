'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { useToast } from '@/components/admin/Toast';
import { createInvoiceAction } from '../../invoice-actions';

export function CreateInvoiceButton({ caseId, caseNumber, options, label = 'Rechnungsentwurf anlegen' }: { caseId: string; caseNumber: string; options: { key: string; label: string }[]; label?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [key, setKey] = useState(options[0]?.key ?? 'customer');
  return (
    <div className="adm-actions">
      {options.length > 1 && (
        <select className="adm-input" style={{ maxWidth: 320 }} aria-label="Rechnungsempfänger" value={key} onChange={(e) => setKey(e.target.value)}>
          {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      )}
      <button type="button" className="adm-btn" disabled={pending} onClick={() => start(async () => { const r = await createInvoiceAction({ caseId, caseNumber, recipientKey: key }); toast(r.ok ? r.message ?? 'Angelegt.' : r.error ?? 'Das hat nicht geklappt.', r.ok ? 'ok' : 'error'); if (r.ok) router.replace(`/admin/faelle/${caseNumber}/?tab=rechnung&rechnung=${r.id}`); router.refresh(); })}><AdminIcon name="plus" />{label}</button>
    </div>
  );
}
