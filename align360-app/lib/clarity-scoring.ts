import { getAssessment } from './assessments';

// Deterministic scoring for the Clarity Layer assessments (Impact Readiness,
// Value Spectrum). Unlike the gift/wiring assessments (which tally archetype
// tags), these are numeric: each option carries a point value (0/3/7/10) stored
// in its tag. Sub-scores are 0-10, domains and the overall score are 0-100.

export type ClaritySub = { label: string; domain: string; points: number; aiEra: boolean };
export type ClarityDomain = { name: string; score: number; subs: ClaritySub[] };
export type ClarityBand = { key: string; label: string; goal?: boolean };
export type ClarityLevel = ClarityBand & { index: number };

export type ClarityScores = {
  slug: string;
  title: string;
  /** Name of the headline metric, e.g. "Conviction Score" / "Value Score". */
  scoreName: string;
  /** 0-100. */
  overall: number;
  level: ClarityLevel;
  /** Ordered low → high band ladder, for the progression strip. */
  ladder: ClarityBand[];
  /** Index of the current node within `ladder`. Decoupled from `level.index` so a
   *  ladder can be finer-grained than the score bands (e.g. Value Spectrum's 8 stages). */
  ladderNow: number;
  domains: ClarityDomain[];
  /** All sub-scores, flattened, in question order. */
  subs: ClaritySub[];
  /** Separate AI-Era readiness read (Impact Readiness only; null otherwise). */
  aiEra: { score: number; subs: ClaritySub[] } | null;
  /** Lowest sub-score — the precise gap worth attention. */
  primaryGap: ClaritySub | null;
  /** Sub-scores at the maximum (10) — fully developed signals. */
  strengths: ClaritySub[];
  answered: number;
  total: number;
};

type BandDef = { key: string; label: string; min: number; max: number };
type Cfg = { scoreName: string; bands: BandDef[] };

/**
 * Canonical stage ladders. Source: Samuel's "Stage Ladder Correction - Gap Memo"
 * and Knowledge Pack Bundle IR/VS/Currencies v1 CORRECTED (2026-08-28).
 *
 * There is deliberately ONE list per assessment. Every drift Drew reported
 * (2026-07-14 and again 2026-08-18) came from a score-band list and a separate
 * progression list carrying different names for the same position, then being
 * reconciled by proportional mapping. The bands ARE the ladder now, so the
 * headline and the progression strip are the same string by construction and
 * there is nothing left to keep in sync.
 *
 * Two substantive corrections came with the canonical set:
 *   - Impact Readiness has SIX stages, not five. "Clarity" was missing entirely,
 *     and "Impact at Scale" is a real reachable stage rather than a goal node
 *     nobody could land on.
 *   - Value Spectrum has EIGHT stages with their own ranges. The app previously
 *     ran five bands ("Comparison Loop", "Emerging Worth", "Confident Value")
 *     whose names appear nowhere in the canonical set, which is why three of the
 *     eight ladder stages were unreachable.
 */
const CONFIG: Record<string, Cfg> = {
  'impact-readiness': {
    scoreName: 'Conviction Score',
    bands: [
      { key: 'insecurity', label: 'Insecurity', min: 0, max: 39 },
      { key: 'awareness', label: 'Awareness', min: 40, max: 51 },
      { key: 'clarity', label: 'Clarity', min: 52, max: 63 },
      { key: 'alignment', label: 'Alignment', min: 64, max: 75 },
      { key: 'conviction', label: 'Conviction', min: 76, max: 87 },
      { key: 'impact', label: 'Impact at Scale', min: 88, max: 100 },
    ],
  },
  'value-spectrum': {
    scoreName: 'Value Score',
    bands: [
      { key: 'inferiority', label: 'Inferiority Complex', min: 0, max: 12 },
      { key: 'impostor', label: 'Impostor Pattern', min: 13, max: 25 },
      { key: 'perceiving', label: 'Value Perceiving', min: 26, max: 40 },
      { key: 'aware', label: 'Value Aware', min: 41, max: 55 },
      { key: 'aligned', label: 'Value Aligned', min: 56, max: 70 },
      { key: 'identity', label: 'Identity Aligned', min: 71, max: 82 },
      { key: 'authentic', label: 'Authentic', min: 83, max: 90 },
      { key: 'rockstar', label: 'Authentic Rockstar', min: 91, max: 100 },
    ],
  },
};

export function isClaritySlug(slug: string): boolean {
  return slug in CONFIG;
}

