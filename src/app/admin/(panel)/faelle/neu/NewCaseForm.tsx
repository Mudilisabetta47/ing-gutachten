'use client';

import { Field } from '@/components/admin/ui';
import { CaseForm } from '@/components/admin/forms';
import { createCaseAction } from '../actions';
import { useState } from 'react';

/** Fahrzeugwahl + Falldaten. Die Wahl läuft über ein verstecktes Feld, damit sie in `CaseForm` mitgesendet wird. */
export function NewCaseForm({ customerId, vehicles, experts, canAssign }: { customerId: string; vehicles: { id: string; label: string }[]; experts: { id: string; name: string }[]; canAssign: boolean }) {
  const [vehicleId, setVehicleId] = useState(vehicles[0].id);
  return (
    <div className="adm-card grid max-w-[760px] gap-5">
      <Field label="Fahrzeug">
        <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="adm-input">
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </Field>
      <CaseForm action={createCaseAction} hidden={{ customerId, vehicleId }} experts={experts} canAssign={canAssign} submitLabel="Fall anlegen" />
    </div>
  );
}
