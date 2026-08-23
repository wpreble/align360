// Combined-profile generation core, shared by the API route (app/api/profile/generate)
// and admin scripts (scripts/regenerate-combined-profile.ts). The route owns auth,
// paywall and credit metering; this module owns everything about turning answers
// into the final Profile JSON.
import { buildSystemPrompt } from '@/lib/system-prompt';
import { parseJsonLoose, createReportCompletion, hasReportProvider, reportModelLabel } from '@/lib/ai';
import { computeScores, type AnswerSet } from '@/lib/scoring';
import { getAssessment } from '@/lib/assessments';
import { PROFILE_SCHEMA_A, PROFILE_SCHEMA_B, fallbackProfile, type Profile } from '@/lib/profile';
import { computeCurrencies, CURRENCY_CTX } from '@/lib/currency';
import { scoreAssessment } from '@/lib/report-scoring';
import { stripDashes } from '@/lib/markdown';
import { checkVoice } from '@/lib/voice-check';

const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export type CombinedAnswers = {
  wiring?: AnswerSet;
  orientation?: AnswerSet;
  'rejection-gift'?: AnswerSet;
};

/** Recursively apply house style (no em/en dashes) to every string field. */
function deepStripDashes<T>(v: T): T {
  if (typeof v === 'string') return stripDashes(v) as unknown as T;
  if (Array.isArray(v)) return v.map(deepStripDashes) as unknown as T;
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) o[k] = deepStripDashes(val);
    return o as unknown as T;
  }
  return v;
}

/**
 * Deep-merge the model's output over the deterministic fallback. Nested objects merge
 * recursively, so a partial object from the model (e.g. an `aiEra` with `cards` but no
 * `moves`) can no longer wipe out the fallback's complete nested structure — the missing
 * fields keep their fallback values. Arrays and primitives from the source still replace
 * the base wholesale (the model returns complete arrays).
 */
function deepMerge(base: unknown, src: unknown): unknown {
  const isObj = (x: unknown): x is Record<string, unknown> =>
    typeof x === 'object' && x !== null && !Array.isArray(x);
  if (!isObj(base) || !isObj(src)) return src === undefined ? base : src;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(src)) out[k] = deepMerge(base[k], v);
  return out;
}

/** Render the chosen-option text for each answered question, for the model. */
function answersNarrative(slug: string, answers: AnswerSet): string {
  const a = getAssessment(slug);
  if (!a) return '';
  const byId = new Map(a.sections.flatMap((s) => s.questions).map((q) => [q.id, q]));
  const lines: string[] = [];
  for (const [qid, letter] of Object.entries(answers)) {
    const q = byId.get(qid);
    const opt = q?.options.find((o) => o.letter === letter);
    if (q && opt) lines.push(`- ${q.label}: chose "${opt.text}"${opt.giftTag ? ` [${opt.giftTag}]` : ''}`);
  }
  return lines.join('\n');
}

export type GeneratedProfile = {
  scores: ReturnType<typeof computeScores>;
  profile: Profile;
  /** true when the AI output parsed; false means deterministic fallback only (or, for surgical mode, stored text kept). */
  generated: boolean;
  warning?: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number };
  debug?: Record<string, unknown>;
};

type Usage = { promptTokens: number; completionTokens: number };

