import { getAssessment } from './assessments';

// Deterministic scoring for the Clarity Layer assessments (Impact Readiness,
// Value Spectrum). Unlike the gift/wiring assessments (which tally archetype
// tags), these are numeric: each option carries a point value (0/3/7/10) stored
// in its tag. Sub-scores are 0-10, domains and the overall score are 0-100.

export type ClaritySub = { label: string; domain: string; points: number; aiEra: boolean };
export type ClarityDomain = { name: string; score: number; subs: ClaritySub[] };
export type ClarityBand = { key: string; label: string };
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

/** Five-band ladders, sourced from the Drive result reports. */
const CONFIG: Record<string, Cfg> = {
  'impact-readiness': {
    scoreName: 'Conviction Score',
    bands: [
      { key: 'insecure', label: 'Insecure', min: 0, max: 20 },
      { key: 'uncertain', label: 'Uncertain', min: 21, max: 40 },
      { key: 'discovering', label: 'Discovering', min: 41, max: 60 },
      { key: 'aligning', label: 'Aligning', min: 61, max: 80 },
      { key: 'convicted', label: 'Convicted', min: 81, max: 100 },
    ],
  },
  'value-spectrum': {
    scoreName: 'Value Score',
    bands: [
      { key: 'inferiority', label: 'Inferiority Complex', min: 0, max: 20 },
      { key: 'comparison', label: 'Comparison Loop', min: 21, max: 40 },
      { key: 'emerging', label: 'Emerging Worth', min: 41, max: 60 },
      { key: 'confident', label: 'Confident Value', min: 61, max: 80 },
      { key: 'rockstar', label: 'Authentic Rockstar', min: 81, max: 100 },
    ],
  },
};

export function isClaritySlug(slug: string): boolean {
  return slug in CONFIG;
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

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

  return {
    slug,
    title: assessment.title,
    scoreName: cfg.scoreName,
    overall,
    level: bandFor(cfg.bands, overall),
    ladder: cfg.bands.map((b) => ({ key: b.key, label: b.label })),
    domains,
    subs,
    aiEra,
    primaryGap,
    strengths,
    answered,
    total,
  };
}
