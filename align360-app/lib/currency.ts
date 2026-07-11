import type { Scores, Tally } from './scoring';
import { WIRING_GIFTS } from './scoring';

/**
 * Deterministic True-Currencies™ scoring — CANONICAL v2.
 *
 * Source of truth: Samuel's "Knowledge Pack Bundle Addendum v1.1", Section 3.8
 * (the True Currencies Scoring Map, written for Will) + Governance v2.0 §5.2
 * (the eight canonical currencies). Supersedes the v1 gift->currency draft
 * (which had Favor/Money and no Courage/Creativity/Service).
 *
 * The AI writes the interpretive words; this math sets the numbers — same lock
 * the gift signals use. Currencies derive from Wiring + Orientation + Rejection
 * Gift only (NOT Value Spectrum, NOT the daily check-in). Stable, not daily.
 *
 * NAME RECONCILIATION (Samuel approved 2026-07-11: "let your agent do the job for
 * now" = keep the app's current wiring/orientation type names and map them onto
 * his scoring map, rather than migrating the app's taxonomy). The addendum keys
 * off his canonical type names; the app runs its own set. Mapping used below:
 *   Wiring   canonical -> app:
 *     Realist->Realist, Organizer->Organizer, Supporter/Shepherd->Supporter,
 *     Encourager/Connector->Encourager, Analyst/Researcher->Wise Observer,
 *     Driver/Executor->Doer, Pioneer/Visionary->Enterpriser,
 *     Creator/Innovator->Integrator (synthesis: "original architectures from
 *       existing elements") + Enterpriser (visionary).  [judgment call]
 *     App "Explainer" (clarity/communication of truth) -> feeds Knowledge/Honor. [judgment call]
 *   Orientation canonical -> app (app has only 5):
 *     Truth-Seeker->Truth-Seeker, Systems-Builder->Builder, People/Service/
 *     Empathy-First->Supporter, Creative/Generative->Starter,
 *     Justice/Standards->Truth-Seeker (proxy; app has no justice type).
 *   Rejection: the addendum's primary currency inputs (Conviction, Courage, and
 *     secondary Honor) key off the "resilience score"; the app's closest signal
 *     is the Rejection Gift "Resilience" category strength, used here.
 * The two [judgment call] links (Explainer, Integrator/Creator) are the only
 * ambiguous ones — flagged to Samuel, easy to retune here.
 *
 * CALIBRATION NOTE: structure + ordering follow the addendum exactly; absolute
 * magnitudes ride the app's existing pct scales (wiring leader ~78, orientation
 * ~88), so a strong primary currency lands in the ~70-85 band rather than
 * Samuel's exemplar ~92. Matching his exact magnitudes needs his normalization
 * constants (a tunable follow-up); the number that governs the words is stable
 * and correctly ranked, which is what fixes the flipping.
 */

// Canonical order (Gov v2 §5.2). Renderer sorts by pct, so order is cosmetic.
export const CURRENCIES = [
  'Knowledge',
  'Integrity',
  'Honor',
  'Relationships',
  'Courage',
  'Creativity',
  'Service',
  'Conviction',
] as const;
export type CurrencyName = (typeof CURRENCIES)[number];

type SrcKind = 'wiring' | 'orientation' | 'rejection';
/** One weighted source per the addendum §3.8.1 split; `types` are APP type names. */
type Source = { kind: SrcKind; weight: number; types: string[] };

// Per-currency source blends. Weights per Addendum §3.8.1 (sum to 1.0 each).
const FEEDS: Record<CurrencyName, Source[]> = {
  Knowledge: [
    { kind: 'wiring', weight: 0.6, types: ['Realist', 'Organizer', 'Wise Observer', 'Explainer'] },
    { kind: 'orientation', weight: 0.4, types: ['Truth-Seeker', 'Builder'] },
  ],
  Integrity: [
    { kind: 'wiring', weight: 0.55, types: ['Organizer', 'Realist'] },
    { kind: 'orientation', weight: 0.45, types: ['Truth-Seeker'] },
  ],
  Honor: [
    { kind: 'wiring', weight: 0.5, types: ['Encourager', 'Supporter'] },
    { kind: 'rejection', weight: 0.5, types: ['Resilience'] },
  ],
  Relationships: [
    { kind: 'wiring', weight: 0.65, types: ['Supporter', 'Encourager', 'Integrator'] },
    { kind: 'orientation', weight: 0.35, types: ['Supporter'] },
  ],
  Courage: [
    { kind: 'rejection', weight: 0.6, types: ['Resilience'] },
    { kind: 'wiring', weight: 0.4, types: ['Doer', 'Enterpriser'] },
  ],
  Creativity: [
    { kind: 'wiring', weight: 0.7, types: ['Integrator', 'Enterpriser'] },
    { kind: 'orientation', weight: 0.3, types: ['Starter'] },
  ],
  Service: [
    { kind: 'wiring', weight: 0.6, types: ['Supporter', 'Encourager'] },
    { kind: 'orientation', weight: 0.4, types: ['Supporter'] },
  ],
  Conviction: [
    { kind: 'rejection', weight: 0.65, types: ['Resilience'] },
    { kind: 'wiring', weight: 0.35, types: ['Realist', 'Organizer'] },
  ],
};

/** Short context label under each bar; the LLM's prose overrides it when present. */
export const CURRENCY_CTX: Record<CurrencyName, string> = {
  Knowledge: 'Skill and wisdom',
  Integrity: 'Values in action',
  Honor: 'Kept commitments',
  Relationships: 'Genuine connection',
  Courage: 'Acting through risk',
  Creativity: 'Original synthesis',
  Service: 'Investment in others',
  Conviction: 'Settled certainty',
};

const ORIENTATIONS = ['Truth-Seeker', 'Builder', 'Explainer', 'Supporter', 'Starter'] as const;
const REJECTION_CATEGORIES = ['Perspective', 'Insight', 'Creativity', 'Resilience', 'Empathy'] as const;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** normalized tag -> strength(pct); floor-fills the canonical set so unseen tags read 8. */
function strengthMap(tallies: Tally[], canonical: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tallies) m.set(norm(t.tag), t.pct);
  for (const tag of canonical) if (!m.has(norm(tag))) m.set(norm(tag), 8);
  return m;
}

export type CurrencyScore = { name: CurrencyName; pct: number };

/** Deterministic 0-97 for each of the 8 canonical currencies from the computed signals. */
export function computeCurrencies(scores: Scores): CurrencyScore[] {
  const maps: Record<SrcKind, Map<string, number>> = {
    wiring: strengthMap(scores.wiring.allNine, WIRING_GIFTS),
    orientation: strengthMap(scores.orientation.ranked, ORIENTATIONS),
    rejection: strengthMap(scores.rejectionGift.ranked, REJECTION_CATEGORIES),
  };
  return CURRENCIES.map((name) => {
    let acc = 0;
    for (const s of FEEDS[name]) {
      // The strongest contributing type drives the source (the addendum's
      // "primary boost" semantics), so a strong Realist reads high on Knowledge.
      const strength = Math.max(...s.types.map((t) => maps[s.kind].get(norm(t)) ?? 8));
      acc += s.weight * strength;
    }
    // §3.8.4: never a "perfect" currency — cap at 97, always a growth edge.
    const pct = Math.max(0, Math.min(97, Math.round(acc)));
    return { name, pct };
  });
}