// Half-to-even rounding (banker's), clamped to 0-100. Matches Samuel's canonical
// Impact Readiness tiles, where 92.5 renders as 92 but 77.5 renders as 78; plain
// round-half-up would show 93/93/93 and break measurement parity with his standard.
const clamp100 = (n: number) => {
  const x = Math.min(100, Math.max(0, n));
  const scaled = Math.round(x * 1e6) / 1e6; // strip float dust (e.g. 92.50000000000001)
  const floor = Math.floor(scaled);
  if (Math.abs(scaled - floor - 0.5) < 1e-9) return floor % 2 === 0 ? floor : floor + 1;
  return Math.round(scaled);
};

function bandFor(bands: BandDef[], score: number): ClarityLevel {
  const i = bands.findIndex((b) => score >= b.min && score <= b.max);
  // Out-of-range falls to the correct end: below the floor → lowest band, above → highest.
  const idx = i >= 0 ? i : score < bands[0].min ? 0 : bands.length - 1;
  return { key: bands[idx].key, label: bands[idx].label, index: idx };
}

/**
 * Score a single Clarity Layer assessment from its answers ({questionId: letter}).
 * Returns null for an unknown/unscored slug.
 */
export function computeClarityScores(slug: string, answers: Record<string, string>): ClarityScores | null {
  const cfg = CONFIG[slug];
  const assessment = getAssessment(slug);
  if (!cfg || !assessment) return null;

  const domains: ClarityDomain[] = [];
  const subs: ClaritySub[] = [];
  let answered = 0;
  let total = 0;

  for (const section of assessment.sections) {
    const dSubs: ClaritySub[] = [];
    for (const q of section.questions) {
      total++;
      const letter = answers[q.id];
      const opt = q.options.find((o) => o.letter === letter);
      // Unanswered questions score 0 (the floor), so the overall stays 0-100.
      const points = opt ? parseInt(opt.giftTag ?? '0', 10) || 0 : 0;
      if (opt) answered++;
      const sub: ClaritySub = {
        label: q.label || `Q${q.number}`,
        domain: section.name,
        points,
        aiEra: /ai[\s\-/]*era/i.test(q.label),
      };
      dSubs.push(sub);
      subs.push(sub);
    }
    const domainScore = dSubs.length
      ? clamp100((dSubs.reduce((n, s) => n + s.points, 0) / (dSubs.length * 10)) * 100)
      : 0;
    domains.push({ name: section.name, score: domainScore, subs: dSubs });
  }

  const overall = subs.length
    ? clamp100((subs.reduce((n, s) => n + s.points, 0) / (subs.length * 10)) * 100)
    : 0;

  const aiEraSubs = subs.filter((s) => s.aiEra);
  const aiEra = aiEraSubs.length
    ? { score: clamp100((aiEraSubs.reduce((n, s) => n + s.points, 0) / (aiEraSubs.length * 10)) * 100), subs: aiEraSubs }
    : null;

  // Primary gap = lowest sub-score (first in question order on a tie).
  const primaryGap = subs.length
    ? subs.reduce((lo, s) => (s.points < lo.points ? s : lo), subs[0])
    : null;
  const strengths = subs.filter((s) => s.points >= 10);

  const band = bandFor(cfg.bands, overall);
  // One list: the ladder is the bands. Nothing to reconcile.
  const ladder: ClarityBand[] = cfg.bands.map((b) => ({ key: b.key, label: b.label }));
  const ladderNow = band.index;

  // The headline level takes its LABEL from the ladder node the marker sits on,
  // keeping the band's key and index for scoring.
  //
  // The 2026-07-14 fix synced the ladder POSITION to the band but left the two
  // label sets independent, so a report could place the marker on "Identity
  // Aligned" while the headline read "Confident Value" (Drew, 2026-08-18: same
  // defect on Impact Readiness, "Discovering" vs "Clarity"). Deriving the label
  // from `ladder[ladderNow]` means the headline and the strip are now the same
  // string by construction and cannot drift again.
  //
  // This also reaches the narrative: `level.label` is what lib/clarity.ts and
  // the report generator hand to the model, so the written prose was describing
  // the band name while the user was looking at the ladder name.
  const level: ClarityLevel = { ...band, label: ladder[ladderNow]?.label ?? band.label };

  return {
    slug,
    title: assessment.title,
    scoreName: cfg.scoreName,
    overall,
    level,
    ladder,
    ladderNow,
    domains,
    subs,
    aiEra,
    primaryGap,
    strengths,
    answered,
    total,
  };
}
