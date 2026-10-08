import 'server-only';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';

/**
 * Systemeinstellungen: kleine, per Zod validierte JSON-Dokumente in `system_settings`.
 * Jede Einstellung hat Defaults – das System läuft ohne einen einzigen Eintrag.
 * Keine Geheimnisse hier (die gehören in Umgebungsvariablen).
 */
export const SETTINGS = {
  numbering: z.object({
    casePrefix: z.string().trim().min(1).max(10).regex(/^[A-Za-z0-9-]+$/),
    caseDigits: z.number().int().min(3).max(8),
    invoicePrefix: z.string().trim().min(1).max(10).regex(/^[A-Za-z0-9-]+$/),
    invoiceDigits: z.number().int().min(3).max(8),
    reportPrefix: z.string().trim().min(1).max(10).regex(/^[A-Za-z0-9-]+$/).default('GA'),
    reportDigits: z.number().int().min(3).max(8).default(5),
  }),
  company: z.object({
    name: z.string().trim().min(1).max(120),
    street: z.string().trim().max(120),
    postalCode: z.string().trim().max(10),
    city: z.string().trim().max(80),
    phone: z.string().trim().max(40),
    email: z.string().trim().max(120),
    website: z.string().trim().max(120),
    taxId: z.string().trim().max(40),
    bank: z.string().trim().max(200),
    footer: z.string().trim().max(300),
  }),
  uploads: z.object({
    maxPhotoMb: z.number().min(1).max(50),
    maxDocumentMb: z.number().min(1).max(100),
    maxFilesPerUpload: z.number().int().min(1).max(50),
  }),
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]>;

export const SETTING_DEFAULTS: { [K in SettingKey]: SettingValue<K> } = {
  numbering: { casePrefix: 'ING', caseDigits: 5, invoicePrefix: 'RE', invoiceDigits: 5, reportPrefix: 'GA', reportDigits: 5 },
  company: { name: 'ING Gutachten', street: '', postalCode: '', city: '', phone: '', email: '', website: '', taxId: '', bank: '', footer: '' },
  uploads: { maxPhotoMb: 15, maxDocumentMb: 25, maxFilesPerUpload: 20 },
};

/**
 * `client`: innerhalb einer Transaktion MUSS der Transaktions-Client übergeben werden – sonst hält
 * die Transaktion eine Verbindung und wartet auf eine zweite (Pool-Verklemmung unter Last).
 */
export async function getSetting<K extends SettingKey>(key: K, client: Pick<PrismaClient, 'systemSetting'> = db): Promise<SettingValue<K>> {
  const row = await client.systemSetting.findUnique({ where: { key } });
  const parsed = SETTINGS[key].safeParse(row?.value);
  return (parsed.success ? parsed.data : SETTING_DEFAULTS[key]) as SettingValue<K>;
}

export async function setSetting<K extends SettingKey>(key: K, value: unknown, actorId: string) {
  const data = SETTINGS[key].parse(value);
  const before = await getSetting(key);
  await db.$transaction(async (tx) => {
    await tx.systemSetting.upsert({
      where: { key },
      create: { key, value: data, updatedById: actorId },
      update: { value: data, updatedById: actorId },
    });
    await writeAudit({ actorId, action: 'settings.update', entityType: 'SystemSetting', entityId: key, summary: `Einstellung „${key}“ geändert`, before, after: data }, tx);
  });
  return data as SettingValue<K>;
}
