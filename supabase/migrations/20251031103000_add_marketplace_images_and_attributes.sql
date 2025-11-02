-- Marketplace: listing images gallery + attributes field

create table if not exists public.marketplace_listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_marketplace_listing_images_listing on public.marketplace_listing_images(listing_id);
create index if not exists idx_marketplace_listing_images_sort on public.marketplace_listing_images(listing_id, sort_order asc, created_at asc);

alter table public.marketplace_listing_images enable row level security;

do $$ begin
  create policy if not exists marketplace_listing_images_select on public.marketplace_listing_images
    for select using (
      exists (
        select 1 from public.marketplace_listings l
        where l.id = marketplace_listing_images.listing_id
          and (l.status = 'active' or auth.uid() = l.user_id)
      )
    );
exception when others then null; end $$;

do $$ begin
  create policy if not exists marketplace_listing_images_write on public.marketplace_listing_images
    for insert with check (
      exists (
        select 1 from public.marketplace_listings l
        where l.id = marketplace_listing_images.listing_id
          and auth.uid() = l.user_id
      )
    );
exception when others then null; end $$;

-- Optional: attributes JSONB on listings (category-specific fields)
do $$ begin
  alter table public.marketplace_listings add column if not exists attributes jsonb not null default '{}'::jsonb;
exception when others then null; end $$;

