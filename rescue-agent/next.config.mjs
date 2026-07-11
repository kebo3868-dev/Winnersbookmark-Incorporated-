import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client'],
  output: 'standalone',
  // This app lives in a subdirectory of a repo with other lockfiles; pin the
  // tracing root so standalone output lands at .next/standalone/server.js
  // (the layout the Dockerfile copies).
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
};

export default nextConfig;
