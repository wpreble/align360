import { NextRequest, NextResponse } from 'next/server';
import { creditPrecheck, meterUsage } from '@/lib/credit-metering';
import { getAccessStatus } from '@/lib/billing-access';
import { getAssessment } from '@/lib/assessments';
import type { AnswerSet } from '@/lib/scoring';
import { generateCombinedProfile, type CombinedAnswers } from '@/lib/profile-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  name?: string;
  demo?: boolean;
  answers?: CombinedAnswers;
};

/** Build sample answers (varied options across questions) for demo/testing. */
function demoAnswers(): CombinedAnswers {
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
  return out as CombinedAnswers;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const answers = body.demo ? demoAnswers() : body.answers || {};
  const name = body.name || (body.demo ? 'Sample' : 'Friend');

  if (!body.demo) {
    // Paywall: onboarding is the free teaser; the combined profile requires a
    // subscription once billing is enforced. `demo` is the internal preview path
    // (not linked from any UI), exempt so testing keeps working.
    const acc = await getAccessStatus();
    if (acc.enforce && !acc.access) {
      return NextResponse.json({ error: 'paywall', message: 'Subscribe to unlock your full profile.' }, { status: 402 });
    }
  }

  // Credit precheck before spending tokens on generation.
  const pre = await creditPrecheck();
  if (!pre.ok) return NextResponse.json({ error: 'out_of_credits', message: 'You are out of credits this month. Top up to generate more reports.' }, { status: 402 });

  try {
    const res = await generateCombinedProfile(answers, name);
    await meterUsage('profile', res.model, res.usage.promptTokens, res.usage.completionTokens);
    return NextResponse.json({
      scores: res.scores,
      profile: res.profile,
      generated: res.generated,
      ...(res.warning ? { warning: res.warning } : {}),
      debug: req.nextUrl.searchParams.has('debug') ? res.debug : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
