/** @type {import('next').NextConfig} */
const nextConfig = {
  // Include AI Model + Assessments folders in the serverless bundle so the
  // chat API route can read them at runtime on Vercel.
  outputFileTracingIncludes: {
    '/api/chat': ['../AI Model/**/*', '../Assessments/**/*'],
  },
  experimental: {
    // Allow reading files outside the project root at build/runtime.
    outputFileTracingRoot: require('path').join(__dirname, '..'),
  },
};

module.exports = nextConfig;
