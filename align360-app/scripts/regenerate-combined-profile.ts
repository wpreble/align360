/**
 * Regenerate a user's combined identity profile ("Full Identity Profile")
 * server-side, using the CURRENT generation code (schemas, determinism locks,
 * voice rules). Exists because a prompt fix only affects new generations —
 * existing reports keep the old wording until regenerated (e.g. Drew's AI-Era
 * drift report, 2026-08).
 *
 * Two modes:
 *   default        — full regeneration: every prose field re-rolls (scores stay pinned).
 *   --ai-era-only  — surgical: re-runs ONLY the AI-era section and splices it into the
 *                    stored report; every other field keeps its previous exact wording.
 *
 * Reads the user's stored assessment answers from Supabase, runs the shared core
 * (lib/profile-core.ts), backs up the existing narrative to a local JSON file, and
 * upserts `reports` (kind='combined', slug=''). Dry-run by default; --write persists.
 *
 * Run from align360-app/:
 *   npx tsx scripts/regenerate-combined-profile.ts <email> [--ai-era-only] [--write]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { generateCombinedProfile, regenerateAiEraOnly, type GeneratedProfile } from '../lib/profile-core';
import { checkVoice, formatViolations } from '../lib/voice-check';
import type { AnswerSet } from '../lib/scoring';

/* ── env: parse .env.local from cwd (tsx does not auto-load it) ── */
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error(`No .env.local at ${envPath} — run from align360-app/`);
  process.exit(1);
}
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith('--'));
const aiEraOnly = args.includes('--ai-era-only');
const write = args.includes('--write');
const forceVoice = args.includes('--force-voice');
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: npx tsx scripts/regenerate-combined-profile.ts <user@example.com> [--ai-era-only] [--write]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

type Cell = { lbl?: string; cap?: string; body?: string; aiNote?: string };
const aiCells = (p: unknown): Cell[] =>
  ((p as { aiEra?: { irreplaceable?: { cells?: Cell[] } } })?.aiEra?.irreplaceable?.cells) || [];
const firstLine = (s: unknown): string =>
  typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, 110) : '';

