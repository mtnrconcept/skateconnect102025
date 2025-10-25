-- Capture structured performance metrics for sponsor spotlights
CREATE TABLE IF NOT EXISTS sponsor_spotlight_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spotlight_id uuid NOT NULL REFERENCES sponsor_spotlights(id) ON DELETE CASCADE,
  metric_date date NOT NULL DEFAULT current_date,
  impressions int NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks int NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sponsor_spotlight_metrics_unique_day UNIQUE (spotlight_id, metric_date)
);

CREATE INDEX IF NOT EXISTS sponsor_spotlight_metrics_spotlight_date_idx
  ON sponsor_spotlight_metrics (spotlight_id, metric_date DESC);

ALTER TABLE sponsor_spotlight_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Sponsors can read their spotlight metrics"
  ON sponsor_spotlight_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sponsor_spotlights s
      WHERE s.id = spotlight_id AND s.sponsor_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Sponsors can insert their spotlight metrics"
  ON sponsor_spotlight_metrics FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sponsor_spotlights s
      WHERE s.id = spotlight_id AND s.sponsor_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Sponsors can update their spotlight metrics"
  ON sponsor_spotlight_metrics FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sponsor_spotlights s
      WHERE s.id = spotlight_id AND s.sponsor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sponsor_spotlights s
      WHERE s.id = spotlight_id AND s.sponsor_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION set_updated_at_sponsor_spotlight_metrics()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_sponsor_spotlight_metrics ON sponsor_spotlight_metrics;
CREATE TRIGGER set_updated_at_sponsor_spotlight_metrics
  BEFORE UPDATE ON sponsor_spotlight_metrics
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_sponsor_spotlight_metrics();

CREATE OR REPLACE FUNCTION refresh_sponsor_spotlight_performance(p_spotlight_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_impressions int := 0;
  v_total_clicks int := 0;
  v_ctr numeric := 0;
  v_last7_impressions int := 0;
  v_last7_clicks int := 0;
  v_prev7_impressions int := 0;
  v_prev7_clicks int := 0;
  v_daily jsonb := '[]'::jsonb;
BEGIN
  SELECT COALESCE(SUM(impressions), 0), COALESCE(SUM(clicks), 0)
    INTO v_total_impressions, v_total_clicks
    FROM sponsor_spotlight_metrics
   WHERE spotlight_id = p_spotlight_id;

  IF v_total_impressions > 0 THEN
    v_ctr := ROUND((v_total_clicks::numeric / NULLIF(v_total_impressions, 0)) * 100, 2);
  ELSE
    v_ctr := 0;
  END IF;

  SELECT COALESCE(SUM(impressions), 0), COALESCE(SUM(clicks), 0)
    INTO v_last7_impressions, v_last7_clicks
    FROM sponsor_spotlight_metrics
   WHERE spotlight_id = p_spotlight_id
     AND metric_date >= (current_date - INTERVAL '6 days');

  SELECT COALESCE(SUM(impressions), 0), COALESCE(SUM(clicks), 0)
    INTO v_prev7_impressions, v_prev7_clicks
    FROM sponsor_spotlight_metrics
   WHERE spotlight_id = p_spotlight_id
     AND metric_date BETWEEN (current_date - INTERVAL '13 days') AND (current_date - INTERVAL '7 days');

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'date', metric_date,
             'impressions', impressions,
             'clicks', clicks
           )
           ORDER BY metric_date
         ), '[]'::jsonb)
    INTO v_daily
    FROM sponsor_spotlight_metrics
   WHERE spotlight_id = p_spotlight_id
     AND metric_date >= (current_date - INTERVAL '29 days');

  UPDATE sponsor_spotlights
     SET performance = jsonb_build_object(
       'totals', jsonb_build_object(
         'impressions', v_total_impressions,
         'clicks', v_total_clicks,
         'ctr', v_ctr
       ),
       'last_7_days', jsonb_build_object(
         'impressions', v_last7_impressions,
         'clicks', v_last7_clicks
       ),
       'previous_7_days', jsonb_build_object(
         'impressions', v_prev7_impressions,
         'clicks', v_prev7_clicks
       ),
       'daily', v_daily
     ),
         updated_at = now()
   WHERE id = p_spotlight_id;
END;
$$;

CREATE OR REPLACE FUNCTION handle_sponsor_spotlight_metrics_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_sponsor_spotlight_performance(NEW.spotlight_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION handle_sponsor_spotlight_metrics_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_sponsor_spotlight_performance(OLD.spotlight_id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS update_spotlight_performance_after_insert ON sponsor_spotlight_metrics;
CREATE TRIGGER update_spotlight_performance_after_insert
  AFTER INSERT ON sponsor_spotlight_metrics
  FOR EACH ROW
  EXECUTE FUNCTION handle_sponsor_spotlight_metrics_change();

DROP TRIGGER IF EXISTS update_spotlight_performance_after_update ON sponsor_spotlight_metrics;
CREATE TRIGGER update_spotlight_performance_after_update
  AFTER UPDATE ON sponsor_spotlight_metrics
  FOR EACH ROW
  EXECUTE FUNCTION handle_sponsor_spotlight_metrics_change();

DROP TRIGGER IF EXISTS update_spotlight_performance_after_delete ON sponsor_spotlight_metrics;
CREATE TRIGGER update_spotlight_performance_after_delete
  AFTER DELETE ON sponsor_spotlight_metrics
  FOR EACH ROW
  EXECUTE FUNCTION handle_sponsor_spotlight_metrics_delete();

CREATE OR REPLACE FUNCTION log_sponsor_spotlight_event(p_spotlight_id uuid, p_event_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_impressions_delta int := 0;
  v_clicks_delta int := 0;
BEGIN
  IF p_event_type NOT IN ('impression', 'click') THEN
    RAISE EXCEPTION 'Unsupported event type %', p_event_type;
  END IF;

  IF p_event_type = 'impression' THEN
    v_impressions_delta := 1;
  ELSE
    v_clicks_delta := 1;
  END IF;

  INSERT INTO sponsor_spotlight_metrics (spotlight_id, metric_date, impressions, clicks)
  VALUES (p_spotlight_id, current_date, v_impressions_delta, v_clicks_delta)
  ON CONFLICT (spotlight_id, metric_date)
  DO UPDATE SET
    impressions = sponsor_spotlight_metrics.impressions + EXCLUDED.impressions,
    clicks = sponsor_spotlight_metrics.clicks + EXCLUDED.clicks,
    updated_at = now();

  PERFORM refresh_sponsor_spotlight_performance(p_spotlight_id);
END;
$$;

REVOKE ALL ON FUNCTION log_sponsor_spotlight_event(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_sponsor_spotlight_event(uuid, text) TO authenticated, service_role;

-- Ensure existing spotlights expose a structured performance payload
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM sponsor_spotlights LOOP
    PERFORM refresh_sponsor_spotlight_performance(r.id);
  END LOOP;
END;
$$;
