// Onboarding flow — ported from the original Align360 demo baseline.
// A lightweight intake (NOT the formal 19-Q Wiring assessment) that collects
// signals, synthesizes a preliminary wiring hypothesis, and personalizes the
// AI from the first message.

export type Step =
  | { type: 'inputs'; eyebrow: string; question: string; sub?: string; inputs: { id: string; placeholder: string; key: string }[] }
  | { type: 'single' | 'multi'; eyebrow: string; question: string; sub?: string; options: string[]; key: string; optional?: boolean; compact?: boolean }
  | { type: 'summary' };

export const OB_STEPS: Step[] = [
  { type: 'inputs', eyebrow: "Let's begin", question: 'First, what should we call you?', sub: 'Just a few things to make this feel like yours.',
    inputs: [ { id: 'name', placeholder: 'Full name', key: 'name' }, { id: 'callName', placeholder: 'Preferred name (optional)', key: 'callName' } ] },
  { type: 'multi', eyebrow: 'Warm welcome', question: 'What brings you to Align360 today?', sub: 'Pick all that apply. This helps us prioritize your first experience.',
    options: ['Discover my strengths', 'Explore career direction', 'Align my life and priorities', 'Build something meaningful', 'Plan my next chapter', 'Just curious'], key: 'intent' },
  { type: 'single', eyebrow: 'Wiring signals · 1 of 3', question: "When you're at your best, what are you usually doing?", sub: 'Pick what resonates most right now.',
    options: ['Solving problems', 'Building systems', 'Helping people grow', 'Creating ideas', 'Organizing chaos', 'Leading initiatives', 'Learning and teaching'], key: 'wiring1' },
  { type: 'single', eyebrow: 'Wiring signals · 2 of 3', question: 'Which environments energize you most?',
    options: ['Starting new things', 'Improving existing systems', 'Teaching or mentoring', 'Strategy and planning', 'Creative work', 'Building teams'], key: 'wiring2' },
  { type: 'single', eyebrow: 'Wiring signals · 3 of 3', question: 'What kind of impact excites you most?',
    options: ['Helping people grow', 'Solving meaningful problems', 'Creating new opportunities', 'Building organizations', 'Bringing clarity to complexity', 'Leaving something lasting'], key: 'wiring3' },
  { type: 'single', eyebrow: 'Life rhythm', question: 'What helps you recharge?', sub: 'This shapes the pace of your experience.',
    options: ['Music', 'Movies', 'Reading', 'Exercise', 'Nature', 'Time with friends', 'Quiet reflection'], key: 'recharge', compact: true },
  { type: 'single', eyebrow: 'Decision style', question: 'How do you usually make important decisions?', sub: 'Helps Align360 adapt how it communicates with you.',
    options: ['Think deeply alone', 'Talk it through with others', 'Research and analyze', 'Follow intuition', 'Pray and reflect', 'A mix of these'], key: 'decisionStyle' },
  { type: 'single', eyebrow: 'Growth signals', question: 'Which challenge has shaped you the most?', sub: 'Every setback carries a gift. This helps us find yours.',
    options: ['Being underestimated', 'High expectations', 'Having to figure things out alone', 'Failure or setbacks', 'Responsibility early in life', 'Being overlooked', 'Learning through hardship'], key: 'growthSignal' },
  { type: 'single', eyebrow: 'Connection style', question: 'What helps you feel most encouraged?',
    options: ['Words of encouragement', 'Quality time', 'Acts of support', 'Recognition', 'Shared experiences'], key: 'connection', compact: true },
  { type: 'single', eyebrow: 'Faith & values · optional', question: 'Do spiritual or faith values play a role in how you approach life?', sub: "We'll respect whatever you share, or don't.",
    options: ['Yes, very important', 'Somewhat important', "I'm exploring", 'Not really', 'Prefer not to say'], key: 'faith', optional: true },
  { type: 'single', eyebrow: 'Curiosity', question: 'What are you most curious to discover about yourself?', sub: "Let's explore that together.",
    options: ['My strengths', 'My direction', 'My purpose', 'My next opportunity', 'My growth potential'], key: 'curiosity' },
  { type: 'summary' },
];

export type Answers = Record<string, string | string[]>;