/** Shared per-request generation machinery: one summary + system prompt, N schema calls. */
function makeGen(summary: string, usage: Usage) {
  const sys = buildSystemPrompt();
  const genOnce = async (schema: string) => {
    const c = await createReportCompletion(
      [
        { role: 'system', content: sys },
        { role: 'user', content: `You are generating part of a combined Align360 identity profile ("Combined in an AI-Era" format). Return ONLY a single valid JSON object, no markdown fences or prose. Participant assessment data:\n\n${summary}\n\n${schema}` },
      ],
      { maxTokens: 9000, json: true, reasoning: 'off', temperature: 0 },
    );
    const text = c.choices[0]?.message?.content || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cu = (c as any).usage; usage.promptTokens += cu?.prompt_tokens ?? 0; usage.completionTokens += cu?.completion_tokens ?? 0;
    return { parsed: parseJsonLoose<Partial<Profile>>(text), finish: c.choices[0]?.finish_reason, len: text.length };
  };
  // One retry when the model returns unparseable/empty JSON (GLM does this
  // intermittently); a malformed half otherwise silently drops to fallback.
  //
  // `requireKey` makes the retry aware of what the caller actually needs. Without
  // it, JSON that parses but omits the one key the caller wants counts as success
  // and the retry never fires: the AI-era-only regeneration hit exactly that on
  // 2026-08-23, returning a well-formed object with no `aiEra` and silently
  // keeping the stored (drifted) copy.
  return async (schema: string, requireKey?: string) => {
    const structureOk = (r: { parsed: Partial<Profile> | null }) => {
      if (!r.parsed || Object.keys(r.parsed).length === 0) return false;
      if (!requireKey) return true;
      const v = (r.parsed as Record<string, unknown>)[requireKey];
      return !!v && typeof v === 'object';
    };
    // Voice violations reuse the SAME single retry as malformed JSON, so the common
    // (clean) case still costs one call. This is the drift Drew reported on
    // 2026-08-18 caught at generation time rather than by a human reading the report.
    const usable = (r: { parsed: Partial<Profile> | null }) =>
      structureOk(r) && checkVoice(requireKey ? (r.parsed as Record<string, unknown>)[requireKey] : r.parsed).length === 0;

    let r = await genOnce(schema);
    // A thin-but-valid half degrades to the deterministic fallback rather than
    // paying for a second 40-70s GLM call, keeping generation fast.
    if (!usable(r)) {
      const retry = await genOnce(schema);
      // Prefer a clean resample; otherwise keep whichever is at least structurally
      // sound. Never block a user's report on voice alone.
      if (usable(retry)) r = retry;
      else if (!structureOk(r) && structureOk(retry)) r = retry;
    }
    const violations = checkVoice(requireKey ? (r.parsed as Record<string, unknown>)?.[requireKey] : r.parsed);
    if (violations.length) {
      console.warn(`report voice: ${violations.length} violation(s) persisted after retry: ${violations.map((v) => v.rule).join(', ')}`);
    }
    return { parsed: r.parsed || {}, finish: r.finish, len: r.len, voice: violations.length };
  };
}

