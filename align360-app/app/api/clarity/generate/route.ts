import { NextRequest, NextResponse } from 'next/server';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { resolveModel, makeClient, genParams, parseJsonLoose } from '@/lib/ai';
import { creditPrecheck, meterUsage } from '@/lib/credit-metering';
import { getAssessment } from '@/lib/assessments';
import { computeClarityScores, isClaritySlug, type ClarityScores } from '@/lib/clarity-scoring';
import { claritySchema, fallbackClarityNarrative, type ClarityNarrative, type ClarityNote } from '@/lib/clarity';
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

function pickStr(a: unknown, fb: string): string {
  return typeof a === 'string' && a.trim() ? a : fb;
}
function pickNote(a: Partial<ClarityNote> | undefined, fb: ClarityNote): ClarityNote {
  return { label: pickStr(a?.label, fb.label), body: pickStr(a?.body, fb.body) };
}

/**
 * Merge the model's narrative over the deterministic fallback, field by field.
 * domains/subs are rebuilt from the AUTHORITATIVE score labels (not the model's),
 * so a renamed or omitted key can never blank a section, and every nested object
 * (diagnostic, primaryGap, aiEra, closing) is guaranteed complete even if the
 * model returns a partial JSON.
 */
function mergeNarrative(fb: ClarityNarrative, parsed: Partial<ClarityNarrative>, scores: ClarityScores): ClarityNarrative {
  const norm = (s: string) => s.trim().toLowerCase();
  const dMap = new Map(
    (Array.isArray(parsed.domains) ? parsed.domains : []).filter((d) => d && typeof d.name === 'string').map((d) => [norm(d.name), d.body] as const),
  );
  const sMap = new Map(
    (Array.isArray(parsed.subs) ? parsed.subs : []).filter((s) => s && typeof s.label === 'string').map((s) => [norm(s.label), s.body] as const),
  );
  const pStrengths = (Array.isArray(parsed.strengths) ? parsed.strengths : [])
    .filter((s) => s && typeof s.title === 'string' && typeof s.body === 'string')
    .map((s) => ({ title: s.title, body: s.body }));
  return {
    headline: pickStr(parsed.headline, fb.headline),
    summary: pickStr(parsed.summary, fb.summary),
    domains: scores.domains.map((d, i) => ({ name: d.name, body: pickStr(dMap.get(norm(d.name)), fb.domains[i]?.body || '') })),
    subs: scores.subs.map((s, i) => ({ label: s.label, body: pickStr(sMap.get(norm(s.label)), fb.subs[i]?.body || '') })),
    primaryGap: {
      title: pickStr(parsed.primaryGap?.title, fb.primaryGap.title),
      body: pickStr(parsed.primaryGap?.body, fb.primaryGap.body),
      tool: pickStr(parsed.primaryGap?.tool, fb.primaryGap.tool),
    },
    strengths: pStrengths.length ? pStrengths : fb.strengths,
    aiEra: scores.aiEra
      ? { title: pickStr(parsed.aiEra?.title, fb.aiEra?.title || ''), body: pickStr(parsed.aiEra?.body, fb.aiEra?.body || '') }
      : null,
    diagnostic: {
      severity: pickNote(parsed.diagnostic?.severity, fb.diagnostic.severity),
      source: pickNote(parsed.diagnostic?.source, fb.diagnostic.source),
      velocity: pickNote(parsed.diagnostic?.velocity, fb.diagnostic.velocity),
    },
    closing: {
      title: pickStr(parsed.closing?.title, fb.closing.title),
      body: pickStr(parsed.closing?.body, fb.closing.body),
    },
  };
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { slug?: string; name?: string; demo?: boolean; answers?: Record<string, string> };

/** Build sample answers (varied options) for demo/testing. */
function demoAnswers(slug: string): Record<string, string> {
  const a = getAssessment(slug);
  const set: Record<string, string> = {};
  let i = 0;
  for (const s of a?.sections || []) {
    for (const q of s.questions) {
      const opt = q.options[i % Math.max(1, q.options.length)];
      if (opt) set[q.id] = opt.letter;
      i++;
    }
  }
  return set;
}

/** Render the chosen-option text for each answered question, for the model. */
function answersNarrative(slug: string, answers: Record<string, string>): string {
  const a = getAssessment(slug);
  if (!a) return '';
  const byId = new Map(
    a.sections.flatMap((s) => s.questions.map((q) => [q.id, { q, section: s.name }] as const)),
  );
  const lines: string[] = [];
  for (const [qid, letter] of Object.entries(answers)) {
    const entry = byId.get(qid);
    const opt = entry?.q.options.find((o) => o.letter === letter);
    if (entry && opt) lines.push(`- ${entry.q.label} [${entry.section}]: chose "${opt.text}" (${opt.giftTag ?? '0'}/10)`);
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

  const slug = (body.slug || '').trim();
  if (!isClaritySlug(slug)) {
    return NextResponse.json({ error: `Unknown Clarity Layer assessment: "${slug}".` }, { status: 400 });
  }

  const answers = body.demo ? demoAnswers(slug) : body.answers || {};
  // Strip control chars/newlines so the name can't smuggle prompt instructions
  // into the system prompt where it's interpolated.
  const name = (body.name || (body.demo ? 'Sample' : 'Friend')).replace(/[\u0000-\u001f]+/g, ' ').replace(/[‒-―]/g, '-').trim().slice(0, 60);
  const scores = computeClarityScores(slug, answers);

  if (!scores) {
    return NextResponse.json({ error: 'Could not score this assessment.' }, { status: 400 });
  }
  if (scores.answered === 0) {
    return NextResponse.json({ error: 'No answers provided for this assessment.' }, { status: 400 });
  }

  // Report model: REPORT_MODEL=z-ai/glm-5.2 → OpenRouter; default OPENAI_MODEL/gpt-5.5.
  // No key → deterministic fallback so the report still renders.
  const { model, useOpenRouter, apiKey } = resolveModel('REPORT_MODEL', process.env.OPENAI_MODEL || 'gpt-5.5');
  if (!apiKey) {
    return NextResponse.json({ scores, narrative: deepStripDashes(fallbackClarityNarrative(scores, name)), generated: false });
  }

  const pre = await creditPrecheck();
  if (!pre.ok) return NextResponse.json({ error: 'out_of_credits', message: 'You are out of credits this month. Top up to generate more reports.' }, { status: 402 });
  let mInTok = 0, mOutTok = 0;

  const summary = [
    `Participant first name: ${name}`,
    `Assessment: ${scores.title}. ${scores.scoreName}: ${scores.overall}/100 (level: ${scores.level.label}).`,
    `Domain scores: ${scores.domains.map((d) => `${d.name} ${d.score}/100`).join(', ')}.`,
    scores.aiEra ? `AI-Era readiness: ${scores.aiEra.score}/100.` : '',
    `Lowest signal (primary gap): ${scores.primaryGap?.label} ${scores.primaryGap?.points}/10. Maxed signals: ${scores.strengths.map((s) => s.label).join(', ') || 'none'}.`,
    'Chosen answers:',
    answersNarrative(slug, answers),
  ]
    .filter(Boolean)
    .join('\n');

  const client = makeClient(useOpenRouter, apiKey);
  const sys = buildSystemPrompt();

  const genOnce = async () => {
    const c = await client.chat.completions.create({
      model,
      ...genParams(useOpenRouter, { maxTokens: 9000, json: true, reasoning: 'off' }),
      messages: [
        { role: 'system', content: sys },
        {
          role: 'user',
          content: `You are writing the analysis for an Align360 Clarity Layer result (${scores.title}). The scores are already computed; write ONLY the interpretive narrative as a single valid JSON object, no markdown fences or prose.\n\n${summary}\n\n${claritySchema(scores)}`,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const text = c.choices[0]?.message?.content || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cu = (c as any).usage; mInTok += cu?.prompt_tokens ?? 0; mOutTok += cu?.completion_tokens ?? 0;
    return { parsed: parseJsonLoose<Partial<ClarityNarrative>>(text), finish: c.choices[0]?.finish_reason, len: text.length };
  };

  try {
    // One retry when the model returns unparseable/empty/thin JSON (intermittent on GLM).
    let r = await genOnce();
    if (!r.parsed || Object.keys(r.parsed).length === 0) {
      const retry = await genOnce();
      if (retry.parsed && Object.keys(retry.parsed).length > 0) r = retry;
    }
    const parsed = r.parsed || {};
    const narrative = deepStripDashes(mergeNarrative(fallbackClarityNarrative(scores, name), parsed, scores));
    const ok = Object.keys(parsed).length > 0;
    const debug = req.nextUrl.searchParams.has('debug')
      ? { finish: r.finish, len: r.len, keys: Object.keys(parsed) }
      : undefined;
    await meterUsage('clarity', model, mInTok, mOutTok);
    return NextResponse.json({ scores, narrative, generated: ok, debug });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'generation failed';
    console.error('clarity generate error:', message);
    return NextResponse.json({ scores, narrative: deepStripDashes(fallbackClarityNarrative(scores, name)), generated: false, warning: message });
  }
}
