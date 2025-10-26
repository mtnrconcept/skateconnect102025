/*
  # Create community events table for pro submissions

  ## Changes
  - Create community_events table to store events created by pro subscribers
  - Add supporting indexes and updated_at trigger
  - Enable row level security with read/insert policies
*/

CREATE TABLE IF NOT EXISTS community_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  event_date date NOT NULL,
  event_time text NOT NULL,
  location text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'Compétition',
    'Contest',
    'Rencontre',
    'Avant-première',
    'Appel à projet',
    'Appel à sponsor'
  )),
  attendees_count integer NOT NULL DEFAULT 0,
  is_sponsor_event boolean NOT NULL DEFAULT false,
  sponsor_name text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_events_event_date ON community_events(event_date);
CREATE INDEX IF NOT EXISTS idx_community_events_event_type ON community_events(event_type);
CREATE INDEX IF NOT EXISTS idx_community_events_created_by ON community_events(created_by);

ALTER TABLE community_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view community events"
  ON community_events FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can add community events"
  ON community_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP TRIGGER IF EXISTS set_updated_at_community_events ON community_events;
CREATE TRIGGER set_updated_at_community_events
  BEFORE UPDATE ON community_events
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
