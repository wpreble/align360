/** @type {import('next').NextConfig} */
const nextConfig = {
  // The AI Model + Assessments markdown lives inside the app (./content) so the
  // app is self-contained and deploys cleanly from this directory. Bundle that
  // content into the serverless functions that read it at runtime.
  experimental: {
    outputFileTracingIncludes: {
      '/api/chat': ['./content/**/*'],
      '/api/profile/generate': ['./content/**/*'],
      '/api/clarity/generate': ['./content/**/*'],
      '/api/assessment/generate': ['./content/**/*'],
      '/assessment/[slug]': ['./content/**/*'],
      '/discover/[slug]': ['./content/landing/**/*'],
      '/for/[slug]': ['./content/for/**/*'],
    },
  },
  // Retire the stale betaapp.io app: forward every path to the canonical
  // align360.io. Lead-gen CTAs are relative (/signup), so a page served from the
  // old domain kept users on betaapp.io (Samuel, 2026-07-11). Dormant on
  // align360.io; activates once betaapp.io is added as a domain on this Vercel
  // project (align360-app) — which also decommissions the old deployment.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'align360.betaapp.io' }],
        destination: 'https://align360.io/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
