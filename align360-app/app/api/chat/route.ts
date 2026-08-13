import { NextRequest, NextResponse } from 'next/server';
import { buildSystemPrompt, chatDeliveryStyle } from '@/lib/system-prompt';
import { resolveModel, resolveModelStrict, makeClient, genParams, charisChatOpts } from '@/lib/ai';
import { creditPrecheck, meterUsage } from '@/lib/credit-metering';
import { getAccessStatus } from '@/lib/billing-access';

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

  // Paywall: onboarding is the free teaser; chat itself requires a subscription
  // once billing is enforced. Authoritative server-side check (the client also
  // pre-checks for instant UX, but this is what actually blocks the request).
  const acc = await getAccessStatus();
  if (acc.enforce && !acc.access) {
    return NextResponse.json({ error: 'paywall', message: 'Subscribe to chat with your AI guide.' }, { status: 402 });
  }

  // Attachment-aware routing. GLM via OpenRouter can read neither images nor
  // files, so attachments need a vision-capable target or they get flattened to
  // a note (below) rather than 502ing. Text-only chat stays on cheap GLM.
  //
  // IMAGE_MODEL routes IMAGES to an open-weights vision model (e.g. a DeepSeek
  // vision id on Charis) so image content stops going to a frontier lab, which
  // is the claim we want to be able to make to enterprise buyers. It is opt-in:
  // unset, or set without its provider key, falls back to OpenAI exactly as before.
  //
  // Setting IMAGE_MODEL is treated as a POLICY, not just a preference: once it is
  // configured, no attachment path may reach a frontier lab, because that is the
  // claim we make to enterprise buyers and it has to be true end to end.
  //
  // The consequence is PDFs. They are sent as OpenAI Files `file_id` parts, an
  // OpenAI-specific reference no other provider can resolve, so with IMAGE_MODEL
  // set they are NOT forwarded to OpenAI. They degrade to the flatten path below
  // ("paste the relevant text") instead. Restoring PDF reading without OpenAI
  // needs server-side text extraction at upload, which is a separate change.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partsOf = (m: any) => (Array.isArray(m.content) ? (m.content as any[]) : []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasImage = messages.some((m: any) => partsOf(m).some((p) => p?.type === 'image_url'));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasFile = messages.some((m: any) => partsOf(m).some((p) => p?.type === 'file'));

  const openai = resolveModel('OPENAI_MODEL', 'gpt-5.5');
  const imageModel = resolveModelStrict('IMAGE_MODEL');

  // visionCapable drives whether the structured parts survive; see `prepared`.
  let target = resolveModel('CHAT_MODEL', 'gpt-5-mini');
  let visionCapable = false;
  if (imageModel) {
    // Frontier-free mode. Images go to the open-weights vision model; PDFs fall
    // through to flatten rather than being handed to OpenAI.
    if (hasImage) { target = imageModel; visionCapable = true; }
  } else if ((hasImage || hasFile) && openai.apiKey) {
    target = openai; visionCapable = true;              // legacy path, unchanged
  }
  const { model, provider, apiKey } = target;
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
  // Keep the structured image_url / file parts only when we actually routed to a
  // vision-capable target. Gating this on `provider === 'openai'` (as it used to)
  // would silently strip the image the moment IMAGE_MODEL pointed anywhere else.
  const prepared = visionCapable ? messages : flattenForText(messages);

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
