-- Add sponsor role metadata and sponsor feature tables
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'skater' CHECK (role IN ('skater', 'sponsor', 'admin')),
  ADD COLUMN IF NOT EXISTS sponsor_contact jsonb,
  ADD COLUMN IF NOT EXISTS sponsor_branding jsonb,
  ADD COLUMN IF NOT EXISTS sponsor_permissions jsonb;

UPDATE profiles
SET role = COALESCE(NULLIF(role, ''), 'skater');

CREATE TABLE IF NOT EXISTS sponsor_spotlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  media_url text,
  call_to_action text,
  call_to_action_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'completed')),
  start_date timestamptz,
  end_date timestamptz,
  performance jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sponsor_shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  price_cents int NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  stock int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  image_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sponsor_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS sponsor_community_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  metric_date date NOT NULL DEFAULT current_date,
  reach int NOT NULL DEFAULT 0,
  engagement_rate numeric(5,2) NOT NULL DEFAULT 0,
  activation_count int NOT NULL DEFAULT 0,
  top_regions text[] NOT NULL DEFAULT ARRAY[]::text[],
  trending_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sponsor_spotlights_sponsor_id_idx ON sponsor_spotlights (sponsor_id);
CREATE INDEX IF NOT EXISTS sponsor_shop_items_sponsor_id_idx ON sponsor_shop_items (sponsor_id);
CREATE INDEX IF NOT EXISTS sponsor_api_keys_sponsor_id_idx ON sponsor_api_keys (sponsor_id);
CREATE INDEX IF NOT EXISTS sponsor_community_metrics_sponsor_id_idx ON sponsor_community_metrics (sponsor_id, metric_date DESC);

ALTER TABLE sponsor_spotlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_community_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Sponsors can manage their spotlights"
  ON sponsor_spotlights FOR ALL
  USING (auth.uid() = sponsor_id)
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors can manage their shop"
  ON sponsor_shop_items FOR ALL
  USING (auth.uid() = sponsor_id)
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors can manage their api keys"
  ON sponsor_api_keys FOR ALL
  USING (auth.uid() = sponsor_id)
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors can read their metrics"
  ON sponsor_community_metrics FOR SELECT
  USING (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors can insert their metrics"
  ON sponsor_community_metrics FOR INSERT
  WITH CHECK (auth.uid() = sponsor_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_sponsor_spotlights ON sponsor_spotlights;
CREATE TRIGGER set_updated_at_sponsor_spotlights
  BEFORE UPDATE ON sponsor_spotlights
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_sponsor_shop_items ON sponsor_shop_items;
CREATE TRIGGER set_updated_at_sponsor_shop_items
  BEFORE UPDATE ON sponsor_shop_items
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
