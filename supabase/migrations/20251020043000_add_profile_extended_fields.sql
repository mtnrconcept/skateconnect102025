/*
  # Add Extended Profile Fields

  ## Overview
  - Adds optional profile metadata columns to store rich rider details
  - Enables storing showcase follower/following counts migrated from Bolt
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS location text DEFAULT '',
  ADD COLUMN IF NOT EXISTS sponsors text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS favorite_tricks text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS achievements text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS legacy_followers_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS legacy_following_count integer DEFAULT 0;

-- Ensure existing rows have non-null arrays
UPDATE profiles
SET
  sponsors = COALESCE(sponsors, '{}'),
  favorite_tricks = COALESCE(favorite_tricks, '{}'),
  achievements = COALESCE(achievements, '{}'),
  legacy_followers_count = COALESCE(legacy_followers_count, 0),
  legacy_following_count = COALESCE(legacy_following_count, 0)
WHERE true;
