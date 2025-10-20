/*
  # Fix XP Award Triggers

  Separate triggers for each table type to avoid field access errors
*/

-- Drop old triggers
DROP TRIGGER IF EXISTS award_xp_on_post ON posts;
DROP TRIGGER IF EXISTS award_xp_on_comment ON comments;
DROP TRIGGER IF EXISTS award_xp_on_like ON likes;

-- Create specific function for posts
CREATE OR REPLACE FUNCTION award_xp_on_post()
RETURNS TRIGGER AS $$
DECLARE
  v_xp_amount integer;
  v_action_type text;
BEGIN
  -- Ensure user_xp record exists
  INSERT INTO user_xp (user_id, total_xp, current_level, xp_to_next_level, level_title)
  VALUES (NEW.user_id, 0, 1, 100, 'New Rider')
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Determine XP based on post type
  IF NEW.post_type IN ('video', 'photo') THEN
    v_xp_amount := 20;
    v_action_type := 'post_media';
  ELSE
    v_xp_amount := 5;
    v_action_type := 'create_post';
  END IF;
  
  -- Award XP
  PERFORM add_user_xp(NEW.user_id, v_xp_amount, v_action_type, NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create specific function for comments
CREATE OR REPLACE FUNCTION award_xp_on_comment()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure user_xp record exists
  INSERT INTO user_xp (user_id, total_xp, current_level, xp_to_next_level, level_title)
  VALUES (NEW.user_id, 0, 1, 100, 'New Rider')
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Award XP
  PERFORM add_user_xp(NEW.user_id, 5, 'add_comment', NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create specific function for likes
CREATE OR REPLACE FUNCTION award_xp_on_like()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure user_xp record exists
  INSERT INTO user_xp (user_id, total_xp, current_level, xp_to_next_level, level_title)
  VALUES (NEW.user_id, 0, 1, 100, 'New Rider')
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Award XP
  PERFORM add_user_xp(NEW.user_id, 2, 'give_like', NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers
CREATE TRIGGER award_xp_on_post
  AFTER INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION award_xp_on_post();

CREATE TRIGGER award_xp_on_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION award_xp_on_comment();

CREATE TRIGGER award_xp_on_like
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION award_xp_on_like();