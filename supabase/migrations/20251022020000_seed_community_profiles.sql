/*
  # Seed Additional Community Profiles

  ## Overview
  - Adds ten diverse community member profiles for richer demo interactions
  - Ensures matching auth accounts exist with confirmed credentials
  - Populates extended profile metadata used across social features
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
        "email": "leo.martinez@shredloc.test",
        "password": "SkateDemo42!",
        "username": "leo-martinez",
        "display_name": "Léo \"Switchblade\" Martinez",
        "bio": "Street technician avec un faible pour les lines en switch.",
        "avatar_url": "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "avancé",
        "stance": "switch",
        "location": "Lyon, FR",
        "sponsors": ["Decksmith", "Pulse Wheels"],
        "favorite_tricks": ["Switch Back Tail", "Half Cab Flip", "Bigspin"],
        "achievements": ["2e place Street League Lyon 2024"],
        "legacy_followers_count": 18200,
        "legacy_following_count": 850
      },
      {
        "email": "giulia.bianchi@shredloc.test",
        "password": "SkateDemo42!",
        "username": "giulia-bianchi",
        "display_name": "Giulia Bianchi",
        "bio": "Community manager pour les crews féminins italiens.",
        "avatar_url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "intermédiaire",
        "stance": "goofy",
        "location": "Rome, IT",
        "sponsors": ["Vespa Wheels"],
        "favorite_tricks": ["FS Rock", "Boneless", "Pivot Fakie"],
        "achievements": ["Organisatrice Roma Push 2023", "Ambassadrice SkateHer"],
        "legacy_followers_count": 9700,
        "legacy_following_count": 410
      },
      {
        "email": "matt.holden@shredloc.test",
        "password": "SkateDemo42!",
        "username": "matt-holden",
        "display_name": "Matt Holden",
        "bio": "Filmeur VX1000, spécialiste des spots industriels recyclés.",
        "avatar_url": "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1517837872118-66188a98212e?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "avancé",
        "stance": "regular",
        "location": "Manchester, UK",
        "sponsors": ["Grey Lens", "Northern Grip"],
        "favorite_tricks": ["BS 180 Nosegrind", "Wallride Nollie Out"],
        "achievements": ["Réalisateur de la série \"Mill Lines\""]
      },
      {
        "email": "sasha.kuznetsov@shredloc.test",
        "password": "SkateDemo42!",
        "username": "sasha-kuznetsov",
        "display_name": "Sasha Kuznetsov",
        "bio": "Rideur DIY, construit des bowls en climat glacial.",
        "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "expert",
        "stance": "goofy",
        "location": "Saint-Pétersbourg, RU",
        "sponsors": ["Frost Bearings", "North Concrete"],
        "favorite_tricks": ["Alley Oop Frontside Air", "Stalefish"],
        "achievements": ["Créateur du bowl Koldwave", "Vainqueur Siberia DIY 2024"]
      },
      {
        "email": "harper.nguyen@shredloc.test",
        "password": "SkateDemo42!",
        "username": "harper-nguyen",
        "display_name": "Harper Nguyen",
        "bio": "Coach jeunesse, focus inclusion & accessibilité.",
        "avatar_url": "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "débutant",
        "stance": "regular",
        "location": "Seattle, US",
        "sponsors": ["Northwest Skate Collective"],
        "favorite_tricks": ["Ollie North", "Shuvit"],
        "achievements": ["Programme Access Skate 2024"]
      },
      {
        "email": "zanele.mbeki@shredloc.test",
        "password": "SkateDemo42!",
        "username": "zanele-mbeki",
        "display_name": "Zanele Mbeki",
        "bio": "Photographe et curatrice d'expositions skate en plein air.",
        "avatar_url": "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "intermédiaire",
        "stance": "switch",
        "location": "Johannesburg, ZA",
        "sponsors": ["Ubuntu Wheels", "Nightlight Gallery"],
        "favorite_tricks": ["No Comply", "FS Shuvit"],
        "achievements": ["Expo Ride The City 2023", "Mentor SheShreds Africa"],
        "legacy_followers_count": 6400,
        "legacy_following_count": 520
      },
      {
        "email": "bruno.moreira@shredloc.test",
        "password": "SkateDemo42!",
        "username": "bruno-moreira",
        "display_name": "Bruno Moreira",
        "bio": "Animateur radio & commentateur de contests sud-américains.",
        "avatar_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "avancé",
        "stance": "regular",
        "location": "Porto Alegre, BR",
        "sponsors": ["Radio Drop", "Sunset Bearings"],
        "favorite_tricks": ["BS Noseblunt", "Impossible"],
        "achievements": ["Voix officielle Porto Alegre Open"]
      },
      {
        "email": "noor.faraj@shredloc.test",
        "password": "SkateDemo42!",
        "username": "noor-faraj",
        "display_name": "Noor Faraj",
        "bio": "Ingénieure lumière et rideuse nocturne.",
        "avatar_url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1517837872118-66188a98212e?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "intermédiaire",
        "stance": "goofy",
        "location": "Dubaï, AE",
        "sponsors": ["Neon Ride"],
        "favorite_tricks": ["Night Powerslide", "Kickflip"],
        "achievements": ["Designer du spot Glow Plaza"]
      },
      {
        "email": "isaac.johnson@shredloc.test",
        "password": "SkateDemo42!",
        "username": "isaac-johnson",
        "display_name": "Isaac Johnson",
        "bio": "Builder & skate dad, construit des mini-ramps dans les écoles.",
        "avatar_url": "https://images.unsplash.com/photo-1520970014086-2208d157c9e2?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "intermédiaire",
        "stance": "regular",
        "location": "Austin, US",
        "sponsors": ["RampRise"],
        "favorite_tricks": ["Smith Grind", "Tail Stall"],
        "achievements": ["Bâtisseur Schoolyard Ramps"],
        "legacy_followers_count": 4200,
        "legacy_following_count": 300
      },
      {
        "email": "mei.lin@shredloc.test",
        "password": "SkateDemo42!",
        "username": "mei-lin",
        "display_name": "Mei Lin",
        "bio": "Chercheuse en matériaux, teste des boards biosourcées.",
        "avatar_url": "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "avancé",
        "stance": "switch",
        "location": "Taipei, TW",
        "sponsors": ["GreenFlex Labs", "Urban Glide"],
        "favorite_tricks": ["Nollie 360", "Tail Slide"],
        "achievements": ["Brevet board fibre de bambou", "Conférencière EcoRide 2024"],
        "legacy_followers_count": 15800,
        "legacy_following_count": 1020
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
