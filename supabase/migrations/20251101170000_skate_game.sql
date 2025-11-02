-- Game of S.K.A.T.E minimal schema (Supabase/Postgres)
-- Safe to run multiple times if tables don’t exist

create extension if not exists pgcrypto;

-- Enums
do $$ begin
  create type match_mode as enum ('live','remote');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_status as enum ('pending','active','review','finished','canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type turn_status as enum ('proposed','responded','validated','failed','timeout','disputed');
exception when duplicate_object then null; end $$;

-- Riders
create table if not exists public.rider_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  country text,
  elo int default 1200,
  xp int default 0,
  skatecoins int default 0,
  created_at timestamptz default now()
);

-- Matches
create table if not exists public.skate_matches (
  id uuid primary key default gen_random_uuid(),
  mode match_mode not null,
  player_a uuid not null references rider_profiles(user_id),
  player_b uuid not null references rider_profiles(user_id),
  status match_status not null default 'pending',
  letters_a text not null default '',
  letters_b text not null default '',
  winner uuid references rider_profiles(user_id),
  created_at timestamptz default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists skate_matches_players_idx on public.skate_matches (player_a, player_b);
create index if not exists skate_matches_status_idx on public.skate_matches (status);

-- Turns
create table if not exists public.skate_turns (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references skate_matches(id) on delete cascade,
  turn_index int not null,
  proposer uuid not null references rider_profiles(user_id),
  trick_name text,
  difficulty int,
  video_a_url text,
  video_b_url text,
  status turn_status not null default 'proposed',
  remote_deadline timestamptz,
  meta_a jsonb default '{}'::jsonb,
  meta_b jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists skate_turns_match_idx on public.skate_turns (match_id, turn_index);

-- Reviews (jury)
create table if not exists public.turn_reviews (
  id uuid primary key default gen_random_uuid(),
  turn_id uuid not null references skate_turns(id) on delete cascade,
  reviewer uuid not null references rider_profiles(user_id),
  decision text not null check (decision in ('valid','invalid')),
  reason text,
  created_at timestamptz default now(),
  unique(turn_id, reviewer)
);

-- Rewards history
create table if not exists public.rider_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references rider_profiles(user_id),
  match_id uuid references skate_matches(id),
  kind text not null check (kind in ('xp','elo','coin')),
  delta int not null,
  reason text,
  created_at timestamptz default now()
);

-- Basic RLS (restrict to players for matches & turns)
alter table public.skate_matches enable row level security;
alter table public.skate_turns enable row level security;
alter table public.turn_reviews enable row level security;
alter table public.rider_rewards enable row level security;
alter table public.rider_profiles enable row level security;

-- rider_profiles: users can see/update their own profile (minimal)
do $$ begin
  create policy rider_profiles_select_self on public.rider_profiles
  for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy rider_profiles_update_self on public.rider_profiles
  for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Matches: only participants can select; inserts allowed to authenticated (validated app logic)
do $$ begin
  create policy skate_matches_select_players on public.skate_matches
  for select using (auth.uid() = player_a or auth.uid() = player_b);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy skate_matches_insert_auth on public.skate_matches
  for insert with check (auth.uid() is not null);
exception when duplicate_object then null; end $$;

-- Turns: only participants can select/insert
do $$ begin
  create policy skate_turns_select_players on public.skate_turns
  for select using (
    exists (select 1 from public.skate_matches m where m.id = match_id and (auth.uid() = m.player_a or auth.uid() = m.player_b))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy skate_turns_insert_players on public.skate_turns
  for insert with check (
    exists (select 1 from public.skate_matches m where m.id = match_id and (auth.uid() = m.player_a or auth.uid() = m.player_b))
  );
exception when duplicate_object then null; end $$;

-- Reviews: reviewers must not be match participants (simplified: allow any authenticated user)
do $$ begin
  create policy turn_reviews_insert_auth on public.turn_reviews
  for insert with check (auth.uid() is not null);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy turn_reviews_select_auth on public.turn_reviews
  for select using (auth.uid() is not null);
exception when duplicate_object then null; end $$;

-- Rewards: a user can select their own rewards
do $$ begin
  create policy rider_rewards_select_self on public.rider_rewards
  for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