const GIFT_HINTS: Record<string, string[]> = {
  'Solving problems': ['Realist'],
  'Building systems': ['Organizer', 'Enterpriser'],
  'Helping people grow': ['Encourager', 'Supporter'],
  'Creating ideas': ['Explainer', 'Integrator'],
  'Organizing chaos': ['Organizer', 'Realist'],
  'Leading initiatives': ['Enterpriser', 'Doer'],
  'Learning and teaching': ['Explainer', 'Wise Observer'],
  'Starting new things': ['Enterpriser', 'Doer'],
  'Improving existing systems': ['Organizer', 'Integrator'],
  'Teaching or mentoring': ['Explainer', 'Encourager'],
  'Strategy and planning': ['Wise Observer', 'Integrator'],
  'Creative work': ['Integrator', 'Explainer'],
  'Building teams': ['Enterpriser', 'Encourager'],
  'Solving meaningful problems': ['Realist', 'Wise Observer'],
  'Creating new opportunities': ['Enterpriser', 'Doer'],
  'Building organizations': ['Enterpriser', 'Organizer'],
  'Bringing clarity to complexity': ['Wise Observer', 'Explainer'],
  'Leaving something lasting': ['Wise Observer', 'Enterpriser'],
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
const INTENT_BLURBS: Record<string, string> = {
  'Discover my strengths': "understand how you're wired",
  'Explore career direction': 'find work that fits who you are',
  'Align my life and priorities': 'get rhythm and priorities into sync',
  'Build something meaningful': 'build something that lasts',
  'Plan my next chapter': 'plan the next chapter with clarity',
  'Just curious': "explore what's possible",
};
const GROWTH_READS: Record<string, string> = {
  'Being underestimated': 'The pattern of being underestimated often sharpens a quiet kind of conviction',
  'High expectations': 'Carrying high expectations tends to build an unusually strong internal compass',
  'Having to figure things out alone': 'Figuring things out alone builds resourcefulness most people never develop',
  'Failure or setbacks': "Moving through real setbacks builds the kind of resilience you can't fake",
  'Responsibility early in life': 'Carrying responsibility early tends to produce maturity and steadiness others sense',
  'Being overlooked': 'Being overlooked early often sharpens perception; you see what others miss',
  'Learning through hardship': 'Learning through hardship tends to create depth and a truer sense of what matters',
};
const DECISION_READS: Record<string, string> = {
  'Think deeply alone': "I'll give you space to think, and offer frameworks you can process solo.",
  'Talk it through with others': "I'll engage with you conversationally; we'll think out loud together.",
  'Research and analyze': "I'll bring data and structure; you can test my reasoning against your own.",
  'Follow intuition': "I'll ask questions that help you trust what you already sense.",
  'Pray and reflect': "I'll leave space for reflection, and respect the deeper layer in how you decide.",
  'A mix of these': "I'll adapt: sometimes structured, sometimes open-ended, always following your lead.",
};

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
  const nameStr = typeof answers.callName === 'string' && answers.callName
    ? answers.callName
    : typeof answers.name === 'string' && answers.name
      ? answers.name.split(' ')[0]
      : 'there';

  const giftScores: Record<string, number> = {};
  (['wiring1', 'wiring2', 'wiring3'] as const).forEach((k) => {
    const ans = answers[k];
    if (typeof ans === 'string' && GIFT_HINTS[ans]) GIFT_HINTS[ans].forEach((g) => { giftScores[g] = (giftScores[g] || 0) + 1; });
  });
  const sorted = Object.entries(giftScores).sort((a, b) => b[1] - a[1]);
  const primaryGift = sorted[0]?.[0] || 'Integrator';
  const secondaryGift = sorted[1]?.[0] || 'Explainer';

  const intents = Array.isArray(answers.intent) ? answers.intent : [answers.intent].filter(Boolean) as string[];
  const intentPhrase = intents.length === 0 ? "explore what's possible"
    : intents.length === 1 ? (INTENT_BLURBS[intents[0]] || 'get clarity')
    : intents.slice(0, 2).map((i) => INTENT_BLURBS[i] || '').filter(Boolean).join(', and ');

  const growthRead = (typeof answers.growthSignal === 'string' && GROWTH_READS[answers.growthSignal]) || 'What you have come through already shapes how you show up now';
  const commsRead = (typeof answers.decisionStyle === 'string' && DECISION_READS[answers.decisionStyle]) || "I'll adapt my style as we go.";

  return {
    name: nameStr,
    primaryGift, secondaryGift,
    primaryBlurb: GIFT_BLURBS[primaryGift], secondaryBlurb: GIFT_BLURBS[secondaryGift],
    intentPhrase, growthRead, commsRead,
  };
}

/** Compact context string injected into the chat system prompt for personalization. */
export function buildOnboardingContext(answers: Answers): string {
  if (!answers || Object.keys(answers).length === 0) return '';
  const s = synthesize(answers);
  const intents = Array.isArray(answers.intent) ? answers.intent.join(', ') : (answers.intent as string) || '';
  const lines = [
    `Name: ${typeof answers.name === 'string' ? answers.name : ''}${answers.callName ? ` (prefers "${answers.callName}")` : ''}`.trim(),
    intents && `Came to Align360 to: ${intents}`,
    answers.wiring1 && `At their best: ${answers.wiring1}`,
    answers.wiring2 && `Energized by: ${answers.wiring2}`,
    answers.wiring3 && `Impact that excites: ${answers.wiring3}`,
    answers.recharge && `Recharges via: ${answers.recharge}`,
    answers.decisionStyle && `Decision style: ${answers.decisionStyle}`,
    answers.growthSignal && `Shaped most by: ${answers.growthSignal}`,
    answers.connection && `Feels encouraged by: ${answers.connection}`,
    answers.faith && answers.faith !== 'Prefer not to say' && `Faith/values: ${answers.faith}`,
    answers.curiosity && `Most curious about: ${answers.curiosity}`,
    `Preliminary wiring hypothesis (NOT confirmed; the Wiring for Impact assessment confirms it): ${s.primaryGift}, with undertones of ${s.secondaryGift}. Treat as a working read, not a label.`,
    `Communication preference: ${s.commsRead}`,
  ].filter(Boolean);
  return lines.join('\n');
}
