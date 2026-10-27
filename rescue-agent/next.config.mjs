import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SECURITY_HEADERS } from './src/lib/securityHeaders.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client'],
  output: 'standalone',
  // This app lives in a subdirectory of a repo with other lockfiles; pin the
  // tracing root so standalone output lands at .next/standalone/server.js
  // (the layout the Dockerfile copies).
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  // Every route, pages and API alike. See src/lib/securityHeaders.mjs.
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
