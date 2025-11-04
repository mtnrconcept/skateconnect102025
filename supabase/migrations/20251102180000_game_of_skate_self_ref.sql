-- Game of Skate self-referee system
-- Tables pour match auto-arbitré et chat temps réel

-- Match & lettres
create table if not exists public.gos_match (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  rider_a uuid not null references auth.users(id) on delete cascade,
  rider_b uuid not null references auth.users(id) on delete cascade,
  turn text not null check (turn in ('A','B')) default 'A',
  letters_a int not null default 0 check (letters_a >= 0 and letters_a <= 5),
  letters_b int not null default 0 check (letters_b >= 0 and letters_b <= 5),
  status text not null default 'active' check (status in ('active','ended')),
  winner text check (winner in ('A','B')),
  updated_at timestamptz default now()
);

create index if not exists gos_match_rider_a_idx on public.gos_match (rider_a);
create index if not exists gos_match_rider_b_idx on public.gos_match (rider_b);
create index if not exists gos_match_status_idx on public.gos_match (status);

-- Chat + événements
create table if not exists public.gos_chat_message (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.gos_match(id) on delete cascade,
  sender uuid references auth.users(id) on delete set null, -- null si message système
  kind text not null check (kind in ('text','system','event')),
  text text,
  payload jsonb,
  created_at timestamptz default now()
);

create index if not exists gos_chat_message_match_idx on public.gos_chat_message (match_id, created_at);
create index if not exists gos_chat_message_created_idx on public.gos_chat_message (created_at);

-- Trigger pour updated_at
create or replace function public.set_gos_match_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists gos_match_updated_at on public.gos_match;
create trigger gos_match_updated_at
  before update on public.gos_match
  for each row
  execute procedure public.set_gos_match_updated_at();

-- RLS
alter table public.gos_match enable row level security;
alter table public.gos_chat_message enable row level security;

-- Policy: les participants peuvent lire/modifier leur match
do $$ begin
  create policy "read my match" on public.gos_match
    for select using (
      auth.uid() = rider_a or auth.uid() = rider_b
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "update my match" on public.gos_match
    for update using (
      auth.uid() = rider_a or auth.uid() = rider_b
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "insert my match" on public.gos_match
    for insert with check (auth.uid() is not null);
exception when duplicate_object then null; end $$;

-- Policy: lecture chat pour participants
do $$ begin
  create policy "read my match chat" on public.gos_chat_message
    for select using (
      exists (
        select 1 from public.gos_match m
        where m.id = match_id and (auth.uid() = m.rider_a or auth.uid() = m.rider_b)
      )
    );
exception when duplicate_object then null; end $$;

-- Policy: écriture chat pour participants
do $$ begin
  create policy "post my chat" on public.gos_chat_message
    for insert with check (
      exists (
        select 1 from public.gos_match m
        where m.id = match_id and (auth.uid() = m.rider_a or auth.uid() = m.rider_b)
      )
    );
exception when duplicate_object then null; end $$;








