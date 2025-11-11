-- Community events and registrations schema so the frontend can create and list events

create table if not exists public.community_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  event_date date not null,
  event_time text not null,
  location text not null,
  event_type text not null check (char_length(trim(event_type)) > 0),
  attendees_count integer not null default 0 check (attendees_count >= 0),
  is_sponsor_event boolean not null default false,
  sponsor_name text null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_community_events_set_updated_at on public.community_events;
create trigger trg_community_events_set_updated_at
before update on public.community_events
for each row execute function public.set_updated_at();

create index if not exists idx_community_events_date on public.community_events using btree (event_date, event_type);
create index if not exists idx_community_events_creator on public.community_events using btree (created_by);

alter table public.community_events enable row level security;

do $$ begin
  perform 1 from pg_policies where polname = 'community_events_select_all';
  if not found then
    create policy community_events_select_all on public.community_events
      for select using (true);
  end if;
end $$;

do $$ begin
  perform 1 from pg_policies where polname = 'community_events_insert_owner';
  if not found then
    create policy community_events_insert_owner on public.community_events
      for insert with check (auth.uid() = created_by or auth.role() = 'service_role');
  end if;
end $$;

do $$ begin
  perform 1 from pg_policies where polname = 'community_events_update_owner';
  if not found then
    create policy community_events_update_owner on public.community_events
      for update using (auth.uid() = created_by or auth.role() = 'service_role')
      with check (auth.uid() = created_by or auth.role() = 'service_role');
  end if;
end $$;

do $$ begin
  perform 1 from pg_policies where polname = 'community_events_delete_owner';
  if not found then
    create policy community_events_delete_owner on public.community_events
      for delete using (auth.uid() = created_by or auth.role() = 'service_role');
  end if;
end $$;

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.community_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_event_registrations_unique on public.event_registrations(event_id, user_id);
create index if not exists idx_event_registrations_event on public.event_registrations(event_id);

alter table public.event_registrations enable row level security;

do $$ begin
  perform 1 from pg_policies where polname = 'event_registrations_select_public';
  if not found then
    create policy event_registrations_select_public on public.event_registrations
      for select using (true);
  end if;
end $$;

do $$ begin
  perform 1 from pg_policies where polname = 'event_registrations_insert_self';
  if not found then
    create policy event_registrations_insert_self on public.event_registrations
      for insert with check (auth.uid() = user_id or auth.role() = 'service_role');
  end if;
end $$;

do $$ begin
  perform 1 from pg_policies where polname = 'event_registrations_delete_self';
  if not found then
    create policy event_registrations_delete_self on public.event_registrations
      for delete using (auth.uid() = user_id or auth.role() = 'service_role');
  end if;
end $$;
