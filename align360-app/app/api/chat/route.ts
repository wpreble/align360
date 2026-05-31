import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { buildSystemPrompt } from '@/lib/system-prompt';

export const runtime = 'nodejs';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// content is a string, or a vision array ([{type:'text'...},{type:'image_url'...}]).
type ChatMessage = { role: 'user' | 'assistant'; content: unknown };

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not set on the server.' },
      { status: 500 },
    );
  }

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

  const model = process.env.OPENAI_MODEL || 'gpt-5.5';
  let systemPrompt = buildSystemPrompt();

  // Make the user's assessment results instantly referenceable by the AI.
  const ctx = (body.profileContext || '').trim();
  if (ctx) {
    systemPrompt += `\n\n---\n\n# THE USER'S ALIGN360 PROFILE (from their completed assessments)\n\nReference this naturally to personalize guidance. It reflects the user's Foundational Self — do not re-administer assessments they have already completed.\n\n${ctx}`;
  }

  try {
    const completion = await client.chat.completions.create({
      model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: 'system', content: systemPrompt }, ...messages] as any,
      // gpt-5.5 reasoning tokens share this budget — keep headroom for the reply.
      max_completion_tokens: 3000,
    });

    const text = completion.choices[0]?.message?.content ?? '';
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('OpenAI error:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
