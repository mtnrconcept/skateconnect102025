
-- Storage bucket for sponsor media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'sponsors',
    'sponsors',
    true,
    52428800,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']
  )
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "Public read access for sponsors"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'sponsors');

CREATE POLICY IF NOT EXISTS "Authenticated users can upload sponsors"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'sponsors');

CREATE POLICY IF NOT EXISTS "Users can update own sponsors"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'sponsors' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'sponsors' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY IF NOT EXISTS "Users can delete own sponsors"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'sponsors' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ========================================
-- Sponsor challenges and participations
-- ========================================
CREATE TABLE IF NOT EXISTS sponsor_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  prize text,
  value text,
  location text,
  cover_image_url text,
  tags text[] DEFAULT '{}'::text[],
  start_date timestamptz,
  end_date timestamptz,
  participants_count integer DEFAULT 0,
  participants_label text DEFAULT 'Crews inscrites',
  action_label text DEFAULT 'Voir le défi',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sponsor_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Sponsor challenges are public"
  ON sponsor_challenges FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Sponsors insert their challenges"
  ON sponsor_challenges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors update their challenges"
  ON sponsor_challenges FOR UPDATE
  TO authenticated
  USING (auth.uid() = sponsor_id)
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors delete their challenges"
  ON sponsor_challenges FOR DELETE
  TO authenticated
  USING (auth.uid() = sponsor_id);

CREATE TABLE IF NOT EXISTS sponsor_challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_challenge_id uuid NOT NULL REFERENCES sponsor_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sponsor_challenge_id, user_id)
);

ALTER TABLE sponsor_challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users view their sponsor challenge registrations"
  ON sponsor_challenge_participants FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users join sponsor challenges"
  ON sponsor_challenge_participants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users leave sponsor challenges"
  ON sponsor_challenge_participants FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION increment_sponsor_challenge_participants_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sponsor_challenges
  SET participants_count = COALESCE(participants_count, 0) + 1,
      updated_at = now()
  WHERE id = NEW.sponsor_challenge_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_sponsor_challenge_participants_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sponsor_challenges
  SET participants_count = GREATEST(COALESCE(participants_count, 0) - 1, 0),
      updated_at = now()
  WHERE id = OLD.sponsor_challenge_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_sponsor_challenge_participants ON sponsor_challenge_participants;
CREATE TRIGGER trigger_increment_sponsor_challenge_participants
  AFTER INSERT ON sponsor_challenge_participants
  FOR EACH ROW
  EXECUTE FUNCTION increment_sponsor_challenge_participants_count();

DROP TRIGGER IF EXISTS trigger_decrement_sponsor_challenge_participants ON sponsor_challenge_participants;
CREATE TRIGGER trigger_decrement_sponsor_challenge_participants
  AFTER DELETE ON sponsor_challenge_participants
  FOR EACH ROW
  EXECUTE FUNCTION decrement_sponsor_challenge_participants_count();

DROP TRIGGER IF EXISTS set_updated_at_sponsor_challenges ON sponsor_challenges;
CREATE TRIGGER set_updated_at_sponsor_challenges
  BEFORE UPDATE ON sponsor_challenges
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ========================================
-- Sponsor events and registrations
-- ========================================
CREATE TABLE IF NOT EXISTS sponsor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  event_date date,
  event_time text,
  location text,
  event_type text,
  attendees integer DEFAULT 0,
  cover_image_url text,
  tags text[] DEFAULT '{}'::text[],
  action_label text DEFAULT 'Réserver',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sponsor_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Sponsor events are public"
  ON sponsor_events FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Sponsors insert their events"
  ON sponsor_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors update their events"
  ON sponsor_events FOR UPDATE
  TO authenticated
  USING (auth.uid() = sponsor_id)
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors delete their events"
  ON sponsor_events FOR DELETE
  TO authenticated
  USING (auth.uid() = sponsor_id);

CREATE TABLE IF NOT EXISTS sponsor_event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_event_id uuid NOT NULL REFERENCES sponsor_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sponsor_event_id, user_id)
);

ALTER TABLE sponsor_event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users view their sponsor event registrations"
  ON sponsor_event_registrations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users join sponsor events"
  ON sponsor_event_registrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users leave sponsor events"
  ON sponsor_event_registrations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION increment_sponsor_event_attendees()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sponsor_events
  SET attendees = COALESCE(attendees, 0) + 1,
      updated_at = now()
  WHERE id = NEW.sponsor_event_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_sponsor_event_attendees()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sponsor_events
  SET attendees = GREATEST(COALESCE(attendees, 0) - 1, 0),
      updated_at = now()
  WHERE id = OLD.sponsor_event_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_sponsor_event_attendees ON sponsor_event_registrations;
CREATE TRIGGER trigger_increment_sponsor_event_attendees
  AFTER INSERT ON sponsor_event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION increment_sponsor_event_attendees();

DROP TRIGGER IF EXISTS trigger_decrement_sponsor_event_attendees ON sponsor_event_registrations;
CREATE TRIGGER trigger_decrement_sponsor_event_attendees
  AFTER DELETE ON sponsor_event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION decrement_sponsor_event_attendees();

DROP TRIGGER IF EXISTS set_updated_at_sponsor_events ON sponsor_events;
CREATE TRIGGER set_updated_at_sponsor_events
  BEFORE UPDATE ON sponsor_events
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ========================================
-- Sponsor calls for projects
-- ========================================
CREATE TABLE IF NOT EXISTS sponsor_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text NOT NULL,
  description text NOT NULL,
  location text,
  deadline date,
  reward text,
  highlight text,
  cover_image_url text,
  tags text[] DEFAULT '{}'::text[],
  participants_label text DEFAULT 'Candidatures',
  participants_count integer DEFAULT 0,
  action_label text DEFAULT 'Déposer un projet',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sponsor_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Sponsor calls are public"
  ON sponsor_calls FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Sponsors insert their calls"
  ON sponsor_calls FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors update their calls"
  ON sponsor_calls FOR UPDATE
  TO authenticated
  USING (auth.uid() = sponsor_id)
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors delete their calls"
  ON sponsor_calls FOR DELETE
  TO authenticated
  USING (auth.uid() = sponsor_id);

DROP TRIGGER IF EXISTS set_updated_at_sponsor_calls ON sponsor_calls;
CREATE TRIGGER set_updated_at_sponsor_calls
  BEFORE UPDATE ON sponsor_calls
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ========================================
-- Sponsor news
-- ========================================
CREATE TABLE IF NOT EXISTS sponsor_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text NOT NULL,
  body text NOT NULL,
  location text,
  published_at date,
  highlight text,
  cover_image_url text,
  tags text[] DEFAULT '{}'::text[],
  action_label text DEFAULT 'En savoir plus',
  participants_label text DEFAULT 'Lecteurs',
  participants_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sponsor_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Sponsor news are public"
  ON sponsor_news FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Sponsors insert their news"
  ON sponsor_news FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors update their news"
  ON sponsor_news FOR UPDATE
  TO authenticated
  USING (auth.uid() = sponsor_id)
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY IF NOT EXISTS "Sponsors delete their news"
  ON sponsor_news FOR DELETE
  TO authenticated
  USING (auth.uid() = sponsor_id);

DROP TRIGGER IF EXISTS set_updated_at_sponsor_news ON sponsor_news;
CREATE TRIGGER set_updated_at_sponsor_news
  BEFORE UPDATE ON sponsor_news
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
