-- Add review support and rating stats for spots
ALTER TABLE spot_ratings
  ADD COLUMN IF NOT EXISTS comment text CHECK (char_length(comment) <= 280);

ALTER TABLE spot_ratings
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE spots
  ADD COLUMN IF NOT EXISTS rating_average numeric(4,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_distribution jsonb DEFAULT '{"1":0,"2":0,"3":0,"4":0,"5":0}';

UPDATE spots
SET
  rating_average = COALESCE(rating_average, 0),
  rating_count = COALESCE(rating_count, 0),
  rating_distribution = COALESCE(rating_distribution, '{"1":0,"2":0,"3":0,"4":0,"5":0}'::jsonb);

UPDATE spots s
SET
  rating_average = data.avg_rating,
  rating_count = data.rating_count,
  rating_distribution = data.rating_distribution
FROM (
  SELECT
    spot_id,
    ROUND(AVG(rating)::numeric, 2) AS avg_rating,
    COUNT(*) AS rating_count,
    jsonb_build_object(
      '1', COUNT(*) FILTER (WHERE rating = 1),
      '2', COUNT(*) FILTER (WHERE rating = 2),
      '3', COUNT(*) FILTER (WHERE rating = 3),
      '4', COUNT(*) FILTER (WHERE rating = 4),
      '5', COUNT(*) FILTER (WHERE rating = 5)
    ) AS rating_distribution
  FROM spot_ratings
  GROUP BY spot_id
) AS data
WHERE s.id = data.spot_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'spot_ratings'
      AND policyname = 'Users can delete own ratings'
  ) THEN
    CREATE POLICY "Users can delete own ratings"
      ON spot_ratings FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS update_spot_ratings_updated_at ON spot_ratings;
CREATE TRIGGER update_spot_ratings_updated_at
  BEFORE UPDATE ON spot_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION refresh_spot_rating_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_spot uuid;
  stats RECORD;
BEGIN
  target_spot := COALESCE(NEW.spot_id, OLD.spot_id);

  IF target_spot IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    spot_id,
    ROUND(AVG(rating)::numeric, 2) AS avg_rating,
    COUNT(*) AS rating_count,
    jsonb_build_object(
      '1', COUNT(*) FILTER (WHERE rating = 1),
      '2', COUNT(*) FILTER (WHERE rating = 2),
      '3', COUNT(*) FILTER (WHERE rating = 3),
      '4', COUNT(*) FILTER (WHERE rating = 4),
      '5', COUNT(*) FILTER (WHERE rating = 5)
    ) AS rating_distribution
  INTO stats
  FROM spot_ratings
  WHERE spot_id = target_spot
  GROUP BY spot_id;

  IF stats IS NULL THEN
    UPDATE spots
    SET
      rating_average = 0,
      rating_count = 0,
      rating_distribution = '{"1":0,"2":0,"3":0,"4":0,"5":0}'::jsonb,
      updated_at = now()
    WHERE id = target_spot;
  ELSE
    UPDATE spots
    SET
      rating_average = COALESCE(stats.avg_rating, 0),
      rating_count = stats.rating_count,
      rating_distribution = stats.rating_distribution,
      updated_at = now()
    WHERE id = target_spot;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS spot_ratings_after_insert ON spot_ratings;
CREATE TRIGGER spot_ratings_after_insert
  AFTER INSERT ON spot_ratings
  FOR EACH ROW
  EXECUTE FUNCTION refresh_spot_rating_stats();

DROP TRIGGER IF EXISTS spot_ratings_after_update ON spot_ratings;
CREATE TRIGGER spot_ratings_after_update
  AFTER UPDATE ON spot_ratings
  FOR EACH ROW
  EXECUTE FUNCTION refresh_spot_rating_stats();

DROP TRIGGER IF EXISTS spot_ratings_after_delete ON spot_ratings;
CREATE TRIGGER spot_ratings_after_delete
  AFTER DELETE ON spot_ratings
  FOR EACH ROW
  EXECUTE FUNCTION refresh_spot_rating_stats();
