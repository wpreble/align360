// Onboarding flow — the canonical Align360 intake (content/Assessments/Onboarding.md).
// 19 single-choice questions across Sections A–I. NOT scored for a result: every
// answer maps to a system behavior (AI tone, routing, faith level, distress flag,
// AI-era delivery). synthesize() gives a preliminary "first read"; buildOnboarding
// context() feeds the chosen-answer signals into the live AI.

export type Step =
  | { type: 'inputs'; eyebrow: string; question: string; sub?: string; inputs: { id: string; placeholder: string; key: string }[] }
  | { type: 'single' | 'multi'; eyebrow: string; question: string; sub?: string; options: string[]; key: string; optional?: boolean; compact?: boolean }
  | { type: 'summary' };

export type Answers = Record<string, string | string[]>;

type Opt = { t: string; s: string };
type QDef = { key: string; eyebrow: string; question: string; sub?: string; opts: Opt[] };

// Each option: t = what the user sees, s = the internal behavior signal it maps to.
const QUESTIONS: QDef[] = [
  { key: 'q1_intent', eyebrow: 'Why you’re here', question: 'What brings you to Align360 right now?', sub: 'Pick what fits best today.', opts: [
    { t: 'I want to understand my strengths and how I’m wired', s: 'Strength-seeker; open DesignSuite first' },
    { t: 'I’m at a crossroads and need clarity on direction', s: 'Direction-seeker; surface decision clarity early' },
    { t: 'I want to align my life across work, relationships, and health', s: 'Integrator; activate the life-alignment path' },
    { t: 'I’m building something and want to know if I’m the right person to build it', s: 'Builder-validator; weight Career Navigator' },
    { t: 'I want to understand my competitive edge and how to use it', s: 'Edge-seeker; highlight the Rejection Gift first' },
  ]},
  { key: 'q2_value', eyebrow: 'Why you’re here', question: 'When you imagine getting the most value from Align360, what does that look like?', opts: [
    { t: 'I finally understand why I’m wired the way I am, and it makes sense', s: 'Goal: self-clarity' },
    { t: 'I have a clear direction I feel confident moving toward', s: 'Goal: direction confidence' },
    { t: 'I discover something about myself I didn’t expect but immediately recognize as true', s: 'Goal: insight' },
    { t: 'I can articulate my value to others in a way I couldn’t before', s: 'Goal: communication clarity' },
    { t: 'I feel more aligned, like the different parts of my life are working together', s: 'Goal: integration' },
  ]},
  { key: 'q3_wiring1', eyebrow: 'How you’re wired', question: 'When you are operating at your absolute best, what are you usually doing?', sub: 'Pick what resonates most.', opts: [
    { t: 'Solving a genuinely complex problem that others couldn’t crack', s: 'Wiring signal: Realist / Organizer' },
    { t: 'Building or creating something that didn’t exist before', s: 'Wiring signal: Enterpriser / Doer' },
    { t: 'Helping someone else grow, succeed, or find clarity', s: 'Wiring signal: Encourager / Supporter' },
    { t: 'Organizing and bringing structure to something that was chaotic', s: 'Wiring signal: Organizer' },
    { t: 'Teaching or explaining something in a way that finally makes sense', s: 'Wiring signal: Explainer' },
  ]},
  { key: 'q4_wiring2', eyebrow: 'How you’re wired', question: 'Which environment brings out the best version of you?', opts: [
    { t: 'High-stakes situations where clear thinking matters most', s: 'Weights advisory / strategic roles' },
    { t: 'Starting something new, early stages, before things are defined', s: 'Weights Starter / Enterpriser' },
    { t: 'Being in service to someone else’s growth or wellbeing', s: 'Weights Supporter / coaching roles' },
    { t: 'Building systems and processes that make things run better', s: 'Weights Organizer / operations roles' },
    { t: 'Strategy and planning, mapping out where things are going', s: 'Weights Builder / strategic roles' },
  ]},
  { key: 'q5_recharge', eyebrow: 'Life rhythm', question: 'What genuinely helps you recover and recharge after a demanding period?', opts: [
    { t: 'Quiet time alone, reading, thinking, being in my own space', s: 'Introvert recharge' },
    { t: 'Time with people who know me well and don’t need anything from me', s: 'Relational recharge' },
    { t: 'Physical movement, exercise, being in nature, using my body', s: 'Physical recharge' },
    { t: 'Creative activity, music, film, writing, making something', s: 'Creative recharge' },
    { t: 'Rest without agenda, sleep, stillness, doing nothing productively', s: 'Rest-first recharge' },
  ]},
  { key: 'q6_wellbeing', eyebrow: 'Life rhythm', question: 'What does a week look like when you feel like you’re living well?', opts: [
    { t: 'I’m doing meaningful work that challenges me and I can see progress', s: 'Wellbeing: challenge + progress' },
    { t: 'I have time for the relationships that matter most to me', s: 'Wellbeing: relationship-centered' },
    { t: 'I have freedom and flexibility, I’m not locked into a rigid schedule', s: 'Wellbeing: autonomy-centered' },
    { t: 'I feel physically well and my energy is consistent throughout the day', s: 'Wellbeing: physical vitality' },
    { t: 'I have space to think and reflect, not just react and execute', s: 'Wellbeing: reflective space' },
  ]},
  { key: 'q7_decision', eyebrow: 'How you decide', question: 'When you face an important decision, what do you actually rely on most?', sub: 'This shapes how the AI talks with you.', opts: [
    { t: 'I think it through systematically, I analyze options and likely outcomes', s: 'AI style: analytical, data-forward' },
    { t: 'I talk it through with people I trust, I think better in dialogue', s: 'AI style: dialogic, question-driven, conversational' },
    { t: 'I sit with it and let my gut speak, I’ve learned to trust my instincts', s: 'AI style: intuitive, help them trust what they sense' },
    { t: 'I pray, reflect, or bring my faith into the center of the decision', s: 'AI style: faith-integrated, leave room for reflection' },
    { t: 'I research until I feel informed enough to move with confidence', s: 'AI style: research-driven, bring structure and sources' },
  ]},
  { key: 'q8_shaped', eyebrow: 'What shaped you', question: 'Which of these challenges has done the most to shape who you are today?', sub: 'Answer for your whole life, not just work.', opts: [
    { t: 'Having to figure things out alone, without a roadmap or mentor', s: 'Pre-seeds Paradigm Challenger / Insight' },
    { t: 'Carrying significant responsibility before I felt ready for it', s: 'Pre-seeds Resilience / Organizer' },
    { t: 'Experiencing failure or rejection that forced me to start over', s: 'Pre-seeds Resilience / Comeback' },
    { t: 'Being underestimated, not being seen or taken seriously', s: 'Pre-seeds Perspective / Independent Thinker' },
    { t: 'Navigating genuine uncertainty where the stakes were high', s: 'Pre-seeds Realist / Truth-Seeker' },
  ]},
  { key: 'q9_gift', eyebrow: 'What shaped you', question: 'Looking at what you’ve been through, what’s the most significant thing it gave you?', opts: [
    { t: 'A depth of insight and wisdom I couldn’t have gotten any other way', s: 'Rejection Gift: Insight' },
    { t: 'Resilience, I know I can survive and rebuild from almost anything', s: 'Rejection Gift: Resilience' },
    { t: 'Empathy, I understand other people’s struggles at a level I can’t explain', s: 'Rejection Gift: Empathy' },
    { t: 'An unconventional perspective, I see things in ways most people don’t', s: 'Rejection Gift: Perspective' },
    { t: 'Conviction, I know what I believe and I’m not easily moved from it', s: 'Rejection Gift: Conviction / Principled' },
  ]},
  { key: 'q10_connection', eyebrow: 'How you connect', question: 'What helps you feel genuinely encouraged and seen by someone else?', opts: [
    { t: 'When someone takes real time with me, presence matters more than words', s: 'Encouragement: quality time' },
    { t: 'When someone speaks directly into what I’m doing and affirms the quality of it', s: 'Encouragement: words of affirmation' },
    { t: 'When someone acts on my behalf without being asked', s: 'Encouragement: acts of service' },
    { t: 'When someone shares an experience with me, doing something together', s: 'Encouragement: shared experience' },
    { t: 'When someone understands what it cost me to get here', s: 'Encouragement: depth of witness' },
  ]},
  { key: 'q11_faith', eyebrow: 'Faith & values', question: 'How central are faith or spiritual values to how you approach your life?', sub: 'We’ll respect whatever you share.', opts: [
    { t: 'Central, my faith is the foundation everything else is built on', s: 'Faith: full integration; wisdom / discernment / calling language unlocked' },
    { t: 'Very important, it shapes how I make decisions and treat people', s: 'Faith: high integration; faith-informed framing' },
    { t: 'Somewhat important, it’s part of my life but not always the primary lens', s: 'Faith: moderate integration' },
    { t: 'I’m exploring, I’m open to spiritual dimensions but not settled', s: 'Faith: open posture; neutral framing' },
    { t: 'Not central, I operate primarily from other value frameworks', s: 'Faith: secular framing; no faith language' },
  ]},
  { key: 'q12_building', eyebrow: 'What you’re building toward', question: 'If you could describe the life you’re working to build, which comes closest?', opts: [
    { t: 'A life of meaningful impact, where my work changes real things for real people', s: 'Trajectory: impact leadership' },
    { t: 'A life of freedom and flexibility, not constrained by structures I didn’t choose', s: 'Trajectory: autonomy' },
    { t: 'A life of deep connection, rich relationships, presence, being truly known', s: 'Trajectory: relational legacy' },
    { t: 'A life of legacy, building something that outlasts me and serves others', s: 'Trajectory: legacy-builder' },
    { t: 'A life of alignment, where what I do, who I am, and what I believe are the same', s: 'Trajectory: integration' },
  ]},
  { key: 'q13_state', eyebrow: 'Right now', question: 'Setting aside your ideal or your best, how would you describe how you are actually operating in your day-to-day life right now?', sub: 'This last section is about right now.', opts: [
    { t: 'I am largely in my element; how I am operating feels aligned with how I am naturally wired.', s: 'Current state: Aligned (presence gap 1)' },
    { t: 'I am stretched, operating at a higher pace than feels fully natural, but I am choosing it deliberately.', s: 'Current state: Intentional extension (2)' },
    { t: 'I am adapting, showing up in ways the situation requires but that do not quite feel like me.', s: 'Current state: Role adaptation (3)' },
    { t: 'I am compressed, operating below my natural capacity; circumstances have narrowed what I can bring.', s: 'Current state: Underutilization (4)' },
    { t: 'I am honestly not sure; I have been in this mode long enough that I have lost track of what feels natural.', s: 'Current state: Orientation loss (5); lead with stabilization before any planning' },
  ]},
  { key: 'q14_pressure', eyebrow: 'Right now', question: 'Right now, where is the primary source of pressure in your life coming from?', opts: [
    { t: 'Professional, demands from work, role expectations, or performance', s: 'Pressure: professional; route Career Navigator first' },
    { t: 'Relational, dynamics with family, partner, or social environment', s: 'Pressure: relational; activate the relational layer' },
    { t: 'Financial, concerns about stability, security, or resources', s: 'Pressure: economic; adjust opportunity weighting' },
    { t: 'Internal, a gap between who I am and where I feel I should be', s: 'Pressure: identity gap; DesignSuite becomes priority' },
    { t: 'Multiple sources at once; it is the weight of several things simultaneously', s: 'Pressure: multi-domain; wellness layer stabilizes first' },
  ]},
  { key: 'q15_presencegap', eyebrow: 'Right now', question: 'How far is the version of you showing up to meet current demands from the version that feels most genuinely like you?', opts: [
    { t: 'Not very far, I can show up as myself most of the time.', s: 'Presence gap: 1' },
    { t: 'Somewhat, I have stretched or adapted, but not a fundamental departure.', s: 'Presence gap: 2' },
    { t: 'Noticeably far, I regularly show up in ways that take sustained energy to maintain.', s: 'Presence gap: 3; acknowledge current state before profile language' },
    { t: 'Very far, I have been in performance mode long enough that I am not certain where it ends and I begin.', s: 'Presence gap: 4; do not open with foundational profile framing' },
    { t: 'I do not have a clear sense of what genuinely like myself feels like right now.', s: 'Presence gap: 5; foundational profile is a destination, not a description' },
  ]},
  { key: 'q16_suppressed', eyebrow: 'Right now', question: 'What have you had to set aside in order to meet current demands?', opts: [
    { t: 'Depth, I have had to move more broadly and quickly than I prefer.', s: 'Suppressed: depth' },
    { t: 'Precision, I have had to release a standard of accuracy I genuinely care about.', s: 'Suppressed: accuracy' },
    { t: 'Presence, I have been less available to the people who matter to me.', s: 'Suppressed: relational availability' },
    { t: 'Perspective, I have been too reactive to do the thinking that energizes me.', s: 'Suppressed: strategic thinking' },
    { t: 'Recovery, I have let go of the habits that normally restore me.', s: 'Suppressed: physiological restoration; flag wellness as priority' },
  ]},
  { key: 'q17_effort', eyebrow: 'Right now', question: 'Does what is currently demanding your energy feel worth what it is costing you?', opts: [
    { t: 'Yes, I am choosing this willingly and the outcome justifies the cost.', s: 'Effort value: high; positive pressure' },
    { t: 'Mostly yes, I believe in the direction but question whether the pace is sustainable.', s: 'Effort value: moderate; flag sustainability' },
    { t: 'I am uncertain, I am not sure the outcome I am working toward is what I want.', s: 'Effort value: unclear; enter direction-clarity mode before action planning' },
    { t: 'Mostly no, the cost does not feel proportionate to what I get back.', s: 'Effort value: low; DISTRESS: remove output-oriented framing' },
    { t: 'No, the cost is clearly not worth it and I know it, but I do not know how to stop.', s: 'Effort value: critical; FULL DISTRESS PROTOCOL: no forward planning until stability returns' },
  ]},
  { key: 'q18_shift', eyebrow: 'Right now', question: 'If you could shift one thing about how you are showing up, not your circumstances but how you yourself are operating, what would it be?', opts: [
    { t: 'I would slow down enough to do things the way I actually care about.', s: 'Desired shift: depth and quality restoration' },
    { t: 'I would be more present, more genuinely with the people and moments in front of me.', s: 'Desired shift: relational presence' },
    { t: 'I would be clearer about what actually matters so I could stop carrying everything equally.', s: 'Desired shift: priority clarity' },
    { t: 'I would trust my own judgment more instead of second-guessing as much as I do.', s: 'Desired shift: self-trust' },
    { t: 'I would take better care of my physical and mental restoration.', s: 'Desired shift: physiological recovery; wellness becomes the foundation' },
  ]},
  { key: 'q19_disruption', eyebrow: 'Right now', question: 'When significant change disrupts how things have always worked in your field or environment, what do you honestly tend to do first?', opts: [
    { t: 'I move toward it early. I want to understand what’s changing before most people do, and I position accordingly.', s: 'Disruption posture: early mover; surface AI-era signals fully and directly' },
    { t: 'I assess it carefully before moving. I want to know what’s real versus hype before I commit.', s: 'Disruption posture: thoughtful adopter; surface AI-era signals with rationale' },
    { t: 'I watch what others do first. Once I see how it plays out for people I trust, I make my move.', s: 'Disruption posture: wait-and-see; surface AI-era signals after stability is established' },
    { t: 'I focus on what hasn’t changed. I look for what remains stable and build from there.', s: 'Disruption posture: stability-anchored; surface AI-era signals gradually, leading with what is durable' },
    { t: 'I feel overwhelmed by it. Major change tends to disorient me before I find my footing.', s: 'Disruption posture: high sensitivity; withhold AI-era signals until grounding; lead with identity stability' },
  ]},
];

