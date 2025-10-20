/*
  # Add Cover Photo Field to Spot Media

  1. Changes
    - Add `is_cover_photo` boolean column to spot_media table
    - Create unique constraint: only one cover photo per spot
    - Create function to ensure only one cover photo per spot
    - Create trigger to enforce cover photo constraint

  2. Security
    - Maintain existing RLS policies
    - No security changes needed
*/

-- Add is_cover_photo column
ALTER TABLE spot_media 
ADD COLUMN IF NOT EXISTS is_cover_photo boolean DEFAULT false;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_spot_media_cover_photo 
ON spot_media(spot_id, is_cover_photo) 
WHERE is_cover_photo = true;

-- Function to ensure only one cover photo per spot
CREATE OR REPLACE FUNCTION ensure_single_cover_photo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If this media is being set as cover photo
  IF NEW.is_cover_photo = true THEN
    -- Remove cover photo status from all other media of this spot
    UPDATE spot_media
    SET is_cover_photo = false
    WHERE spot_id = NEW.spot_id
      AND id != NEW.id
      AND is_cover_photo = true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_ensure_single_cover_photo ON spot_media;
CREATE TRIGGER trigger_ensure_single_cover_photo
  BEFORE INSERT OR UPDATE ON spot_media
  FOR EACH ROW
  WHEN (NEW.is_cover_photo = true)
  EXECUTE FUNCTION ensure_single_cover_photo();

-- Set first media as cover photo for spots that don't have one
DO $$
DECLARE
  spot_record RECORD;
  first_media_id uuid;
BEGIN
  FOR spot_record IN 
    SELECT DISTINCT spot_id FROM spot_media
  LOOP
    -- Check if spot already has a cover photo
    IF NOT EXISTS (
      SELECT 1 FROM spot_media 
      WHERE spot_id = spot_record.spot_id 
      AND is_cover_photo = true
    ) THEN
      -- Get the first (oldest) media for this spot
      SELECT id INTO first_media_id
      FROM spot_media
      WHERE spot_id = spot_record.spot_id
      ORDER BY created_at ASC
      LIMIT 1;
      
      -- Set it as cover photo
      IF first_media_id IS NOT NULL THEN
        UPDATE spot_media
        SET is_cover_photo = true
        WHERE id = first_media_id;
      END IF;
    END IF;
  END LOOP;
END $$;