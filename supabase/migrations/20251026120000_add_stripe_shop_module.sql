-- Stripe Connect onboarding & public shop browsing

-- Extend sponsor profile with payout configuration
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_account_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_onboarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS default_commission_rate numeric(5,4) NOT NULL DEFAULT 0.1000,
  ADD COLUMN IF NOT EXISTS payout_email text;

-- Ensure legacy rows benefit from default commission rate
UPDATE profiles
SET default_commission_rate = COALESCE(default_commission_rate, 0.1000);

-- Enrich shop orders with Stripe metadata and payout tracking
ALTER TABLE sponsor_shop_orders
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES sponsor_shop_item_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal_cents bigint,
  ADD COLUMN IF NOT EXISTS shipping_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_city text,
  ADD COLUMN IF NOT EXISTS customer_country text;

-- Index Stripe session identifiers for quick lookups
CREATE INDEX IF NOT EXISTS sponsor_shop_orders_stripe_session_idx
  ON sponsor_shop_orders (stripe_session_id);

-- Public browsing policies for the marketplace
CREATE POLICY IF NOT EXISTS "Public can view active shop items"
  ON sponsor_shop_items
  FOR SELECT
  TO public
  USING (
    is_active = true
    AND (stock IS NULL OR stock > 0)
    AND (available_from IS NULL OR available_from <= now())
    AND (available_until IS NULL OR available_until >= now())
  );

CREATE POLICY IF NOT EXISTS "Public can view active shop variants"
  ON sponsor_shop_item_variants
  FOR SELECT
  TO public
  USING (
    is_active = true
    AND (stock IS NULL OR stock > 0)
    AND (availability_start IS NULL OR availability_start <= now())
    AND (availability_end IS NULL OR availability_end >= now())
  );

CREATE POLICY IF NOT EXISTS "Public can view active shop bundles"
  ON sponsor_shop_bundles
  FOR SELECT
  TO public
  USING (
    is_active = true
    AND (available_from IS NULL OR available_from <= now())
    AND (available_until IS NULL OR available_until >= now())
  );

CREATE POLICY IF NOT EXISTS "Public can view active shop coupons"
  ON sponsor_shop_item_coupons
  FOR SELECT
  TO public
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (expires_at IS NULL OR expires_at >= now())
  );

-- Expose sponsor branding details to marketplace shoppers
CREATE POLICY IF NOT EXISTS "Public can view sponsor storefront info"
  ON profiles
  FOR SELECT
  TO public
  USING (role = 'sponsor');
