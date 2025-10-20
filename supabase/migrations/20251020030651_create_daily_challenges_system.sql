/*
  # Create Daily/Weekly Challenges System

  1. New Tables
    - `daily_challenges` - Available daily challenges
    - `user_challenge_progress` - Track user progress on challenges
    - `challenge_completions` - Completed challenges history

  2. Functions for challenge management
*/

-- Create daily_challenges table
CREATE TABLE IF NOT EXISTS daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  challenge_type text NOT NULL,
  target_count integer NOT NULL,
  xp_reward integer NOT NULL,
  badge_reward uuid REFERENCES badges(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active challenges"
  ON daily_challenges FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Create user_challenge_progress table
CREATE TABLE IF NOT EXISTS user_challenge_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES daily_challenges(id) ON DELETE CASCADE,
  current_count integer DEFAULT 0,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, challenge_id)
);

ALTER TABLE user_challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own challenge progress"
  ON user_challenge_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own challenge progress"
  ON user_challenge_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert challenge progress"
  ON user_challenge_progress FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_daily_challenges_dates ON daily_challenges(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_user_challenge_progress_user ON user_challenge_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_challenge_progress_challenge ON user_challenge_progress(challenge_id);

-- Function to update challenge progress
CREATE OR REPLACE FUNCTION update_challenge_progress(
  p_user_id uuid,
  p_challenge_type text,
  p_increment integer DEFAULT 1
)
RETURNS void AS $$
DECLARE
  v_challenge record;
BEGIN
  -- Find active challenges of this type
  FOR v_challenge IN
    SELECT * FROM daily_challenges
    WHERE challenge_type = p_challenge_type
    AND is_active = true
    AND CURRENT_DATE BETWEEN start_date AND end_date
  LOOP
    -- Insert or update progress
    INSERT INTO user_challenge_progress (user_id, challenge_id, current_count)
    VALUES (p_user_id, v_challenge.id, p_increment)
    ON CONFLICT (user_id, challenge_id)
    DO UPDATE SET
      current_count = user_challenge_progress.current_count + p_increment,
      updated_at = now();
    
    -- Check if challenge is completed
    UPDATE user_challenge_progress
    SET 
      is_completed = true,
      completed_at = now()
    WHERE user_id = p_user_id
    AND challenge_id = v_challenge.id
    AND current_count >= v_challenge.target_count
    AND is_completed = false;
    
    -- Award XP and badge if just completed
    IF EXISTS (
      SELECT 1 FROM user_challenge_progress
      WHERE user_id = p_user_id
      AND challenge_id = v_challenge.id
      AND is_completed = true
      AND completed_at > now() - INTERVAL '1 second'
    ) THEN
      -- Award XP
      PERFORM add_user_xp(p_user_id, v_challenge.xp_reward, 'challenge_completed', v_challenge.id);
      
      -- Award badge if specified
      IF v_challenge.badge_reward IS NOT NULL THEN
        INSERT INTO user_badges (user_id, badge_id)
        VALUES (p_user_id, v_challenge.badge_reward)
        ON CONFLICT (user_id, badge_id) DO NOTHING;
      END IF;
      
      -- Create notification
      INSERT INTO notifications (user_id, type, content)
      VALUES (
        p_user_id,
        'challenge',
        'Défi complété: ' || v_challenge.title || '! +' || v_challenge.xp_reward || ' XP'
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update challenges after post
CREATE OR REPLACE FUNCTION update_challenges_after_post()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.post_type = 'video' THEN
    PERFORM update_challenge_progress(NEW.user_id, 'post_video', 1);
  ELSIF NEW.post_type = 'photo' THEN
    PERFORM update_challenge_progress(NEW.user_id, 'post_photo', 1);
  END IF;
  
  PERFORM update_challenge_progress(NEW.user_id, 'create_post', 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_challenges_after_post_trigger ON posts;
CREATE TRIGGER update_challenges_after_post_trigger
  AFTER INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_challenges_after_post();

-- Trigger to update challenges after spot
CREATE OR REPLACE FUNCTION update_challenges_after_spot()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_challenge_progress(NEW.created_by, 'add_spot', 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_challenges_after_spot_trigger ON spots;
CREATE TRIGGER update_challenges_after_spot_trigger
  AFTER INSERT ON spots
  FOR EACH ROW
  EXECUTE FUNCTION update_challenges_after_spot();

-- Trigger to update challenges after comment
CREATE OR REPLACE FUNCTION update_challenges_after_comment()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_challenge_progress(NEW.user_id, 'add_comment', 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_challenges_after_comment_trigger ON comments;
CREATE TRIGGER update_challenges_after_comment_trigger
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_challenges_after_comment();

-- Trigger to update challenges after like
CREATE OR REPLACE FUNCTION update_challenges_after_like()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_challenge_progress(NEW.user_id, 'give_like', 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_challenges_after_like_trigger ON likes;
CREATE TRIGGER update_challenges_after_like_trigger
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION update_challenges_after_like();

-- Insert sample daily challenges
INSERT INTO daily_challenges (title, description, challenge_type, target_count, xp_reward, start_date, end_date) VALUES
  ('Skateur du jour', 'Publie 3 vidéos aujourd''hui', 'post_video', 3, 100, CURRENT_DATE, CURRENT_DATE),
  ('Chasseur de spots', 'Ajoute 2 nouveaux spots', 'add_spot', 2, 50, CURRENT_DATE, CURRENT_DATE),
  ('Commentateur actif', 'Laisse 10 commentaires', 'add_comment', 10, 30, CURRENT_DATE, CURRENT_DATE),
  ('Amateur de contenu', 'Donne 20 likes', 'give_like', 20, 20, CURRENT_DATE, CURRENT_DATE),
  ('Créateur hebdomadaire', 'Publie 10 posts cette semaine', 'create_post', 10, 200, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days'),
  ('Explorateur hebdomadaire', 'Ajoute 5 spots cette semaine', 'add_spot', 5, 150, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days')
ON CONFLICT DO NOTHING;