/*
  # Create Automatic Badge Awarding System

  1. Functions to check and award badges
  2. Triggers to auto-award badges on milestones
  3. Notifications when badges are earned
*/

-- Function to award badge to user if not already earned
CREATE OR REPLACE FUNCTION award_badge(
  p_user_id uuid,
  p_badge_name text
)
RETURNS void AS $$
DECLARE
  v_badge_id uuid;
  v_already_earned boolean;
BEGIN
  -- Get badge ID
  SELECT id INTO v_badge_id 
  FROM badges 
  WHERE name = p_badge_name;
  
  IF v_badge_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Check if already earned
  SELECT EXISTS(
    SELECT 1 FROM user_badges 
    WHERE user_id = p_user_id AND badge_id = v_badge_id
  ) INTO v_already_earned;
  
  IF NOT v_already_earned THEN
    -- Award badge
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (p_user_id, v_badge_id);
    
    -- Create notification
    INSERT INTO notifications (user_id, type, content)
    VALUES (
      p_user_id,
      'achievement',
      'Nouveau badge débloqué: ' || p_badge_name || '!'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and award progression badges
CREATE OR REPLACE FUNCTION check_level_badges(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_level integer;
BEGIN
  SELECT current_level INTO v_level
  FROM user_xp
  WHERE user_id = p_user_id;
  
  IF v_level >= 5 THEN
    PERFORM award_badge(p_user_id, 'Local Legend');
  END IF;
  
  IF v_level >= 10 THEN
    PERFORM award_badge(p_user_id, 'Pro Rider');
  END IF;
  
  IF v_level >= 20 THEN
    PERFORM award_badge(p_user_id, 'Street Icon');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check spot-related badges
CREATE OR REPLACE FUNCTION check_spot_badges(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_spot_count integer;
BEGIN
  -- Count user's spots
  SELECT COUNT(*) INTO v_spot_count
  FROM spots
  WHERE created_by = p_user_id;
  
  -- Découvreur - first spot
  IF v_spot_count >= 1 THEN
    PERFORM award_badge(p_user_id, 'Découvreur');
  END IF;
  
  -- Check photo count
  DECLARE
    v_photo_count integer;
  BEGIN
    SELECT COUNT(*) INTO v_photo_count
    FROM spot_media
    WHERE user_id = p_user_id AND media_type = 'photo';
    
    IF v_photo_count >= 20 THEN
      PERFORM award_badge(p_user_id, 'Photographe');
    END IF;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check content badges
CREATE OR REPLACE FUNCTION check_content_badges(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_video_count integer;
  v_photo_count integer;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE post_type = 'video'),
    COUNT(*) FILTER (WHERE post_type = 'photo')
  INTO v_video_count, v_photo_count
  FROM posts
  WHERE user_id = p_user_id;
  
  -- Créateur - first video
  IF v_video_count >= 1 THEN
    PERFORM award_badge(p_user_id, 'Créateur');
  END IF;
  
  -- Vidéaste - 10 videos
  IF v_video_count >= 10 THEN
    PERFORM award_badge(p_user_id, 'Vidéaste');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check engagement badges
CREATE OR REPLACE FUNCTION check_engagement_badges(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_comment_count integer;
  v_like_count integer;
BEGIN
  -- Count comments
  SELECT COUNT(*) INTO v_comment_count
  FROM comments
  WHERE user_id = p_user_id;
  
  IF v_comment_count >= 50 THEN
    PERFORM award_badge(p_user_id, 'Commentateur');
  END IF;
  
  -- Count likes
  SELECT COUNT(*) INTO v_like_count
  FROM likes
  WHERE user_id = p_user_id;
  
  IF v_like_count >= 100 THEN
    PERFORM award_badge(p_user_id, 'Likeur');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check social badges
CREATE OR REPLACE FUNCTION check_social_badges(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_follower_count integer;
BEGIN
  SELECT COUNT(*) INTO v_follower_count
  FROM follows
  WHERE following_id = p_user_id;
  
  IF v_follower_count >= 1000 THEN
    PERFORM award_badge(p_user_id, 'Influenceur');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to check badges after XP update
CREATE OR REPLACE FUNCTION check_badges_after_xp_update()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM check_level_badges(NEW.user_id);
  PERFORM check_spot_badges(NEW.user_id);
  PERFORM check_content_badges(NEW.user_id);
  PERFORM check_engagement_badges(NEW.user_id);
  PERFORM check_social_badges(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on user_xp updates
DROP TRIGGER IF EXISTS check_badges_trigger ON user_xp;
CREATE TRIGGER check_badges_trigger
  AFTER UPDATE ON user_xp
  FOR EACH ROW
  EXECUTE FUNCTION check_badges_after_xp_update();

-- Trigger to check badges after new spot
CREATE OR REPLACE FUNCTION check_badges_after_spot()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM check_spot_badges(NEW.created_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_badges_after_spot_trigger ON spots;
CREATE TRIGGER check_badges_after_spot_trigger
  AFTER INSERT ON spots
  FOR EACH ROW
  EXECUTE FUNCTION check_badges_after_spot();

-- Trigger to check badges after new post
CREATE OR REPLACE FUNCTION check_badges_after_post()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM check_content_badges(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_badges_after_post_trigger ON posts;
CREATE TRIGGER check_badges_after_post_trigger
  AFTER INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION check_badges_after_post();

-- Trigger to check badges after new follow
CREATE OR REPLACE FUNCTION check_badges_after_follow()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM check_social_badges(NEW.following_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_badges_after_follow_trigger ON follows;
CREATE TRIGGER check_badges_after_follow_trigger
  AFTER INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION check_badges_after_follow();

-- Update notifications table to support achievement type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type 
    WHERE typname = 'notification_type'
  ) THEN
    ALTER TABLE notifications 
    ALTER COLUMN type TYPE text;
  END IF;
END $$;