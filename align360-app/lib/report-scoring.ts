import { getAssessment } from './assessments';
import { WIRING_GIFTS } from './scoring';

// Deterministic scoring for the three CORE assessments' individual reports
// (Wiring for Impact, Orientation for Impact, Rejection Gift Finder). Unlike the
// Clarity Layer (numeric 0-100 per option), these tally archetype TAGS from the
// chosen options and rank them. Each report has its own shape:
//   - Wiring:     9 gifts, strength-scaled (top ≈ 78, Samuel's canonical scale)
//   - Orientation: 5 orientations, share-of-total scaled (sums ≈ 100)
//   - Rejection:  5 gift CATEGORIES (share-scaled) + a dominant SIGNATURE TRAIT
// Tags are read from each option's `→ Tag` annotation (parsed in lib/assessments).

export const REPORT_SLUGS = ['wiring', 'orientation', 'rejection-gift'] as const;
export type ReportSlug = (typeof REPORT_SLUGS)[number];

export const ORIENTATIONS = ['Truth-Seeker', 'Builder', 'Explainer', 'Supporter', 'Starter'] as const;
export const REJECTION_CATEGORIES = ['Perspective', 'Insight', 'Creativity', 'Resilience', 'Empathy'] as const;

export function isReportSlug(slug: string): slug is ReportSlug {
  return (REPORT_SLUGS as readonly string[]).includes(slug);
}

export type Tally = { tag: string; score: number; pct: number; dim: boolean };

/** A chosen answer with its parsed (colon-free) tags, kept for the AI narrative. */
export type Chosen = { qid: string; section: string; label: string; text: string; tags: string[] };

function chosenOptions(slug: string, answers: Record<string, string>): Chosen[] {
  const a = getAssessment(slug);
  if (!a) return [];
  const byId = new Map<string, { label: string; section: string; options: { letter: string; text: string; giftTag?: string }[] }>();
  for (const s of a.sections) for (const q of s.questions) byId.set(q.id, { label: q.label, section: s.name, options: q.options });
  const out: Chosen[] = [];
  for (const [qid, letter] of Object.entries(answers)) {
    const q = byId.get(qid);
    if (!q) continue;
    const opt = q.options.find((o) => o.letter === letter);
    if (!opt) continue;
    // Canonical tags never contain ':' (those are diagnostic metadata), so drop them.
    const tags = (opt.giftTag || '').split('/').map((t) => t.trim()).filter((t) => t && !t.includes(':'));
    out.push({ qid, section: q.section, label: q.label, text: opt.text, tags });
  }
  return out;
}

/** Weighted tally of tags, optionally restricted to a universe. First tag 1.0,
 *  extras 0.5 (the governance doc's rule: secondary gift gets 50% of points;
 *  changed from 0.6 on 2026-07-02, approved by Samuel). Keep in sync with
 *  lib/scoring.ts tallyTags. */
function tally(chosen: Chosen[], universe?: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of chosen) {
    c.tags.forEach((t, i) => {
      if (universe && !universe.includes(t)) return;
      counts[t] = (counts[t] || 0) + (i === 0 ? 1 : 0.5);
    });
  }
  return counts;
}

/** Strength scale: leader ≈ 78, floor 8 so every bar is visible. Used for Wiring.
 *  78 is Samuel's canonical measurement scale (his WFI standard shows the top
 *  gift at 78%); changed from 88 on 2026-07-02 per Will. Keep in sync with the
 *  same constant in lib/scoring.ts (combined profile) so surfaces agree. */
function rankStrength(counts: Record<string, number>, universe: readonly string[]): Tally[] {
  const max = Math.max(1, ...universe.map((t) => counts[t] || 0));
  return universe
    .map((tag) => {
      const score = counts[tag] || 0;
      const pct = score ? Math.max(8, Math.round((score / max) * 78)) : 8;
      return { tag, score, pct, dim: false };
    })
    .sort((a, b) => b.score - a.score)
    // 44 keeps the same relative dim cutoff the old 50 had on the 88 scale.
    .map((t, i) => ({ ...t, dim: i > 1 && t.pct < 44 }));
}

/** Share scale: each tag as a % of total tag weight (sums ≈ 100). Orientation + Rejection. */
function rankShare(counts: Record<string, number>, universe: readonly string[]): Tally[] {
  const total = universe.reduce((n, t) => n + (counts[t] || 0), 0) || 1;
  return universe
    .map((tag) => {
      const score = counts[tag] || 0;
      return { tag, score, pct: Math.round((score / total) * 100), dim: false };
    })
    .sort((a, b) => b.score - a.score)
    .map((t, i) => ({ ...t, dim: i > 1 && t.pct < 15 }));
}

// Governance-doc confidence bands (approved by Samuel 2026-07-02): blended when
// the top two are within 5 points, clear primary at a 7+ point gap. The low-signal
// Emerging floor is kept as a guard for scattered share-scale results.
function confidenceBand(ranked: Tally[]): string {
  const top = ranked[0]?.pct ?? 0;
  const gap = top - (ranked[1]?.pct ?? 0);
  if (top < 24) return 'Emerging';
  if (gap <= 5) return 'Blended Primary';
  if (gap >= 7) return 'Clear Primary';
  return 'Clear';
}

