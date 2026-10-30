-- Winnersbookmark AgentOS — core schema (Phase 1 / Phase 2 vertical slice).
--
-- Applies to Supabase Postgres (supabase db push, or scripts/migrate.mjs with
-- a direct connection string) and to plain Postgres 15+ for local work and CI.
--
-- Access model: the application connects server-side with the database owner
-- role. Row Level Security is ENABLED on every table with NO policies, so the
-- Supabase anon and authenticated roles — the ones a browser key carries —
-- can read and write nothing, even if a key leaks. The owner role bypasses
-- RLS, which is what the server uses.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tasks: one objective, one primary agent, optional independent reviewer.
-- ---------------------------------------------------------------------------
create table tasks (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null check (char_length(title) between 3 and 200),
  objective          text not null check (char_length(objective) between 10 and 8000),
  agent_id           text not null check (agent_id in ('roxy', 'zeus', 'hermes', 'gemini')),
  reviewer_agent_id  text check (reviewer_agent_id in ('roxy', 'zeus', 'hermes', 'gemini')),
  risk_level         text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  status             text not null default 'queued'
                     check (status in ('queued', 'running', 'awaiting_approval', 'approved', 'rejected', 'failed')),
  last_error         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Independent verification means a different agent. Enforced here so no
  -- code path can schedule an agent to grade its own work.
  constraint reviewer_is_independent check (reviewer_agent_id is null or reviewer_agent_id <> agent_id)
);
create index tasks_status_idx on tasks (status, created_at desc);
create index tasks_agent_idx on tasks (agent_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Runs: every provider call, primary or reviewer, with its evidence.
-- mode = 'mock' marks simulated output; it can never be relabelled 'live'.
-- ---------------------------------------------------------------------------
create table task_runs (
  id                   uuid primary key default gen_random_uuid(),
  task_id              uuid not null references tasks (id) on delete restrict,
  agent_id             text not null check (agent_id in ('roxy', 'zeus', 'hermes', 'gemini')),
  role                 text not null check (role in ('primary', 'reviewer')),
  mode                 text not null check (mode in ('live', 'mock')),
  attempt              integer not null check (attempt between 1 and 10),
  status               text not null check (status in ('succeeded', 'failed')),
  provider             text not null,
  model                text,
  output               text,
  verdict              text check (verdict in ('pass', 'concerns', 'fail', 'unparseable')),
  findings             jsonb,
  error                text,
  input_tokens         integer,
  output_tokens        integer,
  latency_ms           integer,
  provider_response_id text,
  started_at           timestamptz not null,
  finished_at          timestamptz not null,
  constraint verdict_only_on_review check (verdict is null or role = 'reviewer')
);
create index task_runs_task_idx on task_runs (task_id, started_at);

-- Evidence is immutable once written.
create function forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;
-- Tasks referencing evidence cannot be deleted either (on delete restrict).
create trigger task_runs_immutable before update or delete on task_runs
  for each row execute function forbid_mutation();

-- ---------------------------------------------------------------------------
-- Approvals: the founder's explicit decisions. Gated action types mirror
-- src/lib/approvals/policy.ts.
-- ---------------------------------------------------------------------------
create table approvals (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references tasks (id) on delete restrict,
  action_type  text not null check (action_type in (
                 'accept_result',
                 'send_external_message',
                 'spend_money',
                 'publish_content',
                 'modify_production_database',
                 'deploy_production',
                 'contractual_commitment')),
  summary      text not null,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by   text,
  decided_at   timestamptz,
  note         text,
  created_at   timestamptz not null default now(),
  -- A decision is recorded with who and when, or not at all.
  constraint decision_is_attributed check (
    (status = 'pending' and decided_at is null and decided_by is null) or
    (status <> 'pending' and decided_at is not null and decided_by is not null))
);
create index approvals_pending_idx on approvals (status, created_at desc);
-- At most one open decision per task and action.
create unique index approvals_one_pending on approvals (task_id, action_type) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Connection probes: the only source of a "verified" status.
-- ---------------------------------------------------------------------------
create table agent_probes (
  id            uuid primary key default gen_random_uuid(),
  agent_id      text not null check (agent_id in ('roxy', 'zeus', 'hermes', 'gemini')),
  ok            boolean not null,
  detail        text not null,
  model         text,
  latency_ms    integer,
  probed_at     timestamptz not null default now()
);
create index agent_probes_latest_idx on agent_probes (agent_id, probed_at desc);

-- ---------------------------------------------------------------------------
-- Audit log: append-only record of every state change and decision.
-- ---------------------------------------------------------------------------
create table audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       text not null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     jsonb not null default '{}'::jsonb
);
create index audit_log_entity_idx on audit_log (entity, entity_id, at desc);
create trigger audit_log_immutable before update or delete on audit_log
  for each row execute function forbid_mutation();

-- ---------------------------------------------------------------------------
-- Rate limits: fixed windows shared by every server instance.
-- ---------------------------------------------------------------------------
create table rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------------------
-- Lock the browser-facing roles out (Supabase). Guarded so the migration also
-- applies to plain Postgres, where those roles do not exist.
-- ---------------------------------------------------------------------------
alter table tasks         enable row level security;
alter table task_runs     enable row level security;
alter table approvals     enable row level security;
alter table agent_probes  enable row level security;
alter table audit_log     enable row level security;
alter table rate_limits   enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on tasks, task_runs, approvals, agent_probes, audit_log, rate_limits from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on tasks, task_runs, approvals, agent_probes, audit_log, rate_limits from authenticated;
  end if;
end;
$$;
