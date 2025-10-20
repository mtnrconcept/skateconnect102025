/*
  # Create Complete Engagement System with Auto-Counters

  ## 1. New Tables

  ### spot_likes
  - `id` (uuid, primary key)
  - `spot_id` (uuid, foreign key to spots)
  - `user_id` (uuid, foreign key to profiles)
  - `created_at` (timestamptz)
  - Unique constraint on (spot_id, user_id)

  ### spot_comments
  - `id` (uuid, primary key)
  - `spot_id` (uuid, foreign key to spots)
  - `user_id` (uuid, foreign key to profiles)
  - `content` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### spot_media_comments
  - `id` (uuid, primary key)
  - `media_id` (uuid, foreign key to spot_media)
  - `user_id` (uuid, foreign key to profiles)
  - `content` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## 2. Add Counter Columns

  - Add `likes_count` and `comments_count` to `spots` table
  - Add `comments_count` to `spot_media` table

  ## 3. Trigger Functions

  ### For Posts
  - `increment_post_likes_count()` - Auto-increment likes on posts
  - `decrement_post_likes_count()` - Auto-decrement likes on posts
  - `increment_post_comments_count()` - Auto-increment comments on posts
  - `decrement_post_comments_count()` - Auto-decrement comments on posts

  ### For Spots
  - `increment_spot_likes_count()` - Auto-increment likes on spots
  - `decrement_spot_likes_count()` - Auto-decrement likes on spots
  - `increment_spot_comments_count()` - Auto-increment comments on spots
  - `decrement_spot_comments_count()` - Auto-decrement comments on spots

  ### For Spot Media
  - `increment_media_comments_count()` - Auto-increment comments on spot_media
  - `decrement_media_comments_count()` - Auto-decrement comments on spot_media

  ## 4. Security

  - Enable RLS on all new tables
  - Users can view all likes and comments (public read)
  - Users can only create their own likes and comments
  - Users can only delete their own likes and comments
  - Users can only update their own comments

  ## 5. Performance

  - Create indexes on foreign keys for optimal query performance
  - Create composite indexes on (spot_id, user_id) and (media_id, user_id)
*/

-- ========================================
-- 1. ADD COUNTER COLUMNS TO EXISTING TABLES
-- ========================================

ALTER TABLE spots ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0;
ALTER TABLE spot_media ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0;

