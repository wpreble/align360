import type { ReportScores, WiringScores, OrientationScores, RejectionScores, ReportSlug } from './report-scoring';

// AI narrative layer for the three CORE assessment reports. Scores are computed
// deterministically (report-scoring.ts); this module defines the written
// analysis the model produces over those scores, a deterministic fallback so the
// report always renders, and the merge that guarantees a complete object even
// from partial/thin model JSON. Mirrors lib/clarity.ts, one shape per assessment.

export type PSR = {
  pressure: { heading: string; body: string };
  stress: { heading: string; body: string };
  risk: { heading: string; body: string };
};

export type WiringNarrative = {
  hero: { prefix: string; em: string; line2: string; descriptor: string };
  primary: { facets: string; body: string };
  supporting: { tagline: string; body: string };
  blend: { name: string; body: string };
  contexts: { area: string; title: string; body: string }[]; // 4
  psr: PSR;
  energy: { thrives: string[]; drains: string[] };
  watchouts: { title: string; body: string }[]; // 3
};

export type OrientationNarrative = {
  hero: { prefix: string; em: string; line2: string; descriptor: string; primaryQuestion: string; secondaryQuestion: string };
  blend: { name: string; body: string };
  shows: { area: string; title: string; body: string }[]; // 6
  risk: { position: number; pressure: string; uncertainty: string; faith: string };
  psr: PSR;
  matrix: { label: string; value: string; desc: string }[]; // 4
};

export type RejectionNarrative = {
  hero: { prefix: string; em: string; line2: string; descriptor: string };
  archetype: { name: string; titlePrefix: string; titleEm: string; body: string; quote: string };
  signature: { name: string; body: string };
  parallels: { name: string; rejected: string; gift: string }[]; // 3
  flow: { title: string; body: string }[]; // 4
  psr: PSR;
  advantage: { title: string; body: string; envs: string[] };
};

export type ReportNarrative = WiringNarrative | OrientationNarrative | RejectionNarrative;

export type ReportResult = { scores: ReportScores; narrative: ReportNarrative; name: string; generatedAt: string };

/* ── Config (eyebrow, accent, completion step) ──────────────────────────────── */

export const CONTEXT_AREAS = ['Work & Vocation', 'Relationships & Community', 'Leadership & Influence', 'Life & Philosophy'] as const;
export const SHOWS_AREAS = ['Reading Situations', 'Making Decisions', 'Communicating', 'Under Conflict', 'Under Complexity', 'Core Curiosity'] as const;
export const MATRIX_LABELS = ['AI guidance emphasis', 'How this combination expresses', 'Unique team value', 'Best environments'] as const;
export const FLOW_LABELS = ['Rejection experience', 'What you did with it', 'What it developed', 'What you bring now'] as const;

type Cfg = { roman: string; step: number; accent: 'gold' | 'teal' | 'plum' };
export const REPORT_CONFIG: Record<ReportSlug, Cfg> = {
  wiring: { roman: 'I', step: 1, accent: 'gold' },
  orientation: { roman: 'II', step: 2, accent: 'teal' },
  'rejection-gift': { roman: 'III', step: 3, accent: 'plum' },
};

export function reportEyebrow(scores: ReportScores): string {
  return `Align360 · Assessment ${REPORT_CONFIG[scores.slug].roman} of III · ${scores.title}`;
}

/* ── Schemas (model instructions) ───────────────────────────────────────────── */

const PSR_SHAPE = `"psr": { "pressure": {"heading":"<short>","body":"3 sentences on how this shows up under pressure, named with one honest growth edge"}, "stress": {"heading":"<short>","body":"3 sentences under stress"}, "risk": {"heading":"<short>","body":"3 sentences on risk posture"} }`;
const GOV = `Honor the governance: present patterns not directives, name growth edges as precise and addressable (never as worth or deficiency), never rank human worth, never manufacture urgency, never invent biographical facts. Write in warm, dignified, second-person ("you"). Every field must be specific to this person's answers.`;

