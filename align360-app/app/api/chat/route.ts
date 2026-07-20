import { NextRequest, NextResponse } from 'next/server';
import { buildSystemPrompt, chatDeliveryStyle } from '@/lib/system-prompt';
import { resolveModel, makeClient, genParams, charisChatOpts } from '@/lib/ai';
import { creditPrecheck, meterUsage } from '@/lib/credit-metering';

export const runtime = 'nodejs';

// content is a string, or a vision array ([{type:'text'...},{type:'image_url'...}]).
type ChatMessage = { role: 'user' | 'assistant'; content: unknown };

export async function POST(req: NextRequest) {
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

  // Attachment-aware routing. Images (image_url) and PDFs (OpenAI Files `file_id`)
  // need a vision + Files-capable model; GLM via OpenRouter can read neither. So
  // route attachment messages to OpenAI when its key is present; otherwise the
  // GLM path flattens them to a note (below) instead of hard-erroring. Text-only
  // chat stays on cheap GLM (CHAT_MODEL).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasAttachment = messages.some((m) => Array.isArray(m.content) && (m.content as any[]).some((p) => p?.type === 'image_url' || p?.type === 'file'));
  const openai = resolveModel('OPENAI_MODEL', 'gpt-5.5');
  const { model, provider, apiKey } = hasAttachment && openai.apiKey ? openai : resolveModel('CHAT_MODEL', 'gpt-5-mini');
  if (!apiKey) {
    return NextResponse.json(
      { error: `${provider === 'openai' ? 'OPENAI_API_KEY' : provider === 'charis' ? 'CHARIS_API_KEY' : 'OPENROUTER_API_KEY'} is not set on the server.` },
      { status: 500 },
    );
  }
  const client = makeClient(provider, apiKey);

  // GLM (OpenRouter) cannot consume image_url / file parts. If an attachment
  // message is heading there (no OpenAI key), flatten it to its text plus a note
  // so the model responds helpfully instead of the request 502ing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flattenForText = (msgs: any[]) => msgs.map((m) => {
    if (!Array.isArray(m.content)) return m;
    const text = m.content.filter((p: any) => p?.type === 'text').map((p: any) => p.text).filter(Boolean).join('\n');
    const notes: string[] = [];
    if (m.content.some((p: any) => p?.type === 'image_url')) notes.push('[The user attached an image, but image viewing is unavailable in this mode. Ask them to describe what they would like help with.]');
    if (m.content.some((p: any) => p?.type === 'file')) notes.push('[The user attached a file that cannot be read in this mode. Ask them to paste the relevant text.]');
    const merged = [text, notes.join(' ')].filter(Boolean).join('\n\n');
    return { ...m, content: merged || '(attachment)' };
  });
  // Only GLM (OpenRouter / Charis) needs the flatten; OpenAI can consume the
  // structured image_url / file parts, so keep them intact on that path.
  const prepared = provider === 'openai' ? messages : flattenForText(messages);

  const pre = await creditPrecheck();
  if (!pre.ok) {
    return NextResponse.json({ error: 'out_of_credits', message: 'You are out of credits this month. Top up to keep chatting.' }, { status: 402 });
  }

  let systemPrompt = buildSystemPrompt();

  // Chat-only voice layer: keep live replies concise and precise instead of the
  // heavy report structure. Not applied to report/profile generation.
  const style = chatDeliveryStyle();
  if (style) systemPrompt += `\n\n---\n\n${style}`;

  // Make the user's assessment results instantly referenceable by the AI.
  const ctx = (body.profileContext || '').trim();
  if (ctx) {
    systemPrompt += `\n\n---\n\n# THE USER'S ALIGN360 PROFILE (from their completed assessments)\n\nReference this naturally to personalize guidance. It reflects the user's Foundational Self — do not re-administer assessments they have already completed.\n\n${ctx}`;
  }

  const full = [{ role: 'system', content: systemPrompt }, ...prepared];
  // Chat: no reasoning tokens (cheap/fast); lower temperature for precision and a
  // tighter token ceiling as a brevity backstop (the voice layer does the real work).
  // Reports use reasoning:'low'.
  const baseParams = { model, ...genParams(provider, { maxTokens: 1500, reasoning: 'off', temperature: 0.5 }) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Chat is latency-sensitive: pin a Charis chat to its fast OpenRouter supplier
  // (no-op for OpenAI/OpenRouter providers). Reports don't do this (cheapest peer).
  const run = (msgs: any) =>
    client.chat.completions.create({ ...baseParams, messages: msgs } as any, charisChatOpts(provider));

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = (completion as any).usage;
    await meterUsage('chat', model, u?.prompt_tokens ?? 0, u?.completion_tokens ?? 0);
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('OpenAI error:', message);
    return NextResponse.json({ error: 'The assistant could not complete that request. Please try again.' }, { status: 502 });
  }
}
