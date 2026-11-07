import { isNonProductionDeployment, resolveDatabaseUrlSource } from '@/lib/db';
import { resolveAuthMode } from '@/lib/auth';
import { resolveLeadRetentionDays } from '@/lib/leads/retention';

/** Names and states only — never a value. Only ever served to an operator. */
export function diagnosticConfig() {
  const authMode = resolveAuthMode({
    BASIC_AUTH_USER: process.env.BASIC_AUTH_USER,
    BASIC_AUTH_PASSWORD: process.env.BASIC_AUTH_PASSWORD,
    NODE_ENV: process.env.NODE_ENV,
  });
  return {
    auth:
      authMode === 'required'
        ? 'configured'
        : authMode === 'open'
          ? 'open (non-production)'
          : 'MISSING — all routes serve 503 until BASIC_AUTH_USER/BASIC_AUTH_PASSWORD are set',
    databaseSource: resolveDatabaseUrlSource() ?? 'NONE — no database env var found',
    // A non-production deployment never migrates (scripts/vercel-build-plan.mjs).
    migrationSourceAvailable: !isNonProductionDeployment() && Boolean(
      process.env.RESCUE_DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING,
    ),
    aiNarrative:
      process.env.AI_PROVIDER && process.env.ANTHROPIC_API_KEY ? 'configured' : 'disabled (deterministic reports)',
    leadRetention: (() => {
      const days = resolveLeadRetentionDays();
      return days === null
        ? 'disabled — lead contact details are kept indefinitely (set LEAD_RETENTION_DAYS to expire them)'
        : `contact details redacted after ${days} day(s)`;
    })(),
  };
}
