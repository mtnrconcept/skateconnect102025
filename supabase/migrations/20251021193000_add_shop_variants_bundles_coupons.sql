-- Extend sponsor shop inventory with variants, bundles and coupons

-- Availability window for base items
ALTER TABLE sponsor_shop_items
  ADD COLUMN IF NOT EXISTS available_from timestamptz,
  ADD COLUMN IF NOT EXISTS available_until timestamptz;

ALTER TABLE sponsor_shop_items
  DROP CONSTRAINT IF EXISTS sponsor_shop_items_availability_window_check;

ALTER TABLE sponsor_shop_items
  ADD CONSTRAINT sponsor_shop_items_availability_window_check
  CHECK (
    available_from IS NULL
    OR available_until IS NULL
    OR available_until > available_from
  );

-- Variants (size, color, SKU ...)
CREATE TABLE IF NOT EXISTS sponsor_shop_item_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES sponsor_shop_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  size text,
  color text,
  sku text,
  price_cents int,
  stock int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  image_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  availability_start timestamptz,
  availability_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sponsor_shop_item_variants_price_positive CHECK (price_cents IS NULL OR price_cents >= 0),
  CONSTRAINT sponsor_shop_item_variants_stock_positive CHECK (stock >= 0),
  CONSTRAINT sponsor_shop_item_variants_window CHECK (
    availability_start IS NULL
    OR availability_end IS NULL
    OR availability_end > availability_start
  )
);

CREATE INDEX IF NOT EXISTS sponsor_shop_item_variants_sponsor_idx
  ON sponsor_shop_item_variants (sponsor_id, item_id);
CREATE INDEX IF NOT EXISTS sponsor_shop_item_variants_item_idx
  ON sponsor_shop_item_variants (item_id, is_active);

ALTER TABLE sponsor_shop_item_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Sponsors manage their shop variants"
  ON sponsor_shop_item_variants FOR ALL
  USING (auth.uid() = sponsor_id)
  WITH CHECK (auth.uid() = sponsor_id);

DROP TRIGGER IF EXISTS set_updated_at_sponsor_shop_item_variants ON sponsor_shop_item_variants;
CREATE TRIGGER set_updated_at_sponsor_shop_item_variants
  BEFORE UPDATE ON sponsor_shop_item_variants
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Bundles regrouping multiple items (primary item scoped)
CREATE TABLE IF NOT EXISTS sponsor_shop_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  primary_item_id uuid NOT NULL REFERENCES sponsor_shop_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  price_cents int NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  available_from timestamptz,
  available_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sponsor_shop_bundles_price_positive CHECK (price_cents >= 0),
  CONSTRAINT sponsor_shop_bundles_window CHECK (
    available_from IS NULL
    OR available_until IS NULL
    OR available_until > available_from
  )
);

CREATE INDEX IF NOT EXISTS sponsor_shop_bundles_sponsor_idx
  ON sponsor_shop_bundles (sponsor_id, primary_item_id);
CREATE INDEX IF NOT EXISTS sponsor_shop_bundles_primary_item_idx
  ON sponsor_shop_bundles (primary_item_id);

ALTER TABLE sponsor_shop_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Sponsors manage their bundles"
  ON sponsor_shop_bundles FOR ALL
  USING (auth.uid() = sponsor_id)
  WITH CHECK (auth.uid() = sponsor_id);

DROP TRIGGER IF EXISTS set_updated_at_sponsor_shop_bundles ON sponsor_shop_bundles;
CREATE TRIGGER set_updated_at_sponsor_shop_bundles
  BEFORE UPDATE ON sponsor_shop_bundles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS sponsor_shop_bundle_items (
  bundle_id uuid NOT NULL REFERENCES sponsor_shop_bundles(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES sponsor_shop_items(id) ON DELETE CASCADE,
  sponsor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bundle_id, item_id),
  CONSTRAINT sponsor_shop_bundle_items_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS sponsor_shop_bundle_items_bundle_idx
  ON sponsor_shop_bundle_items (bundle_id);
CREATE INDEX IF NOT EXISTS sponsor_shop_bundle_items_item_idx
  ON sponsor_shop_bundle_items (item_id);

ALTER TABLE sponsor_shop_bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Sponsors manage their bundle items"
  ON sponsor_shop_bundle_items FOR ALL
  USING (auth.uid() = sponsor_id)
  WITH CHECK (auth.uid() = sponsor_id);

-- Coupons with usage counters
CREATE TABLE IF NOT EXISTS sponsor_shop_item_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES sponsor_shop_items(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text DEFAULT '',
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value int NOT NULL,
  max_uses int,
  usage_count int NOT NULL DEFAULT 0,
  minimum_quantity int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sponsor_shop_item_coupons_discount_positive CHECK (discount_value >= 0),
  CONSTRAINT sponsor_shop_item_coupons_max_uses_positive CHECK (max_uses IS NULL OR max_uses > 0),
  CONSTRAINT sponsor_shop_item_coupons_min_quantity_positive CHECK (minimum_quantity > 0),
  CONSTRAINT sponsor_shop_item_coupons_window CHECK (
    starts_at IS NULL
    OR expires_at IS NULL
    OR expires_at > starts_at
  ),
  CONSTRAINT sponsor_shop_item_coupons_unique_code UNIQUE (item_id, code)
);

CREATE INDEX IF NOT EXISTS sponsor_shop_item_coupons_sponsor_idx
  ON sponsor_shop_item_coupons (sponsor_id, item_id);
CREATE INDEX IF NOT EXISTS sponsor_shop_item_coupons_code_idx
  ON sponsor_shop_item_coupons (code);

ALTER TABLE sponsor_shop_item_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Sponsors manage their coupons"
  ON sponsor_shop_item_coupons FOR ALL
  USING (auth.uid() = sponsor_id)
  WITH CHECK (auth.uid() = sponsor_id);

DROP TRIGGER IF EXISTS set_updated_at_sponsor_shop_item_coupons ON sponsor_shop_item_coupons;
CREATE TRIGGER set_updated_at_sponsor_shop_item_coupons
  BEFORE UPDATE ON sponsor_shop_item_coupons
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
