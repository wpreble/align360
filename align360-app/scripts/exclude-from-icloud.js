/**
 * Keep build directories out of iCloud Drive. Runs automatically via `postinstall`.
 *
 * This repo lives under ~/Documents, which iCloud Drive syncs. iCloud evicts files
 * it thinks are cold into dataless placeholders; when Node then require()s one,
 * readFileSync fails with errno -70 (ESTALE) and `next build` dies at require time.
 * Before the fix a build hung for 12+ minutes and then threw; after it, 15 seconds.
 *
 * The com.apple.fileprovider.ignore#P attribute tells File Provider to leave a
 * directory alone. It has to be re-applied after every install, because npm ci
 * deletes and recreates node_modules (taking the attribute with it).
 *
 * No-ops on anything that is not macOS, so Vercel's Linux builders are unaffected.
 */
const { execFileSync } = require('node:child_process');
const { existsSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

if (process.platform !== 'darwin') process.exit(0);

const root = join(__dirname, '..');
// `content` holds the assessment markdown the app reads at request time. An
// evicted file there reads as an EMPTY STRING rather than throwing, so the
// assessment silently parses to zero questions instead of failing.
for (const dir of ['node_modules', '.next', 'content']) {
  const target = join(root, dir);
  try {
    if (!existsSync(target)) mkdirSync(target, { recursive: true });
    execFileSync('xattr', ['-w', 'com.apple.fileprovider.ignore#P', '1', target], { stdio: 'ignore' });
    console.log(`icloud: excluded ${dir}`);
  } catch {
    // Never fail an install over this. Worst case the build is slow again and
    // the comment above explains why.
  }
}
