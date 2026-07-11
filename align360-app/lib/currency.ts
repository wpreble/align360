import type { Scores, Tally } from './scoring';
import { WIRING_GIFTS } from './scoring';

/**
 * Deterministic True-Riches currency scoring.
 *
 * Background: the combined profile's "currency constellation" %s used to be
 * invented by the LLM, so they flipped on every regeneration — the last
 * remaining source of non-determinism after the three gift signals were pinned
 * (see app/api/profile/generate/route.ts). Samuel's canonical "True Currencies"
 * scoring pack was never formally built, so this is the v1 gift -> currency map
 * drafted 2026-07-10 and approved by Will 2026-07-11, grounded in Samuel's
 * framework meanings. AI writes the words; this math sets the number — the same
 * lock the gift signals already use. Every link is tunable when his pack lands.
 *
 * Each currency = a weighted blend of the relevant signal strengths (the 0-100
 * pct each gift / orientation / rejection category already scores), so no single
 * answer can swing it: every currency pulls from 3+ signals.
 *
 * "Conviction" is the market-facing name for Faith (Samuel: "Faith will become
 * conviction ... market facing names"). The other six names are the current app
 * names, pending his full market-phasing map.
 */

// Canonical order — Money last, per his framework ("money sits last; it is a
// product of the other currencies").
export const CURRENCIES = [
  'Relationships',
  'Integrity',
  'Honor',
  'Conviction',
  'Knowledge',
  'Favor',
  'Money',
] as const;
export type CurrencyName = (typeof CURRENCIES)[number];

type Src = 'wiring' | 'orientation' | 'rejection';
type Feed = { src: Src; tag: string; w?: number };

/**
 * v1 gift -> currency feeds: (assessment, signal tag, optional intra-currency
 * weight). Tags are matched loosely (case/spacing/hyphen-insensitive), so a
 * "Truth-Seeker" feed still resolves against a "Truth Seeker" score.
 */
const FEEDS: Record<CurrencyName, Feed[]> = {
  Relationships: [
    { src: 'wiring', tag: 'Supporter' },
    { src: 'wiring', tag: 'Integrator' },
    { src: 'wiring', tag: 'Encourager' },
    { src: 'orientation', tag: 'Supporter' },
    { src: 'rejection', tag: 'Empathy' },
  ],
  Integrity: [
    { src: 'wiring', tag: 'Realist' },
    { src: 'wiring', tag: 'Organizer' },
    { src: 'orientation', tag: 'Truth-Seeker' },
  ],
  Honor: [
    { src: 'wiring', tag: 'Explainer' },
    { src: 'wiring', tag: 'Wise Observer' },
    { src: 'wiring', tag: 'Encourager' },
    { src: 'orientation', tag: 'Explainer' },
    { src: 'rejection', tag: 'Insight' },
    { src: 'rejection', tag: 'Resilience' },
  ],
  Conviction: [
    { src: 'wiring', tag: 'Enterpriser' },
    { src: 'wiring', tag: 'Encourager' },
    { src: 'orientation', tag: 'Starter' },
    { src: 'rejection', tag: 'Resilience' },
    { src: 'rejection', tag: 'Perspective' },
  ],
  Knowledge: [
    { src: 'wiring', tag: 'Realist' },
    { src: 'wiring', tag: 'Explainer' },
    { src: 'wiring', tag: 'Wise Observer' },
    { src: 'wiring', tag: 'Doer' },
    { src: 'orientation', tag: 'Truth-Seeker' },
    { src: 'orientation', tag: 'Builder' },
    { src: 'rejection', tag: 'Insight' },
    { src: 'rejection', tag: 'Perspective' },
    { src: 'rejection', tag: 'Creativity' },
  ],
  Favor: [
    { src: 'wiring', tag: 'Integrator' },
    { src: 'wiring', tag: 'Supporter' },
    { src: 'wiring', tag: 'Enterpriser' },
    { src: 'orientation', tag: 'Supporter' },
    { src: 'orientation', tag: 'Starter' },
  ],
  Money: [
    { src: 'wiring', tag: 'Doer' },
    { src: 'wiring', tag: 'Organizer' },
    { src: 'wiring', tag: 'Enterpriser' },
    { src: 'orientation', tag: 'Builder' },
    { src: 'rejection', tag: 'Creativity' },
  ],
};

/**
 * Post-blend multiplier per currency. Money is down-weighted so it trends
 * smallest ("output, not source") without forcing a fixed rank — the math still
 * decides the order.
 */
const SCALE: Partial<Record<CurrencyName, number>> = { Money: 0.6 };

/** Short context label under each bar; the LLM's prose overrides it when present. */
export const CURRENCY_CTX: Record<CurrencyName, string> = {
  Relationships: 'Trust-based connection',
  Integrity: 'Credibility',
  Honor: 'Earned respect',
  Conviction: 'Conviction and resilience',
  Knowledge: 'Skill and wisdom',
  Favor: 'Access and support',
  Money: 'Output, not source',
};

const ORIENTATIONS = ['Truth-Seeker', 'Builder', 'Explainer', 'Supporter', 'Starter'] as const;
const REJECTION_CATEGORIES = ['Perspective', 'Insight', 'Creativity', 'Resilience', 'Empathy'] as const;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** normalized tag -> strength(pct); floor-fills the canonical set so unseen tags read 8, not missing. */
function strengthMap(tallies: Tally[], canonical: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tallies) m.set(norm(t.tag), t.pct);
  for (const tag of canonical) if (!m.has(norm(tag))) m.set(norm(tag), 8);
  return m;
}

export type CurrencyScore = { name: CurrencyName; pct: number };

/** Deterministic 0-100 for each of the 7 currencies, from the computed signals. */
export function computeCurrencies(scores: Scores): CurrencyScore[] {
  const maps: Record<Src, Map<string, number>> = {
    wiring: strengthMap(scores.wiring.allNine, WIRING_GIFTS),
    orientation: strengthMap(scores.orientation.ranked, ORIENTATIONS),
    rejection: strengthMap(scores.rejectionGift.ranked, REJECTION_CATEGORIES),
  };
  return CURRENCIES.map((name) => {
    let acc = 0;
    let wsum = 0;
    for (const f of FEEDS[name]) {
      const pct = maps[f.src].get(norm(f.tag)) ?? 8;
      const w = f.w ?? 1;
      acc += w * pct;
      wsum += w;
    }
    const base = wsum > 0 ? acc / wsum : 8;
    const pct = Math.round(base * (SCALE[name] ?? 1));
    return { name, pct: Math.max(0, Math.min(100, pct)) };
  });
}
