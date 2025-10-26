--
-- Add planner status & owner columns for sponsor opportunities
-- and prepare hooks for automation (notifications/assignments).
--

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sponsor_planner_status') THEN
    CREATE TYPE sponsor_planner_status AS ENUM (
      'idea',
      'briefing',
      'production',
      'promotion',
      'live',
      'archived'
    );
  END IF;
END$$;

ALTER TABLE sponsor_challenges
  ADD COLUMN IF NOT EXISTS status sponsor_planner_status NOT NULL DEFAULT 'idea',
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE sponsor_events
  ADD COLUMN IF NOT EXISTS status sponsor_planner_status NOT NULL DEFAULT 'idea',
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE sponsor_calls
  ADD COLUMN IF NOT EXISTS status sponsor_planner_status NOT NULL DEFAULT 'idea',
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sponsor_challenges_status ON sponsor_challenges(status);
CREATE INDEX IF NOT EXISTS idx_sponsor_events_status ON sponsor_events(status);
CREATE INDEX IF NOT EXISTS idx_sponsor_calls_status ON sponsor_calls(status);
CREATE INDEX IF NOT EXISTS idx_sponsor_challenges_owner ON sponsor_challenges(owner_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_events_owner ON sponsor_events(owner_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_calls_owner ON sponsor_calls(owner_id);

-- Centralised table to orchestrate notifications / Supabase Functions workers.
CREATE TABLE IF NOT EXISTS sponsor_opportunity_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_type text NOT NULL CHECK (opportunity_type = ANY (ARRAY['challenge', 'event', 'call'])),
  opportunity_id uuid NOT NULL,
  previous_status sponsor_planner_status,
  new_status sponsor_planner_status NOT NULL,
  owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz,
  handled boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_sponsor_status_events_type ON sponsor_opportunity_status_events(opportunity_type, opportunity_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_status_events_handled ON sponsor_opportunity_status_events(handled) WHERE handled = false;

-- Function to capture status changes and enqueue them for automation.
CREATE OR REPLACE FUNCTION log_sponsor_opportunity_status_change()
RETURNS trigger AS $$
DECLARE
  opportunity_type text := TG_ARGV[0];
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO sponsor_opportunity_status_events (
      opportunity_type,
      opportunity_id,
      previous_status,
      new_status,
      owner_id
    )
    VALUES (
      COALESCE(opportunity_type, TG_TABLE_NAME),
      NEW.id,
      OLD.status,
      NEW.status,
      COALESCE(NEW.owner_id, OLD.owner_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sponsor_challenges_status_change ON sponsor_challenges;
CREATE TRIGGER trg_sponsor_challenges_status_change
  AFTER UPDATE ON sponsor_challenges
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_sponsor_opportunity_status_change('challenge');

DROP TRIGGER IF EXISTS trg_sponsor_events_status_change ON sponsor_events;
CREATE TRIGGER trg_sponsor_events_status_change
  AFTER UPDATE ON sponsor_events
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_sponsor_opportunity_status_change('event');

DROP TRIGGER IF EXISTS trg_sponsor_calls_status_change ON sponsor_calls;
CREATE TRIGGER trg_sponsor_calls_status_change
  AFTER UPDATE ON sponsor_calls
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_sponsor_opportunity_status_change('call');
