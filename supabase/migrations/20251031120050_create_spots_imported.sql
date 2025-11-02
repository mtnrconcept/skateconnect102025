-- Create a dedicated table for imported skate spots with full schema parity
-- Table: public.spots_imported

create table if not exists public.spots_imported (
  id uuid primary key default gen_random_uuid(),
  created_by uuid null references public.profiles(id) on delete set null,
  name text not null,
  description text not null default '',
  address text not null default '',
  latitude double precision not null,
  longitude double precision not null,
  spot_type text not null check (spot_type in ('street','skatepark','bowl','diy','transition')),
  difficulty integer not null default 3 check (difficulty between 1 and 5),
  surfaces text[] not null default '{}',
  modules text[] not null default '{}',
  is_verified boolean not null default false,
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  rating_average numeric null,
  rating_count integer not null default 0,
  rating_distribution jsonb null,
  cover_image_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Simple updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_spots_imported_set_updated_at on public.spots_imported;
create trigger trg_spots_imported_set_updated_at
before update on public.spots_imported
for each row execute function public.set_updated_at();

-- Indexes to speed up lookups
create index if not exists idx_spots_imported_name on public.spots_imported using btree (name);
create index if not exists idx_spots_imported_lat_lon on public.spots_imported using btree (latitude, longitude);

-- Enable RLS and allow read for anon/auth, write restricted
alter table public.spots_imported enable row level security;

do $$ begin
  perform 1 from pg_policies where polname = 'spots_imported_select_all';
  if not found then
    create policy spots_imported_select_all on public.spots_imported
      for select using (true);
  end if;
end $$;

do $$ begin
  perform 1 from pg_policies where polname = 'spots_imported_insert_service_only';
  if not found then
    create policy spots_imported_insert_service_only on public.spots_imported
      for insert with check (auth.jwt() ->> 'role' = 'service_role');
  end if;
end $$;

do $$ begin
  perform 1 from pg_policies where polname = 'spots_imported_update_service_only';
  if not found then
    create policy spots_imported_update_service_only on public.spots_imported
      for update using (auth.jwt() ->> 'role' = 'service_role') with check (auth.jwt() ->> 'role' = 'service_role');
  end if;
end $$;

