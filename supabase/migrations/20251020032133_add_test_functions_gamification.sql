/*
  # Add Test Functions for Gamification

  Functions to test XP, badges, and challenge systems
*/

-- Function to test XP system
CREATE OR REPLACE FUNCTION test_xp_system(p_user_id uuid)
RETURNS TABLE(
  test_name text,
  result text,
  details jsonb
) AS $$
DECLARE
  v_initial_xp integer;
  v_final_xp integer;
  v_initial_level integer;
  v_final_level integer;
BEGIN
  -- Get initial state
  SELECT total_xp, current_level INTO v_initial_xp, v_initial_level
  FROM user_xp WHERE user_id = p_user_id;
  
  IF v_initial_xp IS NULL THEN
    RETURN QUERY SELECT 
      'User XP Record'::text,
      'FAIL'::text,
      jsonb_build_object('error', 'No user_xp record found')::jsonb;
    RETURN;
  END IF;
  
  -- Test adding XP
  PERFORM add_user_xp(p_user_id, 50, 'test_action', NULL);
  
  -- Get final state
  SELECT total_xp, current_level INTO v_final_xp, v_final_level
  FROM user_xp WHERE user_id = p_user_id;
  
  -- Return test result
  RETURN QUERY SELECT 
    'Add XP Test'::text,
    CASE 
      WHEN v_final_xp = v_initial_xp + 50 THEN 'PASS'
      ELSE 'FAIL'
    END::text,
    jsonb_build_object(
      'initial_xp', v_initial_xp,
      'final_xp', v_final_xp,
      'expected_xp', v_initial_xp + 50,
      'initial_level', v_initial_level,
      'final_level', v_final_level
    )::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check badge system
CREATE OR REPLACE FUNCTION test_badge_system(p_user_id uuid)
RETURNS TABLE(
  badge_name text,
  earned boolean,
  conditions_met boolean,
  current_progress text
) AS $$
BEGIN
  RETURN QUERY
  WITH user_stats AS (
    SELECT
      (SELECT COUNT(*) FROM spots WHERE created_by = p_user_id) as spot_count,
      (SELECT COUNT(*) FROM posts WHERE user_id = p_user_id AND post_type = 'video') as video_count,
      (SELECT COUNT(*) FROM posts WHERE user_id = p_user_id AND post_type = 'photo') as photo_count,
      (SELECT COUNT(*) FROM comments WHERE user_id = p_user_id) as comment_count,
      (SELECT COUNT(*) FROM likes WHERE user_id = p_user_id) as like_count,
      (SELECT COUNT(*) FROM follows WHERE following_id = p_user_id) as follower_count,
      (SELECT current_level FROM user_xp WHERE user_id = p_user_id) as current_level,
      (SELECT COUNT(*) FROM spot_media WHERE user_id = p_user_id AND media_type = 'photo') as spot_photo_count
  )
  SELECT 
    b.name::text,
    EXISTS(SELECT 1 FROM user_badges WHERE user_id = p_user_id AND badge_id = b.id)::boolean as earned,
    CASE b.name
      WHEN 'Découvreur' THEN us.spot_count >= 1
      WHEN 'Créateur' THEN us.video_count >= 1
      WHEN 'Explorateur' THEN us.spot_count >= 10
      WHEN 'Influenceur' THEN us.follower_count >= 1000
      WHEN 'Local Legend' THEN us.current_level >= 5
      WHEN 'Pro Rider' THEN us.current_level >= 10
      WHEN 'Street Icon' THEN us.current_level >= 20
      WHEN 'Commentateur' THEN us.comment_count >= 50
      WHEN 'Likeur' THEN us.like_count >= 100
      WHEN 'Photographe' THEN us.spot_photo_count >= 20
      WHEN 'Vidéaste' THEN us.video_count >= 10
      ELSE false
    END::boolean as conditions_met,
    CASE b.name
      WHEN 'Découvreur' THEN us.spot_count || '/1 spots'
      WHEN 'Créateur' THEN us.video_count || '/1 videos'
      WHEN 'Explorateur' THEN us.spot_count || '/10 spots'
      WHEN 'Influenceur' THEN us.follower_count || '/1000 followers'
      WHEN 'Local Legend' THEN us.current_level || '/5 level'
      WHEN 'Pro Rider' THEN us.current_level || '/10 level'
      WHEN 'Street Icon' THEN us.current_level || '/20 level'
      WHEN 'Commentateur' THEN us.comment_count || '/50 comments'
      WHEN 'Likeur' THEN us.like_count || '/100 likes'
      WHEN 'Photographe' THEN us.spot_photo_count || '/20 photos'
      WHEN 'Vidéaste' THEN us.video_count || '/10 videos'
      ELSE 'N/A'
    END::text as current_progress
  FROM badges b
  CROSS JOIN user_stats us
  ORDER BY b.rarity DESC, b.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check challenge progress