function wiringSchema(s: WiringScores): string {
  const list = s.gifts.map((g) => `${g.tag} ${g.pct}%`).join(', ');
  return `Return ONLY a valid JSON object (no markdown fences) with EXACTLY this shape:
{
  "hero": { "prefix":"<2-3 word lead, e.g. 'The Principled'>", "em":"<the primary gift word as a one-word archetype noun, e.g. 'Organizer'>", "line2":"<one line: the rare thing about how they build, ~10 words>", "descriptor":"3 sentences on their signature, contrasting them with a generic ${s.primary}" },
  "primary": { "facets":"<4 single words joined by ' · ' that capture the ${s.primary} gift>", "body":"4-5 sentences on the ${s.primary} gift (their primary, ${s.primaryPct}%): how it shows up, when they feel most alive, the friction when it is blocked" },
  "supporting": { "tagline":"<3-5 words for the ${s.secondary} supporting gift>", "body":"3-4 sentences on how ${s.secondary} (${s.secondaryPct}%) sharpens the primary into something rarer" },
  "blend": { "name":"<evocative 2-3 word name for the ${s.primary}+${s.secondary} blend>", "body":"3-4 sentences on why this combination is rare and valuable" },
  "contexts": [ ${CONTEXT_AREAS.map((a) => `{"area":${JSON.stringify(a)},"title":"<short, ~8 words>","body":"2-3 sentences on how their wiring shows up in ${a.toLowerCase()}"}`).join(', ')} ],
  ${PSR_SHAPE},
  "energy": { "thrives":["<5-7 short phrases of environments/work that energize this wiring>"], "drains":["<4-6 short phrases that drain it>"] },
  "watchouts": [ {"title":"<short>","body":"2 sentences"}, {"title":"<short>","body":"2 sentences"}, {"title":"<short>","body":"2 sentences"} ]
}
Their nine gifts, ranked: ${list}. Primary ${s.primary} (${s.primaryPct}%), supporting ${s.secondary} (${s.secondaryPct}%).
${GOV}`;
}

function orientationSchema(s: OrientationScores): string {
  const list = s.orientations.map((o) => `${o.tag} ${o.pct}%`).join(', ');
  return `Return ONLY a valid JSON object (no markdown fences) with EXACTLY this shape:
{
  "hero": { "prefix":"<2-3 word lead, e.g. 'The Principled'>", "em":"<one-word archetype noun drawn from ${s.primary}>", "line2":"<one line, ~10 words>", "descriptor":"3 sentences on their ${s.blended ? 'blended' : 'primary'} orientation lens", "primaryQuestion":"<the question the ${s.primary} silently asks of every situation, in quotes>", "secondaryQuestion":"<the question the ${s.secondary} asks, in quotes>" },
  "blend": { "name":"<evocative 2-3 word name for the ${s.primary}${s.blended ? ' + ' + s.secondary : ''} orientation>", "body":"4-5 sentences on how they see and decide, naming the cost and the gain" },
  "shows": [ ${SHOWS_AREAS.map((a) => `{"area":${JSON.stringify(a)},"title":"<short, ~7 words>","body":"2-3 sentences on '${a}'"}`).join(', ')} ],
  "risk": { "position":<0-100, where 0=protect stability first, 50=balanced wisdom, 100=move before clarity>, "pressure":"2 sentences on how they handle risk under pressure", "uncertainty":"2 sentences under uncertainty", "faith":"2 sentences on their faith/conviction posture in decisions" },
  ${PSR_SHAPE},
  "matrix": [ ${MATRIX_LABELS.map((l) => `{"label":${JSON.stringify(l)},"value":"<3-6 word phrase>","desc":"1 sentence"}`).join(', ')} ]
}
Their five orientations, ranked: ${list}. Primary ${s.primary} (${s.primaryPct}%), secondary ${s.secondary} (${s.secondaryPct}%)${s.blended ? ', these are nearly equal, a genuine dual/blended orientation' : ''}.
${GOV}`;
}

