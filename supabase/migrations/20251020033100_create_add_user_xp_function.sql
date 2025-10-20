/*
  # Create add_user_xp Function

  Main function to add XP to users and manage level progression
*/

-- Function to calculate level from XP
CREATE OR REPLACE FUNCTION calculate_level(p_total_xp integer)
RETURNS integer AS $$
BEGIN
  -- Level formula: sqrt(total_xp / 100)
  RETURN GREATEST(1, FLOOR(SQRT(p_total_xp::float / 100))::integer);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate XP needed for next level
CREATE OR REPLACE FUNCTION calculate_xp_to_next_level(p_current_level integer)
RETURNS integer AS $$
DECLARE
  v_next_level integer;
  v_xp_for_next integer;
  v_xp_for_current integer;
BEGIN
  v_next_level := p_current_level + 1;
  v_xp_for_next := (v_next_level * v_next_level) * 100;
  v_xp_for_current := (p_current_level * p_current_level) * 100;
  RETURN v_xp_for_next - v_xp_for_current;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get level title
CREATE OR REPLACE FUNCTION get_level_title(p_level integer)
RETURNS text AS $$
BEGIN
  RETURN CASE
    WHEN p_level >= 30 THEN 'Skate Master'
    WHEN p_level >= 20 THEN 'Street Icon'
    WHEN p_level >= 15 THEN 'Park Legend'
    WHEN p_level >= 10 THEN 'Pro Rider'
    WHEN p_level >= 5 THEN 'Local Legend'
    ELSE 'New Rider'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Main function to add XP
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
    INSERT INTO notifications (user_id, type, content)
    VALUES (
      p_user_id,
      'level_up',
      'Félicitations! Vous avez atteint le niveau ' || v_new_level || ' - ' || v_new_title || '!'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION add_user_xp TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_level TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_xp_to_next_level TO authenticated;
GRANT EXECUTE ON FUNCTION get_level_title TO authenticated;