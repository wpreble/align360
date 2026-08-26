/**
 * Voice validator for generated report prose.
 *
 * The VOICE block in lib/profile.ts tells the model what not to do. This checks
 * whether it listened. It exists because generation is nondeterministic: reviewing
 * one sample by eye says nothing about the sample that actually gets written.
 *
 * Drew reported (2026-08-18) that every AI-Era card came back in one rhythm:
 *   "AI optimizes within existing frames; it cannot decide the frame is wrong."
 *   "AI can simulate empathy but cannot create the felt safety of human presence."
 * The schema was naming the construction it wanted. The prompt is fixed, but a
 * prompt is a request, not a guarantee, so anything that writes prose to a real
 * person's report should verify before it persists.
 */

export type VoiceViolation = { rule: string; path: string; text: string };

/** "AI does X; it cannot do Y" and its variants, which is the drift Drew flagged. */
const AI_CANNOT = [
  /\bAI\b[^.!?;]{0,100}[;,]\s*(?:it|but it|yet it|and it)\s+(?:cannot|can't|can not|will never|never can)\b/i,
  /\bAI\b[^.!?]{0,60}\bcan\b[^.!?]{0,80},\s*but\s+(?:you|a human|people)\b/i,
  /\bAI\b[^.!?;]{0,100}\b(?:cannot|can't|can not)\b[^.!?]{0,80}\b(?:you|your|human)\b/i,
  // "AI does X; you do Y" — the contrast form, same template without the "cannot".
  /\bAI\b[^.!?;]{0,100}[;,]\s*(?:you|your)\b/i,
];

/** Words the VOICE block bans unless the person's own data makes them literal. */
const BANNED_WORDS = /\b(amplif(?:y|ies|ied|ying)|commodit(?:y|ies|ised|ized)|irreplaceable|moats?)\b/i;

/** House style: no em or en dashes anywhere in user-facing prose. */
const LONG_DASH = /[‒-―⸺⸻]|--/;

/** Walk every string in a JSON-ish value, yielding [dotted.path, text]. */
function* strings(v: unknown, path = ''): Generator<[string, string]> {
  if (typeof v === 'string') { yield [path, v]; return; }
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) yield* strings(v[i], `${path}[${i}]`);
    return;
  }
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      yield* strings(val, path ? `${path}.${k}` : k);
    }
  }
}

/**
 * Check a generated object (a whole Profile, or just its aiEra half) for voice
 * violations. Returns every violation found; empty array means clean.
 */
export function checkVoice(value: unknown): VoiceViolation[] {
  const out: VoiceViolation[] = [];
  const openers = new Map<string, { word: string; text: string; path: string }[]>();

  for (const [path, text] of strings(value)) {
    // Short labels and captions are not prose; they trip the word rules for no reason.
    const isProse = text.trim().split(/\s+/).length >= 6;

    if (isProse && AI_CANNOT.some((re) => re.test(text))) {
      out.push({ rule: 'ai-cannot-construction', path, text });
    }
    if (isProse && BANNED_WORDS.test(text)) {
      out.push({ rule: `banned-word:${(text.match(BANNED_WORDS) || [])[0]}`, path, text });
    }
    if (LONG_DASH.test(text)) {
      out.push({ rule: 'long-dash', path, text });
    }

    // Collect first words of sibling items so we can flag four cards that all
    // open the same way ("Do not open consecutive fields with the same word").
    //
    // Headings, captions and short structured values are excluded. The VOICE rule
    // is about sibling BODY copy sharing one rhythm; headings that open "You ..."
    // are a normal, readable pattern, and flagging them blocked a clean
    // regeneration on 2026-08-26 over prose that was not actually drifting.
    const leaf = path.split('.').pop()?.replace(/\[\d+\]$/, '') ?? '';
    const isLabelField = /^(heading|title|label|lbl|cap|value|name|statusLabel|eyebrow|subtitle|step)$/i.test(leaf);
    if (isProse && !isLabelField) {
      const parent = path.replace(/\[\d+\][^[]*$/, '');
      const first = text.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
      if (first) {
        const list = openers.get(parent) || [];
        list.push({ word: first, text, path });
        openers.set(parent, list);
      }
    }
  }

  for (const [parent, items] of openers) {
    if (items.length < 3) continue;
    const counts = new Map<string, number>();
    for (const it of items) counts.set(it.word, (counts.get(it.word) || 0) + 1);
    for (const [w, n] of counts) {
      if (n < 3) continue;
      // Name the offending fields, otherwise the violation is not actionable:
      // "3 siblings open with your" does not say which three.
      const hits = items.filter((it) => it.word === w);
      const where = hits.map((h) => h.path.replace(parent, '').replace(/^\./, '')).join(', ');
      out.push({
        rule: 'repeated-opener',
        path: parent,
        text: `${n} siblings open with "${w}" (${where}) e.g. "${hits[0].text.replace(/\s+/g, ' ').slice(0, 90)}"`,
      });
    }
  }

  return out;
}

/** One-line-per-violation rendering for CLI output. */
export function formatViolations(v: VoiceViolation[]): string {
  return v.map((x) => `  [${x.rule}] ${x.path}\n      ${x.text.replace(/\s+/g, ' ').slice(0, 160)}`).join('\n');
}
