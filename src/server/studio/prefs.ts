import 'server-only';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { DomainError } from '@/server/errors';
import { DEFAULT_PINNED, parsePrefs, safeAppUrl, studioPrefsSchema, type StudioPrefs } from '@/lib/studio';

const KEY = 'studio';
const MAX_BYTES = 30_000;

/** Eigene Studio-Einstellungen. Fehlende oder beschädigte Daten ergeben Standardwerte – das Studio startet immer. */
export async function getStudioPrefs(user: AuthUser, allowedApps: ReadonlySet<string>): Promise<StudioPrefs> {
  const row = await db.userPreference.findUnique({ where: { userId_key: { userId: user.id, key: KEY } } });
  const p = parsePrefs(row?.value);
  const pinned = (p.pinned.length ? p.pinned : DEFAULT_PINNED).filter((id) => allowedApps.has(id));
  return { ...p, pinned };
}

/**
 * Speichert die Einstellungen der angemeldeten Person (nie die einer anderen). Eingabe wird streng geprüft:
 * unbekannte Felder fallen weg, Fenster dürfen nur interne Adressen und erlaubte Apps enthalten.
 */
export async function saveStudioPrefs(user: AuthUser, raw: unknown, allowedApps: ReadonlySet<string>): Promise<StudioPrefs> {
  const parsed = studioPrefsSchema.safeParse(raw);
  if (!parsed.success) throw new DomainError('Die Einstellungen sind ungültig.');
  const p = parsed.data;
  const clean: StudioPrefs = {
    ...p,
    pinned: p.pinned.filter((id) => allowedApps.has(id)),
    recents: p.recents.filter((r) => allowedApps.has(r.appId) && safeAppUrl(r.url)),
    windows: p.windows.filter((w) => (allowedApps.has(w.appId) || w.appId === 'settings') && (w.url === '' || safeAppUrl(w.url))),
    geometry: Object.fromEntries(Object.entries(p.geometry).filter(([id]) => allowedApps.has(id) || id === 'settings')),
  };
  if (JSON.stringify(clean).length > MAX_BYTES) throw new DomainError('Die Einstellungen sind zu umfangreich.');
  await db.userPreference.upsert({ where: { userId_key: { userId: user.id, key: KEY } }, create: { userId: user.id, key: KEY, value: clean }, update: { value: clean } });
  return clean;
}

export async function resetStudioPrefs(user: AuthUser) {
  await db.userPreference.deleteMany({ where: { userId: user.id, key: KEY } });
  await writeAudit({ actorId: user.id, action: 'studio.reset', entityType: 'User', entityId: user.id, summary: 'ING Studio auf Standard zurückgesetzt' });
}