function buildSummary(scores: ReturnType<typeof computeScores>, answers: CombinedAnswers, name: string): string {
  return [
    `Participant first name: ${name}`,
    `WIRING — primary ${scores.wiring.primary}, secondary ${scores.wiring.secondary}. Ranked: ${scores.wiring.ranked.map((t) => `${t.tag} ${t.pct}%`).join(', ')}.`,
    scores.completed.wiring ? answersNarrative('wiring', answers.wiring!) : '',
    `ORIENTATION — primary ${scores.orientation.primary}, secondary ${scores.orientation.secondary}.`,
    scores.completed.orientation ? answersNarrative('orientation', answers.orientation!) : '',
    `REJECTION GIFT — ${scores.rejectionGift.primary}.`,
    scores.completed.rejectionGift ? answersNarrative('rejection-gift', answers['rejection-gift']!) : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Pin the three gift signals + hero pills to the COMPUTED scores (see long note in git history). */
function pinSignals(profile: Profile, answers: CombinedAnswers, scores: ReturnType<typeof computeScores>): void {
  const wRep = answers.wiring ? scoreAssessment('wiring', answers.wiring) : null;
  const oRep = answers.orientation ? scoreAssessment('orientation', answers.orientation) : null;
  const rRep = answers['rejection-gift'] ? scoreAssessment('rejection-gift', answers['rejection-gift']) : null;
  const pinned = [
    { name: wRep?.primary ?? scores.wiring.primary, pct: wRep?.primaryPct ?? scores.wiring.ranked[0]?.pct },
    { name: oRep?.primary ?? scores.orientation.primary, pct: oRep?.primaryPct ?? scores.orientation.ranked[0]?.pct },
    { name: rRep?.primary ?? scores.rejectionGift.primary, pct: rRep?.primaryPct ?? scores.rejectionGift.ranked[0]?.pct },
  ];
  if (Array.isArray(profile.signals?.items)) {
    profile.signals.items = profile.signals.items.map((it, i) =>
      pinned[i] ? { ...it, name: pinned[i].name ?? it.name, pct: pinned[i].pct ?? it.pct } : it,
    );
  }
  if (Array.isArray(profile.hero?.pills) && profile.hero.pills.length >= 3) {
    const vals = [pinned[0].name, pinned[1].name, pinned[2].name];
    profile.hero.pills = profile.hero.pills.map((pill, i) => (vals[i] ? { ...pill, value: vals[i]! } : pill));
  }
}

/** DETERMINISM (currencies): math sets every pct, the model only names each row's ctx label. */
function pinCurrencies(profile: Profile, scores: ReturnType<typeof computeScores>): void {
  if (!profile.currency) return;
  const llmCtx = new Map<string, string>();
  if (Array.isArray(profile.currency.rows)) {
    for (const r of profile.currency.rows) {
      if (r && typeof r.name === 'string' && typeof r.ctx === 'string' && r.ctx.trim()) {
        llmCtx.set(normName(r.name), r.ctx.trim());
      }
    }
  }
  profile.currency.rows = computeCurrencies(scores).map((c) => ({
    name: c.name,
    pct: c.pct,
    ctx: llmCtx.get(normName(c.name)) ?? CURRENCY_CTX[c.name],
  }));
}

/** Full regeneration: both halves over the deterministic fallback, then all determinism pins. */
export async function generateCombinedProfile(
  answers: CombinedAnswers,
  rawName: string,
): Promise<GeneratedProfile> {
  // Strip control chars/newlines so the name can't smuggle prompt instructions.
  const name = (rawName || 'Friend').replace(/[\u0000-\u001f]+/g, ' ').replace(/[‒-―]/g, '-').trim().slice(0, 60);
  const scores = computeScores(answers);

  if (!scores.completed.wiring && !scores.completed.orientation && !scores.completed.rejectionGift) {
    throw new Error('No assessment answers provided.');
  }

  const model = reportModelLabel();
  if (!hasReportProvider()) {
    return {
      scores,
      profile: deepStripDashes(fallbackProfile(scores, name)),
      generated: false,
      warning: 'No report provider configured.',
      model,
      usage: { promptTokens: 0, completionTokens: 0 },
    };
  }

  const usage: Usage = { promptTokens: 0, completionTokens: 0 };
  const gen = makeGen(buildSummary(scores, answers, name), usage);

  try {
    // Two PARALLEL halves (identity + market/AI-era) so wall-clock is the slower
    // half, not the sum. Each half parses defensively, so one malformed half still
    // leaves the rest (over the deterministic fallback).
    const [a, b] = await Promise.all([gen(PROFILE_SCHEMA_A), gen(PROFILE_SCHEMA_B)]);
    // Deep-merge (not a shallow spread) so a partial nested object from the model
    // can't drop the fallback's complete nested fields.
    const profile = deepStripDashes(
      deepMerge(deepMerge(fallbackProfile(scores, name), a.parsed), b.parsed),
    ) as Profile;

    // Determinism locks: the model never owns the numbers.
    pinSignals(profile, answers, scores);
    pinCurrencies(profile, scores);

    const ok = Object.keys(a.parsed).length > 0 || Object.keys(b.parsed).length > 0;
    return {
      scores,
      profile,
      generated: ok,
      model,
      usage,
      debug: { finishA: a.finish, finishB: b.finish, lenA: a.len, lenB: b.len },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'generation failed';
    console.error('profile generate error:', message);
    return {
      scores,
      profile: deepStripDashes(fallbackProfile(scores, name)),
      generated: false,
      warning: message,
      model,
      usage,
    };
  }
}

/**
 * SURGICAL regeneration: re-run ONLY the AI-era half (PROFILE_SCHEMA_B) and splice
 * its `aiEra` section into an EXISTING stored profile, leaving every other prose
 * field exactly as the user last saw it. Exists because a full regenerate re-rolls
 * the whole narrative while the user may have asked about one section only (Drew's
 * AI Readiness headings, 2026-08). On any failure the stored profile is returned
 * unchanged with generated:false so callers refuse to write.
 */
export async function regenerateAiEraOnly(
  stored: Profile,
  answers: CombinedAnswers,
  rawName: string,
): Promise<GeneratedProfile> {
  const name = (rawName || 'Friend').replace(/[\u0000-\u001f]+/g, ' ').replace(/[‒-―]/g, '-').trim().slice(0, 60);
  const scores = computeScores(answers);
  const model = reportModelLabel();

  if (!hasReportProvider()) {
    return { scores, profile: stored, generated: false, warning: 'No report provider configured.', model, usage: { promptTokens: 0, completionTokens: 0 } };
  }

  const usage: Usage = { promptTokens: 0, completionTokens: 0 };
  const gen = makeGen(buildSummary(scores, answers, name), usage);

  try {
    const b = await gen(PROFILE_SCHEMA_B, 'aiEra');
    if (!b.parsed.aiEra || typeof b.parsed.aiEra !== 'object') {
      const keys = Object.keys(b.parsed || {}).join(', ') || '(none)';
      return {
        scores, profile: stored, generated: false, model, usage,
        warning: `AI-era half did not parse after retry; stored report kept. finish=${b.finish} len=${b.len} keys=[${keys}]`,
        debug: { finishB: b.finish, lenB: b.len },
      };
    }
    // Merge the fresh aiEra OVER the stored one (deep), so any field the model
    // omits keeps its previous wording instead of falling back to template prose.
    const merged = deepStripDashes({
      ...stored,
      aiEra: deepMerge(stored.aiEra ?? fallbackProfile(scores, name).aiEra, b.parsed.aiEra),
    }) as Profile;
    return { scores, profile: merged, generated: true, model, usage, debug: { finishB: b.finish, lenB: b.len } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'generation failed';
    console.error('ai-era regen error:', message);
    return { scores, profile: stored, generated: false, warning: message, model, usage };
  }
}
