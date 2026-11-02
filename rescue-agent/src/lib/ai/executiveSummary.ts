import { getAiProvider, type AiProvider } from '@/lib/ai/provider';

/**
 * AI executive-summary feature flag.
 *
 * `AI_EXECUTIVE_SUMMARY=enabled` is the only value that turns the AI-written
 * executive summary on. Anything else, including unset, "true", "1" and "on",
 * leaves it off. Off is the default.
 *
 * - Generation at audit time needs the flag AND a configured provider
 *   (AI_PROVIDER=anthropic plus ANTHROPIC_API_KEY). Without both, the audit
 *   stores the deterministic summary.
 * - Display of a summary already stored as AI-written needs the flag only, since
 *   the stored text needs no provider. With the flag off, every report (web and
 *   PDF alike) shows the deterministic summary composed from the stored audit
 *   data. Stored records are never altered either way.
 *
 * Nothing else depends on this flag: scoring, evidence, confidence,
 * classification and every other report section are deterministic and unchanged.
 */

type Env = Record<string, string | undefined>;

export const AI_EXECUTIVE_SUMMARY_ENV = 'AI_EXECUTIVE_SUMMARY';
export const AI_EXECUTIVE_SUMMARY_ON_VALUE = 'enabled';

/** True only when AI_EXECUTIVE_SUMMARY is explicitly "enabled". */
export function aiExecutiveSummaryEnabled(env: Env = process.env): boolean {
  return (env[AI_EXECUTIVE_SUMMARY_ENV] ?? '').trim().toLowerCase() === AI_EXECUTIVE_SUMMARY_ON_VALUE;
}

export type AiProviderState =
  | { configured: true; name: 'anthropic' }
  | { configured: false; reason: 'AI_PROVIDER unset' | 'AI_PROVIDER unsupported' | 'ANTHROPIC_API_KEY missing' };

/** Mirrors getAiProvider() without constructing a client. Names, never values. */
export function aiProviderState(env: Env = process.env): AiProviderState {
  // Same test as getAiProvider(), so health never disagrees with the pipeline.
  const provider = (env.AI_PROVIDER || '').toLowerCase();
  if (!provider) return { configured: false, reason: 'AI_PROVIDER unset' };
  if (provider !== 'anthropic') return { configured: false, reason: 'AI_PROVIDER unsupported' };
  if (!env.ANTHROPIC_API_KEY) return { configured: false, reason: 'ANTHROPIC_API_KEY missing' };
  return { configured: true, name: 'anthropic' };
}

/**
 * The provider the audit may use for the executive summary, or null. Null
 * unless the flag is enabled and a provider is configured. This is the only
 * way the audit pipeline obtains a provider for the summary.
 */
export function getExecutiveSummaryProvider(env: Env = process.env): AiProvider | null {
  if (!aiExecutiveSummaryEnabled(env)) return null;
  if (!aiProviderState(env).configured) return null;
  return getAiProvider();
}

/**
 * Whether a report may show an executive summary that was stored as AI-written
 * at audit time. Report loaders (web and PDF share one) call this; when it is
 * false they fall back to the deterministic summary.
 */
export function showStoredAiExecutiveSummary(storedAsAiWritten: boolean, env: Env = process.env): boolean {
  return storedAsAiWritten && aiExecutiveSummaryEnabled(env);
}

export interface ExecutiveSummaryStatus {
  /** What new audits will store. */
  newAudits: 'ai-enhanced' | 'deterministic';
  /** What reports do with summaries previously stored as AI-written. */
  storedAiSummaries: 'shown' | 'hidden (deterministic summary shown)';
  flag: string;
  provider: string;
}

/** Operator-facing state for /api/health. Names and states only, never values. */
export function executiveSummaryStatus(env: Env = process.env): ExecutiveSummaryStatus {
  const enabled = aiExecutiveSummaryEnabled(env);
  const raw = (env[AI_EXECUTIVE_SUMMARY_ENV] ?? '').trim();
  const provider = aiProviderState(env);
  return {
    newAudits: enabled && provider.configured ? 'ai-enhanced' : 'deterministic',
    storedAiSummaries: enabled ? 'shown' : 'hidden (deterministic summary shown)',
    flag: enabled
      ? 'enabled'
      : raw
        ? `off (unrecognised value; only ${AI_EXECUTIVE_SUMMARY_ENV}=${AI_EXECUTIVE_SUMMARY_ON_VALUE} turns it on)`
        : `off (${AI_EXECUTIVE_SUMMARY_ENV} unset)`,
    provider: provider.configured
      ? `${provider.name} (configured)`
      : provider.reason === 'AI_PROVIDER unset'
        ? 'not configured (AI_PROVIDER unset)'
        : provider.reason === 'AI_PROVIDER unsupported'
          ? 'not configured (AI_PROVIDER is not a supported provider; use anthropic)'
          : 'not configured (AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is missing)',
  };
}
