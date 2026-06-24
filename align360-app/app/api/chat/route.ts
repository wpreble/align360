import { NextRequest, NextResponse } from 'next/server';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { resolveModel, makeClient, genParams } from '@/lib/ai';

export const runtime = 'nodejs';

// content is a string, or a vision array ([{type:'text'...},{type:'image_url'...}]).
type ChatMessage = { role: 'user' | 'assistant'; content: unknown };

export async function POST(req: NextRequest) {
  // Chat model (set CHAT_MODEL=z-ai/glm-5.2 to route through OpenRouter; default
  // gpt-5-mini on OpenAI). Headline reports use REPORT_MODEL, see those routes.
  const { model, useOpenRouter, apiKey } = resolveModel('CHAT_MODEL', 'gpt-5-mini');
  if (!apiKey) {
    return NextResponse.json(
      { error: `${useOpenRouter ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY'} is not set on the server.` },
      { status: 500 },
    );
  }
  const client = makeClient(useOpenRouter, apiKey);

  let body: { messages?: ChatMessage[]; profileContext?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: 'messages array is required.' }, { status: 400 });
  }

  let systemPrompt = buildSystemPrompt();

  // Make the user's assessment results instantly referenceable by the AI.
  const ctx = (body.profileContext || '').trim();
  if (ctx) {
    systemPrompt += `\n\n---\n\n# THE USER'S ALIGN360 PROFILE (from their completed assessments)\n\nReference this naturally to personalize guidance. It reflects the user's Foundational Self — do not re-administer assessments they have already completed.\n\n${ctx}`;
  }

  const full = [{ role: 'system', content: systemPrompt }, ...messages];
  // Chat: no reasoning tokens (cheap/fast). Reports use reasoning:'low'.
  const baseParams = { model, ...genParams(useOpenRouter, { maxTokens: 3000, reasoning: 'off' }) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = (msgs: any) =>
    client.chat.completions.create({ ...baseParams, messages: msgs } as any);

  // Drop {type:'file'} parts when a referenced file is gone (expired/deleted),
  // so an old session with a stale file_id stays usable instead of 400ing forever.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripFiles = (msgs: any[]) =>
    msgs.map((m) => {
      if (!Array.isArray(m.content)) return m;
      const kept = m.content.filter((p: any) => p?.type !== 'file');
      if (kept.length === m.content.length) return m;
      const textPart = m.content.find((p: any) => p?.type === 'text')?.text;
      return { ...m, content: kept.length ? kept : (textPart || '[an attached file is no longer available]') };
    });

  try {
    let completion;
    try {
      completion = await run(full);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (/file/i.test(msg) && /(no such|not found|expired|invalid|cannot)/i.test(msg)) {
        completion = await run(stripFiles(full)); // retry without the dead file
      } else {
        throw e;
      }
    }
    const text = completion.choices[0]?.message?.content ?? '';
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('OpenAI error:', message);
    return NextResponse.json({ error: 'The assistant could not complete that request. Please try again.' }, { status: 502 });
  }
}
