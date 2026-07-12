#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "FATAL: DATABASE_URL is not set." >&2
  exit 1
fi

echo "Applying database migrations (prisma migrate deploy)..."
./node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma

echo "Starting Restaurant Rescue Agent on port ${PORT:-3000}..."
exec node server.js
