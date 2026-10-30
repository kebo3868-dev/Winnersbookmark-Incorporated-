# Environment variables

All are server-side. None may be prefixed `NEXT_PUBLIC_`, and a test enforces that no
key, secret or database URL is. Set them in Vercel → Project → Settings → Environment
Variables (Production and Preview separately), or in `agentos/.env.local` for local work.

## Required

| Variable | Purpose |
|---|---|
| `AGENTOS_OWNER_PASSWORD_HASH` | scrypt hash of the founder password. Generate with `npm run --silent hash-password` (reads from stdin, minimum 12 characters). |
| `AGENTOS_SESSION_SECRET` | ≥ 32 random characters, for example `openssl rand -hex 32`. Rotating it signs out every session. |
| `DATABASE_URL` | Supabase Postgres connection string. On Vercel use the **pooled** string (Supavisor, port 6543). Do **not** add `sslmode` (TLS is configured in code). Required in production; without it, development uses an in-memory store that announces itself on every page. |
| `DATABASE_CA_CERT` | Supabase's CA certificate (PEM; `\n` escapes allowed), from Supabase → Database Settings → SSL. Needed to verify the database's TLS certificate. Not needed for a local database. |

Without the first two, every page and API answers 503 (fail closed), in development too.

## Providers (each optional; an unset agent is "Not connected")

| Agent | Variables | Default model | Source of the default |
|---|---|---|---|
| Roxy | `OPENAI_API_KEY` · `OPENAI_MODEL` · `OPENAI_BASE_URL` · `OPENAI_TIMEOUT_MS` | `gpt-5.5` | Listed in the official `openai-node` SDK model list |
| Zeus | `META_MODEL_API_KEY` · `META_MODEL` · `META_MODEL_API_BASE_URL` · `META_TIMEOUT_MS` | `muse-spark-1.3` | Meta Model API, base `https://api.meta.ai/v1`, as documented by promptfoo and Mastra integrations. Confirm on dev.meta.ai in Phase 3 (see below). |
| Hermes | `HERMES_BASE_URL` · `HERMES_API_KEY` · `HERMES_MODEL` · `HERMES_TIMEOUT_MS` | `hermes-agent` | Official Hermes Agent API server docs |
| Gemini | `GEMINI_API_KEY` · `GEMINI_MODEL` · `GEMINI_BASE_URL` · `GEMINI_TIMEOUT_MS` | `gemini-flash-latest` | Official `@google/genai` SDK README |

Timeouts default to 120000 ms (allowed range 1000–600000).

**Meta:** `-contributor` model IDs are refused because they license Meta to train on your
data. Muse Spark was in US-only public preview when this was built.

**Hermes:** `HERMES_BASE_URL` is the server root, for example `https://hermes.internal.example:8642`
(a trailing `/v1` is accepted). `HERMES_API_KEY` must equal `API_SERVER_KEY` in Hermes's
`~/.hermes/.env`, and Hermes needs `API_SERVER_ENABLED=true`. Hermes listens on
`127.0.0.1:8642` by default. Expose it to AgentOS only over a private network or a TLS
reverse proxy with an IP allowlist.

**Verification note:** this session's network policy blocked `developers.openai.com`,
`dev.meta.ai`, `developer.meta.com` and `hermes-agent.nousresearch.com`. Endpoint shapes
were taken from the official Hermes docs (via its GitHub repo), the official OpenAI and
Google SDK sources, and two independent Meta integrations. Each is re-verified by a live
probe in Phase 3. The dashboard never shows "verified" until that probe succeeds.

## Controls

| Variable | Default | Purpose |
|---|---|---|
| `AGENTOS_ALLOW_MOCK` | `true` in development, `false` in production | Whether an unconfigured agent may answer with labelled simulated output. Set `false` in production once agents are live. |
| `AGENTOS_MAX_RUNS_PER_HOUR` | `30` | Cap on task runs plus connection checks per hour, across all instances (spend control). |
| `AGENTOS_MAX_OUTPUT_TOKENS` | `8000` | Output cap per provider call. |
| `DATABASE_POOL_MAX` | `5` | Connections per server instance. |

Never commit `.env.local`. The repo `.gitignore` excludes `.env`, `.env.local` and `.env.*.local`.
