/*
  # Spot Cover Photo Management Function

  - Adds security-definer function to set a spot's cover photo
  - Only the spot creator can change the cover photo
  - Ensures selected media belongs to the spot
*/
CREATE OR REPLACE FUNCTION set_spot_cover_photo(p_spot_id uuid, p_media_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT created_by
  INTO owner_id
  FROM spots
  WHERE id = p_spot_id;

  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Spot not found';
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM spot_media
    WHERE id = p_media_id
      AND spot_id = p_spot_id
  ) THEN
    RAISE EXCEPTION 'Media does not belong to the specified spot';
  END IF;

  UPDATE spot_media
  SET is_cover_photo = false
  WHERE spot_id = p_spot_id
    AND id <> p_media_id
    AND is_cover_photo = true;

  UPDATE spot_media
  SET is_cover_photo = true
  WHERE id = p_media_id
    AND spot_id = p_spot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Media not found for spot';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION set_spot_cover_photo(uuid, uuid) TO authenticated;
