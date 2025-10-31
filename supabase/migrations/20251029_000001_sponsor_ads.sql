-- Sponsor ads schema providing campaign management, creatives, placements, and reporting snapshots

-- Helper trigger to keep updated_at fields in sync
create or replace function public.set_current_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

-- Campaigns represent the root entity for sponsor ads
create table if not exists public.sponsor_ads_campaigns (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  objective text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled', 'archived')),
  budget_cents integer not null default 0 check (budget_cents >= 0),
  daily_spend_cap_cents integer check (daily_spend_cap_cents >= 0),
  currency text not null default 'EUR',
  start_date date,
  end_date date,
  target_audience jsonb,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_timestamp on public.sponsor_ads_campaigns;
create trigger set_timestamp
  before update on public.sponsor_ads_campaigns
  for each row
  execute procedure public.set_current_timestamp();

create index if not exists sponsor_ads_campaigns_sponsor_id_idx on public.sponsor_ads_campaigns (sponsor_id);
create index if not exists sponsor_ads_campaigns_status_idx on public.sponsor_ads_campaigns (status);
create index if not exists sponsor_ads_campaigns_schedule_idx on public.sponsor_ads_campaigns (start_date nulls last, end_date nulls last);

-- Creatives store the assets and messaging for a campaign
create table if not exists public.sponsor_ads_creatives (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  campaign_id uuid not null references public.sponsor_ads_campaigns (id) on delete cascade,
  name text not null,
  format text not null default 'image' check (format in ('image', 'video', 'carousel', 'story', 'interactive')),
  headline text,
  description text,
  call_to_action text,
  call_to_action_url text,
  media_url text,
  thumbnail_url text,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_timestamp on public.sponsor_ads_creatives;
create trigger set_timestamp
  before update on public.sponsor_ads_creatives
  for each row
  execute procedure public.set_current_timestamp();

create index if not exists sponsor_ads_creatives_sponsor_id_idx on public.sponsor_ads_creatives (sponsor_id);
create index if not exists sponsor_ads_creatives_campaign_id_idx on public.sponsor_ads_creatives (campaign_id);

-- Placements describe where and how a creative is delivered
create table if not exists public.sponsor_ads_placements (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  campaign_id uuid not null references public.sponsor_ads_campaigns (id) on delete cascade,
  creative_id uuid not null references public.sponsor_ads_creatives (id) on delete cascade,
  placement_type text not null check (placement_type in ('feed', 'map', 'stories', 'search', 'challenge', 'shop', 'profile', 'messaging', 'notifications')),
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'paused', 'completed', 'cancelled')),
  bid_cents integer check (bid_cents >= 0),
  max_impressions integer,
  max_clicks integer,
  start_time timestamptz,
  end_time timestamptz,
  targeting jsonb,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_timestamp on public.sponsor_ads_placements;
create trigger set_timestamp
  before update on public.sponsor_ads_placements
  for each row
  execute procedure public.set_current_timestamp();

create index if not exists sponsor_ads_placements_sponsor_id_idx on public.sponsor_ads_placements (sponsor_id);
create index if not exists sponsor_ads_placements_campaign_id_idx on public.sponsor_ads_placements (campaign_id);
create index if not exists sponsor_ads_placements_status_idx on public.sponsor_ads_placements (status);
create index if not exists sponsor_ads_placements_schedule_idx on public.sponsor_ads_placements (start_time nulls last, end_time nulls last);

-- Audience presets allow sponsors to reuse saved targeting combinations
create table if not exists public.sponsor_ads_audience_presets (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  targeting jsonb not null,
  estimated_size integer,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_timestamp on public.sponsor_ads_audience_presets;
create trigger set_timestamp
  before update on public.sponsor_ads_audience_presets
  for each row
  execute procedure public.set_current_timestamp();

create index if not exists sponsor_ads_audience_presets_sponsor_id_idx on public.sponsor_ads_audience_presets (sponsor_id);
create unique index if not exists sponsor_ads_audience_presets_name_idx on public.sponsor_ads_audience_presets (sponsor_id, lower(name));

-- Budget flights allow multi-phase allocations for a campaign
create table if not exists public.sponsor_ads_budget_flights (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  campaign_id uuid not null references public.sponsor_ads_campaigns (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  budget_cents integer not null check (budget_cents >= 0),
  pacing_strategy text not null default 'even' check (pacing_strategy in ('even', 'accelerated', 'lifetime')), 
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (end_date >= start_date)
);

drop trigger if exists set_timestamp on public.sponsor_ads_budget_flights;
create trigger set_timestamp
  before update on public.sponsor_ads_budget_flights
  for each row
  execute procedure public.set_current_timestamp();

create index if not exists sponsor_ads_budget_flights_campaign_id_idx on public.sponsor_ads_budget_flights (campaign_id);
create index if not exists sponsor_ads_budget_flights_sponsor_id_idx on public.sponsor_ads_budget_flights (sponsor_id);
create unique index if not exists sponsor_ads_budget_flights_unique_range_idx on public.sponsor_ads_budget_flights (campaign_id, start_date, end_date);

-- Snapshot table aggregating metrics per placement per day
create table if not exists public.sponsor_ads_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  campaign_id uuid not null references public.sponsor_ads_campaigns (id) on delete cascade,
  placement_id uuid references public.sponsor_ads_placements (id) on delete set null,
  snapshot_date date not null,
  impressions integer not null default 0,
  reach integer not null default 0,
  clicks integer not null default 0,
  video_views integer not null default 0,
  conversions integer not null default 0,
  spend_cents integer not null default 0,
  ctr numeric(8, 5) not null default 0,
  cpc numeric(12, 5) not null default 0,
  cpa numeric(12, 5) not null default 0,
  watch_time_seconds integer not null default 0,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists sponsor_ads_performance_snapshots_sponsor_id_idx on public.sponsor_ads_performance_snapshots (sponsor_id);
create index if not exists sponsor_ads_performance_snapshots_campaign_id_idx on public.sponsor_ads_performance_snapshots (campaign_id);
create index if not exists sponsor_ads_performance_snapshots_date_idx on public.sponsor_ads_performance_snapshots (snapshot_date desc);
create unique index if not exists sponsor_ads_performance_snapshots_unique_idx on public.sponsor_ads_performance_snapshots (coalesce(placement_id, '00000000-0000-0000-0000-000000000000'::uuid), snapshot_date);

-- Breakdown metrics for each snapshot by dimension (e.g., location, device)
create table if not exists public.sponsor_ads_snapshot_breakdowns (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.sponsor_ads_performance_snapshots (id) on delete cascade,
  dimension text not null,
  dimension_value text not null,
  impressions integer not null default 0,
  reach integer not null default 0,
  clicks integer not null default 0,
  conversions integer not null default 0,
  spend_cents integer not null default 0,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists sponsor_ads_snapshot_breakdowns_snapshot_idx on public.sponsor_ads_snapshot_breakdowns (snapshot_id);
create unique index if not exists sponsor_ads_snapshot_breakdowns_unique_idx on public.sponsor_ads_snapshot_breakdowns (snapshot_id, dimension, dimension_value);

-- Historical exports for compliance / reporting
create table if not exists public.sponsor_ads_report_exports (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  campaign_id uuid references public.sponsor_ads_campaigns (id) on delete set null,
  export_type text not null default 'performance' check (export_type in ('performance', 'billing', 'audit')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  file_url text,
  metadata jsonb
);

create index if not exists sponsor_ads_report_exports_sponsor_id_idx on public.sponsor_ads_report_exports (sponsor_id);
create index if not exists sponsor_ads_report_exports_campaign_id_idx on public.sponsor_ads_report_exports (campaign_id);
create index if not exists sponsor_ads_report_exports_status_idx on public.sponsor_ads_report_exports (status);

-- Enable Row Level Security
alter table public.sponsor_ads_campaigns enable row level security;
alter table public.sponsor_ads_creatives enable row level security;
alter table public.sponsor_ads_placements enable row level security;
alter table public.sponsor_ads_audience_presets enable row level security;
alter table public.sponsor_ads_budget_flights enable row level security;
alter table public.sponsor_ads_performance_snapshots enable row level security;
alter table public.sponsor_ads_snapshot_breakdowns enable row level security;
alter table public.sponsor_ads_report_exports enable row level security;

-- RLS policies (select + all) following sponsor ownership rules
create policy if not exists "sponsor_ads_campaigns_select" on public.sponsor_ads_campaigns
  for select using (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_ads_campaigns_manage" on public.sponsor_ads_campaigns
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_ads_creatives_select" on public.sponsor_ads_creatives
  for select using (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_ads_creatives_manage" on public.sponsor_ads_creatives
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_ads_placements_select" on public.sponsor_ads_placements
  for select using (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_ads_placements_manage" on public.sponsor_ads_placements
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_ads_audience_presets_select" on public.sponsor_ads_audience_presets
  for select using (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_ads_audience_presets_manage" on public.sponsor_ads_audience_presets
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_ads_budget_flights_select" on public.sponsor_ads_budget_flights
  for select using (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_ads_budget_flights_manage" on public.sponsor_ads_budget_flights
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_ads_performance_snapshots_select" on public.sponsor_ads_performance_snapshots
  for select using (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_ads_performance_snapshots_manage" on public.sponsor_ads_performance_snapshots
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_ads_snapshot_breakdowns_select" on public.sponsor_ads_snapshot_breakdowns
  for select using (exists (
    select 1 from public.sponsor_ads_performance_snapshots s
    where s.id = snapshot_id and (auth.uid() = s.sponsor_id or auth.role() = 'service_role')
  ));

create policy if not exists "sponsor_ads_snapshot_breakdowns_manage" on public.sponsor_ads_snapshot_breakdowns
  for all using (exists (
    select 1 from public.sponsor_ads_performance_snapshots s
    where s.id = snapshot_id and (auth.uid() = s.sponsor_id or auth.role() = 'service_role')
  ))
  with check (exists (
    select 1 from public.sponsor_ads_performance_snapshots s
    where s.id = snapshot_id and (auth.uid() = s.sponsor_id or auth.role() = 'service_role')
  ));

create policy if not exists "sponsor_ads_report_exports_select" on public.sponsor_ads_report_exports
  for select using (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_ads_report_exports_manage" on public.sponsor_ads_report_exports
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');
