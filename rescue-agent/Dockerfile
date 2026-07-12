# Winners Bookmark Restaurant Rescue Agent — production image.
# Multi-stage build producing a small Next.js standalone server that applies
# Prisma migrations on startup, then serves on $PORT (default 3000).

FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl curl && rm -rf /var/lib/apt/lists/* \
  && groupadd --system nodejs && useradd --system --gid nodejs nextjs
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# Prisma CLI for `migrate deploy` on startup, installed with its FULL
# dependency closure into a dedicated directory. Copying node_modules/prisma
# + @prisma subtrees is not enough — the CLI's transitive deps (e.g.
# @prisma/config → c12, effect) live outside them and standalone tracing
# never includes dev-only CLI packages. Keep the version in sync with
# devDependencies.prisma in package.json.
RUN mkdir -p /app/migrator && cd /app/migrator && npm install --no-save --no-audit --no-fund prisma@6.19.3 \
  && chown -R nextjs:nodejs /app/migrator
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:${PORT}/api/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
