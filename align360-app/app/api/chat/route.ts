import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { buildSystemPrompt } from '@/lib/system-prompt';

export const runtime = 'nodejs';

// content is a string, or a vision array ([{type:'text'...},{type:'image_url'...}]).
type ChatMessage = { role: 'user' | 'assistant'; content: unknown };

export async function POST(req: NextRequest) {
  // Chat runs on a cheaper model than the headline reports (profile/clarity stay on
  // OPENAI_MODEL=gpt-5.5). Default gpt-5-mini; set CHAT_MODEL to an OpenRouter id
  // (e.g. z-ai/glm-5.2) to route chat through OpenRouter instead.
  const model = process.env.CHAT_MODEL || 'gpt-5-mini';
  const useOpenRouter = model.includes('/') && !!process.env.OPENROUTER_API_KEY;
  const apiKey = useOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: `${useOpenRouter ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY'} is not set on the server.` },
      { status: 500 },
    );
  }
  // Instantiate lazily (not at module scope) so the build doesn't require a key.
  const client = new OpenAI(
    useOpenRouter
      ? { apiKey, baseURL: 'https://openrouter.ai/api/v1', defaultHeaders: { 'HTTP-Referer': 'https://align360-app.vercel.app', 'X-Title': 'Align360' } }
      : { apiKey },
  );

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
  // OpenRouter models use max_tokens + the unified `reasoning` flag (disabled here
  // for cheap/fast chat); OpenAI models use max_completion_tokens + reasoning_effort.
  const baseParams = useOpenRouter
    ? { model, max_tokens: 3000, reasoning: { enabled: false } }
    : { model, max_completion_tokens: 3000, reasoning_effort: 'low' };
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
