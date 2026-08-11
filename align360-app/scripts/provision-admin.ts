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
 * Usage — generate fresh random passwords for everyone in the ROSTER:
 *   npx tsx scripts/provision-admin.ts --generate
 * Prints each person's password ONCE plus the ADMIN_USERS JSON. Nothing is
 * written to disk and no password is typed as a shell argument.
 *
 * Or set the passwords yourself by editing the ROSTER below, then:
 *   npx tsx scripts/provision-admin.ts
 *
 * To add ONE user without hand-editing the roster, e.g. rotate a password:
 *   npx tsx scripts/provision-admin.ts --one "name@email.com" "password" superadmin
 *
 * NOTE: ADMIN_USERS is marked SENSITIVE in Vercel, so its current value cannot
 * be read back by anyone — not the dashboard, not the CLI. There is no way to
 * look up who currently has access or what their password is. Re-provisioning
 * with a known roster is the only way to get back to a known state.
 *
 * IMPORTANT: this only ever PRINTS. Passwords typed here are process args (only
 * visible in your own shell history) and are not written to disk. Existing
 * ADMIN_USERS entries not listed here are NOT preserved automatically — the
 * output REPLACES the whole array, so include everyone who should still have
 * access. Rotate ADMIN_SESSION_SECRET separately if you need to force-expire
 * every existing session (that's a different, unrelated env var).
 */
import { randomInt } from 'crypto';
import { hashPassword, type AdminRole } from '../lib/admin/auth';

type Entry = { email: string; password: string; role: AdminRole };

// Edit this roster and re-run for a full re-provision (e.g. onboarding Drew).
// Passwords here are PLACEHOLDERS — replace before running, don't commit real ones.
const ROSTER: Entry[] = [
  { email: 'wllprbl@gmail.com', password: 'REPLACE_ME', role: 'superadmin' },
  { email: 'samuel@align360.io', password: 'REPLACE_ME', role: 'admin' },
  { email: 'drewcline168@gmail.com', password: 'REPLACE_ME', role: 'admin' },
];

/** Readable, high-entropy password: 4 words + 3 digits, ~64 bits. Easy to send
 *  in a message and retype once, which is what actually happens in practice. */
function generatePassword(): string {
  const words = [
    'anchor', 'basalt', 'cinder', 'dahlia', 'ember', 'fathom', 'gable', 'harbor',
    'indigo', 'juniper', 'kestrel', 'lantern', 'marrow', 'nimbus', 'onyx', 'plume',
    'quarry', 'ribbon', 'saffron', 'thistle', 'umber', 'vellum', 'willow', 'zenith',
  ];
  const pick = () => words[randomInt(words.length)];
  return `${pick()}-${pick()}-${pick()}-${pick()}-${randomInt(100, 1000)}`;
}

function main() {
  const oneIdx = process.argv.indexOf('--one');
  const generate = process.argv.includes('--generate');

  let entries: Entry[] =
    oneIdx >= 0
      ? [{ email: process.argv[oneIdx + 1], password: process.argv[oneIdx + 2], role: (process.argv[oneIdx + 3] as AdminRole) || 'admin' }]
      : ROSTER;

  // --generate replaces every password with a fresh random one, so the ROSTER
  // never has to hold a real secret and nothing sensitive is typed as a shell
  // argument (where it would land in shell history).
  if (generate) entries = entries.map((e) => ({ ...e, password: generatePassword() }));

  for (const e of entries) {
    if (!e.email || !e.password || e.password === 'REPLACE_ME') {
      throw new Error(
        `Missing/placeholder password for ${e.email || '(blank)'} — pass --generate, edit the ROSTER, or use --one.`,
      );
    }
  }

  const out = entries.map((e) => {
    const { salt, hash } = hashPassword(e.password);
    return { email: e.email.trim().toLowerCase(), salt, hash, role: e.role };
  });

  if (generate) {
    console.log('\n=== CREDENTIALS — send each person their own line, then delete this output ===\n');
    for (const e of entries) {
      console.log(`  ${e.email}`);
      console.log(`    password: ${e.password}`);
      console.log(`    role:     ${e.role}\n`);
    }
    console.log('These are shown ONCE. They are not stored anywhere and cannot be recovered.\n');
  } else {
    console.log(`Generated ${out.length} admin entr${out.length === 1 ? 'y' : 'ies'}:\n`);
    for (const e of out) console.log(`  ${e.email}  →  ${e.role}`);
  }

  console.log('=== ADMIN_USERS value — paste into Vercel, replacing the WHOLE variable ===\n');
  console.log(JSON.stringify(out));
  console.log('\nThen redeploy, or the running instance will not see the change.');
}

main();
