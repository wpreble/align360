/** @type {import('next').NextConfig} */
const nextConfig = {
  // The AI Model + Assessments markdown lives inside the app (./content) so the
  // app is self-contained and deploys cleanly from this directory. Bundle that
  // content into the serverless functions that read it at runtime.
  experimental: {
    outputFileTracingIncludes: {
      '/api/chat': ['./content/**/*'],
      '/api/profile/generate': ['./content/**/*'],
      '/assessment/[slug]': ['./content/**/*'],
    },
  },
};

module.exports = nextConfig;
