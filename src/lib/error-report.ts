/**
 * Fehlerüberwachung ohne Fremddienst-Zwang: strukturierte Fehlerzeile im Log (Vercel Log Drain / Alerts können darauf filtern)
 * und – wenn ALERT_WEBHOOK_URL gesetzt ist (https, z. B. Slack/Teams/Mattermost-Eingang) – eine knappe Alarmmeldung.
 * Personenbezogene Daten gehören nicht hinein: E-Mail-Adressen, Telefonnummern, Tokens und Query-Strings werden entfernt.
 */
import { createHash } from 'node:crypto';

export type ErrorContext = { route?: string; method?: string; kind?: string; digest?: string; env?: string; release?: string };

export function scrub(text: string, max = 300): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[E-Mail]')
    .replace(/postgres(?:ql)?:\/\/[^\s)'"]+/gi, '[Datenbank-Verbindung]')
    .replace(/https?:\/\/[^\s)'"]+/gi, (u) => u.split('?')[0])
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[Token]')
    .replace(/(?:\+?\d[\s\-/().]?){9,}/g, '[Nummer]')
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

export function describeError(err: unknown, ctx: ErrorContext = {}) {
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Unbekannter Fehler');
  const frames = (e.stack ?? '').split('\n').slice(1, 5).map((l) => scrub(l.replace(/\(?(?:file:\/\/)?\/[^\s)]*\/(src|node_modules)\//, '($1/'), 140));
  const route = ctx.route ? ctx.route.split('?')[0].replace(/\/[A-Za-z0-9_-]{20,}(?=\/|$)/g, '/[id]') : undefined;
  const fingerprint = createHash('sha256').update(`${e.name}|${scrub(e.message, 120)}|${(frames[0] ?? '').replace(/:\d+(?::\d+)?/g, '')}|${route ?? ''}`).digest('hex').slice(0, 12);
  return {
    level: 'error', event: 'app_error', fingerprint, name: e.name, message: scrub(e.message),
    route, method: ctx.method, kind: ctx.kind, digest: ctx.digest,
    env: ctx.env, release: ctx.release, frames, at: new Date().toISOString(),
  };
}

const seen = new Map<string, number>();
const sentLog: number[] = [];
const DEDUPE_MS = 5 * 60_000;
const MAX_PER_MIN = 10;

/** Meldet einen Fehler (nie werfend). Gleiche Fehler höchstens alle 5 Minuten, insgesamt höchstens 10 Meldungen pro Minute an den Webhook. */
export async function reportError(err: unknown, ctx: ErrorContext = {}, env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch): Promise<{ logged: boolean; alerted: boolean }> {
  try {
    const d = describeError(err, { env: env.ING_ENV ?? env.VERCEL_ENV ?? 'development', release: (env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || undefined, ...ctx });
    console.error(JSON.stringify(d));
    const url = env.ALERT_WEBHOOK_URL ?? '';
    if (!/^https:\/\//.test(url)) return { logged: true, alerted: false };
    const now = Date.now();
    if (now - (seen.get(d.fingerprint) ?? 0) < DEDUPE_MS) return { logged: true, alerted: false };
    while (sentLog.length && now - sentLog[0] > 60_000) sentLog.shift();
    if (sentLog.length >= MAX_PER_MIN) return { logged: true, alerted: false };
    seen.set(d.fingerprint, now); sentLog.push(now);
    if (seen.size > 500) for (const [k, t] of seen) if (now - t > DEDUPE_MS) seen.delete(k);
    const text = `🔴 ING (${d.env}) ${d.kind ?? 'Fehler'}: ${d.name}: ${d.message}${d.route ? `\nRoute: ${d.method ?? ''} ${d.route}` : ''}\nKennung ${d.fingerprint}${d.release ? ` · Stand ${d.release}` : ''}`;
    const res = await fetcher(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, content: text, fingerprint: d.fingerprint }), signal: AbortSignal.timeout(3000) });
    return { logged: true, alerted: res.ok };
  } catch {
    return { logged: false, alerted: false };
  }
}
export const _resetErrorReporter = () => { seen.clear(); sentLog.length = 0; };
