import 'server-only';
import { hash, verify } from '@node-rs/argon2';

/**
 * Passwörter: Argon2id (Algorithmus-Standard von @node-rs/argon2).
 * Parameter nach OWASP-Empfehlung (19 MiB, 2 Durchgänge, 1 Thread) – schnell genug
 * für Serverless, teuer genug gegen Offline-Angriffe.
 */
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Gültiger Hash eines zufälligen Werts: sorgt dafür, dass ein Login mit unbekannter
 *  E-Mail genauso lange dauert wie einer mit bekannter (kein Rückschluss auf Konten). */
let dummy: Promise<string> | null = null;
export function dummyHash(): Promise<string> {
  dummy ??= hash(`dummy-${Math.random()}-${Date.now()}`, OPTIONS);
  return dummy;
}

const COMMON = new Set(
  ['passwort1234', 'password1234', '123456789012', 'qwertzuiop12', 'willkommen123', 'administrator', 'changeme1234', 'inggutachten', 'ing-gutachten', 'hannover12345'].map((s) => s.toLowerCase()),
);

export const MIN_PASSWORD_LENGTH = 12;

/** Gibt eine deutsche Fehlermeldung zurück oder null, wenn das Passwort zulässig ist. */
export function validatePasswordPolicy(password: string, ctx: { email?: string; firstName?: string; lastName?: string } = {}): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`;
  if (password.length > 200) return 'Das Passwort ist zu lang.';
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return 'Dieses Passwort ist zu bekannt. Bitte ein anderes wählen.';
  if (/^(.)\1+$/.test(password)) return 'Das Passwort darf nicht nur aus einem wiederholten Zeichen bestehen.';
  const local = ctx.email?.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return 'Das Passwort darf Ihre E-Mail-Adresse nicht enthalten.';
  for (const part of [ctx.firstName, ctx.lastName]) {
    if (part && part.length >= 4 && lower.includes(part.toLowerCase())) return 'Das Passwort darf Ihren Namen nicht enthalten.';
  }
  return null;
}
