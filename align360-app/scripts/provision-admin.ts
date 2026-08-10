/**
 * Generate the ADMIN_USERS env var JSON for /admin access. No provisioning
 * script existed before this — admin users were apparently hand-hashed once.
 * This never touches Vercel/any live env; it only prints JSON to paste into
 * Vercel → align360-app → Settings → Environment Variables → ADMIN_USERS
 * (Production), then redeploy (or the running instance won't see the change).
 *
 * Roles (lib/admin/guard.ts):
 *   'admin'      Overview metrics, the full user list with payment state, per-user
 *                drilldown, teams/seats, trends, and feedback. This is the whole
 *                operating picture and is what Drew and Samuel need day to day.
 *   'superadmin' All of the above, plus the Ascendance/Align360 revenue SPLIT and
 *                internal infra status (HubSpot token scopes).
 * The line is ownership data, not customer data. Omitting role defaults to
 * 'admin' — least privilege, and still fully useful.
 *
 * Usage — edit the ROSTER below, then:
 *   npx tsx scripts/provision-admin.ts
 *
 * To add ONE user without hand-editing the roster, e.g. rotate a password:
 *   npx tsx scripts/provision-admin.ts --one "name@email.com" "password" superadmin
 *
 * IMPORTANT: this only ever PRINTS. Passwords typed here are process args (only
 * visible in your own shell history) and are not written to disk. Existing
 * ADMIN_USERS entries not listed here are NOT preserved automatically — the
 * output REPLACES the whole array, so include everyone who should still have
 * access. Rotate ADMIN_SESSION_SECRET separately if you need to force-expire
 * every existing session (that's a different, unrelated env var).
 */
import { hashPassword, type AdminRole } from '../lib/admin/auth';

type Entry = { email: string; password: string; role: AdminRole };

// Edit this roster and re-run for a full re-provision (e.g. onboarding Drew).
// Passwords here are PLACEHOLDERS — replace before running, don't commit real ones.
const ROSTER: Entry[] = [
  { email: 'wllprbl@gmail.com', password: 'REPLACE_ME', role: 'superadmin' },
  { email: 'samuel@align360.io', password: 'REPLACE_ME', role: 'admin' },
  { email: 'drewcline168@gmail.com', password: 'REPLACE_ME', role: 'admin' },
];

function main() {
  const oneIdx = process.argv.indexOf('--one');
  const entries: Entry[] =
    oneIdx >= 0
      ? [{ email: process.argv[oneIdx + 1], password: process.argv[oneIdx + 2], role: (process.argv[oneIdx + 3] as AdminRole) || 'admin' }]
      : ROSTER;

  for (const e of entries) {
    if (!e.email || !e.password || e.password === 'REPLACE_ME') {
      throw new Error(`Missing/placeholder email or password for ${e.email || '(blank)'} — edit the ROSTER or use --one.`);
    }
  }

  const out = entries.map((e) => {
    const { salt, hash } = hashPassword(e.password);
    return { email: e.email.trim().toLowerCase(), salt, hash, role: e.role };
  });

  console.log(`Generated ${out.length} admin entr${out.length === 1 ? 'y' : 'ies'}:\n`);
  for (const e of out) console.log(`  ${e.email}  →  ${e.role}`);
  console.log('\nADMIN_USERS value (paste into Vercel, replacing the whole var):\n');
  console.log(JSON.stringify(out));
}

main();