function rejectionSchema(s: RejectionScores): string {
  const list = s.categories.map((c) => `${c.tag} ${c.pct}%`).join(', ');
  return `Return ONLY a valid JSON object (no markdown fences) with EXACTLY this shape:
{
  "hero": { "prefix":"<2-3 word lead, e.g. 'The Paradigm'>", "em":"<one-word noun completing the signature trait '${s.signatureTrait}'>", "line2":"<one line reframing the rejection as selection, ~9 words>", "descriptor":"3 sentences reframing what felt like rejection as the forging of a gift" },
  "archetype": { "name":"<the story archetype, e.g. '${s.storyArchetypeHint}'>", "titlePrefix":"<first half of a one-line title>", "titleEm":"<second half, emphasized>", "body":"4-5 sentences naming the pattern across their answers: what the world misread, and what it actually was", "quote":"<a single resonant first-person-adjacent line in quotes>" },
  "signature": { "name":"<the signature trait, e.g. '${s.signatureTrait}'>", "body":"3-4 sentences on this specific edge within the ${s.primary} gift" },
  "parallels": [ {"name":"<a real, widely-known figure who carried this same gift>","rejected":"<one line on how they were rejected/dismissed>","gift":"<one line on what they ultimately did>"}, {"name":"...","rejected":"...","gift":"..."}, {"name":"...","rejected":"...","gift":"..."} ],
  "flow": [ ${FLOW_LABELS.map((l) => `{"title":"<short, the '${l}' moment>","body":"2-3 sentences"}`).join(', ')} ],
  ${PSR_SHAPE},
  "advantage": { "title":"<one line naming the forged competitive advantage>", "body":"3-4 sentences on why this is a strategic capability, not a soft skill", "envs":["<5 short environment/role phrases where this gift compounds>"] }
}
Their five gift categories, ranked: ${list}. Primary category ${s.primary} (${s.primaryPct}%), dominant signature trait "${s.signatureTrait}".
Pick parallels that genuinely fit the ${s.primary} gift; use real figures and accurate one-line framing.
${GOV}`;
}

export function schemaFor(scores: ReportScores): string {
  if (scores.kind === 'wiring') return wiringSchema(scores);
  if (scores.kind === 'orientation') return orientationSchema(scores);
  return rejectionSchema(scores);
}

/* ── Deterministic fallbacks ────────────────────────────────────────────────── */

const psrFallback = (subject: string): PSR => ({
  pressure: { heading: 'You lead with your strongest pattern', body: `Under pressure, ${subject} takes the lead. This is a strength; at its edge it can move before there is enough information. A fuller reading generates when the narrative engine is connected.` },
  stress: { heading: 'You narrow toward what you trust', body: 'Under stress you default to your most reliable mode. Naming that out loud helps the people around you keep pace.' },
  risk: { heading: 'Calibrated and grounded', body: 'You assess before you commit, and you move when you understand. A detailed read generates when the narrative engine is connected.' },
});

function fallbackWiring(s: WiringScores, name: string): WiringNarrative {
  return {
    hero: { prefix: 'The', em: s.primary, line2: 'How you are built to create value', descriptor: `${name ? name + "'s" : 'Your'} wiring centers on ${s.primary}, with ${s.secondary} close behind. This is a working read from your answers; a fuller written analysis appears when the narrative engine is connected.` },
    primary: { facets: 'Direction · Order · Structure · Contribution', body: `Your primary wiring gift is ${s.primary} at ${s.primaryPct}%. This is how you most naturally create impact when you are at your best. A detailed reading generates when the narrative engine is connected.` },
    supporting: { tagline: `Supporting · ${s.secondary}`, body: `Your ${s.secondary} gift (${s.secondaryPct}%) sharpens your primary into something more specific than either alone.` },
    blend: { name: `The ${s.primary} ${s.secondary}`, body: 'The combination of your top two gifts is the rare part of your profile. The full synthesis generates when the narrative engine is connected.' },
    contexts: CONTEXT_AREAS.map((area) => ({ area, title: `How your wiring shows up`, body: `Your ${s.primary} gift carries into ${area.toLowerCase()}. A specific reading generates when the narrative engine is connected.` })),
    psr: psrFallback(`your ${s.primary} gift`),
    energy: { thrives: ['Clear, high-stakes problems', 'Building new systems', 'Environments with real standards'], drains: ['Vague expectations', 'Motion without direction', 'Repetitive routine'] },
    watchouts: [
      { title: 'Overusing your strength', body: 'Every gift has a cost when overused. The specific watch-out for your wiring generates when the narrative engine is connected.' },
      { title: 'The lowest signals', body: `Your least-expressed gifts are where the most growth is available. They are not flaws, just under-practiced.` },
      { title: 'Balancing pace and depth', body: 'Knowing when to act and when to wait is the edge for your profile.' },
    ],
  };
}

