/*
  # Seed Additional Fake Test Profiles

  ## Overview
  - Adds a batch of fake community profiles used for interaction testing
  - Creates matching auth accounts with confirmed emails for immediate login
  - Populates rich profile metadata (location, sponsors, favorite tricks)

  ## Notes
  - Demo accounts share the password `SkateDemo42!`
  - Script is idempotent thanks to conflict handling on auth.users and profiles
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
        "email": "celine.roux@shredloc.test",
        "password": "SkateDemo42!",
        "username": "celine-roux",
        "display_name": "Céline \"Roots\" Roux",
        "bio": "Organisatrice de sessions communautaires et chasseuse de spots verts.",
        "avatar_url": "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1517837872118-66188a98212e?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "intermédiaire",
        "stance": "goofy",
        "location": "Marseille, FR",
        "sponsors": ["SouthBay Trucks"],
        "favorite_tricks": ["FS 5050", "Early Grab", "Boneless"],
        "achievements": ["Fondatrice du collectif Roots & Rails", "Coordinatrice Ride Like A Girl 2024"]
      },
      {
        "email": "adrien.pivot@shredloc.test",
        "password": "SkateDemo42!",
        "username": "adrien-pivot",
        "display_name": "Adrien Pivot",
        "bio": "Data analyst le jour, nose manuals la nuit. Amateur de spots cachés.",
        "avatar_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "avancé",
        "stance": "regular",
        "location": "Lille, FR",
        "sponsors": ["Northern Bearings", "DataDeck"],
        "favorite_tricks": ["Nose Manual Nollie Flip", "Switch Heelflip", "FS Crooked"],
        "achievements": ["Vainqueur Tech Lines Lille 2023", "Finaliste Game Of SKATE Nord"]
      },
      {
        "email": "amira.elmasri@shredloc.test",
        "password": "SkateDemo42!",
        "username": "amira-elmasri",
        "display_name": "Amira El Masri",
        "bio": "Filmeuse & éditrice, je capture les crews émergents du Maghreb.",
        "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "intermédiaire",
        "stance": "regular",
        "location": "Casablanca, MA",
        "sponsors": ["Atlas Lens"],
        "favorite_tricks": ["BS Boardslide", "Shuvit", "Wallride"],
        "achievements": ["Documentaire \"Maghreb Push\" 2024", "Membre Skate Féminin Maroc"]
      },
      {
        "email": "nils.fischer@shredloc.test",
        "password": "SkateDemo42!",
        "username": "nils-fischer",
        "display_name": "Nils Fischer",
        "bio": "DIY engineer. Je construit des corners modulaires pour les contests locaux.",
        "avatar_url": "https://images.unsplash.com/photo-1520970014086-2208d157c9e2?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "expert",
        "stance": "regular",
        "location": "Hambourg, DE",
        "sponsors": ["Werkstatt Tools", "Concrete Pulse"],
        "favorite_tricks": ["BS Smith", "Wallie 180", "Madonna"],
        "achievements": ["Architecte DIY Hafen Jam", "Consultant SkatePark Build Lab"]
      },
      {
        "email": "maeva.tan@shredloc.test",
        "password": "SkateDemo42!",
        "username": "maeva-tan",
        "display_name": "Maeva Tan",
        "bio": "Product designer & longboardeuse — focus sur le flow et la narration.",
        "avatar_url": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
        "cover_url": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80",
        "skill_level": "intermédiaire",
        "stance": "switch",
        "location": "Montréal, CA",
        "sponsors": ["FlowState Boards"],
        "favorite_tricks": ["Switch Bigspin", "Powerslide", "Nose Grab"],
        "achievements": ["Conférencière Design & Ride 2024", "Créatrice série \"Fluid Narratives\""]
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
      updated_at = now();
  END LOOP;
END $$;
