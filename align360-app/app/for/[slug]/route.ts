import { readFileSync } from 'node:fs';
import path from 'node:path';
import { FOR_PAGES, FOR_SLUGS } from '@/lib/for-pages';

// Samuel's audience-specific one-pagers (align360.io/for/<slug>). Each is a
// complete standalone HTML document served as-is; CTAs point at align360.io and
// Samuel's Calendly. Public (allowlisted in middleware) so they render without a
// session; not necessarily linked from nav (Samuel emails the links directly).

export function generateStaticParams() {
  return FOR_PAGES.map((p) => ({ slug: p.slug }));
}

export const dynamic = 'force-static';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  if (!FOR_SLUGS.has(params.slug)) {
    return new Response('Not found', { status: 404 });
  }
  try {
    const html = readFileSync(path.join(process.cwd(), 'content', 'for', `${params.slug}.html`), 'utf8');
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=86400' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
