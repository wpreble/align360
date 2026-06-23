// Public industry/audience landing pages (Samuel's lead-gen designs), served by
// app/discover/[slug]/route.ts from content/landing/<slug>.html.

export const LANDING_PAGES = [
  { slug: 'career-clarity', title: 'Career Clarity' },
  { slug: 'coach-intelligence', title: 'Coach Intelligence' },
  { slug: 'csuite', title: 'C-Suite' },
  { slug: 'workforce-intelligence', title: 'Workforce Intelligence' },
  { slug: 'b3-daily', title: 'B3 Daily' },
] as const;

export const LANDING_SLUGS = new Set<string>(LANDING_PAGES.map((p) => p.slug));
