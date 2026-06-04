import fs from 'node:fs';
import path from 'node:path';

// Content lives inside the app (align360-app/content) so the app is
// self-contained and deploys cleanly. Editing these .md files still updates
// the live prompt on the next request (no rebuild in dev).
const ROOT = path.join(process.cwd(), 'content');

function safeRead(relPath: string): string {
  try {
    return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  } catch {
    return '';
  }
}

/**
 * Build the live system prompt by composing the working-version files from
 * the AI Model/ folder at the repo root. Editing those files (e.g. dropping
 * in v6.3) takes effect on the next request — no rebuild needed in dev.
 */
export function buildSystemPrompt(): string {
  const systemPrompt = safeRead('AI Model/System Prompt.md');
  const standingRules = safeRead('AI Model/Standing Rules.md');
  const knowledge1 = safeRead('AI Model/Knowledge File — Part 1.md');
  const knowledge2 = safeRead('AI Model/Knowledge File — Part 2.md');

  const sections = [
    systemPrompt && `# SYSTEM PROMPT\n\n${systemPrompt}`,
    standingRules && `# STANDING RULES (must honor in every output)\n\n${standingRules}`,
    knowledge1 && `# KNOWLEDGE — Part 1\n\n${knowledge1}`,
    knowledge2 && `# KNOWLEDGE — Part 2\n\n${knowledge2}`,
  ].filter(Boolean);

  if (sections.length === 0) {
    return [
      'You are Align360 AI, a personal and professional development companion.',
      'The live prompt files are missing from /AI Model/. Until they are restored,',
      'respond conservatively: be warm, direct, and brief. Do not claim assessment',
      'results. Suggest the user reach out to support if they need a full profile.',
    ].join(' ');
  }

  return sections.join('\n\n---\n\n');
}
