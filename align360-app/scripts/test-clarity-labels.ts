/**
 * Invariant check for the Clarity Layer headline/ladder label fix.
 *   npx tsx scripts/test-clarity-labels.ts
 *
 * Drew reported (2026-07-14 and again 2026-08-18) that the headline tier and the
 * progression strip printed different words for the same position: Value Spectrum
 * showed "Confident Value" over a marker sitting on "Identity Aligned", Impact
 * Readiness showed "Discovering" over "Clarity".
 *
 * The invariant that makes that impossible: the headline label must always be the
 * label of the ladder node the marker is on. This sweeps every reachable score by
 * varying the answer point values and asserts it holds everywhere, not just at the
 * two scores that happened to be in the screenshots.
 */
import { getAssessment } from '../lib/assessments';
import { computeClarityScores } from '../lib/clarity-scoring';

const SLUGS = ['impact-readiness', 'value-spectrum'];
const POINTS = [0, 3, 7, 10];

let checked = 0;
let failures = 0;
const seen = new Map<string, Set<string>>();

for (const slug of SLUGS) {
  const a = getAssessment(slug);
  if (!a) { console.log(`  SKIP ${slug} (assessment not found)`); continue; }
  const questions = a.sections.flatMap((s) => s.questions);
  seen.set(slug, new Set());

  // Sweep: give the first `k` questions a high value and the rest a low one, for
  // every (low, high) pair. That walks the overall score across its whole range.
  for (const lo of POINTS) {
    for (const hi of POINTS) {
      for (let k = 0; k <= questions.length; k++) {
        const answers: Record<string, string> = {};
        questions.forEach((q, i) => {
          const want = String(i < k ? hi : lo);
          const opt = q.options.find((o) => (o.giftTag ?? '0') === want) ?? q.options[0];
          answers[q.id] = opt.letter;
        });

        const s = computeClarityScores(slug, answers);
        if (!s) { console.log(`  FAIL ${slug}: computeClarityScores returned null`); failures++; continue; }

        checked++;
        seen.get(slug)!.add(s.level.label);

        const nodeLabel = s.ladder[s.ladderNow]?.label;
        if (s.level.label !== nodeLabel) {
          console.log(`  FAIL ${slug} score=${s.overall}: headline "${s.level.label}" vs ladder node "${nodeLabel}"`);
          failures++;
        }
        if (s.ladderNow < 0 || s.ladderNow >= s.ladder.length) {
          console.log(`  FAIL ${slug} score=${s.overall}: ladderNow ${s.ladderNow} out of range 0..${s.ladder.length - 1}`);
          failures++;
        }
        // Impact Readiness' last node is a goal beyond the top band; nobody should land on it.
        if (s.ladder[s.ladderNow]?.goal) {
          console.log(`  FAIL ${slug} score=${s.overall}: marker landed on the goal node "${nodeLabel}"`);
          failures++;
        }
      }
    }
  }
}

console.log(`\nchecked ${checked} score combinations across ${SLUGS.length} assessments`);
for (const [slug, labels] of seen) {
  console.log(`  ${slug} reachable headline labels: ${[...labels].join(', ')}`);
}
console.log(failures ? `\n${failures} FAILED\n` : '\nheadline always matches the ladder node\n');
process.exit(failures ? 1 : 0);
