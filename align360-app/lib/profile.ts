import type { Scores } from './scoring';
import { computeCurrencies, CURRENCY_CTX } from './currency';

export type Pill = { label: string; value: string };
export type SignalItem = { n: string; category: string; name: string; pct: number; desc: string };
export type PSRItem = { kind: 'p' | 's' | 'r'; label: string; heading: string; body: string };
export type CurrencyRow = { name: string; pct: number; ctx: string };
export type OppLegacy = { score: number; title: string; tag: string; chips: string[]; risk: string };
export type OppAI = { score: number; title: string; chips: string[]; why: string };
export type AICard = { status: 'rising' | 'holding' | 'pivot'; statusLabel: string; title: string; body: string; chips: string[] };
export type AIMove = { num: string; label: string; title: string; body: string; chips: string[] };
export type IrrCell = { lbl: string; cap: string; body: string; chips: string[]; aiNote: string };
export type PositioningRow = { n: string; label: string; value: string };

export type Profile = {
  hero: { eyebrow: string; title: string; subtitle: string; description: string; pills: Pill[]; latin: string };
  signals: { intro: string; items: SignalItem[]; edge: { label: string; title: string; body: string } };
  psr: PSRItem[];
  currency: { title: string; sub: string; rows: CurrencyRow[]; note: string };
  opportunity: {
    intro: string;
    legacy: { note: string; items: OppLegacy[] };
    ai: { title: string; note: string; items: OppAI[] };
  };
  aiEra: {
    reframeLabel: string;
    reframeTitle: string;
    reframeBody: string;
    cards: AICard[];
    moves: AIMove[];
    irreplaceable: { title: string; cells: IrrCell[] };
  };
  positioning: PositioningRow[];
  closing: { name: string; title: string; latin: string; note: string };
};

/**
 * Anti-formula voice rules, appended to both profile schemas.
 *
 * Drew, 2026-08-18: the AI-Era section read as "language drift". The cause was
 * the schema itself, not the model. `aiNote` asked for "what AI cannot do here"
 * four times over, so all four cells came back in one rhythm:
 *   "AI optimizes within a frame; it cannot decide the frame itself is wrong."
 *   "AI extrapolates from existing data; it cannot envision what has no precedent."
 *   "AI generates content; it cannot generate the human conviction..."
 *   "AI accelerates execution for the resourceful; it cannot create the will..."
 * The cards did the same with "AI can X, but you Y". Four aphorisms in a row stop
 * reading as insight and start reading as a template, which is exactly what he saw.
 *
 * Asking for variety is not enough on its own; the field descriptions had to stop
 * naming the construction they wanted. These rules cover the rest.
 */
const VOICE = `
VOICE (applies to every field):
- Write plainly and concretely. Prefer the specific detail from this person's data over a clever generalisation.
- Do NOT write aphorisms, epigrams, or maxims. If a line would work as a caption under any other person's profile, it is too general: rewrite it with their actual signals.
- Never use the construction "AI does X; it cannot do Y", or "AI can X, but you Y", or any variant. Do not open consecutive fields with the same word.
- Vary sentence shape and length across sibling items. Four cards should not share one rhythm.
- Do not use the words "amplify", "commodity", "irreplaceable" or "moat" unless the user's own data makes them literally accurate.
- No em dashes. Plain sentences, ordinary punctuation.`;

