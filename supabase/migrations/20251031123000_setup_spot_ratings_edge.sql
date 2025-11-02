-- Table (si pas déjà en place)
create table if not exists public.spot_ratings (
  id          uuid primary key default gen_random_uuid(),
  spot_id     uuid not null references public.spots(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  rating      int  not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- upsert "1 note par user et par spot"
create unique index if not exists spot_ratings_spot_user_uniq
  on public.spot_ratings (spot_id, user_id);

alter table public.spot_ratings enable row level security;

-- RLS : l’utilisateur connecté peut écrire SA note
create policy if not exists ins_own_rating
on public.spot_ratings for insert to authenticated
with check (user_id = auth.uid());

create policy if not exists upd_own_rating
on public.spot_ratings for update to authenticated
using (user_id = auth.uid());

-- lecture (optionnelle)
create policy if not exists sel_all
on public.spot_ratings for select to authenticated
using (true);

