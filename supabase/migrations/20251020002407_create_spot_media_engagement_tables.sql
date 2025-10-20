/*
  # Create Spot Media Engagement Tables

  1. New Tables
    - `spot_media_likes` - Track likes on spot media
      - `id` (uuid, primary key)
      - `media_id` (uuid, foreign key to spot_media)
      - `user_id` (uuid, foreign key to profiles)
      - `created_at` (timestamptz)

    - `spot_media_views` - Track views on spot media
      - `id` (uuid, primary key)
      - `media_id` (uuid, foreign key to spot_media)
      - `user_id` (uuid, foreign key to profiles, nullable for anonymous)
      - `created_at` (timestamptz)

  2. Add Columns to spot_media
    - `likes_count` (integer) - Denormalized counter
    - `views_count` (integer) - Denormalized counter

  3. Security
    - Enable RLS on all tables
    - Users can like/view any media
    - Users can only unlike their own likes

  4. Triggers
    - Auto-increment/decrement counters
*/

-- Add counters to spot_media table
ALTER TABLE spot_media ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0;
ALTER TABLE spot_media ADD COLUMN IF NOT EXISTS views_count integer DEFAULT 0;

-- Create spot_media_likes table
CREATE TABLE IF NOT EXISTS spot_media_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES spot_media(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(media_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_spot_media_likes_media_id ON spot_media_likes(media_id);
CREATE INDEX IF NOT EXISTS idx_spot_media_likes_user_id ON spot_media_likes(user_id);

-- Create spot_media_views table
CREATE TABLE IF NOT EXISTS spot_media_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES spot_media(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spot_media_views_media_id ON spot_media_views(media_id);
CREATE INDEX IF NOT EXISTS idx_spot_media_views_user_id ON spot_media_views(user_id);

-- Enable RLS
ALTER TABLE spot_media_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE spot_media_views ENABLE ROW LEVEL SECURITY;

-- Policies for spot_media_likes
CREATE POLICY "Anyone can view likes"
  ON spot_media_likes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can like media"
  ON spot_media_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike their own likes"
  ON spot_media_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for spot_media_views
CREATE POLICY "Anyone can view views"
  ON spot_media_views FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can add views"
  ON spot_media_views FOR INSERT
  TO public
  WITH CHECK (true);

-- Trigger function to increment likes count
CREATE OR REPLACE FUNCTION increment_media_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE spot_media
  SET likes_count = likes_count + 1
  WHERE id = NEW.media_id;
  
  RETURN NEW;
END;
$$;

-- Trigger function to decrement likes count
CREATE OR REPLACE FUNCTION decrement_media_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE spot_media
  SET likes_count = GREATEST(0, likes_count - 1)
  WHERE id = OLD.media_id;
  
  RETURN OLD;
END;
$$;

-- Trigger function to increment views count
CREATE OR REPLACE FUNCTION increment_media_views_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE spot_media
  SET views_count = views_count + 1
  WHERE id = NEW.media_id;
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_increment_media_likes ON spot_media_likes;
CREATE TRIGGER trigger_increment_media_likes
  AFTER INSERT ON spot_media_likes
  FOR EACH ROW
  EXECUTE FUNCTION increment_media_likes_count();

DROP TRIGGER IF EXISTS trigger_decrement_media_likes ON spot_media_likes;
CREATE TRIGGER trigger_decrement_media_likes
  AFTER DELETE ON spot_media_likes
  FOR EACH ROW
  EXECUTE FUNCTION decrement_media_likes_count();

DROP TRIGGER IF EXISTS trigger_increment_media_views ON spot_media_views;
CREATE TRIGGER trigger_increment_media_views
  AFTER INSERT ON spot_media_views
  FOR EACH ROW
  EXECUTE FUNCTION increment_media_views_count();