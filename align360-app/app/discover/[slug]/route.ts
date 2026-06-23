import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LANDING_PAGES, LANDING_SLUGS } from '@/lib/landing';

// Public industry/audience landing pages (Samuel's lead-gen designs). Each is a
// complete standalone HTML document served as-is; CTAs point to /signup. Public
// (allowlisted in middleware) so they render without a session.

export function generateStaticParams() {
  return LANDING_PAGES.map((p) => ({ slug: p.slug }));
}

export const dynamic = 'force-static';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  if (!LANDING_SLUGS.has(params.slug)) {
    return new Response('Not found', { status: 404 });
  }
  try {
    const html = readFileSync(path.join(process.cwd(), 'content', 'landing', `${params.slug}.html`), 'utf8');
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=86400' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
