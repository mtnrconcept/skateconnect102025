/*
  # Seed Demo Social Data

  ## Overview
  - Creates a roster of demo riders with confirmed accounts
  - Populates their profiles with bios, avatars and skate preferences
  - Awards XP, badges and transactions to activate the leaderboard & badges UI
  - Adds follow relationships, feed posts, challenges and private messages

  ## Notes
  - Demo accounts share the same password: `SkateDemo42!`
  - Safe to run multiple times thanks to idempotent inserts
*/

DO $$
DECLARE
  user_data jsonb;
  new_user_id uuid;
  user_record RECORD;
BEGIN
  FOR user_record IN
    SELECT *
    FROM jsonb_to_recordset(
      '[
        {"email": "amelie.dubois@shredloc.test", "password": "SkateDemo42!", "username": "amelie-dubois", "display_name": "Amélie \"Mistral\" Dubois", "bio": "Filmeuse du crew Mistral. Fan de lines fluides et de ledges en marbre.", "avatar_url": "https://images.pexels.com/photos/894156/pexels-photo-894156.jpeg", "cover_url": "https://images.pexels.com/photos/169573/pexels-photo-169573.jpeg", "skill_level": "advanced", "stance": "goofy"},
        {"email": "leon.marchand@shredloc.test", "password": "SkateDemo42!", "username": "leon-marchand", "display_name": "Léon \"Switch\" Marchand", "bio": "Street tech addict. Toujours partant pour un game of SKATE.", "avatar_url": "https://images.pexels.com/photos/1759823/pexels-photo-1759823.jpeg", "cover_url": "https://images.pexels.com/photos/1760775/pexels-photo-1760775.jpeg", "skill_level": "advanced", "stance": "regular"},
        {"email": "sofia.nguyen@shredloc.test", "password": "SkateDemo42!", "username": "sofia-nguyen", "display_name": "Sofia Nguyen", "bio": "Camera en bandoulière. J'adore documenter la scène parisienne.", "avatar_url": "https://images.pexels.com/photos/1552249/pexels-photo-1552249.jpeg", "cover_url": "https://images.pexels.com/photos/1543413/pexels-photo-1543413.jpeg", "skill_level": "intermediate", "stance": "regular"},
        {"email": "malik.diarra@shredloc.test", "password": "SkateDemo42!", "username": "malik-diarra", "display_name": "Malik Diarra", "bio": "DIY builder & flow rider. Je shape des courbes le week-end.", "avatar_url": "https://images.pexels.com/photos/2050994/pexels-photo-2050994.jpeg", "cover_url": "https://images.pexels.com/photos/1543411/pexels-photo-1543411.jpeg", "skill_level": "advanced", "stance": "goofy"},
        {"email": "zoe.lefevre@shredloc.test", "password": "SkateDemo42!", "username": "zoe-lefevre", "display_name": "Zoé \"PowerSlide\" Lefèvre", "bio": "Coach des mini-riders. Axée progression et bonne vibes.", "avatar_url": "https://images.pexels.com/photos/3775532/pexels-photo-3775532.jpeg", "cover_url": "https://images.pexels.com/photos/1183099/pexels-photo-1183099.jpeg", "skill_level": "advanced", "stance": "regular"},
        {"email": "tommy.bernard@shredloc.test", "password": "SkateDemo42!", "username": "tommy-bernard", "display_name": "Tommy \"RailSnap\" Bernard", "bio": "Filme des parts VX1000. Toujours à la recherche d'un nouveau spot.", "avatar_url": "https://images.pexels.com/photos/2531559/pexels-photo-2531559.jpeg", "cover_url": "https://images.pexels.com/photos/258045/pexels-photo-258045.jpeg", "skill_level": "advanced", "stance": "regular"},
        {"email": "camille.perrot@shredloc.test", "password": "SkateDemo42!", "username": "camille-perrot", "display_name": "Camille Perrot", "bio": "Transitions only. Bowls, pools et tout ce qui carve.", "avatar_url": "https://images.pexels.com/photos/4665697/pexels-photo-4665697.jpeg", "cover_url": "https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg", "skill_level": "advanced", "stance": "goofy"},
        {"email": "lucas.renaud@shredloc.test", "password": "SkateDemo42!", "username": "lucas-renaud", "display_name": "Lucas Renaud", "bio": "Rookie motivé. Je grind chaque session pour monter au classement.", "avatar_url": "https://images.pexels.com/photos/301977/pexels-photo-301977.jpeg", "cover_url": "https://images.pexels.com/photos/2343150/pexels-photo-2343150.jpeg", "skill_level": "intermediate", "stance": "regular"},
        {"email": "ines.garcia@shredloc.test", "password": "SkateDemo42!", "username": "ines-garcia", "display_name": "Inès Garcia", "bio": "Night skater. Je chasse les spots urbains après le boulot.", "avatar_url": "https://images.pexels.com/photos/3911216/pexels-photo-3911216.jpeg", "cover_url": "https://images.pexels.com/photos/258045/pexels-photo-258045.jpeg", "skill_level": "advanced", "stance": "regular"},
        {"email": "noah.petit@shredloc.test", "password": "SkateDemo42!", "username": "noah-petit", "display_name": "Noah Petit", "bio": "Filmeur / rider. Clips VX et drones dans le sac.", "avatar_url": "https://images.pexels.com/photos/2385478/pexels-photo-2385478.jpeg", "cover_url": "https://images.pexels.com/photos/1738639/pexels-photo-1738639.jpeg", "skill_level": "intermediate", "stance": "goofy"}
      ]'::jsonb
    ) AS (
      email text,
      password text,
      username text,
      display_name text,
      bio text,
      avatar_url text,
      cover_url text,
      skill_level text,
      stance text
    )
  LOOP
    SELECT id INTO new_user_id FROM auth.users WHERE email = user_record.email;

    IF new_user_id IS NULL THEN
      user_data := auth.create_user(
        jsonb_build_object(
          'email', user_record.email,
          'password', user_record.password,
          'email_confirm', true
        )
      );
      new_user_id := (user_data->>'id')::uuid;
    END IF;

    INSERT INTO profiles (id, username, display_name, bio, avatar_url, cover_url, skill_level, stance)
    VALUES (
      new_user_id,
      user_record.username,
      user_record.display_name,
      user_record.bio,
      COALESCE(user_record.avatar_url, ''),
      COALESCE(user_record.cover_url, ''),
      COALESCE(user_record.skill_level, 'intermediate'),
      COALESCE(user_record.stance, 'regular')
    )
    ON CONFLICT (id) DO UPDATE SET
      username = EXCLUDED.username,
      display_name = EXCLUDED.display_name,
      bio = EXCLUDED.bio,
      avatar_url = EXCLUDED.avatar_url,
      cover_url = EXCLUDED.cover_url,
      skill_level = EXCLUDED.skill_level,
      stance = EXCLUDED.stance;
  END LOOP;
