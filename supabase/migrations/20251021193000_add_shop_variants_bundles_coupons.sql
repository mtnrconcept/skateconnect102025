-- Recreate sponsor shop and engagement schema

-- Ensure helper trigger exists for updated_at timestamps
create or replace function public.set_current_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

-- Sponsor shop core tables
create table if not exists public.sponsor_shop_items (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null,
  currency text not null default 'EUR',
  stock integer not null default 0,
  is_active boolean not null default true,
  image_url text,
  metadata jsonb,
  available_from timestamptz,
  available_until timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_timestamp on public.sponsor_shop_items;
create trigger set_timestamp
  before update on public.sponsor_shop_items
  for each row
  execute procedure public.set_current_timestamp();

create index if not exists sponsor_shop_items_sponsor_id_idx on public.sponsor_shop_items (sponsor_id);
create index if not exists sponsor_shop_items_is_active_idx on public.sponsor_shop_items (is_active);
create index if not exists sponsor_shop_items_updated_at_idx on public.sponsor_shop_items (updated_at desc);

create table if not exists public.sponsor_shop_item_variants (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.sponsor_shop_items (id) on delete cascade,
  name text not null,
  size text,
  color text,
  sku text,
  price_cents integer,
  stock integer not null default 0,
  is_active boolean not null default true,
  image_url text,
  metadata jsonb,
  availability_start timestamptz,
  availability_end timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_timestamp on public.sponsor_shop_item_variants;
create trigger set_timestamp
  before update on public.sponsor_shop_item_variants
  for each row
  execute procedure public.set_current_timestamp();

create index if not exists sponsor_shop_item_variants_item_id_idx on public.sponsor_shop_item_variants (item_id);
create index if not exists sponsor_shop_item_variants_is_active_idx on public.sponsor_shop_item_variants (is_active);

create table if not exists public.sponsor_shop_bundles (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  primary_item_id uuid not null references public.sponsor_shop_items (id) on delete restrict,
  name text not null,
  description text,
  price_cents integer not null,
  currency text not null default 'EUR',
  is_active boolean not null default true,
  metadata jsonb,
  available_from timestamptz,
  available_until timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_timestamp on public.sponsor_shop_bundles;
create trigger set_timestamp
  before update on public.sponsor_shop_bundles
  for each row
  execute procedure public.set_current_timestamp();

create index if not exists sponsor_shop_bundles_sponsor_id_idx on public.sponsor_shop_bundles (sponsor_id);
create index if not exists sponsor_shop_bundles_is_active_idx on public.sponsor_shop_bundles (is_active);

create table if not exists public.sponsor_shop_bundle_items (
  bundle_id uuid not null references public.sponsor_shop_bundles (id) on delete cascade,
  item_id uuid not null references public.sponsor_shop_items (id) on delete cascade,
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  quantity integer not null default 1,
  primary key (bundle_id, item_id)
);

create index if not exists sponsor_shop_bundle_items_sponsor_id_idx on public.sponsor_shop_bundle_items (sponsor_id);

create table if not exists public.sponsor_shop_coupons (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid references public.sponsor_shop_items (id) on delete set null,
  code text not null,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12, 2) not null,
  max_uses integer,
  usage_count integer not null default 0,
  minimum_quantity integer not null default 1,
  is_active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_timestamp on public.sponsor_shop_coupons;
create trigger set_timestamp
  before update on public.sponsor_shop_coupons
  for each row
  execute procedure public.set_current_timestamp();

create unique index if not exists sponsor_shop_coupons_code_key on public.sponsor_shop_coupons (code);
create index if not exists sponsor_shop_coupons_sponsor_id_idx on public.sponsor_shop_coupons (sponsor_id);

create table if not exists public.sponsor_shop_item_stats (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.sponsor_shop_items (id) on delete cascade,
  metric_date date not null,
  views_count integer not null default 0,
  cart_additions integer not null default 0,
  orders_count integer not null default 0,
  units_sold integer not null default 0,
  revenue_cents integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_timestamp on public.sponsor_shop_item_stats;
create trigger set_timestamp
  before update on public.sponsor_shop_item_stats
  for each row
  execute procedure public.set_current_timestamp();

create index if not exists sponsor_shop_item_stats_sponsor_id_idx on public.sponsor_shop_item_stats (sponsor_id);
create index if not exists sponsor_shop_item_stats_metric_idx on public.sponsor_shop_item_stats (metric_date desc);
create unique index if not exists sponsor_shop_item_stats_item_date_key on public.sponsor_shop_item_stats (item_id, metric_date);

-- Sponsor engagement tables
create table if not exists public.sponsor_challenges (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  owner_id uuid references public.profiles (id) on delete set null,
  title text not null,
  description text not null,
  prize text,
  value text,
  location text,
  cover_image_url text,
  tags text[] not null default '{}',
  start_date date,
  end_date date,
  participants_count integer not null default 0,
  participants_label text not null default 'Participants',
  action_label text not null default 'Participer',
  status text not null default 'idea',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_timestamp on public.sponsor_challenges;
create trigger set_timestamp
  before update on public.sponsor_challenges
  for each row
  execute procedure public.set_current_timestamp();

create index if not exists sponsor_challenges_sponsor_id_idx on public.sponsor_challenges (sponsor_id);
create index if not exists sponsor_challenges_status_idx on public.sponsor_challenges (status);
create index if not exists sponsor_challenges_start_date_idx on public.sponsor_challenges (start_date nulls last);

create table if not exists public.sponsor_events (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  owner_id uuid references public.profiles (id) on delete set null,
  title text not null,
  description text not null,
  event_date date,
  event_time text,
  location text,
  event_type text,
  attendees integer not null default 0,
  cover_image_url text,
  tags text[] not null default '{}',
  action_label text not null default 'Participer',
  status text not null default 'idea',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_timestamp on public.sponsor_events;
create trigger set_timestamp
  before update on public.sponsor_events
  for each row
  execute procedure public.set_current_timestamp();

create index if not exists sponsor_events_sponsor_id_idx on public.sponsor_events (sponsor_id);
create index if not exists sponsor_events_event_date_idx on public.sponsor_events (event_date nulls last);

create table if not exists public.sponsor_calls (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  owner_id uuid references public.profiles (id) on delete set null,
  title text not null,
  summary text not null,
  description text not null,
  location text,
  deadline date,
  reward text,
  highlight text,
  cover_image_url text,
  tags text[] not null default '{}',
  participants_label text not null default 'Participants',
  participants_count integer not null default 0,
  action_label text not null default 'Postuler',
  status text not null default 'idea',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_timestamp on public.sponsor_calls;
create trigger set_timestamp
  before update on public.sponsor_calls
  for each row
  execute procedure public.set_current_timestamp();

create index if not exists sponsor_calls_sponsor_id_idx on public.sponsor_calls (sponsor_id);
create index if not exists sponsor_calls_deadline_idx on public.sponsor_calls (deadline nulls last);

create table if not exists public.sponsor_spotlights (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  media_url text,
  call_to_action text,
  call_to_action_url text,
  status text not null default 'draft',
  start_date timestamptz,
  end_date timestamptz,
  performance jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_timestamp on public.sponsor_spotlights;
create trigger set_timestamp
  before update on public.sponsor_spotlights
  for each row
  execute procedure public.set_current_timestamp();

create index if not exists sponsor_spotlights_sponsor_id_idx on public.sponsor_spotlights (sponsor_id);
create index if not exists sponsor_spotlights_status_idx on public.sponsor_spotlights (status);

create table if not exists public.sponsor_api_keys (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes text[] not null default '{}',
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create unique index if not exists sponsor_api_keys_prefix_key on public.sponsor_api_keys (key_prefix);
create index if not exists sponsor_api_keys_sponsor_id_idx on public.sponsor_api_keys (sponsor_id);

create table if not exists public.sponsor_community_metrics (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  metric_date timestamptz not null,
  reach integer not null default 0,
  engagement_rate numeric not null default 0,
  activation_count integer not null default 0,
  top_regions text[] not null default '{}',
  trending_tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists sponsor_community_metrics_sponsor_id_idx on public.sponsor_community_metrics (sponsor_id);
create index if not exists sponsor_community_metrics_metric_date_idx on public.sponsor_community_metrics (metric_date desc);

-- Row Level Security policies
alter table public.sponsor_shop_items enable row level security;
alter table public.sponsor_shop_item_variants enable row level security;
alter table public.sponsor_shop_bundles enable row level security;
alter table public.sponsor_shop_bundle_items enable row level security;
alter table public.sponsor_shop_coupons enable row level security;
alter table public.sponsor_shop_item_stats enable row level security;
alter table public.sponsor_challenges enable row level security;
alter table public.sponsor_events enable row level security;
alter table public.sponsor_calls enable row level security;
alter table public.sponsor_spotlights enable row level security;
alter table public.sponsor_api_keys enable row level security;
alter table public.sponsor_community_metrics enable row level security;

-- Public read access for catalog style tables
create policy if not exists "sponsor_shop_items_read" on public.sponsor_shop_items
  for select using (true);

create policy if not exists "sponsor_shop_items_manage" on public.sponsor_shop_items
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_shop_variants_read" on public.sponsor_shop_item_variants
  for select using (true);

create policy if not exists "sponsor_shop_variants_manage" on public.sponsor_shop_item_variants
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_shop_bundles_read" on public.sponsor_shop_bundles
  for select using (true);

create policy if not exists "sponsor_shop_bundles_manage" on public.sponsor_shop_bundles
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_shop_bundle_items_read" on public.sponsor_shop_bundle_items
  for select using (true);

create policy if not exists "sponsor_shop_bundle_items_manage" on public.sponsor_shop_bundle_items
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_shop_coupons_manage" on public.sponsor_shop_coupons
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_shop_coupons_read" on public.sponsor_shop_coupons
  for select using (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_shop_item_stats_read" on public.sponsor_shop_item_stats
  for select using (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_shop_item_stats_manage" on public.sponsor_shop_item_stats
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_challenges_read" on public.sponsor_challenges
  for select using (true);

create policy if not exists "sponsor_challenges_manage" on public.sponsor_challenges
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_events_read" on public.sponsor_events
  for select using (true);

create policy if not exists "sponsor_events_manage" on public.sponsor_events
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_calls_read" on public.sponsor_calls
  for select using (true);

create policy if not exists "sponsor_calls_manage" on public.sponsor_calls
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_spotlights_read" on public.sponsor_spotlights
  for select using (true);

create policy if not exists "sponsor_spotlights_manage" on public.sponsor_spotlights
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_api_keys_read" on public.sponsor_api_keys
  for select using (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_api_keys_manage" on public.sponsor_api_keys
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_community_metrics_read" on public.sponsor_community_metrics
  for select using (auth.uid() = sponsor_id or auth.role() = 'service_role');

create policy if not exists "sponsor_community_metrics_manage" on public.sponsor_community_metrics
  for all using (auth.uid() = sponsor_id or auth.role() = 'service_role')
  with check (auth.uid() = sponsor_id or auth.role() = 'service_role');