const SIGNAL_MAP: Record<string, Record<string, string>> = Object.fromEntries(
  QUESTIONS.map((q) => [q.key, Object.fromEntries(q.opts.map((o) => [o.t, o.s]))]),
);

export const OB_STEPS: Step[] = [
  { type: 'inputs', eyebrow: "Let's begin", question: 'First, what should we call you?', sub: 'Just a few things to make this feel like yours.',
    inputs: [{ id: 'name', placeholder: 'Full name', key: 'name' }, { id: 'callName', placeholder: 'Preferred name (optional)', key: 'callName' }] },
  ...QUESTIONS.map((q): Step => ({ type: 'single', eyebrow: q.eyebrow, question: q.question, sub: q.sub, options: q.opts.map((o) => o.t), key: q.key })),
  { type: 'summary' },
];

/* ── Preliminary synthesis (the onboarding "first read" + chat welcome) ── */

// Index-based so they can never drift from the option text. Order matches the
// A–E options of each question above.
const GIFT_BY_INDEX: Record<string, string[][]> = {
  q3_wiring1: [['Realist', 'Organizer'], ['Enterpriser', 'Doer'], ['Encourager', 'Supporter'], ['Organizer'], ['Explainer']],
  q4_wiring2: [['Wise Observer', 'Realist'], ['Enterpriser', 'Doer'], ['Supporter'], ['Organizer'], ['Wise Observer', 'Integrator']],
};
const GIFT_BLURBS: Record<string, string> = {
  Realist: 'see reality clearly and cut through confusion',
  Supporter: 'show up steady for the people around you',
  Doer: 'move things forward when others hesitate',
  Organizer: 'create order where there was chaos',
  Explainer: 'make complex things land clearly for others',
  Integrator: 'connect ideas and people across boundaries',
  Enterpriser: 'see the opportunity and build toward it',
  Encourager: 'draw out the best in others',
  'Wise Observer': 'hold the long view when others are in the weeds',
};
const INTENT_BY_INDEX = [
  "understand how you're wired", 'find clarity on your direction', 'bring your life into alignment',
  "test whether you're the one to build it", 'understand and use your edge',
];
const GROWTH_BY_INDEX = [
  'Figuring things out alone builds resourcefulness most people never develop',
  'Carrying responsibility early tends to produce a steadiness others sense',
  "Moving through real setbacks builds the kind of resilience you can't fake",
  'Being underestimated often sharpens a quiet conviction and sharper perception',
  'Operating under high-stakes uncertainty builds a clear, grounded read on reality',
];
const COMMS_BY_INDEX = [
  "I'll bring structure and lay out the reasoning so you can test it.",
  "I'll think out loud with you, conversationally, asking the right questions.",
  "I'll ask questions that help you trust what you already sense.",
  "I'll leave room for reflection and respect the deeper layer in how you decide.",
  "I'll bring data and sources so you can move with confidence.",
];

