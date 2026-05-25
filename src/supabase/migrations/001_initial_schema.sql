-- Restaurant AI Revenue Agent — Initial Schema
-- Run this in your Supabase SQL editor

-- ─── PROFILES ─────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  full_name text,
  company_name text,
  phone text,
  website text,
  business_email text,
  business_address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = user_id);

-- ─── LEADS ────────────────────────────────────────────────────────────────────

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  restaurant_name text not null,
  owner_name text,
  city text,
  address text,
  phone text,
  email text,
  website text,
  cuisine text,
  rating numeric,
  review_count integer,
  lead_source text,
  google_place_id text,
  google_maps_url text,
  has_online_ordering text check (has_online_ordering in ('yes', 'no', 'unknown')),
  has_reservations text check (has_reservations in ('yes', 'no', 'unknown')),
  has_catering_page text check (has_catering_page in ('yes', 'no', 'unknown')),
  has_contact_form text check (has_contact_form in ('yes', 'no', 'unknown')),
  bottleneck_score integer default 0,
  score_label text check (score_label in ('Low', 'Medium', 'High')),
  main_bottleneck text,
  top_bottlenecks text[],
  recommended_offer text,
  crm_stage text default 'New Lead',
  opt_out boolean default false,
  notes text,
  last_contacted_at timestamptz,
  next_followup_at date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.leads enable row level security;

create policy "Users can manage own leads"
  on public.leads for all using (auth.uid() = user_id);

-- ─── AUDITS ───────────────────────────────────────────────────────────────────

create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  lead_id uuid references public.leads(id) on delete cascade not null,
  digital_presence_score integer,
  customer_friction_score integer,
  revenue_capture_score integer,
  ai_opportunity_score integer,
  bottleneck_score integer,
  score_label text check (score_label in ('Low', 'Medium', 'High')),
  audit_summary text,
  top_bottlenecks text[],
  recommended_solution text,
  estimated_revenue_leak text,
  outreach_angle text,
  confidence_level text check (confidence_level in ('Low', 'Medium', 'High')),
  missing_information text[],
  next_best_action text,
  created_at timestamptz default now()
);

alter table public.audits enable row level security;

create policy "Users can manage own audits"
  on public.audits for all using (auth.uid() = user_id);

-- ─── EMAIL DRAFTS ─────────────────────────────────────────────────────────────

create table if not exists public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  lead_id uuid references public.leads(id) on delete cascade not null,
  subject text,
  body text,
  email_type text,
  status text default 'Draft' check (status in ('Draft', 'Approved', 'Sent')),
  approved_by_user boolean default false,
  sent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.email_drafts enable row level security;

create policy "Users can manage own email drafts"
  on public.email_drafts for all using (auth.uid() = user_id);

-- ─── FOLLOW-UPS ───────────────────────────────────────────────────────────────

create table if not exists public.followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  lead_id uuid references public.leads(id) on delete cascade not null,
  followup_number integer,
  scheduled_date date,
  followup_type text,
  status text default 'Scheduled' check (status in ('Scheduled', 'Due Today', 'Completed', 'Skipped', 'Do Not Contact')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.followups enable row level security;

create policy "Users can manage own followups"
  on public.followups for all using (auth.uid() = user_id);

-- ─── TRIALS ───────────────────────────────────────────────────────────────────

create table if not exists public.trials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  lead_id uuid references public.leads(id) on delete cascade not null,
  trial_start_date date,
  trial_end_date date,
  trial_status text default 'Offered' check (trial_status in ('Offered', 'Accepted', 'Active', 'Completed', 'Converted', 'Not Converted')),
  features_included text[],
  success_criteria text[],
  conversion_status text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.trials enable row level security;

create policy "Users can manage own trials"
  on public.trials for all using (auth.uid() = user_id);

-- ─── OPT-OUTS ─────────────────────────────────────────────────────────────────

create table if not exists public.optouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  lead_id uuid references public.leads(id),
  email text,
  restaurant_name text,
  optout_date timestamptz default now(),
  source text,
  created_at timestamptz default now()
);

alter table public.optouts enable row level security;

create policy "Users can manage own optouts"
  on public.optouts for all using (auth.uid() = user_id);

-- ─── SETTINGS ─────────────────────────────────────────────────────────────────

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  founder_name text,
  company_name text,
  phone text,
  website text,
  business_email text,
  business_address text,
  default_signature text,
  pricing_json jsonb,
  compliance_footer text,
  brand_footer text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.settings enable row level security;

create policy "Users can manage own settings"
  on public.settings for all using (auth.uid() = user_id);

-- ─── UPDATED_AT TRIGGER ───────────────────────────────────────────────────────

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_leads_updated before update on public.leads
  for each row execute function public.handle_updated_at();

create trigger on_email_drafts_updated before update on public.email_drafts
  for each row execute function public.handle_updated_at();

create trigger on_followups_updated before update on public.followups
  for each row execute function public.handle_updated_at();

create trigger on_trials_updated before update on public.trials
  for each row execute function public.handle_updated_at();

create trigger on_settings_updated before update on public.settings
  for each row execute function public.handle_updated_at();
