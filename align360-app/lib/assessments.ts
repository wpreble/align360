import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), '..');

export type Option = { letter: string; text: string; giftTag?: string };
export type Question = { id: string; number: number; label: string; prompt: string; options: Option[] };
export type Section = { name: string; questions: Question[] };
export type Assessment = {
  slug: string;
  title: string;
  meta: string;
  sections: Section[];
  questionCount: number;
};

/** The three User Model assessments in scope for the alpha. */
export const ALPHA_ASSESSMENTS: { slug: string; file: string; blurb: string }[] = [
  {
    slug: 'wiring',
    file: 'Wiring for Impact.md',
    blurb: 'How you naturally create value, under pressure and at your best. The foundational read — everything else builds on this.',
  },
  {
    slug: 'orientation',
    file: 'Orientation for Impact.md',
    blurb: 'How you read situations, think through complexity, and make decisions.',
  },
  {
    slug: 'rejection-gift',
    file: 'Rejection Gift Finder.md',
    blurb: 'How adversity shaped a specific capability that is now an edge. Answer for your whole life, not just work.',
  },
];

function slugToFile(slug: string): string | null {
  return ALPHA_ASSESSMENTS.find((a) => a.slug === slug)?.file ?? null;
}

/**
 * Parse one assessment markdown file (from Assessments/) into structured data.
 * Format: `# Title`, `*meta*`, `## Section`, `### Q<n> — label`, `> prompt`,
 * `- **A.** text → GiftTag`. Dev-note blockquotes and italic section labels
 * are ignored.
 */
export function parseAssessment(slug: string, md: string): Assessment {
  const lines = md.split('\n');
  let title = '';
  let meta = '';
  const sections: Section[] = [];
  let curSection: Section | null = null;
  let curQ: Question | null = null;
  let collectingPrompt = false;
  let promptParts: string[] = [];

  const flushPrompt = () => {
    if (curQ) curQ.prompt = promptParts.join(' ').trim();
    promptParts = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (line.startsWith('# ') && !line.startsWith('## ')) {
      title = line.slice(2).trim();
      continue;
    }
    // meta line: first italic line before any section
    if (!curSection && !meta && /^\*.*\*$/.test(trimmed)) {
      meta = trimmed.replace(/^\*|\*$/g, '').trim();
      continue;
    }
    if (line.startsWith('## ')) {
      flushPrompt();
      curSection = { name: line.slice(3).replace(/\s*\(added\)\s*$/i, '').trim(), questions: [] };
      sections.push(curSection);
      curQ = null;
      collectingPrompt = false;
      continue;
    }
    if (line.startsWith('### ')) {
      flushPrompt();
      const header = line.slice(4).trim();
      // Match `Q12 — Label`, `Q12: Label`, or a bare `Q16` (no separator/label).
      const m = header.match(/^Q?(\d+)\s*(?:[—\-–:]\s*(.*))?$/);
      const number = m ? parseInt(m[1], 10) : curSection ? curSection.questions.length + 1 : sections.length + 1;
      const label = m ? (m[2] || '').trim() : header;
      if (!curSection) {
        curSection = { name: '', questions: [] };
        sections.push(curSection);
      }
      curQ = { id: `q${number}`, number, label, prompt: '', options: [] };
      curSection.questions.push(curQ);
      collectingPrompt = true;
      continue;
    }
    // option line
    const opt = line.match(/^[-*]\s*\*\*([A-Za-z])\.\*\*\s*(.*)$/);
    if (opt && curQ) {
      collectingPrompt = false;
      flushPrompt();
      const rest = opt[2];
      const arrow = rest.split(/\s*(?:→|->)\s*/);
      curQ.options.push({
        letter: opt[1].toUpperCase(),
        text: arrow[0].trim(),
        giftTag: arrow[1]?.trim() || undefined,
      });
      continue;
    }
    // prompt collection (scenario text), skipping dev notes + italic labels
    if (curQ && collectingPrompt && trimmed) {
      if (/^>\s*\*\*dev note/i.test(trimmed)) continue;
      if (/^\*.*\*$/.test(trimmed)) continue; // italic section label
      const text = trimmed.replace(/^>\s?/, '').trim();
      if (text) promptParts.push(text);
    }
  }
  flushPrompt();

  // drop empty sections (e.g. trailing prose-only "rules" sections)
  const cleanSections = sections.filter((s) => s.questions.length > 0);
  const questionCount = cleanSections.reduce((n, s) => n + s.questions.length, 0);

  return { slug, title, meta, sections: cleanSections, questionCount };
}

export function getAssessment(slug: string): Assessment | null {
  const file = slugToFile(slug);
  if (!file) return null;
  try {
    const md = fs.readFileSync(path.join(ROOT, 'Assessments', file), 'utf8');
    return parseAssessment(slug, md);
  } catch {
    return null;
  }
}

export function listAssessments(): (Assessment & { blurb: string })[] {
  return ALPHA_ASSESSMENTS.map((a) => {
    const parsed = getAssessment(a.slug);
    return parsed ? { ...parsed, blurb: a.blurb } : null;
  }).filter(Boolean) as (Assessment & { blurb: string })[];
}