END $$;

-- =============================
-- XP & GAMIFICATION DATA
-- =============================
INSERT INTO user_xp (user_id, total_xp, current_level, xp_to_next_level, level_title)
SELECT
  p.id,
  data.total_xp,
  data.current_level,
  data.xp_to_next_level,
  data.level_title
FROM profiles p
JOIN (
  VALUES
    ('amelie-dubois', 4820, 9, 680, 'Flow Architect'),
    ('leon-marchand', 5120, 10, 900, 'Switch Magician'),
    ('sofia-nguyen', 2380, 6, 320, 'Street Documentarian'),
    ('malik-diarra', 4550, 9, 740, 'DIY Sensei'),
    ('zoe-lefevre', 3890, 8, 550, 'Community Coach'),
    ('tommy-bernard', 3410, 7, 420, 'Rail Hunter'),
    ('camille-perrot', 2750, 6, 360, 'Bowl Queen'),
    ('lucas-renaud', 1880, 5, 260, 'Up & Comer'),
    ('ines-garcia', 3290, 7, 410, 'Night Rider'),
    ('noah-petit', 2120, 5, 230, 'Clip Chaser')
) AS data(username, total_xp, current_level, xp_to_next_level, level_title)
  ON p.username = data.username
ON CONFLICT (user_id) DO UPDATE SET
  total_xp = EXCLUDED.total_xp,
  current_level = EXCLUDED.current_level,
  xp_to_next_level = EXCLUDED.xp_to_next_level,
  level_title = EXCLUDED.level_title,
  updated_at = now();