function fallbackOrientation(s: OrientationScores, name: string): OrientationNarrative {
  return {
    hero: { prefix: 'The', em: s.primary, line2: 'How you naturally see the world', descriptor: `${name ? name + "'s" : 'Your'} orientation is led by ${s.primary}${s.blended ? `, in near-equal tension with ${s.secondary}` : `, with ${s.secondary} supporting`}. A fuller analysis appears when the narrative engine is connected.`, primaryQuestion: 'What is actually true here?', secondaryQuestion: 'What needs to be built?' },
    blend: { name: `The ${s.primary}${s.blended ? ' ' + s.secondary : ''}`, body: `Your orientation is how you interpret situations and decide what to do. Yours leads with ${s.primary} at ${s.primaryPct}%. A detailed reading generates when the narrative engine is connected.` },
    shows: SHOWS_AREAS.map((area) => ({ area, title: area, body: `How your ${s.primary} orientation handles "${area.toLowerCase()}" generates when the narrative engine is connected.` })),
    risk: { position: 50, pressure: 'Under pressure you reassess before committing.', uncertainty: 'You work to resolve partial information rather than act through it.', faith: 'Your decisions integrate conviction and dialogue.' },
    psr: psrFallback(`your ${s.primary} orientation`),
    matrix: MATRIX_LABELS.map((label) => ({ label, value: 'Generates with the engine', desc: 'A cross-signal reading generates when the narrative engine is connected.' })),
  };
}

function fallbackRejection(s: RejectionScores, name: string): RejectionNarrative {
  return {
    hero: { prefix: 'The', em: s.signatureTrait.split(' ').slice(-1)[0] || 'Challenger', line2: 'What felt like rejection was selection', descriptor: `${name ? name + "'s" : 'Your'} hardest seasons forged a ${s.primary} gift. A fuller reading appears when the narrative engine is connected.` },
    archetype: { name: s.storyArchetypeHint, titlePrefix: 'What they misread', titleEm: 'was your edge forming', body: 'The pattern across your answers points to a specific gift that adversity forged in you. A detailed reading generates when the narrative engine is connected.', quote: '"What they called a flaw was a capability arriving early."' },
    signature: { name: s.signatureTrait, body: `Within the ${s.primary} gift, your specific edge is the ${s.signatureTrait}. A detailed reading generates when the narrative engine is connected.` },
    parallels: [
      { name: 'A figure who carried this gift', rejected: 'Was dismissed for the very trait that became their edge', gift: 'A full set of parallels generates when the narrative engine is connected' },
      { name: 'A figure who carried this gift', rejected: 'Was misread before they were understood', gift: 'Generates with the engine' },
      { name: 'A figure who carried this gift', rejected: 'Was overlooked before they were essential', gift: 'Generates with the engine' },
    ],
    flow: FLOW_LABELS.map((title) => ({ title, body: `The "${title.toLowerCase()}" layer of how your gift emerged generates when the narrative engine is connected.` })),
    psr: psrFallback(`your ${s.primary} gift`),
    advantage: { title: 'A strategic capability forged through difficulty', body: `What was forged through your hardest seasons is a strategic capability, not a soft skill. A detailed reading generates when the narrative engine is connected.`, envs: ['Strategic advisory', 'Organizational reform', 'Leadership development', 'Innovation', 'Teaching & mentoring'] },
  };
}

export function fallbackNarrative(scores: ReportScores, name: string): ReportNarrative {
  if (scores.kind === 'wiring') return fallbackWiring(scores, name);
  if (scores.kind === 'orientation') return fallbackOrientation(scores, name);
  return fallbackRejection(scores, name);
}

/* ── Merge model output over the fallback (guarantees a complete object) ─────── */

const str = (a: unknown, fb: string): string => (typeof a === 'string' && a.trim() ? a : fb);
const arr = (a: unknown, fb: string[]): string[] => (Array.isArray(a) && a.filter((x) => typeof x === 'string' && x.trim()).length ? (a.filter((x) => typeof x === 'string' && x.trim()) as string[]) : fb);
const num = (a: unknown, fb: number): number => (typeof a === 'number' && isFinite(a) ? Math.max(0, Math.min(100, a)) : fb);

function mergePSR(p: Partial<PSR> | undefined, fb: PSR): PSR {
  const m = (k: keyof PSR) => ({ heading: str(p?.[k]?.heading, fb[k].heading), body: str(p?.[k]?.body, fb[k].body) });
  return { pressure: m('pressure'), stress: m('stress'), risk: m('risk') };
}

