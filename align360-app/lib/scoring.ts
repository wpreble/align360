import { getAssessment } from './assessments';

export const WIRING_GIFTS = [
  'Realist',
  'Supporter',
  'Doer',
  'Organizer',
  'Explainer',
  'Integrator',
  'Enterpriser',
  'Encourager',
  'Wise Observer',
] as const;

export type Tally = { tag: string; score: number; pct: number };

/** Per-assessment answers: { questionId: optionLetter }. */
export type AnswerSet = Record<string, string>;

/**
 * Tally gift tags from a set of answers against an assessment's question bank.
 * Compound tags ("Realist/Explainer") split; first part weighted 1.0, extras 0.6.
 */
function tallyTags(slug: string, answers: AnswerSet): Record<string, number> {
  const assessment = getAssessment(slug);
  const counts: Record<string, number> = {};
  if (!assessment) return counts;

  const byId = new Map<string, { options: { letter: string; giftTag?: string }[] }>();
  for (const s of assessment.sections) for (const q of s.questions) byId.set(q.id, q);

  for (const [qid, letter] of Object.entries(answers)) {
    const q = byId.get(qid);
    if (!q) continue;
    const opt = q.options.find((o) => o.letter === letter);
    if (!opt?.giftTag) continue;
    const parts = opt.giftTag.split('/').map((p) => p.trim()).filter(Boolean);
    parts.forEach((p, i) => {
      counts[p] = (counts[p] || 0) + (i === 0 ? 1 : 0.6);
    });
  }
  return counts;
}

function rank(counts: Record<string, number>, topPct = 88): Tally[] {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] || 1;
  return entries.map(([tag, score]) => ({
    tag,
    score,
    pct: Math.max(8, Math.round((score / max) * topPct)),
  }));
}

export type Scores = {
  wiring: { ranked: Tally[]; primary?: string; secondary?: string; allNine: Tally[] };
  orientation: { ranked: Tally[]; primary?: string; secondary?: string };
  rejectionGift: { ranked: Tally[]; primary?: string };
  completed: { wiring: boolean; orientation: boolean; rejectionGift: boolean };
};

export function computeScores(answers: {
  wiring?: AnswerSet;
  orientation?: AnswerSet;
  'rejection-gift'?: AnswerSet;
}): Scores {
  const wCounts = answers.wiring ? tallyTags('wiring', answers.wiring) : {};
  const oCounts = answers.orientation ? tallyTags('orientation', answers.orientation) : {};
  const rCounts = answers['rejection-gift'] ? tallyTags('rejection-gift', answers['rejection-gift']) : {};

  const wRanked = rank(wCounts);
  const oRanked = rank(oCounts);
  const rRanked = rank(rCounts);

  // All nine wiring gifts, ranked, with zeros filled in for unseen gifts.
  const wMap = new Map(wRanked.map((t) => [t.tag, t]));
  const allNine: Tally[] = [...WIRING_GIFTS]
    .map((g) => wMap.get(g) || { tag: g, score: 0, pct: 8 })
    .sort((a, b) => b.pct - a.pct);

  return {
    wiring: { ranked: wRanked, primary: wRanked[0]?.tag, secondary: wRanked[1]?.tag, allNine },
    orientation: { ranked: oRanked, primary: oRanked[0]?.tag, secondary: oRanked[1]?.tag },
    rejectionGift: { ranked: rRanked, primary: rRanked[0]?.tag },
    completed: {
      wiring: Object.keys(wCounts).length > 0,
      orientation: Object.keys(oCounts).length > 0,
      rejectionGift: Object.keys(rCounts).length > 0,
    },
  };
}