INSERT INTO xp_transactions (user_id, amount, action_type, reference_id, created_at)
SELECT
  p.id,
  data.amount,
  data.action_type,
  NULL,
  now() - (data.days_ago || ' days')::interval
FROM profiles p
JOIN (
  VALUES
    ('amelie-dubois', 220, 'challenge_win', 2),
    ('amelie-dubois', 150, 'post_feature', 5),
    ('leon-marchand', 180, 'spot_added', 3),
    ('leon-marchand', 120, 'challenge_participation', 8),
    ('sofia-nguyen', 90, 'post_like_streak', 1),
    ('malik-diarra', 160, 'spot_update', 4),
    ('zoe-lefevre', 140, 'community_event_host', 6),
    ('tommy-bernard', 130, 'video_upload', 2),
    ('camille-perrot', 110, 'challenge_participation', 7),
    ('lucas-renaud', 85, 'daily_login', 0),
    ('ines-garcia', 150, 'night_session', 1),
    ('noah-petit', 120, 'clip_of_the_day', 3)
) AS data(username, amount, action_type, days_ago)
  ON p.username = data.username
ON CONFLICT DO NOTHING;

INSERT INTO user_badges (user_id, badge_id, earned_at, is_displayed)
SELECT
  p.id,
  b.id,
  now() - (data.days_ago || ' days')::interval,
  data.is_displayed
FROM (
  VALUES
    ('amelie-dubois', 'Découvreur', true, 12),
    ('amelie-dubois', 'Créateur', true, 6),
    ('leon-marchand', 'Premier pas', true, 20),
    ('leon-marchand', 'Influenceur', true, 5),
    ('sofia-nguyen', 'Photographe', true, 9),
    ('malik-diarra', 'Ambassadeur', false, 14),
    ('zoe-lefevre', 'Commentateur', true, 4),
    ('tommy-bernard', 'Vidéaste', true, 2),
    ('camille-perrot', 'Local Legend', true, 18),
    ('ines-garcia', 'Likeur', false, 3),
    ('noah-petit', 'Créateur', true, 7)
) AS data(username, badge_name, is_displayed, days_ago)
JOIN profiles p ON p.username = data.username
JOIN badges b ON b.name = data.badge_name
ON CONFLICT DO NOTHING;

-- =============================
-- FOLLOW NETWORK
-- =============================
INSERT INTO follows (follower_id, following_id, created_at)
SELECT
  follower.id,
  following.id,
  now() - (data.days_ago || ' days')::interval
FROM (
  VALUES
    ('amelie-dubois', 'leon-marchand', 10),
    ('amelie-dubois', 'sofia-nguyen', 4),
    ('leon-marchand', 'amelie-dubois', 3),
    ('leon-marchand', 'malik-diarra', 6),
    ('sofia-nguyen', 'zoe-lefevre', 8),
    ('sofia-nguyen', 'tommy-bernard', 7),
    ('malik-diarra', 'camille-perrot', 5),
    ('zoe-lefevre', 'lucas-renaud', 2),
    ('tommy-bernard', 'ines-garcia', 4),
    ('camille-perrot', 'amelie-dubois', 9),
    ('lucas-renaud', 'leon-marchand', 1),
    ('ines-garcia', 'noah-petit', 3),
    ('noah-petit', 'sofia-nguyen', 2)
) AS data(follower_username, following_username, days_ago)
JOIN profiles follower ON follower.username = data.follower_username
JOIN profiles following ON following.username = data.following_username
ON CONFLICT DO NOTHING;

