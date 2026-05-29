/** @type {import('next').NextConfig} */
const nextConfig = {
  // Include AI Model + Assessments folders in the serverless bundle so the
  // chat / profile API routes can read them at runtime on Vercel.
  // NOTE: in Next 14 these live under `experimental` (promoted to top-level in Next 15).
  experimental: {
    // Allow reading files outside the project root at build/runtime.
    outputFileTracingRoot: require('path').join(__dirname, '..'),
    outputFileTracingIncludes: {
      '/api/chat': ['../AI Model/**/*', '../Assessments/**/*'],
    },
  },
};

module.exports = nextConfig;
