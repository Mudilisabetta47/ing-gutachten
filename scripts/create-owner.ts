/**
 * Legt den ersten Inhaber an (oder bricht ab, wenn es schon einen gibt).
 *
 *   npm run create-owner -- --email inhaber@example.de --first Max --last Muster
 *   Passwort: Umgebungsvariable OWNER_PASSWORD oder interaktive Eingabe (wird nicht angezeigt).
 *
 * Das Passwort wird nie ausgegeben und nie protokolliert. Das Konto muss es beim ersten Login ändern.
 * Funktioniert auch gegen die Produktionsdatenbank (einmalige Einrichtung), verlangt dafür aber
 * ALLOW_PRODUCTION_BOOTSTRAP=yes.
 */
import { createInterface } from 'node:readline';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from '@node-rs/argon2';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function readHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) throw new Error('Kein Terminal: Passwort bitte über OWNER_PASSWORD setzen.');
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const stdout = process.stdout as NodeJS.WriteStream & { write: (s: string) => boolean };
  const original = stdout.write.bind(stdout);
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    stdout.write = ((s: string) => (s === '\n' || s === '\r\n' ? original(s) : true)) as typeof stdout.write;
    rl.question('', (answer) => {
      stdout.write = original as typeof stdout.write;
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const email = (arg('email') ?? '').trim().toLowerCase();
  const first = arg('first') ?? '';
  const last = arg('last') ?? '';
  if (!email || !first || !last) throw new Error('Aufruf: --email <adresse> --first <Vorname> --last <Nachname>');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL ist nicht gesetzt.');
  const prod = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  if (prod && process.env.ALLOW_PRODUCTION_BOOTSTRAP !== 'yes') {
    throw new Error('Production-Einrichtung erfordert ALLOW_PRODUCTION_BOOTSTRAP=yes (nur einmalig, bewusst).');
  }

  const password = process.env.OWNER_PASSWORD ?? (await readHidden('Passwort (min. 12 Zeichen, wird nicht angezeigt): '));
  if (password.length < 12) throw new Error('Das Passwort braucht mindestens 12 Zeichen.');

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    if (await db.user.count({ where: { role: 'OWNER', deletedAt: null } })) {
      console.log('Es existiert bereits ein Inhaber – nichts geändert.');
      return;
    }
    const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email, firstName: first, lastName: last, role: 'OWNER', passwordHash, mustChangePassword: true, employee: { create: { isExpert: false } } },
      });
      await tx.auditLog.create({ data: { actorId: u.id, action: 'user.create', entityType: 'User', entityId: u.id, summary: 'Inhaber über create-owner angelegt' } });
    });
    console.log(`Inhaber ${email} angelegt. Beim ersten Login muss das Passwort geändert werden.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