-- =============================
-- FEED POSTS & REACTIONS
-- =============================
INSERT INTO posts (user_id, content, media_urls, spot_id, post_type, likes_count, comments_count, created_at)
SELECT
  p.id,
  data.content,
  CASE
    WHEN data.media_urls IS NULL THEN '[]'::jsonb
    ELSE to_jsonb(data.media_urls)
  END,
  data.spot_id,
  data.post_type,
  data.likes_count,
  data.comments_count,
  now() - (data.days_ago || ' days')::interval
FROM (
  VALUES
    ('amelie-dubois', 'Line en switch front crook au Trocadéro. Session sunrise magique.', ARRAY['https://images.pexels.com/photos/1868124/pexels-photo-1868124.jpeg'], 'a1111111-1111-1111-1111-111111111111'::uuid, 'video', 86, 14, 1),
    ('leon-marchand', 'Nouveau spot marble près de La Défense. Qui vient le tester ?', ARRAY['https://images.pexels.com/photos/260409/pexels-photo-260409.jpeg'], 'a5555555-5555-5555-5555-555555555555'::uuid, 'photo', 64, 9, 2),
    ('sofia-nguyen', 'Montage recap de la session de dimanche. Merci la team !', ARRAY['https://images.pexels.com/photos/1543412/pexels-photo-1543412.jpeg'], NULL, 'video', 47, 11, 0),
    ('malik-diarra', 'On a coulé un nouveau curb DIY aux Halles. Venez le waxer.', ARRAY['https://images.pexels.com/photos/1642053/pexels-photo-1642053.jpeg'], 'a4444444-4444-4444-4444-444444444444'::uuid, 'photo', 58, 7, 4),
    ('zoe-lefevre', 'Atelier kids à République ce matin. Progression de dingue !', NULL, 'a2222222-2222-2222-2222-222222222222'::uuid, 'text', 35, 5, 1),
    ('tommy-bernard', 'Part VX en préparation. Voici un extrait brut.', ARRAY['https://images.pexels.com/photos/235986/pexels-photo-235986.jpeg'], NULL, 'video', 72, 13, 3),
    ('camille-perrot', 'Full speed carve au Bercy Bowl. Best feeling ever.', ARRAY['https://images.pexels.com/photos/3621344/pexels-photo-3621344.jpeg'], 'a3333333-3333-3333-3333-333333333333'::uuid, 'photo', 54, 6, 5),
    ('lucas-renaud', 'Premier boardslide sur le rail de Bastille ! Trop hypé.', ARRAY['https://images.pexels.com/photos/3860092/pexels-photo-3860092.jpeg'], 'a6666666-6666-6666-6666-666666666666'::uuid, 'photo', 41, 8, 0),
    ('ines-garcia', 'Session nocturne à Châtelet avec la team. Light trails 🔥', ARRAY['https://images.pexels.com/photos/3910061/pexels-photo-3910061.jpeg'], 'a8888888-8888-8888-8888-888888888888'::uuid, 'photo', 63, 10, 2),
    ('noah-petit', 'Test d’un drone FPV pour filmer les lines au Cosanostra DIY.', ARRAY['https://images.pexels.com/photos/3621347/pexels-photo-3621347.jpeg'], 'a7777777-7777-7777-7777-777777777777'::uuid, 'video', 52, 6, 2)
) AS data(username, content, media_urls, spot_id, post_type, likes_count, comments_count, days_ago)
JOIN profiles p ON p.username = data.username
ON CONFLICT DO NOTHING;

WITH latest_posts AS (
  SELECT DISTINCT ON (user_id) id, user_id
  FROM posts
  ORDER BY user_id, created_at DESC
)
INSERT INTO likes (user_id, post_id, created_at)
SELECT
  liker.id,
  lp.id,
  now() - (data.days_ago || ' days')::interval
