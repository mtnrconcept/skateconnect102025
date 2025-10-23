/*
  # Seed Bolt Legacy Athlete Profiles

  ## Overview
  - Creates the showcase riders that previously lived in the Bolt dataset
  - Migrates their extended profile metadata, XP and social graph
  - Publishes their hero posts so they appear in the global feed
*/

DO $$
DECLARE
  rec RECORD;
  user_data jsonb;
  new_user_id uuid;
BEGIN
  FOR rec IN
    SELECT *
    FROM jsonb_to_recordset($$[
      {
        "email": "aurora.martinez@shredloc.test",
        "password": "SkateDemo42!",
        "username": "aurora_slide",
        "display_name": "Aurora “Slide” Martinez",
        "bio": "Filmer, voyager, partager les vibes des spots les plus créatifs d'Europe.",
        "avatar_url": "https://images.unsplash.com/photo-1502462041640-b3d7e50d0660?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1519861051841-16c69bc5d0c6?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "avancé",
        "stance": "goofy",
        "location": "Barcelone, ES",
        "legacy_followers": 18320,
        "legacy_following": 412,
        "sponsors": ["Solstice Wheels", "Atlas Bearings"],
        "favorite_tricks": ["FS Nosegrind", "Wallride", "No-Comply 180"],
        "achievements": ["Vainqueur Urban Lines 2023", "Clip de l'année · EuroSkate Mag"]
      },
      {
        "email": "keita.flow@shredloc.test",
        "password": "SkateDemo42!",
        "username": "keita.flow",
        "display_name": "Keita Flow",
        "bio": "Street skater parisien — adepte des lines fluides et des sessions sunrise.",
        "avatar_url": "https://images.unsplash.com/photo-1501250987900-211872d97eaa?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "intermédiaire",
        "stance": "regular",
        "location": "Paris, FR",
        "legacy_followers": 9420,
        "legacy_following": 288,
        "sponsors": ["Drift Deck Co."],
        "favorite_tricks": ["Manual combos", "BS Tailslide", "360 Flip"],
        "achievements": ["Finaliste Cash For Tricks République", "Ambassadeur Skate4All"]
      },
      {
        "email": "ivy.loop@shredloc.test",
        "password": "SkateDemo42!",
        "username": "ivy.loop",
        "display_name": "Ivy Loop",
        "bio": "Filmer et rideuse — spotlight sur les crews féminins & queer.",
        "avatar_url": "https://images.unsplash.com/photo-1517254451971-0829fc3c3e47?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1511910849309-0cd922d74902?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "avancé",
        "stance": "switch",
        "location": "Berlin, DE",
        "legacy_followers": 15280,
        "legacy_following": 501,
        "sponsors": ["Night Owl Apparel", "Motion Lens"],
        "favorite_tricks": ["BS Disaster", "Layback Air", "Boneless"],
        "achievements": ["Organisatrice Berlin Push 2024", "Featured · Concrete Dreams"]
      },
      {
        "email": "tom.slice@shredloc.test",
        "password": "SkateDemo42!",
        "username": "tom.slice",
        "display_name": "Tom “Slice” Nguyen",
        "bio": "Obsédé par les spots DIY & les sessions nocturnes sous les ponts.",
        "avatar_url": "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1498593551527-54546b72b1c0?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "expert",
        "stance": "goofy",
        "location": "Lyon, FR",
        "legacy_followers": 20890,
        "legacy_following": 189,
        "sponsors": ["Concrete Pulse", "NightLight"],
        "favorite_tricks": ["BS Smith Grind", "Hardflip", "Wallie"],
        "achievements": ["Best Trick · DIY Lyon Jam", "Coach invité · Night Session Camp"]
      },
      {
        "email": "sahana.rides@shredloc.test",
        "password": "SkateDemo42!",
        "username": "sahana_rides",
        "display_name": "Sahana Rides",
        "bio": "Rideuse itinérante — spots du monde et tricks minimalistes.",
        "avatar_url": "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1477414348463-c0eb7f1359b6?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "intermédiaire",
        "stance": "regular",
        "location": "Lisbonne, PT",
        "legacy_followers": 12450,
        "legacy_following": 340,
        "sponsors": ["Flow State Boards"],
        "favorite_tricks": ["Shuvit", "No-Comply 360", "Body Varial"],
        "achievements": ["Podcast \"Ride The World\"", "Guide · Spots cachés de Lisbonne"]
      }
    ]$$::jsonb) AS (
      email text,
      password text,
      username text,
      display_name text,
      bio text,
      avatar_url text,
      cover_url text,
      skill_level text,
      stance text,
      location text,
      legacy_followers int,
      legacy_following int,
      sponsors jsonb,
      favorite_tricks jsonb,
      achievements jsonb
    )
  LOOP
    SELECT id INTO new_user_id FROM auth.users WHERE email = rec.email;

    IF new_user_id IS NULL THEN
      user_data := auth.create_user(
        jsonb_build_object(
          'email', rec.email,
          'password', rec.password,
          'email_confirm', true
        )
      );
      new_user_id := (user_data->>'id')::uuid;
    END IF;

    INSERT INTO profiles (
      id,
      username,
      display_name,
      bio,
      avatar_url,
      cover_url,
      skill_level,
      stance,
      location,
      sponsors,
      favorite_tricks,
      achievements,
      legacy_followers_count,
      legacy_following_count,
      updated_at
    )
    VALUES (
      new_user_id,
      rec.username,
      rec.display_name,
      rec.bio,
      COALESCE(rec.avatar_url, ''),
      COALESCE(rec.cover_url, ''),
      COALESCE(rec.skill_level, 'intermédiaire'),
      COALESCE(rec.stance, 'regular'),
      COALESCE(rec.location, ''),
      CASE
        WHEN rec.sponsors IS NULL THEN '{}'::text[]
        ELSE ARRAY(SELECT jsonb_array_elements_text(rec.sponsors))
      END,
      CASE
        WHEN rec.favorite_tricks IS NULL THEN '{}'::text[]
        ELSE ARRAY(SELECT jsonb_array_elements_text(rec.favorite_tricks))
      END,
      CASE
        WHEN rec.achievements IS NULL THEN '{}'::text[]
        ELSE ARRAY(SELECT jsonb_array_elements_text(rec.achievements))
      END,
      COALESCE(rec.legacy_followers, 0),
      COALESCE(rec.legacy_following, 0),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      username = EXCLUDED.username,
      display_name = EXCLUDED.display_name,
      bio = EXCLUDED.bio,
      avatar_url = EXCLUDED.avatar_url,
      cover_url = EXCLUDED.cover_url,
      skill_level = EXCLUDED.skill_level,
      stance = EXCLUDED.stance,
      location = EXCLUDED.location,
      sponsors = EXCLUDED.sponsors,
      favorite_tricks = EXCLUDED.favorite_tricks,
      achievements = EXCLUDED.achievements,
      legacy_followers_count = EXCLUDED.legacy_followers_count,
      legacy_following_count = EXCLUDED.legacy_following_count,
      updated_at = now();
  END LOOP;
END $$;

-- =============================
-- XP & LEADERBOARD DATA
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
    ('aurora_slide', 6180, 11, 920, 'Light Rail Visionnaire'),
    ('keita.flow', 4320, 8, 580, 'Paris Flowstate'),
    ('ivy.loop', 5640, 10, 860, 'Storyline Architect'),
    ('tom.slice', 6020, 11, 940, 'DIY Night Shaper'),
    ('sahana_rides', 3980, 8, 540, 'Globe Trotter')
) AS data(username, total_xp, current_level, xp_to_next_level, level_title)
  ON p.username = data.username