CREATE OR REPLACE FUNCTION test_challenge_system(p_user_id uuid)
RETURNS TABLE(
  challenge_title text,
  challenge_type text,
  target integer,
  current_progress integer,
  is_completed boolean,
  xp_reward integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.title::text,
    c.challenge_type::text,
    c.target_count::integer,
    COALESCE(ucp.current_count, 0)::integer,
    COALESCE(ucp.is_completed, false)::boolean,
    c.xp_reward::integer
  FROM daily_challenges c
  LEFT JOIN user_challenge_progress ucp ON c.id = ucp.challenge_id AND ucp.user_id = p_user_id
  WHERE c.is_active = true
  AND CURRENT_DATE BETWEEN c.start_date AND c.end_date
  ORDER BY c.xp_reward DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to simulate user actions for testing
CREATE OR REPLACE FUNCTION simulate_user_actions(
  p_user_id uuid,
  p_spots integer DEFAULT 0,
  p_posts integer DEFAULT 0,
  p_comments integer DEFAULT 0,
  p_likes integer DEFAULT 0
)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_initial_xp integer;
  v_final_xp integer;
  v_new_badges integer;
  i integer;
BEGIN
  -- Get initial XP
  SELECT total_xp INTO v_initial_xp FROM user_xp WHERE user_id = p_user_id;
  
  -- Simulate spots
  FOR i IN 1..p_spots LOOP
    INSERT INTO spots (created_by, name, description, address, latitude, longitude, spot_type, difficulty)
    VALUES (p_user_id, 'Test Spot ' || i, 'Test description', 'Test address', 0, 0, 'street', 3);
  END LOOP;
  
  -- Simulate posts
  FOR i IN 1..p_posts LOOP
    INSERT INTO posts (user_id, content, post_type)
    VALUES (p_user_id, 'Test post ' || i, CASE WHEN i % 2 = 0 THEN 'video' ELSE 'photo' END);
  END LOOP;
  
  -- Simulate comments
  FOR i IN 1..p_comments LOOP
    INSERT INTO comments (user_id, post_id, content)
    SELECT p_user_id, id, 'Test comment ' || i
    FROM posts LIMIT 1;
  END LOOP;
  
  -- Simulate likes
  FOR i IN 1..p_likes LOOP
    INSERT INTO likes (user_id, post_id)
    SELECT p_user_id, id
    FROM posts 
    WHERE id NOT IN (SELECT post_id FROM likes WHERE user_id = p_user_id)
    LIMIT 1
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Get final XP and badges
  SELECT total_xp INTO v_final_xp FROM user_xp WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_new_badges FROM user_badges WHERE user_id = p_user_id;
  
  v_result := jsonb_build_object(
    'initial_xp', v_initial_xp,
    'final_xp', v_final_xp,
    'xp_gained', v_final_xp - v_initial_xp,
    'total_badges', v_new_badges,
    'actions_simulated', jsonb_build_object(
      'spots', p_spots,
      'posts', p_posts,
      'comments', p_comments,
      'likes', p_likes
    )
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;