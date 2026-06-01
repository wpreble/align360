import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { getAssessment } from '@/lib/assessments';
import { computeScores, type AnswerSet } from '@/lib/scoring';
import { PROFILE_SCHEMA_A, PROFILE_SCHEMA_B, fallbackProfile, type Profile } from '@/lib/profile';

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
  const name = (body.name || (body.demo ? 'Sample' : 'Friend')).trim();
  const scores = computeScores(answers);

  if (!scores.completed.wiring && !scores.completed.orientation && !scores.completed.rejectionGift) {
    return NextResponse.json({ error: 'No assessment answers provided.' }, { status: 400 });
  }

  // No key → return the deterministic fallback so the page still renders.
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ scores, profile: fallbackProfile(scores, name), generated: false });
  }

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

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || 'gpt-5.5';
  const sys = buildSystemPrompt();

  // Generate the profile as two PARALLEL halves (identity + market/AI-era) so
  // wall-clock is the slower half, not the sum. Each half parses defensively,
  // so one malformed half still leaves the rest (over the deterministic fallback).
  const gen = async (schema: string) => {
    const c = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      max_completion_tokens: 9000,
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: `You are generating part of a combined Align360 identity profile ("Combined in an AI-Era" format). Participant assessment data:\n\n${summary}\n\n${schema}` },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const text = c.choices[0]?.message?.content || '{}';
    let parsed: Partial<Profile> = {};
    try { parsed = JSON.parse(text); } catch {}
    return { parsed, finish: c.choices[0]?.finish_reason, len: text.length };
  };

  try {
    const [a, b] = await Promise.all([gen(PROFILE_SCHEMA_A), gen(PROFILE_SCHEMA_B)]);
    const profile = { ...fallbackProfile(scores, name), ...a.parsed, ...b.parsed } as Profile;
    const ok = Object.keys(a.parsed).length > 0 || Object.keys(b.parsed).length > 0;
    const debug = req.nextUrl.searchParams.has('debug')
      ? { finishA: a.finish, finishB: b.finish, lenA: a.len, lenB: b.len, keysA: Object.keys(a.parsed), keysB: Object.keys(b.parsed) }
      : undefined;
    return NextResponse.json({ scores, profile, generated: ok, debug });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'generation failed';
    console.error('profile generate error:', message);
    return NextResponse.json({ scores, profile: fallbackProfile(scores, name), generated: false, warning: message });
  }
}
