-- Sponsor shop analytics tables for orders & item metrics
CREATE TABLE IF NOT EXISTS sponsor_shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES sponsor_shop_items(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_cents bigint NOT NULL CHECK (total_cents >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  customer_name text,
  customer_email text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sponsor_shop_item_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES sponsor_shop_items(id) ON DELETE CASCADE,
  metric_date date NOT NULL DEFAULT current_date,
  views_count bigint NOT NULL DEFAULT 0,
  cart_additions bigint NOT NULL DEFAULT 0,
  orders_count bigint NOT NULL DEFAULT 0,
  units_sold bigint NOT NULL DEFAULT 0,
  revenue_cents bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sponsor_shop_item_stats_item_date_unique UNIQUE (item_id, metric_date)
);

CREATE INDEX IF NOT EXISTS sponsor_shop_orders_sponsor_idx
  ON sponsor_shop_orders (sponsor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sponsor_shop_orders_item_idx
  ON sponsor_shop_orders (item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sponsor_shop_item_stats_sponsor_idx
  ON sponsor_shop_item_stats (sponsor_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS sponsor_shop_item_stats_item_idx
  ON sponsor_shop_item_stats (item_id, metric_date DESC);

ALTER TABLE sponsor_shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_shop_item_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Sponsors can read their orders"
  ON sponsor_shop_orders
  FOR SELECT
  USING (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors can read their item stats"
  ON sponsor_shop_item_stats
  FOR SELECT
  USING (auth.uid() = sponsor_id);

-- Service roles keep ability to insert/update stats via replication or backend jobs
CREATE POLICY IF NOT EXISTS "Service role manages shop orders"
  ON sponsor_shop_orders
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Service role manages shop stats"
  ON sponsor_shop_item_stats
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION update_shop_item_stats_on_order()
RETURNS TRIGGER AS $$
DECLARE
  stats_date date := (NEW.created_at AT TIME ZONE 'UTC')::date;
BEGIN
  INSERT INTO sponsor_shop_item_stats (sponsor_id, item_id, metric_date, orders_count, units_sold, revenue_cents)
  VALUES (NEW.sponsor_id, NEW.item_id, stats_date, 1, NEW.quantity, NEW.total_cents)
  ON CONFLICT (item_id, metric_date)
  DO UPDATE SET
    orders_count = sponsor_shop_item_stats.orders_count + 1,
    units_sold = sponsor_shop_item_stats.units_sold + EXCLUDED.units_sold,
    revenue_cents = sponsor_shop_item_stats.revenue_cents + EXCLUDED.revenue_cents,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_shop_order_stats ON sponsor_shop_orders;
CREATE TRIGGER trigger_shop_order_stats
  AFTER INSERT ON sponsor_shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_item_stats_on_order();

-- Ensure updated_at stays fresh on manual updates
DROP TRIGGER IF EXISTS set_updated_at_sponsor_shop_orders ON sponsor_shop_orders;
CREATE TRIGGER set_updated_at_sponsor_shop_orders
  BEFORE UPDATE ON sponsor_shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_sponsor_shop_item_stats ON sponsor_shop_item_stats;
CREATE TRIGGER set_updated_at_sponsor_shop_item_stats
  BEFORE UPDATE ON sponsor_shop_item_stats
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
