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

create table if not exists public.sponsor_news (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  summary text not null,
  body text not null,
  location text,
  published_at timestamptz,
  highlight text,
  cover_image_url text,
  tags text[] not null default '{}',
  action_label text not null default 'En savoir plus',
  participants_label text not null default 'Lecteurs',
  participants_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_timestamp on public.sponsor_news;
create trigger set_timestamp
  before update on public.sponsor_news
  for each row
  execute procedure public.set_current_timestamp();

create index if not exists sponsor_news_sponsor_id_idx on public.sponsor_news (sponsor_id);
create index if not exists sponsor_news_published_at_idx on public.sponsor_news (published_at desc nulls last);
create index if not exists sponsor_news_created_at_idx on public.sponsor_news (created_at desc);

alter table public.sponsor_news enable row level security;

create policy if not exists "sponsor_news_read" on public.sponsor_news
  for select using (
    auth.uid() is not null
  );

create policy if not exists "sponsor_news_manage" on public.sponsor_news
  for all using (
    auth.uid() = sponsor_id
  ) with check (
    auth.uid() = sponsor_id
  );