FROM (
  VALUES
    ('amelie-dubois', 'leon-marchand', 1),
    ('leon-marchand', 'amelie-dubois', 1),
    ('sofia-nguyen', 'malik-diarra', 0),
    ('zoe-lefevre', 'lucas-renaud', 0),
    ('ines-garcia', 'noah-petit', 0),
    ('noah-petit', 'ines-garcia', 0),
    ('malik-diarra', 'camille-perrot', 2)
) AS data(liker_username, author_username, days_ago)
JOIN profiles liker ON liker.username = data.liker_username
JOIN profiles author ON author.username = data.author_username
JOIN latest_posts lp ON lp.user_id = author.id
ON CONFLICT DO NOTHING;

WITH latest_posts AS (
  SELECT DISTINCT ON (user_id) id, user_id
  FROM posts
  ORDER BY user_id, created_at DESC
)
INSERT INTO comments (user_id, post_id, content, created_at)
SELECT
  commenter.id,
  lp.id,
  data.content,
  now() - (data.days_ago || ' days')::interval
FROM (
  VALUES
    ('sofia-nguyen', 'amelie-dubois', 'La lumière est incroyable sur ce clip !', 1),
    ('malik-diarra', 'leon-marchand', 'On y retourne ce week-end ?', 2),
    ('amelie-dubois', 'lucas-renaud', 'Yes Lucas ! Prochain step : fs lipslide.', 0),
    ('ines-garcia', 'noah-petit', 'Ton drone change tout, c''est ciné !', 1)
) AS data(commenter_username, author_username, content, days_ago)
JOIN profiles commenter ON commenter.username = data.commenter_username
JOIN profiles author ON author.username = data.author_username
JOIN latest_posts lp ON lp.user_id = author.id
ON CONFLICT DO NOTHING;

