-- Marketplace core tables (listings, orders, saved searches, questions, reviews)
-- Idempotent: create objects if they do not exist

-- ENUM-like via CHECKs kept simple for portability

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'EUR',
  category text not null default 'other',
  condition text not null default 'used',
  shipping_available boolean not null default false,
  city text,
  country text,
  image_url text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create index if not exists idx_marketplace_listings_user on public.marketplace_listings(user_id);
create index if not exists idx_marketplace_listings_status on public.marketplace_listings(status);
create index if not exists idx_marketplace_listings_created on public.marketplace_listings(created_at desc);

-- Orders (buyer<->seller)
create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending', -- pending, paid, seller_confirmed, shipped, delivered, released, cancelled
  quantity integer not null default 1 check (quantity > 0 and quantity <= 50),
  currency text not null default 'EUR',
  subtotal_cents integer,
  shipping_cents integer,
  tax_cents integer,
  total_cents integer,
  commission_cents integer,
  net_amount_cents integer,
  shipping_carrier text,
  shipping_tracking text,
  shipping_label_url text,
  stripe_session_id text,
  stripe_payment_intent_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_marketplace_orders_buyer on public.marketplace_orders(buyer_id);
create index if not exists idx_marketplace_orders_seller on public.marketplace_orders(seller_id);
create index if not exists idx_marketplace_orders_listing on public.marketplace_orders(listing_id);

-- Saved searches
create table if not exists public.marketplace_saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  query text not null,
  alert_email boolean not null default false,
  alert_push boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_marketplace_saved_searches_user on public.marketplace_saved_searches(user_id);

-- Questions (Q&A) and reviews
create table if not exists public.marketplace_questions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_marketplace_questions_listing on public.marketplace_questions(listing_id);

create table if not exists public.marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists idx_marketplace_reviews_target on public.marketplace_reviews(target_user_id);

-- RLS
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_saved_searches enable row level security;
alter table public.marketplace_questions enable row level security;
alter table public.marketplace_reviews enable row level security;

do $$ begin
  create policy if not exists marketplace_listings_select on public.marketplace_listings for select using (status = 'active' or auth.uid() = user_id);
exception when others then null; end $$;

do $$ begin
  create policy if not exists marketplace_listings_write on public.marketplace_listings for insert with check (auth.uid() = user_id);
exception when others then null; end $$;

do $$ begin
  create policy if not exists marketplace_listings_update on public.marketplace_listings for update using (auth.uid() = user_id);
exception when others then null; end $$;

do $$ begin
  create policy if not exists marketplace_orders_select on public.marketplace_orders for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
exception when others then null; end $$;

do $$ begin
  create policy if not exists marketplace_orders_insert on public.marketplace_orders for insert with check (auth.uid() = buyer_id);
exception when others then null; end $$;

do $$ begin
  create policy if not exists marketplace_saved_searches_rw on public.marketplace_saved_searches for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when others then null; end $$;

do $$ begin
  create policy if not exists marketplace_questions_rw on public.marketplace_questions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when others then null; end $$;

do $$ begin
  create policy if not exists marketplace_reviews_rw on public.marketplace_reviews for all using (auth.uid() = author_id) with check (auth.uid() = author_id);
exception when others then null; end $$;

