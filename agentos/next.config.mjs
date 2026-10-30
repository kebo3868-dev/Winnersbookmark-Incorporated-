import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SECURITY_HEADERS } from './src/lib/security/headers.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This app lives in a subdirectory of a repo with other lockfiles; pin the
  // tracing root to this directory so builds never reach into sibling apps.
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
  serverExternalPackages: ['pg'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
