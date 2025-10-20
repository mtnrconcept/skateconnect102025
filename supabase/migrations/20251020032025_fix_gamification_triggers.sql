/*
  # Fix Gamification System Triggers

  1. Ensure all XP triggers are properly created
  2. Fix user_xp initialization for existing users
  3. Add missing functions
*/

-- Ensure user_xp record exists for all users
INSERT INTO user_xp (user_id, total_xp, current_level, xp_to_next_level, level_title)
SELECT 
  id,
  0,
  1,
  100,
  'New Rider'
FROM profiles
WHERE id NOT IN (SELECT user_id FROM user_xp)
ON CONFLICT (user_id) DO NOTHING;

-- Create or replace the award_xp_on_action function
CREATE OR REPLACE FUNCTION award_xp_on_action()
RETURNS TRIGGER AS $$
DECLARE
  v_xp_amount integer;
  v_action_type text;
BEGIN
  -- Determine XP amount based on table
  IF TG_TABLE_NAME = 'spots' THEN
    v_xp_amount := 10;
    v_action_type := 'add_spot';
  ELSIF TG_TABLE_NAME = 'posts' AND NEW.post_type IN ('video', 'photo') THEN
    v_xp_amount := 20;
    v_action_type := 'post_media';
  ELSIF TG_TABLE_NAME = 'posts' THEN
    v_xp_amount := 5;
    v_action_type := 'create_post';
  ELSIF TG_TABLE_NAME = 'comments' THEN
    v_xp_amount := 5;
    v_action_type := 'add_comment';
  ELSIF TG_TABLE_NAME = 'likes' THEN
    v_xp_amount := 2;
    v_action_type := 'give_like';
  ELSE
    RETURN NEW;
  END IF;
  
  -- Ensure user_xp record exists
  INSERT INTO user_xp (user_id, total_xp, current_level, xp_to_next_level, level_title)
  VALUES (NEW.user_id, 0, 1, 100, 'New Rider')
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Award XP
  PERFORM add_user_xp(NEW.user_id, v_xp_amount, v_action_type, NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- For spots, user_id is called created_by
CREATE OR REPLACE FUNCTION award_xp_on_spot()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure user_xp record exists
  INSERT INTO user_xp (user_id, total_xp, current_level, xp_to_next_level, level_title)
  VALUES (NEW.created_by, 0, 1, 100, 'New Rider')
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Award XP
  PERFORM add_user_xp(NEW.created_by, 10, 'add_spot', NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing XP triggers if they exist
DROP TRIGGER IF EXISTS award_xp_on_spot ON spots;
DROP TRIGGER IF EXISTS award_xp_on_post ON posts;
DROP TRIGGER IF EXISTS award_xp_on_comment ON comments;
DROP TRIGGER IF EXISTS award_xp_on_like ON likes;

-- Create XP triggers
CREATE TRIGGER award_xp_on_spot
  AFTER INSERT ON spots
  FOR EACH ROW
  EXECUTE FUNCTION award_xp_on_spot();

CREATE TRIGGER award_xp_on_post
  AFTER INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION award_xp_on_action();

CREATE TRIGGER award_xp_on_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION award_xp_on_action();

CREATE TRIGGER award_xp_on_like
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION award_xp_on_action();

-- Update badge descriptions to be more specific
UPDATE badges SET 
  description = 'Ajoutez votre premier spot à la carte',
  icon = '🗺️'
WHERE name = 'Découvreur';

UPDATE badges SET 
  description = 'Publiez votre première vidéo de skate',
  icon = '🎬'
WHERE name = 'Créateur';

UPDATE badges SET 
  description = 'Soyez le profil le plus actif du mois',
  icon = '🔥'
WHERE name = 'Rider du mois';

UPDATE badges SET 
  description = 'Visitez 10 spots différents dans diverses villes',
  icon = '🌍'
WHERE name = 'Explorateur';

UPDATE badges SET 
  description = 'Atteignez 1000 abonnés sur votre profil',
  icon = '⭐'
WHERE name = 'Influenceur';

UPDATE badges SET 
  description = 'Invitez 10 nouveaux utilisateurs à rejoindre SHREDLOC',
  icon = '🤝'
WHERE name = 'Ambassadeur';

UPDATE badges SET 
  description = 'Atteignez le niveau 5 - Local Legend',
  icon = '🏆'
WHERE name = 'Local Legend';

UPDATE badges SET 
  description = 'Atteignez le niveau 10 - Pro Rider',
  icon = '💎'
WHERE name = 'Pro Rider';

UPDATE badges SET 
  description = 'Atteignez le niveau 20 - Street Icon',
  icon = '👑'
WHERE name = 'Street Icon';

UPDATE badges SET 
  description = 'Complétez toutes les informations de votre profil',
  icon = '✨'
WHERE name = 'Premier pas';

UPDATE badges SET 
  description = 'Postez 50 commentaires constructifs',
  icon = '💬'
WHERE name = 'Commentateur';

UPDATE badges SET 
  description = 'Donnez 100 likes au contenu de la communauté',
  icon = '❤️'
WHERE name = 'Likeur';

UPDATE badges SET 
  description = 'Ajoutez 20 photos de spots différents',
  icon = '📸'
WHERE name = 'Photographe';

UPDATE badges SET 
  description = 'Publiez 10 vidéos de tricks',
  icon = '🎥'
WHERE name = 'Vidéaste';

UPDATE badges SET 
  description = 'Créez et organisez votre premier événement skate',
  icon = '📅'
WHERE name = 'Organisateur';

-- Verify triggers are working
DO $$
BEGIN
  RAISE NOTICE 'Gamification triggers fixed successfully';
END $$;