/** Index of the chosen answer within its question (answers store the exact
 *  option text, so this is an exact match). -1 if unanswered. */
function answerIndex(answers: Answers, key: string): number {
  const q = QUESTIONS.find((x) => x.key === key);
  const ans = answers[key];
  if (!q || typeof ans !== 'string') return -1;
  return q.opts.findIndex((o) => o.t === ans);
}

export type Synthesis = {
  name: string;
  primaryGift: string;
  secondaryGift: string;
  primaryBlurb: string;
  secondaryBlurb: string;
  intentPhrase: string;
  growthRead: string;
  commsRead: string;
};

export function synthesize(answers: Answers): Synthesis {
  const nameStr = (typeof answers.callName === 'string' && answers.callName)
    ? answers.callName
    : (typeof answers.name === 'string' && answers.name) ? answers.name.split(' ')[0] : 'there';

  const giftScores: Record<string, number> = {};
  (['q3_wiring1', 'q4_wiring2'] as const).forEach((k) => {
    const idx = answerIndex(answers, k);
    const gifts = idx >= 0 ? GIFT_BY_INDEX[k]?.[idx] : undefined;
    gifts?.forEach((g, i) => { giftScores[g] = (giftScores[g] || 0) + (i === 0 ? 1 : 0.6); });
  });
  const sorted = Object.entries(giftScores).sort((a, b) => b[1] - a[1]);
  const primaryGift = sorted[0]?.[0] || 'Integrator';
  const secondaryGift = sorted[1]?.[0] || 'Explainer';

  const i1 = answerIndex(answers, 'q1_intent');
  const intentPhrase = (i1 >= 0 && INTENT_BY_INDEX[i1]) || "explore what's possible";
  const i8 = answerIndex(answers, 'q8_shaped');
  const growthRead = (i8 >= 0 && GROWTH_BY_INDEX[i8]) || 'What you have come through already shapes how you show up now';
  const i7 = answerIndex(answers, 'q7_decision');
  const commsRead = (i7 >= 0 && COMMS_BY_INDEX[i7]) || "I'll adapt my style as we go.";

  return {
    name: nameStr,
    primaryGift, secondaryGift,
    primaryBlurb: GIFT_BLURBS[primaryGift], secondaryBlurb: GIFT_BLURBS[secondaryGift],
    intentPhrase, growthRead, commsRead,
  };
}

