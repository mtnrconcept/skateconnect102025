/*
  # Create Spot Media Table

  ## Overview
  Table to store photos and videos uploaded by users for skateboarding spots.

  ## New Tables
  
  ### `spot_media`
  Media files associated with spots
  - `id` (uuid, primary key)
  - `spot_id` (uuid, references spots, required)
  - `user_id` (uuid, references profiles, required)
  - `media_url` (text, required) - URL to the media file
  - `media_type` (text, required) - 'photo' or 'video'
  - `caption` (text, optional) - User's caption for the media
  - `created_at` (timestamptz) - When media was uploaded
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on spot_media table
  - Anyone authenticated can view spot media
  - Users can only upload media with their own user_id
  - Users can update/delete only their own media
  
  ## Performance
  - Index on spot_id for fast media queries per spot
  - Index on user_id for user's media history
  - Index on created_at for chronological ordering

  ## Important Notes
  1. Cascading deletes when spot or user is deleted
  2. Media type validation to ensure only 'photo' or 'video'
  3. Automatic timestamp updates via trigger
*/

-- Create spot_media table
CREATE TABLE IF NOT EXISTS spot_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('photo', 'video')),
  caption text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE spot_media ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view spot media"
  ON spot_media FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can upload media to spots"
  ON spot_media FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own media"
  ON spot_media FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own media"
  ON spot_media FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_spot_media_spot ON spot_media(spot_id);
CREATE INDEX IF NOT EXISTS idx_spot_media_user ON spot_media(user_id);
CREATE INDEX IF NOT EXISTS idx_spot_media_created ON spot_media(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_spot_media_updated_at BEFORE UPDATE ON spot_media
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();