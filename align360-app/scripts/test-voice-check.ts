/**
 * Fixtures for lib/voice-check.ts:  npx tsx scripts/test-voice-check.ts
 *
 * The BAD cases are the actual strings from Drew's 2026-07-10 report, which is
 * the drift he reported. The GOOD cases are the replacements the fixed prompt
 * produced on 2026-08-23. If the checker cannot tell these two sets apart it is
 * not doing its job.
 */
import { checkVoice, formatViolations } from '../lib/voice-check';
import { fallbackProfile } from '../lib/profile';
import { computeScores } from '../lib/scoring';
import { getAssessment } from '../lib/assessments';

const BAD_AI_ERA = {
  irreplaceable: { cells: [
    { cap: 'reading a room', aiNote: 'AI needs lag time and structured input; your reading is immediate and ambient.' },
    { cap: 'quiet depth', aiNote: 'AI can simulate empathy but cannot create the felt safety of human presence.' },
    { cap: 'advocating', aiNote: 'AI optimizes within existing frames; you break and rebuild the frame itself.' },
    { cap: 'translating pain', aiNote: 'AI optimizes for aggregate outcomes; you protect the individual within the system.' },
  ] },
};

const GOOD_AI_ERA = {
  irreplaceable: { cells: [
    { cap: 'reading a room', aiNote: "The shift in a room's energy after someone feels heard is something you perceive by being there." },
    { cap: 'quiet depth', aiNote: 'Tools generate answers fast, but sitting with a problem until the right question emerges is a practice you have built.' },
    { cap: 'advocating', aiNote: 'Deciding whose interests matter when they conflict with efficiency is a judgment that requires a person willing to be accountable.' },
    { cap: 'translating pain', aiNote: 'Perspective earned through lived rejection carries a weight that no synthesized output can borrow.' },
  ] },
};

const CASES: { name: string; value: unknown; expect: 'violations' | 'clean'; rule?: string }[] = [
  { name: "Drew's original AI-Era cells", value: BAD_AI_ERA, expect: 'violations', rule: 'ai-cannot-construction' },
  { name: 'Regenerated AI-Era cells (2026-08-23)', value: GOOD_AI_ERA, expect: 'clean' },
  { name: 'banned word: amplify', value: { a: 'This is where AI genuinely amplifies the work that you already do well.' }, expect: 'violations', rule: 'banned-word:amplifies' },
  { name: 'banned word: moat', value: { a: 'Your judgment here is the moat that protects the rest of your career.' }, expect: 'violations', rule: 'banned-word:moat' },
  { name: 'em dash', value: { a: 'You read people quickly — and that is the whole advantage right there.' }, expect: 'violations', rule: 'long-dash' },
  { name: 'repeated openers', value: { c: [
      { b: 'Your instinct for timing is unusually well developed here.' },
      { b: 'Your patience under pressure shows up in every one of these answers.' },
      { b: 'Your read on other people is the strongest signal in this profile.' },
    ] }, expect: 'violations', rule: 'repeated-opener' },
  { name: 'short labels are not prose', value: { a: 'Impact Readiness', b: 'Value Aware' }, expect: 'clean' },
];

let failures = 0;

/* ── The deterministic fallback is user-facing prose too ────────────────────
 * It shipped with ONE irreplaceable cell while `.irr-grid` is a two-column
 * grid and the schema asks the model for four, so anyone who hit the fallback
 * saw an empty panel (Drew, 2026-08-25). It also carried the exact "moat" /
 * "AI cannot" phrasing the VOICE block bans. Nothing checked it, because the
 * fallback is the path nobody looks at until a user lands on it.
 */
function fallbackChecks() {
  const answers: Record<string, Record<string, string>> = {};
  for (const slug of ['wiring', 'orientation', 'rejection-gift']) {
    const a = getAssessment(slug);
    if (!a) continue;
    const picked: Record<string, string> = {};
    a.sections.flatMap((s) => s.questions).forEach((q, i) => {
      picked[q.id] = q.options[i % q.options.length].letter;
    });
    answers[slug] = picked;
  }
  const scores = computeScores(answers as never);
  const fb = fallbackProfile(scores, 'Test User');

  const cells = fb.aiEra?.irreplaceable?.cells ?? [];
  const cellsOk = cells.length === 4;
  console.log(`${cellsOk ? 'PASS' : 'FAIL'}  fallback has 4 irreplaceable cells (got ${cells.length})`);
  if (!cellsOk) failures++;

  const incomplete = cells.filter((c) => !c.cap || !c.body || !c.aiNote || !c.lbl);
  console.log(`${incomplete.length ? 'FAIL' : 'PASS'}  every fallback cell is fully populated`);
  if (incomplete.length) failures++;

  const v = checkVoice(fb);
  console.log(`${v.length ? 'FAIL' : 'PASS'}  fallback prose passes the voice rules (${v.length} violation${v.length === 1 ? '' : 's'})`);
  if (v.length) { console.log(formatViolations(v)); failures++; }
}
fallbackChecks();
console.log('');

for (const c of CASES) {
  const v = checkVoice(c.value);
  const got = v.length ? 'violations' : 'clean';
  const ruleOk = !c.rule || v.some((x) => x.rule === c.rule);
  const pass = got === c.expect && ruleOk;
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${c.name}  (${v.length} violation${v.length === 1 ? '' : 's'})`);
  if (!pass) {
    console.log(`      expected ${c.expect}${c.rule ? ` incl. "${c.rule}"` : ''}, got ${got} [${v.map((x) => x.rule).join(', ')}]`);
  }
  if (v.length && c.expect === 'violations') console.log(formatViolations(v.slice(0, 2)));
}

console.log(failures ? `\n${failures} FAILED\n` : '\nvoice checker separates the drifted copy from the fixed copy\n');
process.exit(failures ? 1 : 0);