export function mergeNarrative(scores: ReportScores, fb: ReportNarrative, parsed: Record<string, unknown>): ReportNarrative {
  const p = parsed as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  if (scores.kind === 'wiring') {
    const f = fb as WiringNarrative;
    const pc = Array.isArray(p.contexts) ? p.contexts : [];
    const pw = Array.isArray(p.watchouts) ? p.watchouts : [];
    return {
      hero: { prefix: str(p.hero?.prefix, f.hero.prefix), em: str(p.hero?.em, f.hero.em), line2: str(p.hero?.line2, f.hero.line2), descriptor: str(p.hero?.descriptor, f.hero.descriptor) },
      primary: { facets: str(p.primary?.facets, f.primary.facets), body: str(p.primary?.body, f.primary.body) },
      supporting: { tagline: str(p.supporting?.tagline, f.supporting.tagline), body: str(p.supporting?.body, f.supporting.body) },
      blend: { name: str(p.blend?.name, f.blend.name), body: str(p.blend?.body, f.blend.body) },
      contexts: f.contexts.map((c, i) => ({ area: c.area, title: str(pc[i]?.title, c.title), body: str(pc[i]?.body, c.body) })),
      psr: mergePSR(p.psr, f.psr),
      energy: { thrives: arr(p.energy?.thrives, f.energy.thrives), drains: arr(p.energy?.drains, f.energy.drains) },
      watchouts: f.watchouts.map((w, i) => ({ title: str(pw[i]?.title, w.title), body: str(pw[i]?.body, w.body) })),
    } as WiringNarrative;
  }

  if (scores.kind === 'orientation') {
    const f = fb as OrientationNarrative;
    const ps = Array.isArray(p.shows) ? p.shows : [];
    const pm = Array.isArray(p.matrix) ? p.matrix : [];
    return {
      hero: { prefix: str(p.hero?.prefix, f.hero.prefix), em: str(p.hero?.em, f.hero.em), line2: str(p.hero?.line2, f.hero.line2), descriptor: str(p.hero?.descriptor, f.hero.descriptor), primaryQuestion: str(p.hero?.primaryQuestion, f.hero.primaryQuestion), secondaryQuestion: str(p.hero?.secondaryQuestion, f.hero.secondaryQuestion) },
      blend: { name: str(p.blend?.name, f.blend.name), body: str(p.blend?.body, f.blend.body) },
      shows: f.shows.map((c, i) => ({ area: c.area, title: str(ps[i]?.title, c.title), body: str(ps[i]?.body, c.body) })),
      risk: { position: num(p.risk?.position, f.risk.position), pressure: str(p.risk?.pressure, f.risk.pressure), uncertainty: str(p.risk?.uncertainty, f.risk.uncertainty), faith: str(p.risk?.faith, f.risk.faith) },
      psr: mergePSR(p.psr, f.psr),
      matrix: f.matrix.map((c, i) => ({ label: c.label, value: str(pm[i]?.value, c.value), desc: str(pm[i]?.desc, c.desc) })),
    } as OrientationNarrative;
  }

  const f = fb as RejectionNarrative;
  const pp = Array.isArray(p.parallels) ? p.parallels.filter((x: any) => x && typeof x.name === 'string') : [];
  const pf = Array.isArray(p.flow) ? p.flow : [];
  return {
    hero: { prefix: str(p.hero?.prefix, f.hero.prefix), em: str(p.hero?.em, f.hero.em), line2: str(p.hero?.line2, f.hero.line2), descriptor: str(p.hero?.descriptor, f.hero.descriptor) },
    archetype: { name: str(p.archetype?.name, f.archetype.name), titlePrefix: str(p.archetype?.titlePrefix, f.archetype.titlePrefix), titleEm: str(p.archetype?.titleEm, f.archetype.titleEm), body: str(p.archetype?.body, f.archetype.body), quote: str(p.archetype?.quote, f.archetype.quote) },
    signature: { name: str(p.signature?.name, f.signature.name), body: str(p.signature?.body, f.signature.body) },
    // Always exactly 3, model-or-fallback per field by index (same pattern as flow/contexts),
    // so a partial model parallel can never blank a card or borrow a mismatched fallback.
    parallels: f.parallels.map((c, i) => ({ name: str(pp[i]?.name, c.name), rejected: str(pp[i]?.rejected, c.rejected), gift: str(pp[i]?.gift, c.gift) })),
    flow: f.flow.map((c, i) => ({ title: str(pf[i]?.title, c.title), body: str(pf[i]?.body, c.body) })),
    psr: mergePSR(p.psr, f.psr),
    advantage: { title: str(p.advantage?.title, f.advantage.title), body: str(p.advantage?.body, f.advantage.body), envs: arr(p.advantage?.envs, f.advantage.envs) },
  } as RejectionNarrative;
}