/** Compact context injected into the chat system prompt. Each chosen answer
 *  carries its behavior signal so the AI adapts (tone, faith, routing, distress). */
export function buildOnboardingContext(answers: Answers): string {
  if (!answers || Object.keys(answers).length === 0) return '';
  const s = synthesize(answers);

  const sig = (key: string, label: string): string => {
    const ans = answers[key];
    if (typeof ans !== 'string' || !ans) return '';
    const signal = SIGNAL_MAP[key]?.[ans];
    return `${label}: ${ans}${signal ? ` [${signal}]` : ''}`;
  };

  const lines = [
    `Name: ${typeof answers.name === 'string' ? answers.name : ''}${answers.callName ? ` (prefers "${answers.callName}")` : ''}`.trim(),
    sig('q1_intent', 'Why here'),
    sig('q2_value', 'What success looks like'),
    sig('q3_wiring1', 'At their best'),
    sig('q4_wiring2', 'Best environment'),
    sig('q5_recharge', 'Recharges via'),
    sig('q6_wellbeing', 'Living well means'),
    sig('q7_decision', 'Decision style / AI interaction style'),
    sig('q8_shaped', 'Shaped most by'),
    sig('q9_gift', 'Gift from adversity'),
    sig('q10_connection', 'Feels encouraged by'),
    sig('q11_faith', 'Faith integration (GATE)'),
    sig('q12_building', 'Building toward'),
    sig('q13_state', 'Current state'),
    sig('q14_pressure', 'Primary pressure (routing)'),
    sig('q15_presencegap', 'Presence gap'),
    sig('q16_suppressed', 'Set aside under pressure'),
    sig('q17_effort', 'Worth the cost? (distress signal)'),
    sig('q18_shift', 'Desired shift'),
    sig('q19_disruption', 'Disruption posture (AI-era delivery)'),
    `Preliminary wiring hypothesis (NOT confirmed; the Wiring for Impact assessment confirms it): ${s.primaryGift}, with undertones of ${s.secondaryGift}. Treat as a working read, not a label.`,
    'Honor the calibration rules: never use current-state signals to reduce confidence or limit access; every calibration signal is temporary and contextual.',
  ].filter(Boolean);
  return lines.join('\n');
}
