/*
  # Fix Notifications in Gamification Functions

  Update all functions to use correct notification columns (title, body)
*/

-- Fix add_user_xp function
CREATE OR REPLACE FUNCTION add_user_xp(
  p_user_id uuid,
  p_xp_amount integer,
  p_action_type text,
  p_reference_id uuid DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_current_xp integer;
  v_new_xp integer;
  v_old_level integer;
  v_new_level integer;
  v_new_title text;
  v_xp_to_next integer;
BEGIN
  -- Get current XP and level
  SELECT total_xp, current_level INTO v_current_xp, v_old_level
  FROM user_xp
  WHERE user_id = p_user_id;
  
  -- If user doesn't have XP record, create it
  IF v_current_xp IS NULL THEN
    INSERT INTO user_xp (user_id, total_xp, current_level, xp_to_next_level, level_title)
    VALUES (p_user_id, 0, 1, 100, 'New Rider')
    ON CONFLICT (user_id) DO NOTHING;
    
    v_current_xp := 0;
    v_old_level := 1;
  END IF;
  
  -- Calculate new XP
  v_new_xp := v_current_xp + p_xp_amount;
  
  -- Calculate new level
  v_new_level := calculate_level(v_new_xp);
  
  -- Get level title
  v_new_title := get_level_title(v_new_level);
  
  -- Calculate XP to next level
  v_xp_to_next := calculate_xp_to_next_level(v_new_level);
  
  -- Update user XP
  UPDATE user_xp
  SET 
    total_xp = v_new_xp,
    current_level = v_new_level,
    level_title = v_new_title,
    xp_to_next_level = v_xp_to_next,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Log XP transaction
  INSERT INTO xp_transactions (user_id, amount, action_type, reference_id)
  VALUES (p_user_id, p_xp_amount, p_action_type, p_reference_id);
  
  -- If level increased, create notification
  IF v_new_level > v_old_level THEN
    INSERT INTO notifications (user_id, type, title, body)
    VALUES (
      p_user_id,
      'level_up',
      'Niveau supérieur!',
      'Félicitations! Vous avez atteint le niveau ' || v_new_level || ' - ' || v_new_title || '!'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix award_badge function
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
    INSERT INTO notifications (user_id, type, title, body)
    VALUES (
      p_user_id,
      'achievement',
      'Nouveau badge!',
      'Vous avez débloqué le badge: ' || p_badge_name || '!'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix update_challenge_progress function
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
      INSERT INTO notifications (user_id, type, title, body)
      VALUES (
        p_user_id,
        'challenge',
        'Défi complété!',
        v_challenge.title || ' - Vous avez gagné ' || v_challenge.xp_reward || ' XP!'
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;