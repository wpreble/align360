import type { ClarityScores, ClaritySub } from './clarity-scoring';

// AI narrative layer for the Clarity Layer result reports. Scores are computed
// deterministically (clarity-scoring.ts); this module defines the written
// analysis the model produces over those scores, plus a deterministic fallback
// so the report always renders (no key / API error), mirroring lib/profile.ts.

export type ClarityNote = { label: string; body: string };

export type ClarityNarrative = {
  /** Evocative one-liner; may wrap a phrase in <em></em>. */
  headline: string;
  /** 2-3 sentences interpreting the overall score and level. */
  summary: string;
  /** One interpretation per domain, keyed by exact domain name. */
  domains: { name: string; body: string }[];
  /** One interpretation per sub-score, keyed by exact sub-score label. */
  subs: { label: string; body: string }[];
  /** Analysis of the lowest sub-score and the practice that closes it. */
  primaryGap: { title: string; body: string; tool: string };
  /** The fully developed signals (max sub-scores). */
  strengths: { title: string; body: string }[];
  /** AI-era readiness read (Impact Readiness only; null otherwise). */
  aiEra: { title: string; body: string } | null;
  /** Severity / source / velocity diagnostic, like the Drive reports. */
  diagnostic: { severity: ClarityNote; source: ClarityNote; velocity: ClarityNote };
  closing: { title: string; body: string };
};

export type ClarityResult = { scores: ClarityScores; narrative: ClarityNarrative; name: string; generatedAt: string };

/** Build the JSON schema instruction for the model, specific to this result. */
export function claritySchema(scores: ClarityScores): string {
  const domainList = scores.domains.map((d) => `${d.name} (${d.score}/100)`).join(', ');
  const subList = scores.subs.map((s) => `${s.label} [${s.domain}] ${s.points}/10`).join('; ');
  const gap = scores.primaryGap ? `${scores.primaryGap.label} (${scores.primaryGap.domain}) at ${scores.primaryGap.points}/10` : 'none';
  const strengthList = scores.strengths.map((s) => s.label).join(', ') || 'none at maximum';
  return `Return ONLY a valid JSON object (no markdown fences) with EXACTLY this shape:
{
  "headline": "<one evocative line about where this person stands on their ${scores.scoreName}; you may wrap one phrase in <em></em>>",
  "summary": "2-3 sentences interpreting an overall ${scores.scoreName} of ${scores.overall}/100 (level: ${scores.level.label}). Honest, dignified, specific.",
  "domains": [ ${scores.domains.map((d) => `{"name":${JSON.stringify(d.name)},"body":"2 sentences interpreting this domain at ${d.score}/100"}`).join(', ')} ],
  "subs": [ ${scores.subs.map((s) => `{"label":${JSON.stringify(s.label)},"body":"1-2 sentences interpreting this signal at ${s.points}/10"}`).join(', ')} ],
  "primaryGap": { "title":"<the behavioral pattern at the lowest signal (${gap}), phrased as a short first-person quote or crisp label>", "body":"3-4 sentences analyzing this gap IN CONTEXT of the strengths (${strengthList}). It is a precision gap, not a foundational flaw.", "tool":"<the one specific practice or Align360 tool that closes it>" },
  "strengths": [ {"title":"<short>","body":"2 sentences on a fully developed signal"} ],
  "aiEra": ${scores.aiEra ? `{ "title":"<short>", "body":"2-3 sentences on AI-era readiness given a score of ${scores.aiEra.score}/100" }` : 'null'},
  "diagnostic": { "severity": {"label":"<Mild / Moderate / Significant>","body":"2 sentences"}, "source": {"label":"<short: where this pattern comes from>","body":"2 sentences"}, "velocity": {"label":"<short: how fast it can shift>","body":"2 sentences"} },
  "closing": { "title":"<one line on what comes next>", "body":"2 sentences, grounded and forward-looking" }
}
Provide 2-3 strengths items. Domains to cover (use these EXACT names): ${domainList}. Signals to cover (use these EXACT labels): ${subList}.
Honor the governance: present options not directives, name gaps as precise and addressable (never as worth), never rank human worth, never manufacture urgency. Every field must be specific to this person's answers below.`;
}

/* ── Deterministic fallback ──────────────────────────────────────────────── */

function domainPhrase(score: number): string {
  if (score >= 85) return 'is fully developed and operating at strength';
  if (score >= 70) return 'is strong, with room to refine the edges';
  if (score >= 55) return 'is emerging and moving in the right direction';
  if (score >= 40) return 'is in active development';
  return 'is an area of focus where the most growth is available';
}

function subPhrase(points: number): string {
  if (points >= 10) return 'This signal is at maximum. It is a settled, reliable part of how you operate.';
  if (points >= 7) return 'This signal is healthy and functional, one deliberate step short of maximum.';
  if (points >= 3) return 'This signal is present but selective. There is a clear, specific lift available here.';
  return 'This signal is where the most immediate growth sits. Small, concrete practice moves it quickly.';
}

export function fallbackClarityNarrative(scores: ClarityScores, name: string): ClarityNarrative {
  const lvl = scores.level.label;
  const gap = scores.primaryGap;
  const strong = scores.strengths.slice(0, 3);

  return {
    headline: `You are <em>${lvl}</em> on the ${scores.scoreName}.`,
    summary:
      `Your ${scores.scoreName} is ${scores.overall} out of 100, which places you at ${lvl}. ` +
      `This is a working read from your answers. A fuller written analysis appears when the narrative engine is connected.`,
    domains: scores.domains.map((d) => ({
      name: d.name,
      body: `${d.name} ${domainPhrase(d.score)} (scored ${d.score} out of 100).`,
    })),
    subs: scores.subs.map((s) => ({ label: s.label, body: subPhrase(s.points) })),
    primaryGap: gap
      ? {
          title: `${gap.label}: your most specific opportunity`,
          body:
            `Your lowest signal is ${gap.label} in the ${gap.domain} domain, at ${gap.points} out of 10. ` +
            `Against the rest of your profile this reads as a precision gap, not a foundational one. The distance to close it is short.`,
          tool: 'A single, specific behavioral practice focused on this one signal.',
        }
      : { title: 'No single gap stands out', body: 'Your signals are evenly developed.', tool: 'Keep reinforcing your strongest patterns.' },
    strengths: strong.length
      ? strong.map((s) => ({ title: s.label, body: `${s.label} is at maximum. It is one of the most developed parts of your ${scores.title} profile.` }))
      : [{ title: 'Balanced profile', body: 'No single signal is at the ceiling yet, and several are close.' }],
    aiEra: scores.aiEra
      ? {
          title: 'How you are positioned for the AI era',
          body: `Across the AI-era signals you score ${scores.aiEra.score} out of 100. A detailed read generates when the narrative engine is connected.`,
        }
      : null,
    diagnostic: {
      severity: {
        label: scores.overall >= 81 ? 'Mild' : scores.overall >= 61 ? 'Mild to moderate' : scores.overall >= 41 ? 'Moderate' : 'Significant',
        body: 'A measure of how much the lowest signals are holding back the whole. The detailed reading generates when the narrative engine is connected.',
      },
      source: { label: 'High standards, not fear', body: 'Where your lowest signals come from. A full attribution generates with the narrative engine.' },
      velocity: { label: 'High', body: 'How quickly your profile can shift. Most signals are already at or near strength.' },
    },
    closing: {
      title: `${name}, this is the behavioral layer.`,
      body: `Your ${scores.title} result maps how ready you are right now. Connect the narrative engine for the full written reading.`,
    },
  };
}
