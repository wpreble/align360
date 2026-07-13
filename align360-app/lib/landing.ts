// Public industry/audience landing pages (Samuel's lead-gen designs), served by
// app/discover/[slug]/route.ts from content/landing/<slug>.html.

export const LANDING_PAGES = [
  { slug: 'career-clarity', title: 'Career Clarity' },
  { slug: 'coach-intelligence', title: 'Coach Intelligence' },
  { slug: 'csuite', title: 'C-Suite' },
  { slug: 'workforce-intelligence', title: 'Workforce Intelligence' },
  { slug: 'b3-daily', title: 'B3 Daily' },
  // Score-based lead-gen pages (mapped back from Samuel's Drive set to align360.io).
  { slug: 'conviction-score', title: 'Conviction Score' },
  { slug: 'wiring-score', title: 'Wiring Score' },
  { slug: 'value-score', title: 'Value Score' },
  { slug: 'ai-era-readiness', title: 'AI-Era Readiness' },
] as const;

export const LANDING_SLUGS = new Set<string>(LANDING_PAGES.map((p) => p.slug));
