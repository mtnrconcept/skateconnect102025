/*
  # Create engagement registration tables

  ## Changes
  - Create event_registrations table to track user RSVPs for community events
  - Create challenge_participants table to track challenge participation
  - Add row level security policies for both tables
  - Add triggers to keep challenge participant counts in sync
*/

-- ========================================
-- EVENT REGISTRATIONS
-- ========================================

CREATE TABLE IF NOT EXISTS event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  registered_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_user ON event_registrations(user_id);

ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their event registrations"
  ON event_registrations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can register for events"
  ON event_registrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel their event registrations"
  ON event_registrations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ========================================
-- CHALLENGE PARTICIPANTS
-- ========================================

CREATE TABLE IF NOT EXISTS challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  registered_at timestamptz DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge ON challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user ON challenge_participants(user_id);

ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their challenge registrations"
  ON challenge_participants FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can join challenges"
  ON challenge_participants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave challenges"
  ON challenge_participants FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ========================================
-- PARTICIPANT COUNT MAINTENANCE
-- ========================================

CREATE OR REPLACE FUNCTION increment_challenge_participants_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE challenges
  SET participants_count = COALESCE(participants_count, 0) + 1
  WHERE id = NEW.challenge_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_challenge_participants_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE challenges
  SET participants_count = GREATEST(COALESCE(participants_count, 0) - 1, 0)
  WHERE id = OLD.challenge_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_challenge_participants ON challenge_participants;
CREATE TRIGGER trigger_increment_challenge_participants
  AFTER INSERT ON challenge_participants
  FOR EACH ROW
  EXECUTE FUNCTION increment_challenge_participants_count();

DROP TRIGGER IF EXISTS trigger_decrement_challenge_participants ON challenge_participants;
CREATE TRIGGER trigger_decrement_challenge_participants
  AFTER DELETE ON challenge_participants
  FOR EACH ROW
  EXECUTE FUNCTION decrement_challenge_participants_count();
