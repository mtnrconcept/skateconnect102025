-- Align sponsor module tables with frontend expectations and add aggregated views

-- Ensure service role can manage community metrics for automated jobs
DROP POLICY IF EXISTS "Service role manages sponsor community metrics" ON sponsor_community_metrics;
CREATE POLICY "Service role manages sponsor community metrics"
  ON sponsor_community_metrics
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Refine RLS for sponsor spotlights
DROP POLICY IF EXISTS "Sponsors can manage their spotlights" ON sponsor_spotlights;
CREATE POLICY IF NOT EXISTS "Sponsors select their spotlights"
  ON sponsor_spotlights
  FOR SELECT
  TO authenticated
  USING (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors insert their spotlights"
  ON sponsor_spotlights
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors update their spotlights"
  ON sponsor_spotlights
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = sponsor_id)
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors delete their spotlights"
  ON sponsor_spotlights
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Service role manages sponsor spotlights"
  ON sponsor_spotlights
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Refine RLS for sponsor shop items
DROP POLICY IF EXISTS "Sponsors can manage their shop" ON sponsor_shop_items;
CREATE POLICY IF NOT EXISTS "Sponsors select their shop items"
  ON sponsor_shop_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors insert their shop items"
  ON sponsor_shop_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors update their shop items"
  ON sponsor_shop_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = sponsor_id)
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors delete their shop items"
  ON sponsor_shop_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Service role manages sponsor shop items"
  ON sponsor_shop_items
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Refine RLS for sponsor API keys
DROP POLICY IF EXISTS "Sponsors can manage their api keys" ON sponsor_api_keys;
CREATE POLICY IF NOT EXISTS "Sponsors select their api keys"
  ON sponsor_api_keys
  FOR SELECT
  TO authenticated
  USING (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors insert their api keys"
  ON sponsor_api_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors update their api keys"
  ON sponsor_api_keys
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = sponsor_id)
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors delete their api keys"
  ON sponsor_api_keys
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Service role manages sponsor api keys"
  ON sponsor_api_keys
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Refine RLS for shop variants, bundles, bundle items and coupons
DROP POLICY IF EXISTS "Sponsors manage their shop variants" ON sponsor_shop_item_variants;
CREATE POLICY IF NOT EXISTS "Sponsors select their shop variants"
  ON sponsor_shop_item_variants
  FOR SELECT
  TO authenticated
  USING (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors upsert their shop variants"
  ON sponsor_shop_item_variants
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors update their shop variants"
  ON sponsor_shop_item_variants
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = sponsor_id)
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors delete their shop variants"
  ON sponsor_shop_item_variants
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Service role manages sponsor shop variants"
  ON sponsor_shop_item_variants
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Sponsors manage their bundles" ON sponsor_shop_bundles;
CREATE POLICY IF NOT EXISTS "Sponsors select their shop bundles"
  ON sponsor_shop_bundles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors insert their shop bundles"
  ON sponsor_shop_bundles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors update their shop bundles"
  ON sponsor_shop_bundles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = sponsor_id)
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors delete their shop bundles"
  ON sponsor_shop_bundles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Service role manages sponsor shop bundles"
  ON sponsor_shop_bundles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Sponsors manage their bundle items" ON sponsor_shop_bundle_items;
CREATE POLICY IF NOT EXISTS "Sponsors select their bundle items"
  ON sponsor_shop_bundle_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors insert their bundle items"
  ON sponsor_shop_bundle_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors update their bundle items"
  ON sponsor_shop_bundle_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = sponsor_id)
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors delete their bundle items"
  ON sponsor_shop_bundle_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Service role manages sponsor bundle items"
  ON sponsor_shop_bundle_items
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Sponsors manage their coupons" ON sponsor_shop_item_coupons;
CREATE POLICY IF NOT EXISTS "Sponsors select their coupons"
  ON sponsor_shop_item_coupons
  FOR SELECT
  TO authenticated
  USING (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors insert their coupons"
  ON sponsor_shop_item_coupons
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors update their coupons"
  ON sponsor_shop_item_coupons
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = sponsor_id)
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors delete their coupons"
  ON sponsor_shop_item_coupons
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Service role manages sponsor coupons"
  ON sponsor_shop_item_coupons
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Allow service role to manage spotlight metrics while sponsors keep scoped access
CREATE POLICY IF NOT EXISTS "Service role manages spotlight metrics"
  ON sponsor_spotlight_metrics
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Aggregated analytics views for shop stats
DROP VIEW IF EXISTS sponsor_shop_item_stats_daily CASCADE;
CREATE VIEW sponsor_shop_item_stats_daily
WITH (security_barrier=true)
AS
SELECT
  sponsor_id,
  metric_date,
  SUM(views_count)::bigint AS views_count,
  SUM(cart_additions)::bigint AS cart_additions,
  SUM(orders_count)::bigint AS orders_count,
  SUM(units_sold)::bigint AS units_sold,
  SUM(revenue_cents)::bigint AS revenue_cents
FROM sponsor_shop_item_stats
GROUP BY sponsor_id, metric_date;

DROP VIEW IF EXISTS sponsor_shop_item_stats_summary CASCADE;
CREATE VIEW sponsor_shop_item_stats_summary
WITH (security_barrier=true)
AS
SELECT
  sponsor_id,
  item_id,
  MIN(metric_date) AS first_metric_date,
  MAX(metric_date) AS last_metric_date,
  SUM(views_count)::bigint AS views_count,
  SUM(cart_additions)::bigint AS cart_additions,
  SUM(orders_count)::bigint AS orders_count,
  SUM(units_sold)::bigint AS units_sold,
  SUM(revenue_cents)::bigint AS revenue_cents
FROM sponsor_shop_item_stats
GROUP BY sponsor_id, item_id;

-- Aggregated community analytics views
DROP VIEW IF EXISTS sponsor_community_metrics_latest CASCADE;
CREATE VIEW sponsor_community_metrics_latest
WITH (security_barrier=true)
AS
SELECT DISTINCT ON (sponsor_id)
  id,
  sponsor_id,
  metric_date,
  reach,
  engagement_rate,
  activation_count,
  top_regions,
  trending_tags,
  created_at
FROM sponsor_community_metrics
ORDER BY sponsor_id, metric_date DESC, created_at DESC;

DROP VIEW IF EXISTS sponsor_community_metrics_30d CASCADE;
CREATE VIEW sponsor_community_metrics_30d
WITH (security_barrier=true)
AS
WITH metrics AS (
  SELECT *
  FROM sponsor_community_metrics
  WHERE metric_date >= (current_date - INTERVAL '30 days')
)
SELECT
  m.sponsor_id,
  COALESCE(SUM(m.reach), 0)::bigint AS reach_30d,
  COALESCE(AVG(m.engagement_rate), 0)::numeric(10,2) AS avg_engagement_rate_30d,
  COALESCE(SUM(m.activation_count), 0)::bigint AS activation_count_30d,
  COALESCE((
    SELECT ARRAY_AGG(region ORDER BY region)
    FROM (
      SELECT DISTINCT UNNEST(top_regions) AS region
      FROM metrics mt
      WHERE mt.sponsor_id = m.sponsor_id
    ) regions
  ), ARRAY[]::text[]) AS top_regions,
  COALESCE((
    SELECT ARRAY_AGG(tag ORDER BY tag)
    FROM (
      SELECT DISTINCT UNNEST(trending_tags) AS tag
      FROM metrics mt
      WHERE mt.sponsor_id = m.sponsor_id
    ) tags
  ), ARRAY[]::text[]) AS trending_tags
FROM metrics m
GROUP BY m.sponsor_id;
