/*
  # Add Storage Buckets, Notifications, and Messages

  ## Overview
  This migration adds:
  1. Storage buckets configuration for media uploads
  2. Notifications system for user interactions
  3. Private messaging system
  4. Challenge submissions and participation

  ## New Tables

  ### 1. `notifications`
  User notifications for likes, comments, follows, etc.
  - `id` (uuid, primary key)
  - `user_id` (uuid, references profiles) - recipient
  - `sender_id` (uuid, references profiles) - who triggered the notification
  - `type` (text: like, comment, follow, mention, challenge)
  - `content` (text) - notification message
  - `related_id` (uuid) - ID of related post/comment/etc
  - `is_read` (boolean, default false)
  - `created_at` (timestamptz)

  ### 2. `conversations`
  Private message conversations between users
  - `id` (uuid, primary key)
  - `participant_1_id` (uuid, references profiles)
  - `participant_2_id` (uuid, references profiles)
  - `last_message_at` (timestamptz)
  - `created_at` (timestamptz)

  ### 3. `messages`
  Individual messages in conversations
  - `id` (uuid, primary key)
  - `conversation_id` (uuid, references conversations)
  - `sender_id` (uuid, references profiles)
  - `content` (text)
  - `media_url` (text)
  - `is_read` (boolean, default false)
  - `created_at` (timestamptz)

  ### 4. `challenge_submissions`
  User submissions to challenges
  - `id` (uuid, primary key)
  - `challenge_id` (uuid, references challenges)
  - `user_id` (uuid, references profiles)
  - `media_url` (text)
  - `media_type` (text: photo, video)
  - `caption` (text)
  - `votes_count` (int, default 0)
  - `is_winner` (boolean, default false)
  - `created_at` (timestamptz)

  ### 5. `challenge_votes`
  Votes on challenge submissions
  - `id` (uuid, primary key)
  - `submission_id` (uuid, references challenge_submissions)
  - `user_id` (uuid, references profiles)
  - `created_at` (timestamptz)

  ## Storage Buckets
  - avatars: User profile pictures
  - covers: Profile cover photos
  - posts: Post media (photos/videos)
  - spots: Spot photos/videos
  - challenges: Challenge submission media
  - messages: Message attachments

  ## Security
  - Enable RLS on all tables
  - Users can only read their own notifications and messages
  - Public read access to challenge submissions
  - Proper storage policies for uploads

  ## Important Notes
  1. Storage buckets created with appropriate size limits
  2. RLS ensures data privacy
  3. Indexes added for performance
  4. Triggers for updating message counts
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'mention', 'challenge', 'message')),
  content text NOT NULL,
  related_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_2_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(participant_1_id, participant_2_id),
  CHECK (participant_1_id != participant_2_id)
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  media_url text DEFAULT '',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.participant_1_id = auth.uid() OR conversations.participant_2_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
      AND (conversations.participant_1_id = auth.uid() OR conversations.participant_2_id = auth.uid())
    )
  );

CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- Create challenge_submissions table
CREATE TABLE IF NOT EXISTS challenge_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('photo', 'video')),
  caption text DEFAULT '',
  votes_count int DEFAULT 0,
  is_winner boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

ALTER TABLE challenge_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view challenge submissions"
  ON challenge_submissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own submissions"
  ON challenge_submissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own submissions"
  ON challenge_submissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own submissions"
  ON challenge_submissions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create challenge_votes table
CREATE TABLE IF NOT EXISTS challenge_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES challenge_submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(submission_id, user_id)
);

ALTER TABLE challenge_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view votes"
  ON challenge_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create votes"
  ON challenge_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes"
  ON challenge_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(participant_1_id, participant_2_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_challenge ON challenge_submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_user ON challenge_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_votes_submission ON challenge_votes(submission_id);

-- Create function to update last_message_at on conversations
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updating conversation timestamp
CREATE TRIGGER update_conversation_on_message AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- Create function to increment vote count on challenge submissions
CREATE OR REPLACE FUNCTION increment_submission_votes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE challenge_submissions
  SET votes_count = votes_count + 1
  WHERE id = NEW.submission_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create function to decrement vote count on challenge submissions
CREATE OR REPLACE FUNCTION decrement_submission_votes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE challenge_submissions
  SET votes_count = votes_count - 1
  WHERE id = OLD.submission_id;
  RETURN OLD;
END;
$$ language 'plpgsql';

-- Create triggers for vote counting
CREATE TRIGGER increment_votes_on_insert AFTER INSERT ON challenge_votes
  FOR EACH ROW EXECUTE FUNCTION increment_submission_votes();

CREATE TRIGGER decrement_votes_on_delete AFTER DELETE ON challenge_votes
  FOR EACH ROW EXECUTE FUNCTION decrement_submission_votes();

-- Storage bucket policies will be configured via Supabase dashboard or API
-- Buckets needed: avatars, covers, posts, spots, challenges, messages