async function main() {
  // 1. Find the user.
  let userId: string | null = null;
  for (let page = 1; page <= 40; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 500 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === email!.toLowerCase());
    if (hit) { userId = hit.id; break; }
    if (data.users.length < 500) break;
  }
  if (!userId) { console.error(`No auth user found for ${email}`); process.exit(1); }
  console.log(`user_id: ${userId}`);

  // 2. Pull answers + existing combined row + name.
  const [ans, rep, prof] = await Promise.all([
    supabase.from('assessment_answers').select('slug,answers,completed_at').eq('user_id', userId),
    supabase.from('reports').select('scores,narrative,generated_at').eq('user_id', userId).eq('kind', 'combined').eq('slug', '').maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
  ]);
  if (ans.error) throw ans.error;

  const byslug = new Map((ans.data || []).map((r) => [r.slug, r.answers as AnswerSet]));
  const answers = {
    wiring: byslug.get('wiring'),
    orientation: byslug.get('orientation'),
    'rejection-gift': byslug.get('rejection-gift'),
  };
  const done = Object.entries(answers).filter(([, v]) => v && Object.keys(v as object).length > 0).map(([k]) => k);
  console.log(`stored answers for: ${done.join(', ') || 'NONE'}`);
  if (done.length === 0) { console.error('Nothing to generate from.'); process.exit(1); }

  const storedRow = rep.data;
  console.log(`existing combined report: ${storedRow ? `generated ${storedRow.generated_at}` : 'none'}`);
  if (aiEraOnly && !storedRow?.narrative) {
    console.error('--ai-era-only needs an existing combined report to splice into.');
    process.exit(1);
  }

  const name = prof.data?.full_name || email!.split('@')[0];
  console.log(`mode: ${aiEraOnly ? 'AI-ERA ONLY (all other prose untouched)' : 'FULL regeneration (every prose field re-rolls)'}`);
  console.log(`regenerating as "${name}"${write ? ' → WILL WRITE' : ' (dry run; pass --write to persist)'}\n`);

  // 3. Generate with current code.
  let res: GeneratedProfile;
  if (aiEraOnly) {
    res = await regenerateAiEraOnly(storedRow!.narrative as never, answers as never, name);
  } else {
    res = await generateCombinedProfile(answers as never, name);
  }
  console.log(`model label: ${res.model}  ← confirm this matches production's REPORT_MODEL`);
  console.log(`generated: ${res.generated}${res.warning ? ` · warning: ${res.warning}` : ''}`);
  console.log(`tokens: ${res.usage.promptTokens} in / ${res.usage.completionTokens} out`);
  if (res.debug) console.log(`debug: ${JSON.stringify(res.debug)}`);
  console.log(`signals: ${(res.profile.signals?.items || []).map((i) => `${i.name} ${i.pct}%`).join(' · ')}`);

  // 4. Show the fields the voice fix targets, old vs new.
  const oldCells = aiCells(storedRow?.narrative);
  const newCells = aiCells(res.profile);
  console.log('\nAI-era "irreplaceable" cells (the drifted fields), OLD → NEW:');
  for (let i = 0; i < Math.max(oldCells.length, newCells.length); i++) {
    const o = oldCells[i], n = newCells[i];
    console.log(`  [${i + 1}] ${n?.cap ?? o?.cap ?? '?'}`);
    if (o?.aiNote) console.log(`      old note: ${firstLine(o.aiNote)}`);
    if (n?.aiNote) console.log(`      new note: ${firstLine(n.aiNote)}`);
  }

  if (!res.generated) {
    console.error('\nGeneration did NOT produce model output (stored/fallback kept) — not writing.');
    process.exit(2);
  }
  // 4b. Voice check. Generation is nondeterministic, so eyeballing one sample says
  // nothing about the sample that actually persists. This is the drift Drew reported,
  // caught mechanically. In --ai-era-only we check ONLY the freshly written half:
  // the untouched stored prose is not ours to judge on this run.
  const subject = aiEraOnly ? (res.profile as { aiEra?: unknown }).aiEra : res.profile;
  const violations = checkVoice(subject);
  if (violations.length) {
    console.log(`\nVOICE CHECK: ${violations.length} violation${violations.length === 1 ? '' : 's'} in the generated copy`);
    console.log(formatViolations(violations));
    if (!forceVoice) {
      console.error('\nNot writing. Re-run to resample, or pass --force-voice to persist anyway.');
      process.exit(3);
    }
    console.log('\n--force-voice set: persisting despite the above.');
  } else {
    console.log('\nVOICE CHECK: clean.');
  }

  if (!write) {
    console.log('\nDry run complete. Re-run with --write to persist.');
    return;
  }

  // 5. BACKUP before overwriting a real person's report (no server-side undo).
  const backupPath = path.join(process.cwd(), '..', 'handoff',
    `backup-combined-report_${(email!).split('@')[0]}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({ user_id: userId, email, backed_up_at: new Date().toISOString(), row: storedRow ?? null }, null, 2));
  console.log(`\nbackup written: ${path.resolve(backupPath)}`);

  // 6. Persist over the existing row (PK user_id+kind+slug).
  const { error: upErr } = await supabase.from('reports').upsert({
    user_id: userId,
    kind: 'combined',
    slug: '',
    scores: res.scores,
    narrative: res.profile,
  });
  if (upErr) throw upErr;
  console.log('Written: reports(kind=combined) updated. Their next login pulls the new copy.');
  console.log('Tell them to fully close the app and reopen: an already-hydrated open tab can push the stale localStorage copy back over this row.');
}

main().catch((e) => { console.error(e); process.exit(1); });
