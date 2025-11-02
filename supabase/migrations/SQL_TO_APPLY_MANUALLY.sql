-- Run this SQL in Supabase SQL Editor to apply rating + cover RPC + (optional) imported table
-- Safe to run multiple times (IF NOT EXISTS used where possible)

-- Required for gen_random_uuid
create extension if not exists pgcrypto;

-- 1) Add rating columns to spots
alter table if exists public.spots
  add column if not exists rating_average numeric null,
  add column if not exists rating_count integer not null default 0,
  add column if not exists rating_distribution jsonb null;

-- 2) spot_ratings table + RLS + triggers
create table if not exists public.spot_ratings (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  unique (spot_id, user_id)
);

alter table public.spot_ratings enable row level security;

do $$ begin
  perform 1 from pg_policies where polname = 'spot_ratings_select_all';
  if not found then
    create policy spot_ratings_select_all on public.spot_ratings for select using (true);
  end if;
end $$;

do $$ begin
  perform 1 from pg_policies where polname = 'spot_ratings_insert_auth';
  if not found then
    create policy spot_ratings_insert_auth on public.spot_ratings for insert with check (auth.role() = 'authenticated');
  end if;
end $$;

do $$ begin
  perform 1 from pg_policies where polname = 'spot_ratings_update_own';
  if not found then
    create policy spot_ratings_update_own on public.spot_ratings for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  perform 1 from pg_policies where polname = 'spot_ratings_delete_own';
  if not found then
    create policy spot_ratings_delete_own on public.spot_ratings for delete using (user_id = auth.uid());
  end if;
end $$;

create or replace function public.refresh_spot_rating(p_spot_id uuid)
returns void language plpgsql as $$
declare
  v_avg numeric;
  v_count int;
  v_dist jsonb;
begin
  select avg(rating)::numeric, count(*)::int into v_avg, v_count from public.spot_ratings where spot_id = p_spot_id;
  with buckets as (
    select rating, count(*)::int as c from public.spot_ratings where spot_id = p_spot_id group by rating
  )
  select jsonb_object_agg(rating::text, c) into v_dist from buckets;

  update public.spots
    set rating_average = v_avg,
        rating_count = coalesce(v_count, 0),
        rating_distribution = coalesce(v_dist, '{}'::jsonb),
        updated_at = now()
  where id = p_spot_id;
end $$;

create or replace function public.trg_spot_ratings_refresh()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    perform public.refresh_spot_rating(new.spot_id);
    return new;
  elsif (tg_op = 'UPDATE') then
    perform public.refresh_spot_rating(new.spot_id);
    if (new.spot_id <> old.spot_id) then
      perform public.refresh_spot_rating(old.spot_id);
    end if;
    return new;
  elsif (tg_op = 'DELETE') then
    perform public.refresh_spot_rating(old.spot_id);
    return old;
  end if;
  return null;
end $$;

drop trigger if exists trg_spot_ratings_refresh on public.spot_ratings;
create trigger trg_spot_ratings_refresh
after insert or update or delete on public.spot_ratings
for each row execute function public.trg_spot_ratings_refresh();

-- 3) RPC for cover photo
create or replace function public.set_spot_cover_photo(p_spot_id uuid, p_media_id uuid)
returns void language plpgsql as $$
begin
  update public.spot_media set is_cover_photo = false where spot_id = p_spot_id;
  update public.spot_media set is_cover_photo = true where id = p_media_id and spot_id = p_spot_id;
end $$;