// Split schemas: the profile is generated as two PARALLEL calls so wall-clock
// is the slower half, not the sum (the single 18K-token call took ~60s).
export const PROFILE_SCHEMA_A = `Return ONLY a valid JSON object (no markdown fences) with EXACTLY these keys:
{
  "hero": { "eyebrow": "Align360 · DesignSuite · Full Identity Profile", "title": "The <Evocative Two-Word Archetype>", "subtitle": "of <short phrase>", "description": "2 sentences on the convergence of the three assessments and what it means in an AI era", "pills": [{"label":"Wiring","value":"<primary wiring gift>"},{"label":"Orientation","value":"<primary orientation>"},{"label":"Gift","value":"<rejection gift>"}], "latin": "<short Latin motto>" },
  "signals": { "intro": "1 sentence", "items": [ {"n":"I","category":"Wiring for Impact","name":"<gift name>","pct":<number>,"desc":"2 sentences"}, {"n":"II","category":"Orientation for Impact","name":"<name>","pct":<number>,"desc":"2 sentences"}, {"n":"III","category":"Rejection Gift","name":"<name>","pct":<number>,"desc":"2 sentences"} ], "edge": {"label":"Combined Signal · Your Strategic Edge","title":"<one line; wrap 1-2 key phrases in <em></em>>","body":"3 sentences on the rare combination"} },
  "psr": [ {"kind":"p","label":"Under Pressure","heading":"<short>","body":"3 sentences"}, {"kind":"s","label":"Under Stress","heading":"<short>","body":"3 sentences"}, {"kind":"r","label":"Risk Posture","heading":"<short>","body":"3 sentences"} ],
  "currency": { "title":"Currency constellation", "sub":"<one line>", "rows":[ {"name":"Knowledge","ctx":"<2-3 words>"}, {"name":"Integrity","ctx":"..."}, {"name":"Honor","ctx":"..."}, {"name":"Relationships","ctx":"..."}, {"name":"Courage","ctx":"..."}, {"name":"Creativity","ctx":"..."}, {"name":"Service","ctx":"..."}, {"name":"Conviction","ctx":"..."} ], "note":"2-3 sentences" },
  "positioning": [ {"n":"I","label":"Identity Layer · Wiring & Orientation","value":"1 sentence"}, {"n":"II","label":"Transformation Layer · Rejection Gift","value":"1 sentence"}, {"n":"III","label":"Value Layer · True Riches Currency","value":"1 sentence"}, {"n":"IV","label":"Advantage Layer · Combined Edge","value":"1 sentence"}, {"n":"V","label":"Opportunity Layer · AI-Era Calibration","value":"1 sentence"} ],
  "closing": { "name":"<first name>", "title":"<same archetype as hero, full>", "latin":"<same Latin motto>", "note":"3 sentences, grounded and dignified" }
}
For "currency" keep all eight names and their order exactly as shown; the system sets each currency's percentage from the assessment scores, so provide only the short "ctx" label (2-3 words) per row, not a number. Honor the governance: present options not directives, never rank human worth, never manufacture urgency. Use the user's assessment data below to make every field specific to them.
${VOICE}`;

export const PROFILE_SCHEMA_B = `Return ONLY a valid JSON object (no markdown fences) with EXACTLY these keys:
{
  "opportunity": { "intro":"2 sentences framing legacy vs AI-era", "legacy": {"note":"1 sentence; the 2022-market caveat","items":[ {"score":<70-95>,"title":"<role category>","tag":"<which gifts>","chips":["Role A","Role B","Role C"],"risk":"⚠ AI risk: <one line> OR ↑ AI opportunity: <one line>"} ]}, "ai": {"title":"The same profile. A different world.","note":"1-2 sentences","items":[ {"score":<85-97>,"title":"<AI-era role category>","chips":["Role A","Role B","Role C"],"why":"2 sentences, specific to this person's signals, on why this role gets more valuable rather than less. Do not use the word amplify."} ]} },
  "aiEra": { "reframeLabel":"The honest picture", "reframeTitle":"<one line, stated plainly; wrap a phrase in <em></em>>", "reframeBody":"3 sentences grounded in this person's actual scores; you may wrap key phrases in <strong></strong>", "cards":[ {"status":"rising","statusLabel":"↑ Rising in AI world","title":"<short>","body":"2 sentences; describe what this person does, not what machines fail to do","chips":["A","B","C"]}, {"status":"holding","statusLabel":"→ Holding (if repositioned)","title":"<short>","body":"2 sentences; open with a different word than the other cards","chips":["A","B","C"]}, {"status":"pivot","statusLabel":"⟳ Needs a pivot","title":"<short>","body":"2 sentences; open with a different word than the other cards","chips":["A","B","C"]} ], "moves":[ {"num":"I","label":"Move to make now","title":"<short>","body":"2 sentences; do NOT begin with \"Your\"","chips":["A","B","C"]}, {"num":"II","label":"Work to prioritize next 12 months","title":"<short>","body":"2 sentences; open with a different word than the other moves","chips":["A","B","C"]}, {"num":"III","label":"Identity to protect always","title":"<short>","body":"2 sentences; open with a different word than the other moves","chips":["A","B","C"]} ], "irreplaceable": {"title":"Capabilities that become more valuable as AI advances","cells":[ {"lbl":"Capability I","cap":"<short italic phrase>","body":"2 sentences; do NOT begin with \"Your\", and no two of the four cells may open with the same word","chips":["A","B"],"aiNote":"<one line, plain and concrete: the specific thing this capability depends on that automation does not supply. Must NOT begin with the word AI. Each of the four cells must use a different sentence shape.>"} ]} }
}
Provide exactly 4 legacy items, 4 ai items, and 4 irreplaceable cells. Honor the governance: name AI-era calibration honestly (legacy signals are "incomplete, not wrong"), present options not directives, never manufacture urgency. Use the user's assessment data below to make every field specific to them.
${VOICE}`;