ON CONFLICT (user_id) DO UPDATE SET
  total_xp = EXCLUDED.total_xp,
  current_level = EXCLUDED.current_level,
  xp_to_next_level = EXCLUDED.xp_to_next_level,
  level_title = EXCLUDED.level_title,
  updated_at = now();

-- =============================
-- FEED POSTS
-- =============================
INSERT INTO posts (
  id,
  user_id,
  content,
  media_urls,
  spot_id,
  post_type,
  likes_count,
  comments_count,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  p.id,
  data.content,
  data.media_urls::jsonb,
  NULL,
  data.post_type,
  data.likes_count,
  data.comments_count,
  now() - (data.days_ago || ' days')::interval,
  now() - (data.days_ago || ' days')::interval
FROM profiles p
JOIN (
  VALUES
    ('aurora_slide', 'Session sunrise à la plaza de la Universitat. Deux lines filmées pour la prochaine part, vibes incroyables avec le crew local! ☀️🛹', '["https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=1000&q=80"]', 'photo', 1284, 42, 1),
    ('keita.flow', 'Line improvisée sur les blocs de République — manual combo + flip out. Qui est chaud pour filmer ce soir? 🎥', '["https://images.unsplash.com/photo-1531986733711-de47444e2e1f?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80"]', 'photo', 876, 31, 2),
    ('ivy.loop', 'On a transformé ce toit en mini-bowl pour le crew Berlin Push. Merci à tou.te.s pour l’énergie, part complète en montage! 💾', '["https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=1000&q=80"]', 'photo', 1420, 65, 3),
    ('tom.slice', 'Nouveau module DIY coulé hier soir sous le pont de la Mulatière. Venez tester ce curb raw! 🧱', '["https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=80"]', 'photo', 990, 28, 4),
    ('sahana_rides', 'Petit tour des spots cachés de l’Alfama — rien de tel que les pavés pour bosser le flow. Nouvelle carte des spots dispo demain! 🗺️', '["https://images.unsplash.com/photo-1468645547353-56d325bb57ff?auto=format&fit=crop&w=1000&q=80"]', 'photo', 654, 17, 5),
    ('aurora_slide', 'Première du docu “Lines of Light” demain à Barcelone. Merci à tout le monde pour le support, hâte de partager ça! 🎬', '[]', 'text', 532, 12, 6)
) AS data(username, content, media_urls, post_type, likes_count, comments_count, days_ago)
  ON p.username = data.username
WHERE NOT EXISTS (
  SELECT 1
  FROM posts existing
  WHERE existing.user_id = p.id
    AND existing.content = data.content
);

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
    ('aurora_slide', 'keita.flow', 7),
    ('aurora_slide', 'ivy.loop', 6),
    ('keita.flow', 'aurora_slide', 4),
    ('keita.flow', 'tom.slice', 5),
    ('ivy.loop', 'aurora_slide', 3),
    ('ivy.loop', 'sahana_rides', 2),
    ('tom.slice', 'aurora_slide', 6),
    ('tom.slice', 'keita.flow', 5),
    ('sahana_rides', 'aurora_slide', 4),
    ('sahana_rides', 'ivy.loop', 3)
) AS data(follower_username, following_username, days_ago)
JOIN profiles follower ON follower.username = data.follower_username
JOIN profiles following ON following.username = data.following_username
ON CONFLICT DO NOTHING;