-- =============================
-- CHALLENGES & PARTICIPATION
-- =============================
INSERT INTO challenges (id, created_by, title, description, challenge_type, difficulty, prize, start_date, end_date, participants_count, is_active)
VALUES
  ('c1111111-2222-3333-4444-555555555555'::uuid, (SELECT id FROM profiles WHERE username = 'amelie-dubois'), 'Line Sunrise', 'Filmer la meilleure line au lever du soleil sur un spot emblématique.', 'community', 4, 'Mise en avant + 500 XP', now() - interval '5 days', now() + interval '5 days', 0, true),
  ('c2222222-3333-4444-5555-666666666666'::uuid, (SELECT id FROM profiles WHERE username = 'malik-diarra'), 'DIY Masterpiece', 'Construire ou améliorer un module DIY et partager le process.', 'weekly', 3, 'Pack outils SHREDLOC', now() - interval '2 days', now() + interval '12 days', 0, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO challenge_participants (challenge_id, user_id, registered_at)
SELECT
  data.challenge_id,
  p.id,
  now() - (data.days_ago || ' days')::interval
FROM (
  VALUES
    ('c1111111-2222-3333-4444-555555555555'::uuid, 'leon-marchand', 4),
    ('c1111111-2222-3333-4444-555555555555'::uuid, 'sofia-nguyen', 3),
    ('c1111111-2222-3333-4444-555555555555'::uuid, 'ines-garcia', 2),
    ('c2222222-3333-4444-5555-666666666666'::uuid, 'amelie-dubois', 1),
    ('c2222222-3333-4444-5555-666666666666'::uuid, 'camille-perrot', 1),
    ('c2222222-3333-4444-5555-666666666666'::uuid, 'noah-petit', 0)
) AS data(challenge_id, username, days_ago)
JOIN profiles p ON p.username = data.username
ON CONFLICT DO NOTHING;

INSERT INTO challenge_submissions (challenge_id, user_id, media_url, media_type, caption, votes_count, is_winner, created_at)
SELECT
  data.challenge_id,
  p.id,
  data.media_url,
  data.media_type,
  data.caption,
  data.votes_count,
  data.is_winner,
  now() - (data.days_ago || ' days')::interval
FROM (
  VALUES
    ('c1111111-2222-3333-4444-555555555555'::uuid, 'leon-marchand', 'https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg', 'video', 'Line sunrise à République', 24, false, 2),
    ('c1111111-2222-3333-4444-555555555555'::uuid, 'sofia-nguyen', 'https://images.pexels.com/photos/1624229/pexels-photo-1624229.jpeg', 'video', 'Montage golden hour', 31, true, 1),
    ('c2222222-3333-4444-5555-666666666666'::uuid, 'amelie-dubois', 'https://images.pexels.com/photos/1642053/pexels-photo-1642053.jpeg', 'photo', 'Nouveau curb bétonné', 18, false, 0),
    ('c2222222-3333-4444-5555-666666666666'::uuid, 'noah-petit', 'https://images.pexels.com/photos/3621347/pexels-photo-3621347.jpeg', 'video', 'Time lapse du shape', 21, true, 0)
) AS data(challenge_id, username, media_url, media_type, caption, votes_count, is_winner, days_ago)
JOIN profiles p ON p.username = data.username
ON CONFLICT DO NOTHING;

-- =============================
-- CONVERSATIONS & MESSAGES
-- =============================
INSERT INTO conversations (participant_1_id, participant_2_id, last_message_at, created_at)
SELECT
  p1.id,
  p2.id,
  now() - (data.last_message_days || ' days')::interval,
  now() - (data.created_days || ' days')::interval
FROM (
  VALUES
    ('amelie-dubois', 'leon-marchand', 0, 6),
    ('sofia-nguyen', 'tommy-bernard', 1, 3),
    ('ines-garcia', 'noah-petit', 0, 2)
) AS data(username1, username2, last_message_days, created_days)
JOIN profiles p1 ON p1.username = data.username1
JOIN profiles p2 ON p2.username = data.username2
ON CONFLICT (participant_1_id, participant_2_id) DO UPDATE SET
  last_message_at = EXCLUDED.last_message_at;

WITH convo AS (
  SELECT c.id, p1.username AS u1, p2.username AS u2
  FROM conversations c
  JOIN profiles p1 ON c.participant_1_id = p1.id
  JOIN profiles p2 ON c.participant_2_id = p2.id
)
INSERT INTO messages (conversation_id, sender_id, content, media_url, is_read, created_at)
SELECT
  convo.id,
  sender.id,
  data.content,
  '',
  data.is_read,
  now() - (data.days_ago || ' days')::interval
FROM (
  VALUES
    ('amelie-dubois', 'leon-marchand', 'Ready pour filmer demain matin ?', true, 1),
    ('leon-marchand', 'amelie-dubois', 'Grave ! RDV 6h45 au Trocadéro.', true, 1),
    ('sofia-nguyen', 'tommy-bernard', 'Tu peux m''envoyer les rushs VX ?', false, 0),
    ('tommy-bernard', 'sofia-nguyen', 'Yes je t''upload ça ce soir.', false, 0),
    ('ines-garcia', 'noah-petit', 'Ta session drone m''a motivée, on remet ça ?', true, 0),
    ('noah-petit', 'ines-garcia', 'Carrément, samedi nuit spot tour ?', true, 0)
) AS data(sender_username, recipient_username, content, is_read, days_ago)
JOIN profiles sender ON sender.username = data.sender_username
JOIN profiles recipient ON recipient.username = data.recipient_username
JOIN convo ON (
  (convo.u1 = data.sender_username AND convo.u2 = data.recipient_username)
  OR (convo.u1 = data.recipient_username AND convo.u2 = data.sender_username)
);

-- Update last_message_at to reflect newest inserts
UPDATE conversations c
SET last_message_at = m.created_at
FROM (
  SELECT conversation_id, MAX(created_at) AS created_at
  FROM messages
  GROUP BY conversation_id
) m
WHERE c.id = m.conversation_id;