-- ========================================
-- 2. CREATE SPOT_LIKES TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS spot_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(spot_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_spot_likes_spot_id ON spot_likes(spot_id);
CREATE INDEX IF NOT EXISTS idx_spot_likes_user_id ON spot_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_spot_likes_created_at ON spot_likes(created_at DESC);

ALTER TABLE spot_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view spot likes"
  ON spot_likes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can like spots"
  ON spot_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike their own spot likes"
  ON spot_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ========================================
-- 3. CREATE SPOT_COMMENTS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS spot_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spot_comments_spot_id ON spot_comments(spot_id);
CREATE INDEX IF NOT EXISTS idx_spot_comments_user_id ON spot_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_spot_comments_created_at ON spot_comments(created_at DESC);

ALTER TABLE spot_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view spot comments"
  ON spot_comments FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can comment on spots"
  ON spot_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own spot comments"
  ON spot_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own spot comments"
  ON spot_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ========================================
-- 4. CREATE SPOT_MEDIA_COMMENTS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS spot_media_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES spot_media(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spot_media_comments_media_id ON spot_media_comments(media_id);
CREATE INDEX IF NOT EXISTS idx_spot_media_comments_user_id ON spot_media_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_spot_media_comments_created_at ON spot_media_comments(created_at DESC);

ALTER TABLE spot_media_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view spot media comments"
  ON spot_media_comments FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can comment on spot media"
  ON spot_media_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own spot media comments"
  ON spot_media_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own spot media comments"
  ON spot_media_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ========================================
-- 5. TRIGGER FUNCTIONS FOR POSTS
-- ========================================

CREATE OR REPLACE FUNCTION increment_post_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE posts
  SET likes_count = likes_count + 1
  WHERE id = NEW.post_id;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_post_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE posts
  SET likes_count = GREATEST(0, likes_count - 1)
  WHERE id = OLD.post_id;
  
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION increment_post_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE posts
  SET comments_count = comments_count + 1
  WHERE id = NEW.post_id;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_post_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE posts
  SET comments_count = GREATEST(0, comments_count - 1)
  WHERE id = OLD.post_id;
  
  RETURN OLD;
END;
$$;

-- ========================================
-- 6. TRIGGER FUNCTIONS FOR SPOTS
-- ========================================

CREATE OR REPLACE FUNCTION increment_spot_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE spots
  SET likes_count = likes_count + 1
  WHERE id = NEW.spot_id;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_spot_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE spots
  SET likes_count = GREATEST(0, likes_count - 1)
  WHERE id = OLD.spot_id;
  
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION increment_spot_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE spots
  SET comments_count = comments_count + 1
  WHERE id = NEW.spot_id;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_spot_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE spots
  SET comments_count = GREATEST(0, comments_count - 1)
  WHERE id = OLD.spot_id;
  
  RETURN OLD;
END;
$$;

-- ========================================
-- 7. TRIGGER FUNCTIONS FOR SPOT MEDIA
-- ========================================

CREATE OR REPLACE FUNCTION increment_media_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE spot_media
  SET comments_count = comments_count + 1
  WHERE id = NEW.media_id;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_media_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE spot_media
  SET comments_count = GREATEST(0, comments_count - 1)
  WHERE id = OLD.media_id;
  
  RETURN OLD;
END;
$$;

-- ========================================
-- 8. CREATE TRIGGERS FOR POSTS
-- ========================================

DROP TRIGGER IF EXISTS trigger_increment_post_likes ON likes;
CREATE TRIGGER trigger_increment_post_likes
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION increment_post_likes_count();

DROP TRIGGER IF EXISTS trigger_decrement_post_likes ON likes;
CREATE TRIGGER trigger_decrement_post_likes
  AFTER DELETE ON likes
  FOR EACH ROW
  EXECUTE FUNCTION decrement_post_likes_count();

DROP TRIGGER IF EXISTS trigger_increment_post_comments ON comments;
CREATE TRIGGER trigger_increment_post_comments
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION increment_post_comments_count();

DROP TRIGGER IF EXISTS trigger_decrement_post_comments ON comments;
CREATE TRIGGER trigger_decrement_post_comments
  AFTER DELETE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION decrement_post_comments_count();

-- ========================================
-- 9. CREATE TRIGGERS FOR SPOTS
-- ========================================

DROP TRIGGER IF EXISTS trigger_increment_spot_likes ON spot_likes;
CREATE TRIGGER trigger_increment_spot_likes
  AFTER INSERT ON spot_likes
  FOR EACH ROW
  EXECUTE FUNCTION increment_spot_likes_count();

DROP TRIGGER IF EXISTS trigger_decrement_spot_likes ON spot_likes;
CREATE TRIGGER trigger_decrement_spot_likes
  AFTER DELETE ON spot_likes
  FOR EACH ROW
  EXECUTE FUNCTION decrement_spot_likes_count();

DROP TRIGGER IF EXISTS trigger_increment_spot_comments ON spot_comments;
CREATE TRIGGER trigger_increment_spot_comments
  AFTER INSERT ON spot_comments
  FOR EACH ROW
  EXECUTE FUNCTION increment_spot_comments_count();

DROP TRIGGER IF EXISTS trigger_decrement_spot_comments ON spot_comments;
CREATE TRIGGER trigger_decrement_spot_comments
  AFTER DELETE ON spot_comments
  FOR EACH ROW
  EXECUTE FUNCTION decrement_spot_comments_count();

-- ========================================
-- 10. CREATE TRIGGERS FOR SPOT MEDIA
-- ========================================

DROP TRIGGER IF EXISTS trigger_increment_media_comments ON spot_media_comments;
CREATE TRIGGER trigger_increment_media_comments
  AFTER INSERT ON spot_media_comments
  FOR EACH ROW
  EXECUTE FUNCTION increment_media_comments_count();

DROP TRIGGER IF EXISTS trigger_decrement_media_comments ON spot_media_comments;
CREATE TRIGGER trigger_decrement_media_comments
  AFTER DELETE ON spot_media_comments
  FOR EACH ROW
  EXECUTE FUNCTION decrement_media_comments_count();

-- ========================================
-- 11. UPDATE TRIGGER FOR UPDATED_AT
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_spot_comments_updated_at ON spot_comments;
CREATE TRIGGER update_spot_comments_updated_at
  BEFORE UPDATE ON spot_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_spot_media_comments_updated_at ON spot_media_comments;
CREATE TRIGGER update_spot_media_comments_updated_at
  BEFORE UPDATE ON spot_media_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
