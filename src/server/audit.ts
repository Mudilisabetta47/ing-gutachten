import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';
import { db } from '@/server/db';

/**
 * Audit-Log: append-only. Geschrieben wird bei jeder geschäftsrelevanten Änderung
 * (wer, wann, was, woran) – mit Vorher/Nachher, aber ohne Geheimnisse.
 */

export type AuditInput = {
  actorId?: string | null;
  action: string; // "auth.login", "user.create", "case.status_change" …
  entityType: string;
  entityId?: string | null;
  summary?: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

const SECRET_KEY = /pass(word)?|hash|token|secret|mfa|authorization|cookie/i;

/** Entfernt Geheimnisse rekursiv, bevor etwas ins Protokoll geht. */
export function redact(value: unknown, depth = 0): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  if (depth > 5) return '[…]';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1) ?? null) as Prisma.InputJsonValue;
  if (typeof value === 'object') {
    const out: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? '[redacted]' : (redact(v, depth + 1) ?? null);
    }
    return out as Prisma.InputJsonObject;
  }
  if (typeof value === 'bigint') return value.toString();
  return value as Prisma.InputJsonValue;
}

type Client = PrismaClient | Prisma.TransactionClient;

/** In derselben Transaktion wie die Änderung schreiben, damit keine Lücken entstehen. */
export async function writeAudit(input: AuditInput, client: Client = db) {
  await client.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary?.slice(0, 500),
      before: redact(input.before),
      after: redact(input.after),
      ip: input.ip ?? null,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
    },
  });
}
