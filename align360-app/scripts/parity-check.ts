/**
 * Measurement-parity check for the canonical scoring rubric (locked 2026-07-02,
 * approved by Samuel). The fixture is Samuel's own answer set from his original
 * Claude session. If any engine change makes identical answers produce different
 * measurements, this fails loudly.
 *
 * Rubric under test:
 *   - Wiring strength scale: leader = 78, floor 8 (Samuel's canonical scale)
 *   - Compound tags: first gift 1.0, secondary 0.5 (governance doc: 50%)
 *   - Confidence bands: Blended Primary at gap <= 5, Clear Primary at gap >= 7
 *   - Rejection story archetype: derived from the film-narrative-arc answer
 *   - Clarity rounding: half-to-even (92.5 -> 92, 77.5 -> 78)
 *
 * Run:  npx tsx scripts/parity-check.ts   (from align360-app/)
 */
import { scoreAssessment } from '../lib/report-scoring';
import { computeScores } from '../lib/scoring';
import { computeClarityScores } from '../lib/clarity-scoring';

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) console.log(`  ok  ${name} = ${e}`);
  else {
    console.error(`  FAIL ${name}: expected ${e}, got ${a}`);
    failures++;
  }
}

/* ── Samuel's answers (from his original Claude session) ── */
const WIRING = { q1: 'C', q2: 'A', q3: 'E', q4: 'A', q5: 'B', q6: 'C', q7: 'D', q8: 'E', q9: 'B', q10: 'B', q11: 'A', q12: 'C', q13: 'A', q14: 'C', q15: 'B' };
const ORIENTATION = { q1: 'A', q2: 'D', q3: 'D', q4: 'B', q5: 'E', q6: 'A', q7: 'D', q8: 'E', q9: 'A', q10: 'A', q11: 'E', q12: 'A' };
const REJECTION = { q1: 'C', q2: 'A', q3: 'A', q4: 'E', q5: 'A', q6: 'A', q7: 'E', q8: 'E', q9: 'E', q10: 'E', q11: 'C', q12: 'D' };
const IMPACT_READINESS = { q1: 'C', q2: 'D', q3: 'D', q4: 'D', q5: 'C', q6: 'B', q7: 'D', q8: 'D', q9: 'D', q10: 'C', q11: 'D', q12: 'D', q13: 'C', q14: 'C', q15: 'C', q16: 'D', q17: 'C', q18: 'D', q19: 'D', q20: 'D' };
const VALUE_SPECTRUM = { q1: 'D', q2: 'D', q3: 'C', q4: 'D', q5: 'C', q6: 'D', q7: 'C', q8: 'D', q9: 'D', q10: 'D', q11: 'C', q12: 'D', q13: 'D', q14: 'D', q15: 'D' };

const pctMap = (list: { tag: string; pct: number }[]) => Object.fromEntries(list.map((t) => [t.tag, t.pct]));

console.log('== Wiring for Impact ==');
const w = scoreAssessment('wiring', WIRING);
if (!w || w.kind !== 'wiring') throw new Error('wiring scoring failed');
check('primary', w.primary, 'Realist');
check('primaryPct (canonical leader scale)', w.primaryPct, 78);
check('confidence', w.confidence, 'Clear Primary');
check('gift pcts', pctMap(w.gifts), {
  Realist: 78, Doer: 59, Organizer: 59, Supporter: 39, Explainer: 39,
  'Wise Observer': 29, Encourager: 20, Integrator: 8, Enterpriser: 8,
});
// NOTE: Doer/Organizer tie at 59 — secondary NAME is not asserted (tie-break
// rule is still an open decision); both engines must agree on the numbers.
const wc = computeScores({ wiring: WIRING }).wiring;
check('combined-profile engine agrees (per-gift pcts)', pctMap(wc.allNine), pctMap(w.gifts));

console.log('== Orientation for Impact ==');
const o = scoreAssessment('orientation', ORIENTATION);
if (!o || o.kind !== 'orientation') throw new Error('orientation scoring failed');
check('primary', o.primary, 'Builder');
check('orientation pcts', pctMap(o.orientations), { Builder: 42, 'Truth-Seeker': 38, Explainer: 12, Supporter: 8, Starter: 0 });
check('blended (gap <= 5)', o.blended, true);
check('confidence', o.confidence, 'Blended Primary');

console.log('== Rejection Gift Finder ==');
const r = scoreAssessment('rejection-gift', REJECTION);
if (!r || r.kind !== 'rejection-gift') throw new Error('rejection scoring failed');
check('primary', r.primary, 'Perspective');
check('category pcts', pctMap(r.categories), { Perspective: 44, Insight: 24, Creativity: 24, Resilience: 8, Empathy: 0 });
check('signature trait', r.signatureTrait, 'Paradigm Challenger');
check('story archetype (from film-arc answer)', r.storyArchetypeHint, 'The Misunderstood Visionary');

console.log('== Impact Readiness (Conviction Score) ==');
const ir = computeClarityScores('impact-readiness', IMPACT_READINESS);
if (!ir) throw new Error('IR scoring failed');
check('overall', ir.overall, 86);
check('level', ir.level.label, 'Convicted');
check('domain scores (sorted)', ir.domains.map((d) => d.score).sort((a, b) => a - b), [75, 78, 92, 92, 92]);
check('primary gap', { label: ir.primaryGap?.label, points: ir.primaryGap?.points }, { label: 'Release Threshold', points: 3 });
check('AI-Era composite', ir.aiEra?.score, 94);

console.log('== Value Spectrum (Value Score) ==');
const vs = computeClarityScores('value-spectrum', VALUE_SPECTRUM);
if (!vs) throw new Error('VS scoring failed');
check('overall', vs.overall, 92);
check('level', vs.level.label, 'Authentic Rockstar');
check('domain scores (sorted)', vs.domains.map((d) => d.score).sort((a, b) => a - b), [90, 90, 90, 90, 100]);
check('aiEra is null for VS', vs.aiEra, null);

if (failures) {
  console.error(`\nPARITY FAILED: ${failures} mismatch(es). Identical answers no longer produce the canonical measurements.`);
  process.exit(1);
}
console.log('\nPARITY OK: all five assessments reproduce the canonical measurements.');
