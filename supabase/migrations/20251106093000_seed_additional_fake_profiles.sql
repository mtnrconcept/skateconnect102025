/*
  # Seed Faux Profils Supplémentaires

  ## Objectif
  - Ajoute un lot de profils factices pour les scénarios d'interactions sociales
  - Crée les comptes Auth correspondants avec e-mails confirmés
  - Renseigne les métadonnées étendues (localisation, sponsors, tricks favoris)

  ## Notes
  - Tous les comptes utilisent le mot de passe `SkateDemo42!`
  - Le script est idempotent via les upserts sur `auth.users` et `profiles`
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
        "email": "ines.moreau@shredloc.test",
        "password": "SkateDemo42!",
        "username": "ines-moreau",
        "display_name": "Inès \"Slidewave\" Moreau",
        "bio": "Rideuse lyonnaise qui documente chaque session en Super 8.",
        "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "intermédiaire",
        "stance": "goofy",
        "location": "Lyon, FR",
        "sponsors": ["SlideTape", "FilmLab"],
        "favorite_tricks": ["Wallride", "FS 5-0", "No Comply 180"],
        "achievements": ["Curatrice Expo Super 8 Lines"],
        "legacy_followers_count": 6200,
        "legacy_following_count": 540
      },
      {
        "email": "mohamed.saidi@shredloc.test",
        "password": "SkateDemo42!",
        "username": "moh-saidi",
        "display_name": "Mohamed Saïdi",
        "bio": "Ingé son & DJ — mixe les sessions nocturnes du crew Desert Push.",
        "avatar_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "avancé",
        "stance": "regular",
        "location": "Ouarzazate, MA",
        "sponsors": ["NightShift Audio"],
        "favorite_tricks": ["BS Tail", "Switch Frontside Flip"],
        "achievements": ["Organisateur Desert Push Jam 2024", "Sound designer Mirage Lines"],
        "legacy_followers_count": 8800,
        "legacy_following_count": 710
      },
      {
        "email": "kaia.larsen@shredloc.test",
        "password": "SkateDemo42!",
        "username": "kaia-larsen",
        "display_name": "Kaia Larsen",
        "bio": "Rideuse nordique spécialisée en transition et en design de parks modulaires.",
        "avatar_url": "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "expert",
        "stance": "regular",
        "location": "Oslo, NO",
        "sponsors": ["Fjord Decks", "Aurora Wheels"],
        "favorite_tricks": ["Stalefish", "Lien Air", "Invert"],
        "achievements": ["Designer du skatepark modulable Polar Flow"],
        "legacy_followers_count": 15200,
        "legacy_following_count": 940
      },
      {
        "email": "liam.ortiz@shredloc.test",
        "password": "SkateDemo42!",
        "username": "liam-ortiz",
        "display_name": "Liam Ortiz",
        "bio": "Coach adaptive skate, crée des setups personnalisés pour riders handisport.",
        "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "intermédiaire",
        "stance": "switch",
        "location": "San Diego, US",
        "sponsors": ["Adaptive Motion", "Unity Trucks"],
        "favorite_tricks": ["Manual to Nose Manual", "Half Cab", "Boardslide"],
        "achievements": ["Fondateur Adaptive Sessions", "Speaker Access Skate Summit"],
        "legacy_followers_count": 5400,
        "legacy_following_count": 460
      },
      {
        "email": "sumi.ando@shredloc.test",
        "password": "SkateDemo42!",
        "username": "sumi-ando",
        "display_name": "Sumi Ando",
        "bio": "Illustratrice & rideuse, transforme les tricks en prints minimalistes.",
        "avatar_url": "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "débutant",
        "stance": "regular",
        "location": "Kyoto, JP",
        "sponsors": ["Linework Studio"],
        "favorite_tricks": ["Shuvit", "No Comply"],
        "achievements": ["Créatrice de la série d'affiches Trick Shapes"],
        "legacy_followers_count": 3100,
        "legacy_following_count": 290
      },
      {
        "email": "yara.silva@shredloc.test",
        "password": "SkateDemo42!",
        "username": "yara-silva",
        "display_name": "Yara Silva",
        "bio": "Documentariste brésilienne — raconte les crews féminins de la côte nord.",
        "avatar_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "avancé",
        "stance": "goofy",
        "location": "Fortaleza, BR",
        "sponsors": ["Maré Films", "Atlântico Bearings"],
        "favorite_tricks": ["FS Rock", "Layback", "Kickflip"],
        "achievements": ["Réalisatrice du docu Maré em Movimento", "Mentor Surf & Skate Collective"],
        "legacy_followers_count": 11700,
        "legacy_following_count": 860
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
      sponsors jsonb,
      favorite_tricks jsonb,
      achievements jsonb,
      legacy_followers_count integer,
      legacy_following_count integer
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
      COALESCE(rec.legacy_followers_count, 0),
      COALESCE(rec.legacy_following_count, 0),
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
