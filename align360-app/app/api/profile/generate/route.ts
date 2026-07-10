import { NextRequest, NextResponse } from 'next/server';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { resolveModel, makeClient, genParams, parseJsonLoose } from '@/lib/ai';
import { creditPrecheck, meterUsage } from '@/lib/credit-metering';
import { getAssessment } from '@/lib/assessments';
import { computeScores, type AnswerSet } from '@/lib/scoring';
import { PROFILE_SCHEMA_A, PROFILE_SCHEMA_B, fallbackProfile, type Profile } from '@/lib/profile';
import { stripDashes } from '@/lib/markdown';

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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  name?: string;
  demo?: boolean;
  answers?: { wiring?: AnswerSet; orientation?: AnswerSet; 'rejection-gift'?: AnswerSet };
};

/** Build sample answers (varied options across questions) for demo/testing. */
function demoAnswers(): { wiring: AnswerSet; orientation: AnswerSet; 'rejection-gift': AnswerSet } {
  const out: Record<string, AnswerSet> = {};
  for (const slug of ['wiring', 'orientation', 'rejection-gift']) {
    const a = getAssessment(slug);
    const set: AnswerSet = {};
    let i = 0;
    for (const s of a?.sections || []) {
      for (const q of s.questions) {
        // rotate through options so the tally isn't all one gift
        const opt = q.options[i % Math.max(1, q.options.length)];
        if (opt) set[q.id] = opt.letter;
        i++;
      }
    }
    out[slug] = set;
  }
  return out as { wiring: AnswerSet; orientation: AnswerSet; 'rejection-gift': AnswerSet };
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

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const answers = body.demo ? demoAnswers() : body.answers || {};
  // Strip control chars/newlines so the name can't smuggle prompt instructions.
  const name = (body.name || (body.demo ? 'Sample' : 'Friend')).replace(/[\u0000-\u001f]+/g, ' ').replace(/[‒-―]/g, '-').trim().slice(0, 60);
  const scores = computeScores(answers);

  if (!scores.completed.wiring && !scores.completed.orientation && !scores.completed.rejectionGift) {
    return NextResponse.json({ error: 'No assessment answers provided.' }, { status: 400 });
  }

  // Report model: set REPORT_MODEL=z-ai/glm-5.2 to route through OpenRouter; default
  // OPENAI_MODEL/gpt-5.5 on OpenAI. No key → deterministic fallback so the page renders.
  const { model, useOpenRouter, apiKey } = resolveModel('REPORT_MODEL', process.env.OPENAI_MODEL || 'gpt-5.5');
  if (!apiKey) {
    return NextResponse.json({ scores, profile: deepStripDashes(fallbackProfile(scores, name)), generated: false });
  }

  const pre = await creditPrecheck();
  if (!pre.ok) return NextResponse.json({ error: 'out_of_credits', message: 'You are out of credits this month. Top up to generate more reports.' }, { status: 402 });
  let mInTok = 0, mOutTok = 0;

  const summary = [
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

  const client = makeClient(useOpenRouter, apiKey);
  const sys = buildSystemPrompt();

  // Generate the profile as two PARALLEL halves (identity + market/AI-era) so
  // wall-clock is the slower half, not the sum. Each half parses defensively,
  // so one malformed half still leaves the rest (over the deterministic fallback).
  const genOnce = async (schema: string) => {
    const c = await client.chat.completions.create({
      model,
      ...genParams(useOpenRouter, { maxTokens: 9000, json: true, reasoning: 'off', temperature: 0 }),
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: `You are generating part of a combined Align360 identity profile ("Combined in an AI-Era" format). Return ONLY a single valid JSON object, no markdown fences or prose. Participant assessment data:\n\n${summary}\n\n${schema}` },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const text = c.choices[0]?.message?.content || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cu = (c as any).usage; mInTok += cu?.prompt_tokens ?? 0; mOutTok += cu?.completion_tokens ?? 0;
    return { parsed: parseJsonLoose<Partial<Profile>>(text), finish: c.choices[0]?.finish_reason, len: text.length };
  };
  // One retry when the model returns unparseable/empty JSON (GLM does this
  // intermittently); a malformed half otherwise silently drops to fallback.
  const gen = async (schema: string) => {
    let r = await genOnce(schema);
    // Retry only on empty/unparseable JSON (the real failure mode). A thin-but-
    // valid half degrades to the deterministic fallback rather than paying for a
    // second 40-70s GLM call, keeping generation fast.
    if (!r.parsed || Object.keys(r.parsed).length === 0) {
      const retry = await genOnce(schema);
      if (retry.parsed && Object.keys(retry.parsed).length > 0) r = retry;
    }
    return { parsed: r.parsed || {}, finish: r.finish, len: r.len };
  };

  try {
    const [a, b] = await Promise.all([gen(PROFILE_SCHEMA_A), gen(PROFILE_SCHEMA_B)]);
    const profile = deepStripDashes({ ...fallbackProfile(scores, name), ...a.parsed, ...b.parsed }) as Profile;

    // DETERMINISM: the model is allowed to invent the gift `pct`/`name` in its JSON,
    // so regenerations produced different numbers (a gift flipping 0%<->100%, or
    // landing in the wrong slot). Re-pin the three gift signals + hero pills to the
    // COMPUTED scores so the same answers always yield the same numbers. The model
    // keeps the prose (desc/edge); it never owns the numbers. Order is fixed:
    // I = Wiring, II = Orientation, III = Rejection Gift.
    // (The currency constellation is NOT pinned here — it has no deterministic source
    // among the three primary assessments yet; pending Samuel's scoring decision.)
    const pinned = [
      { name: scores.wiring.primary, pct: scores.wiring.ranked[0]?.pct },
      { name: scores.orientation.primary, pct: scores.orientation.ranked[0]?.pct },
      { name: scores.rejectionGift.primary, pct: scores.rejectionGift.ranked[0]?.pct },
    ];
    if (Array.isArray(profile.signals?.items)) {
      profile.signals.items = profile.signals.items.map((it, i) =>
        pinned[i] ? { ...it, name: pinned[i].name ?? it.name, pct: pinned[i].pct ?? it.pct } : it,
      );
    }
    if (Array.isArray(profile.hero?.pills) && profile.hero.pills.length >= 3) {
      const vals = [scores.wiring.primary, scores.orientation.primary, scores.rejectionGift.primary];
      profile.hero.pills = profile.hero.pills.map((pill, i) => (vals[i] ? { ...pill, value: vals[i]! } : pill));
    }

    const ok = Object.keys(a.parsed).length > 0 || Object.keys(b.parsed).length > 0;
    const debug = req.nextUrl.searchParams.has('debug')
      ? { finishA: a.finish, finishB: b.finish, lenA: a.len, lenB: b.len, keysA: Object.keys(a.parsed), keysB: Object.keys(b.parsed) }
      : undefined;
    await meterUsage('profile', model, mInTok, mOutTok);
    return NextResponse.json({ scores, profile, generated: ok, debug });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'generation failed';
    console.error('profile generate error:', message);
    return NextResponse.json({ scores, profile: deepStripDashes(fallbackProfile(scores, name)), generated: false, warning: message });
  }
}