/** Deterministic fallback so the result page always renders (no key / API error). */
export function fallbackProfile(scores: Scores, name: string): Profile {
  const w = scores.wiring.primary || 'Builder';
  const w2 = scores.wiring.secondary || 'Organizer';
  const o = scores.orientation.primary || 'Strategic';
  const g = scores.rejectionGift.primary || 'Resilient Reframer';
  const archetype = `The ${w} ${w2 === w ? 'Builder' : w2}`;

  return {
    hero: {
      eyebrow: 'Align360 · DesignSuite · Full Identity Profile',
      title: archetype,
      subtitle: 'a working read of how you create value',
      description:
        'Three assessments, one convergence. This is a preliminary synthesis generated from your responses. A fuller AI-written profile appears when narrative generation is enabled.',
      pills: [
        { label: 'Wiring', value: w },
        { label: 'Orientation', value: o },
        { label: 'Gift', value: g },
      ],
      latin: 'Veritas · Structura · Progressus',
    },
    signals: {
      intro: 'Each assessment illuminates a different dimension. The identity emerges in the convergence.',
      items: [
        { n: 'I', category: 'Wiring for Impact', name: w, pct: scores.wiring.ranked[0]?.pct ?? 80, desc: `Your strongest wiring signal is ${w}, with ${w2} close behind.` },
        { n: 'II', category: 'Orientation for Impact', name: o, pct: scores.orientation.ranked[0]?.pct ?? 60, desc: `You orient toward situations primarily as a ${o}.` },
        { n: 'III', category: 'Rejection Gift', name: g, pct: scores.rejectionGift.ranked[0]?.pct ?? 50, desc: `Adversity forged a ${g} capability in you.` },
      ],
      edge: { label: 'Combined Signal · Your Strategic Edge', title: `You bring <em>${w}</em> wiring to <em>${o}</em> problems`, body: 'A fuller synthesis of your combined edge generates when the narrative engine is connected.' },
    },
    psr: [
      { kind: 'p', label: 'Under Pressure', heading: 'You lead with your wiring', body: 'Under pressure your primary gift takes the lead.' },
      { kind: 's', label: 'Under Stress', heading: 'You process before you act', body: 'Stress narrows you toward your most trusted mode.' },
      { kind: 'r', label: 'Risk Posture', heading: 'Calibrated to your orientation', body: 'You assess risk through your orientation lens first.' },
    ],
    currency: {
      title: 'Currency constellation',
      sub: 'The primary currencies are structural; they hold regardless of market conditions',
      // Deterministic 0-100 from the computed signals (same source the API route
      // pins onto the AI-written profile), so the fallback matches the live path.
      rows: computeCurrencies(scores).map((c) => ({ name: c.name, pct: c.pct, ctx: CURRENCY_CTX[c.name] })),
      note: 'A detailed currency reading generates when the narrative engine is connected.',
    },
    opportunity: {
      intro: 'The first set of signals reflects a stable professional landscape. The second reflects where value concentrates in an AI-accelerated world.',
      legacy: { note: 'These signals are incomplete, not wrong; read them as a baseline.', items: [{ score: 85, title: 'Roles aligned to your wiring', tag: `${w} · ${o}`, chips: ['Aligned roles'], risk: '⚠ AI risk: connect the narrative engine for calibrated detail.' }] },
      ai: { title: 'The same profile. A different world.', note: 'AI concentrates value toward judgment and edge.', items: [{ score: 92, title: 'Edge-level work AI cannot replicate', chips: ['Edge roles'], why: 'Detailed AI-era signals generate when the narrative engine is connected.' }] },
    },
    aiEra: {
      reframeLabel: 'The honest picture',
      reframeTitle: 'AI is not your threat.<br><em>Generic positioning is.</em>',
      reframeBody: 'AI automates the competent middle of every market. What it cannot automate is the edge: the judgment, the lived perspective, the integrity. Your profile sits toward that edge.',
      cards: [
        { status: 'rising', statusLabel: '↑ Rising in AI world', title: 'Your strongest wiring', body: 'Becomes rarer as AI floods the middle.', chips: [] },
        { status: 'holding', statusLabel: '→ Holding (if repositioned)', title: 'Your transferable strengths', body: 'Hold their value with a positioning shift.', chips: [] },
        { status: 'pivot', statusLabel: '⟳ Needs a pivot', title: 'Commodity work', body: 'Move from execution to judgment.', chips: [] },
      ],
      moves: [
        { num: 'I', label: 'Move to make now', title: 'Position at the edge', body: 'Lead with the capability AI makes more valuable.', chips: [] },
        { num: 'II', label: 'Work to prioritize', title: 'Seek disruption', body: 'Find organizations mid-transition.', chips: [] },
        { num: 'III', label: 'Identity to protect', title: 'Protect your lived perspective', body: 'It is the part of your work that stays yours as the tools improve.', chips: [] },
      ],
      // FOUR cells, not one. `.irr-grid` is a two-column grid, so a single cell
      // rendered an empty panel beside it — which is what Drew reported on
      // 2026-08-25 as "missing the second capability". The schema asks the model
      // for four; the fallback has to match or the layout breaks for every user
      // who lands here (no provider, API error, or a failed parse).
      // Grounded in this person's actual wiring/orientation/gift so the fallback
      // is still about them, and written to pass lib/voice-check.
      irreplaceable: {
        title: 'Capabilities that become more valuable as AI advances',
        cells: [
          { lbl: 'Capability I', cap: `Reading a situation the way a ${w} does`,
            body: `The pattern you notice first is not the one most people notice. That is a function of how you are wired, not a technique you picked up.`,
            chips: [], aiNote: 'Judgment built from being in the room, repeatedly, with something at stake.' },
          { lbl: 'Capability II', cap: 'Deciding what matters before deciding what to do',
            body: `Your ${o} orientation sets the frame. Choosing which problem deserves the effort sits upstream of solving it.`,
            chips: [], aiNote: 'Someone has to own that choice and answer for it afterwards.' },
          { lbl: 'Capability III', cap: 'Perspective earned the hard way',
            body: `${g} came out of something you lived through. It carries weight when you bring it to someone facing the same thing.`,
            chips: [], aiNote: 'Credibility of this kind accumulates. It cannot be retrieved on demand.' },
          { lbl: 'Capability IV', cap: 'Staying with a problem past the first answer',
            body: 'Fast answers are abundant now. The discipline to reject a quick wrong one is the scarce part.',
            chips: [], aiNote: 'A habit of attention, built over time rather than installed.' },
        ],
      },
    },
    positioning: [
      { n: 'I', label: 'Identity Layer · Wiring & Orientation', value: `${w} · ${o}` },
      { n: 'II', label: 'Transformation Layer · Rejection Gift', value: g },
      { n: 'III', label: 'Value Layer · True Riches Currency', value: 'Knowledge → Integrity → Honor' },
      { n: 'IV', label: 'Advantage Layer · Combined Edge', value: `${w} wiring applied to ${o} problems` },
      { n: 'V', label: 'Opportunity Layer · AI-Era Calibration', value: 'Judgment at the level AI cannot reach' },
    ],
    closing: { name, title: archetype, latin: 'Veritas · Structura · Progressus', note: 'These patterns describe who you are at your best. Connect the narrative engine for the full reading.' },
  };
}
