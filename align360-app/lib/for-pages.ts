// Samuel's niche one-pagers (audience-specific, video + Founders Circle CTA),
// served by app/for/[slug]/route.ts from content/for/<slug>.html. Distinct from
// lib/landing.ts (/discover/*, Samuel's earlier lead-gen designs) — Samuel asked
// for these specifically at align360.io/for/<slug> (Slack, 2026-07-21). Not
// necessarily linked from nav; must be reachable by direct URL to email out.

export const FOR_PAGES = [
  { slug: 'coaches', title: 'For Coaches' },
  { slug: 'schools', title: 'For Schools & Universities' },
  { slug: 'agencies', title: 'For Employment Agencies' },
  { slug: 'faith', title: 'For Churches & Faith Communities' },
  { slug: 'young-professionals', title: 'For Young & Career Professionals' },
] as const;

export const FOR_SLUGS = new Set<string>(FOR_PAGES.map((p) => p.slug));
