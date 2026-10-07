import 'server-only';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { CASE_LABELS, LEAD_LABELS, type CaseStatusKey, type LeadStatusKey } from '@/lib/workflow';
import { caseScope, customerScope, has, vehicleScope } from './access';
import { listCases } from './cases';
import { listCustomers } from './customers';
import { listLeads } from './leads';
import { listVehicles } from './vehicles';

export type SearchHit = { id: string; label: string; sub: string; href: string };
export type SearchResult = { query: string; cases: SearchHit[]; customers: SearchHit[]; vehicles: SearchHit[]; leads: SearchHit[] };

const LIMIT = 5;
const who = (c: { firstName: string; lastName: string; company: string | null }) => c.company || `${c.firstName} ${c.lastName}`.trim();

/**
 * Globale Suche (⌘K): Fallnummer, Kunde, Telefon, E-Mail, Kennzeichen, FIN, Schadennummer.
 * Nutzt dieselben Listenabfragen wie die Seiten – damit gelten exakt dieselben Zugriffsregeln
 * (Experten: nur eigene Fälle; Buchhaltung: keine Fahrzeuge/Anfragen; Website-Rolle: nichts).
 */
export async function globalSearch(user: AuthUser, raw: string): Promise<SearchResult> {
  if (!has(user, 'search.global')) throw new ForbiddenError();
  const q = raw.trim().slice(0, 80);
  const empty: SearchResult = { query: q, cases: [], customers: [], vehicles: [], leads: [] };
  if (q.length < 2) return empty;

  const [cases, customers, vehicles, leads] = await Promise.all([
    caseScope(user, 'read') ? listCases(user, { q, limit: LIMIT }) : null,
    customerScope(user) ? listCustomers(user, { q, limit: LIMIT }) : null,
    vehicleScope(user) ? listVehicles(user, { q, limit: LIMIT }) : null,
    has(user, 'leads.read') ? listLeads(user, { q, limit: LIMIT }) : null,
  ]);

  return {
    query: q,
    cases: (cases?.rows ?? []).map((c) => ({
      id: c.id, label: c.caseNumber, href: `/admin/faelle/${c.caseNumber}/`,
      sub: `${who(c.customer)} · ${c.vehicle.licensePlate ?? c.vehicle.model} · ${CASE_LABELS[c.status as CaseStatusKey]}`,
    })),
    customers: (customers?.rows ?? []).map((c) => ({ id: c.id, label: who(c), href: `/admin/kunden/${c.id}/`, sub: [c.email, c.phone, c.city].filter(Boolean).join(' · ') || '–' })),
    vehicles: (vehicles?.rows ?? []).map((v) => ({ id: v.id, label: v.licensePlate ?? `${v.manufacturer} ${v.model}`, href: `/admin/fahrzeuge/${v.id}/`, sub: `${v.manufacturer} ${v.model} · ${who(v.customer)}` })),
    leads: (leads?.rows ?? []).map((l) => ({ id: l.id, label: l.name, href: `/admin/anfragen/${l.id}/`, sub: `${LEAD_LABELS[l.status as LeadStatusKey]} · ${l.reason}${l.phone ? ` · ${l.phone}` : ''}` })),
  };
}
