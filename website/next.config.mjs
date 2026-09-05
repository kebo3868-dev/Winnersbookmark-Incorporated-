import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This app lives in a subdirectory of a repo that holds two other lockfiles
  // (the repo root's Vite app and rescue-agent). Without an explicit tracing
  // root, Next walks upward, finds the wrong lockfile and warns on every build.
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),

  // Security headers. The marketing site is fully public and holds no
  // credentials, but it is also the surface a prospect judges the company by,
  // so it should not be the weakest thing we ship.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
