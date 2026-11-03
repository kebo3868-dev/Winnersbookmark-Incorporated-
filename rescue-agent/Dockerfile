# syntax=docker/dockerfile:1
# Winners Bookmark Restaurant Rescue Agent — production image.
# Multi-stage build producing a small Next.js standalone server that applies
# Prisma migrations on startup, then serves on $PORT (default 3000).

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl curl && rm -rf /var/lib/apt/lists/* \
  && groupadd --system nodejs && useradd --system --gid nodejs nextjs

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN --mount=type=secret,id=proxy_ca \
  if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
  npm ci

FROM base AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=bind,from=deps,source=/app/node_modules,target=/app/node_modules,rw \
  npm run build

FROM base AS migrator
WORKDIR /app/migrator
COPY docker/migrator/package.json docker/migrator/package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
  if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
  npm ci --omit=dev

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0

# Prisma CLI for `migrate deploy` on startup, installed with its FULL
# dependency closure, committed lockfile and overrides. Never resolve a new
# ungoverned dependency tree inside the final image.
# Assemble in one layer to avoid repeatedly snapshotting native dependencies
# on Docker installations that use the VFS storage driver.
RUN --mount=type=bind,from=builder,source=/app,target=/build \
    --mount=type=bind,from=migrator,source=/app/migrator,target=/locked-migrator \
    cp -a /build/.next/standalone/. /app/ \
    && mkdir -p /app/.next/static /app/migrator \
    && cp -a /build/.next/static/. /app/.next/static/ \
    && cp -a /build/prisma /app/prisma \
    && cp -a /locked-migrator/. /app/migrator/ \
    && cp /build/docker-entrypoint.sh /app/docker-entrypoint.sh \
    && chmod 755 /app/docker-entrypoint.sh \
    && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:${PORT}/api/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
