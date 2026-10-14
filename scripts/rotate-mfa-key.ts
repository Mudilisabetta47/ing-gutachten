/**
 * Schlüsselwechsel für die Zwei-Faktor-Geheimnisse.
 *  1. Neuen Schlüssel erzeugen:  node scripts/generate-secrets.mjs
 *  2. In der Umgebung: MFA_ENCRYPTION_KEY=<neu>  und  MFA_ENCRYPTION_KEY_PREVIOUS=<alt>
 *  3. npm run mfa:rotate            (Probelauf)       npm run mfa:rotate -- --apply
 *  4. Danach MFA_ENCRYPTION_KEY_PREVIOUS entfernen.
 */
import { rotateMfaSecrets } from '../src/server/auth/mfa';

rotateMfaSecrets({ apply: process.argv.includes('--apply') })
  .then((r) => { console.log(`${process.argv.includes('--apply') ? 'ANGEWENDET' : 'PROBELAUF'}: ${r.total} Geheimnisse · neu zu verschlüsseln ${r.rotated} · bereits aktuell ${r.current} · nicht lesbar ${r.errors.length}`); if (r.errors.length) process.exitCode = 1; process.exit(process.exitCode ?? 0); })
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