function counts2(slug: string, answers: Record<string, string>) {
  const a = getAssessment(slug);
  const total = a ? a.sections.reduce((n, s) => n + s.questions.length, 0) : 0;
  const answered = Object.keys(answers || {}).length;
  return { total, answered };
}

/* ── Score shapes (discriminated by `kind`) ─────────────────────────────────── */

export type WiringScores = {
  kind: 'wiring';
  slug: 'wiring';
  title: string;
  gifts: Tally[]; // all 9, ranked
  primary: string;
  primaryPct: number;
  secondary: string;
  secondaryPct: number;
  confidence: string;
  answered: number;
  total: number;
};

export type OrientationScores = {
  kind: 'orientation';
  slug: 'orientation';
  title: string;
  orientations: Tally[]; // all 5, ranked
  primary: string;
  primaryPct: number;
  secondary: string;
  secondaryPct: number;
  blended: boolean; // top two within 8 points
  confidence: string;
  answered: number;
  total: number;
};

export type RejectionScores = {
  kind: 'rejection-gift';
  slug: 'rejection-gift';
  title: string;
  categories: Tally[]; // all 5, ranked
  primary: string;
  primaryPct: number;
  signatureTrait: string;
  storyArchetypeHint: string;
  confidence: string;
  answered: number;
  total: number;
};

export type ReportScores = WiringScores | OrientationScores | RejectionScores;

const ARCHETYPE_BY_CATEGORY: Record<string, string> = {
  Perspective: 'The Outsider Who Was Right',
  Insight: 'The Truth-Teller Who Saw First',
  Creativity: 'The Misunderstood Visionary',
  Resilience: 'The One Who Kept Rising',
  Empathy: 'The Wounded Healer',
};

export function scoreAssessment(slug: string, answers: Record<string, string>): ReportScores | null {
  if (!isReportSlug(slug)) return null;
  const a = getAssessment(slug);
  if (!a) return null;
  const chosen = chosenOptions(slug, answers);
  const { total, answered } = counts2(slug, answers);

  if (slug === 'wiring') {
    const gifts = rankStrength(tally(chosen, WIRING_GIFTS), WIRING_GIFTS);
    return {
      kind: 'wiring',
      slug: 'wiring',
      title: a.title,
      gifts,
      primary: gifts[0]?.tag || 'Organizer',
      primaryPct: gifts[0]?.pct || 0,
      secondary: gifts[1]?.tag || 'Realist',
      secondaryPct: gifts[1]?.pct || 0,
      confidence: confidenceBand(gifts),
      answered,
      total,
    };
  }

  if (slug === 'orientation') {
    const orientations = rankShare(tally(chosen, ORIENTATIONS), ORIENTATIONS);
    const gap = (orientations[0]?.pct ?? 0) - (orientations[1]?.pct ?? 0);
    return {
      kind: 'orientation',
      slug: 'orientation',
      title: a.title,
      orientations,
      primary: orientations[0]?.tag || 'Truth-Seeker',
      primaryPct: orientations[0]?.pct || 0,
      secondary: orientations[1]?.tag || 'Builder',
      secondaryPct: orientations[1]?.pct || 0,
      blended: gap <= 5, // governance-doc blended rule (was 8)
      confidence: confidenceBand(orientations),
      answered,
      total,
    };
  }

  // rejection-gift
  const categories = rankShare(tally(chosen, REJECTION_CATEGORIES), REJECTION_CATEGORIES);
  // Signature traits = tag parts that are NOT one of the five categories.
  const traitCounts: Record<string, number> = {};
  for (const c of chosen)
    c.tags.forEach((t, i) => {
      if ((REJECTION_CATEGORIES as readonly string[]).includes(t)) return;
      if (!WIRING_GIFTS.includes(t as (typeof WIRING_GIFTS)[number])) traitCounts[t] = (traitCounts[t] || 0) + (i === 0 ? 1 : 0.5);
    });
  const signatureTrait = Object.entries(traitCounts).sort((a2, b2) => b2[1] - a2[1])[0]?.[0] || 'Paradigm Challenger';
  const primary = categories[0]?.tag || 'Perspective';
  // Story archetype comes from the user's OWN film-narrative-arc answer (its
  // category tag), not from the overall primary category. Approved by Samuel
  // 2026-07-02: his Perspective-primary result carries "The Misunderstood
  // Visionary" because his film-arc answer was the Creativity option. Falls back
  // to the overall-primary mapping when that question is unanswered.
  const filmArc = chosen.find((c) => /film|narrative arc/i.test(c.label)) || chosen.find((c) => c.qid === 'q11');
  const archetypeKey = filmArc?.tags.find((t) => (REJECTION_CATEGORIES as readonly string[]).includes(t)) || primary;
  return {
    kind: 'rejection-gift',
    slug: 'rejection-gift',
    title: a.title,
    categories,
    primary,
    primaryPct: categories[0]?.pct || 0,
    signatureTrait,
    storyArchetypeHint: ARCHETYPE_BY_CATEGORY[archetypeKey] || 'The Misunderstood Visionary',
    confidence: confidenceBand(categories),
    answered,
    total,
  };
}

/** Render the chosen-option text for each answered question, for the model prompt. */
export function answersNarrative(slug: string, answers: Record<string, string>): string {
  return chosenOptions(slug, answers)
    .map((c) => `- ${c.label} [${c.section}]: chose "${c.text}"${c.tags.length ? ` (→ ${c.tags.join(', ')})` : ''}`)
    .join('\n');
}
