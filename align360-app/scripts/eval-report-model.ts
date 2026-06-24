/**
 * Side-by-side report-quality eval: generate the SAME Clarity report with gpt-5.5
 * (OpenAI) and GLM 5.2 (OpenRouter) so you can compare quality, JSON validity,
 * latency, and cost before choosing REPORT_MODEL.
 *
 * Run:
 *   OPENAI_API_KEY=... OPENROUTER_API_KEY=... npx tsx scripts/eval-report-model.ts
 *
 * Note: the GLM call uses ~9k max_tokens, so the OpenRouter account needs credits
 * (a near-empty balance will 402). The gpt-5.5 side runs regardless.
 */
import { getAssessment } from '../lib/assessments';
import { computeClarityScores } from '../lib/clarity-scoring';
import { claritySchema } from '../lib/clarity';
import { makeClient, genParams } from '../lib/ai';
import { buildSystemPrompt } from '../lib/system-prompt';

function demoAnswers(slug: string): Record<string, string> {
  const a = getAssessment(slug);
  const set: Record<string, string> = {};
  let i = 0;
  for (const s of a?.sections || []) for (const q of s.questions) { const o = q.options[i % Math.max(1, q.options.length)]; if (o) set[q.id] = o.letter; i++; }
  return set;
}

const scores = computeClarityScores('impact-readiness', demoAnswers('impact-readiness'))!;
const sys = buildSystemPrompt();
const userMsg = `You are writing the analysis for an Align360 Clarity Layer result (${scores.title}). The scores are already computed; write ONLY the interpretive narrative.\n\n${scores.scoreName}: ${scores.overall}/100 (${scores.level.label}).\n\n${claritySchema(scores)}`;

async function run(label: string, model: string, useOpenRouter: boolean) {
  const apiKey = useOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) { console.log(`\n=== ${label} — no key, skipped ===`); return; }
  const client = makeClient(useOpenRouter, apiKey);
  const t0 = Date.now();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = await client.chat.completions.create({
      model,
      ...genParams(useOpenRouter, { maxTokens: 9000, json: true, reasoning: 'low' }),
      messages: [{ role: 'system', content: sys }, { role: 'user', content: userMsg }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    const text = c.choices[0]?.message?.content || '{}';
    let parsed: any = null, ok = false;
    try { parsed = JSON.parse(text); ok = true; } catch { /* invalid */ }
    console.log(`\n=== ${label} (${c.model || model}) — ${dt}s ===`);
    console.log('valid JSON:', ok, ok ? `| keys: ${Object.keys(parsed).join(', ')}` : `| raw head: ${text.slice(0, 120)}`);
    if (ok) {
      console.log('headline:', parsed.headline);
      console.log('summary :', (parsed.summary || '').slice(0, 200));
      console.log('coverage: domains', (parsed.domains || []).length, '/ subs', (parsed.subs || []).length, '/ strengths', (parsed.strengths || []).length);
      console.log('sample domain blurb:', (parsed.domains?.[0]?.body || '').slice(0, 160));
    }
    console.log('usage:', c.usage);
  } catch (e) {
    console.log(`\n=== ${label} FAILED: ${e instanceof Error ? e.message : e} ===`);
  }
}

(async () => {
  console.log(`Eval: ${scores.title} report — ${scores.scoreName} ${scores.overall}/100\n`);
  await run('gpt-5.5 (OpenAI)', process.env.OPENAI_MODEL || 'gpt-5.5', false);
  await run('GLM 5.2 (OpenRouter)', 'z-ai/glm-5.2', true);
})();
