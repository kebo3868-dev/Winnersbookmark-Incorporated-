import type { ProviderId } from '@/lib/agents/registry';

/**
 * Environment configuration, read in one place. Every function takes `env`
 * so tests can pass a fixed record instead of mutating process.env.
 *
 * Model defaults are IDs published by each vendor (see docs/ENVIRONMENT.md
 * for the source of each). Override them with the *_MODEL variables when a
 * vendor retires or renames a model; nothing else needs to change.
 */
type Env = Record<string, string | undefined>;

export interface ProviderConfig {
  provider: ProviderId;
  /** Present only when every value required for a live call is set. */
  ready: boolean;
  /** Names of the missing variables, for an honest "not configured" status. */
  missing: string[];
  baseUrl: string;
  apiKey?: string;
  model: string;
  timeoutMs: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;

function timeout(env: Env, name: string): number {
  const raw = Number(env[name]);
  return Number.isFinite(raw) && raw >= 1_000 && raw <= 600_000 ? raw : DEFAULT_TIMEOUT_MS;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function providerConfig(provider: ProviderId, env: Env = process.env): ProviderConfig {
  switch (provider) {
    case 'openai': {
      const apiKey = env.OPENAI_API_KEY;
      return {
        provider,
        ready: Boolean(apiKey),
        missing: apiKey ? [] : ['OPENAI_API_KEY'],
        baseUrl: trimSlash(env.OPENAI_BASE_URL || 'https://api.openai.com/v1'),
        apiKey,
        model: env.OPENAI_MODEL || 'gpt-5.5',
        timeoutMs: timeout(env, 'OPENAI_TIMEOUT_MS'),
      };
    }
    case 'meta': {
      const apiKey = env.META_MODEL_API_KEY;
      return {
        provider,
        ready: Boolean(apiKey),
        missing: apiKey ? [] : ['META_MODEL_API_KEY'],
        baseUrl: trimSlash(env.META_MODEL_API_BASE_URL || 'https://api.meta.ai/v1'),
        apiKey,
        model: env.META_MODEL || 'muse-spark-1.3',
        timeoutMs: timeout(env, 'META_TIMEOUT_MS'),
      };
    }
    case 'hermes': {
      // Hermes has no public endpoint: it runs on infrastructure you operate,
      // so both the URL and the key are required. API_SERVER_KEY on the
      // Hermes side must equal HERMES_API_KEY here.
      const baseUrl = env.HERMES_BASE_URL;
      const apiKey = env.HERMES_API_KEY;
      const missing = [!baseUrl && 'HERMES_BASE_URL', !apiKey && 'HERMES_API_KEY'].filter(Boolean) as string[];
      return {
        provider,
        ready: missing.length === 0,
        missing,
        baseUrl: trimSlash(baseUrl || ''),
        apiKey,
        model: env.HERMES_MODEL || 'hermes-agent',
        timeoutMs: timeout(env, 'HERMES_TIMEOUT_MS'),
      };
    }
    case 'gemini': {
      const apiKey = env.GEMINI_API_KEY;
      return {
        provider,
        ready: Boolean(apiKey),
        missing: apiKey ? [] : ['GEMINI_API_KEY'],
        baseUrl: trimSlash(env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'),
        apiKey,
        model: env.GEMINI_MODEL || 'gemini-flash-latest',
        timeoutMs: timeout(env, 'GEMINI_TIMEOUT_MS'),
      };
    }
  }
}

export function isProduction(env: Env = process.env): boolean {
  return env.NODE_ENV === 'production';
}

/**
 * Whether an unconfigured agent may be served by the mock adapter.
 * Allowed by default in development; in production only by explicit opt-in,
 * so a deployment never silently answers with simulated output.
 */
export function mockAllowed(env: Env = process.env): boolean {
  if (env.AGENTOS_ALLOW_MOCK === 'false') return false;
  if (env.AGENTOS_ALLOW_MOCK === 'true') return true;
  return !isProduction(env);
}

/** Hourly cap on provider-calling actions (runs and probes). Spend control. */
export function runsPerHourLimit(env: Env = process.env): number {
  const raw = Number(env.AGENTOS_MAX_RUNS_PER_HOUR);
  return Number.isInteger(raw) && raw > 0 && raw <= 1000 ? raw : 30;
}
