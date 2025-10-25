-- Add sponsor media kit metadata to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sponsor_media_kits jsonb;

COMMENT ON COLUMN profiles.sponsor_media_kits IS 'Array of downloadable media kit resources (label, url, format, description).';
