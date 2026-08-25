-- ============================================
-- Replace materialized view with regular table + triggers
-- ============================================

-- 1. DROP TABLE FIRST (handles re-running this migration safely)
DROP TABLE IF EXISTS university_stats CASCADE;

-- 2. Drop the materialized view (only executes if it still exists)
DROP MATERIALIZED VIEW IF EXISTS university_stats;

-- 3. Drop old triggers/functions (if they exist from a previous version)
DROP TRIGGER IF EXISTS refresh_university_stats_on_insert ON reviews;
DROP TRIGGER IF EXISTS refresh_university_stats_on_delete ON reviews;
DROP TRIGGER IF EXISTS refresh_university_stats_on_update ON reviews;
DROP TRIGGER IF EXISTS trigger_update_stats_on_insert ON reviews;
DROP TRIGGER IF EXISTS trigger_update_stats_on_delete ON reviews;
DROP TRIGGER IF EXISTS trigger_update_stats_on_update ON reviews;

DROP FUNCTION IF EXISTS refresh_university_stats();
DROP FUNCTION IF EXISTS update_university_stats_on_insert();
DROP FUNCTION IF EXISTS update_university_stats_on_delete();
DROP FUNCTION IF EXISTS update_university_stats_on_update();

-- ==========================================
-- TABLE CREATION & RLS
-- ==========================================

CREATE TABLE university_stats (
  university_id UUID PRIMARY KEY REFERENCES universities(id) ON DELETE CASCADE,
  review_count BIGINT NOT NULL DEFAULT 0,
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  has_verified_review BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_university_stats_avg_rating ON university_stats(avg_rating);
CREATE INDEX idx_university_stats_review_count ON university_stats(review_count);

ALTER TABLE university_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to university_stats"
  ON university_stats
  FOR SELECT
  TO public
  USING (true);

-- ==========================================
-- INITIAL DATA SEED
-- ==========================================

-- Temporarily disable RLS for the bulk insert
ALTER TABLE university_stats DISABLE ROW LEVEL SECURITY;

INSERT INTO university_stats (university_id, review_count, avg_rating, has_verified_review)
SELECT
  u.id AS university_id,
  COUNT(r.id) AS review_count,
  COALESCE(AVG(r.rating), 0) AS avg_rating,
  COALESCE(COUNT(CASE WHEN r.user_id IS NOT NULL THEN 1 END), 0) > 0 AS has_verified_review
FROM universities u
LEFT JOIN reviews r ON u.id = r.university_id
GROUP BY u.id
ON CONFLICT (university_id) DO NOTHING;

ALTER TABLE university_stats ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- TRIGGER FUNCTIONS (SECURITY DEFINER)
-- ==========================================

-- Trigger function to update stats on review insert
CREATE OR REPLACE FUNCTION update_university_stats_on_insert()
RETURNS TRIGGER 
SECURITY DEFINER 
SET search_path = ''  -- ✅ Most secure: prevents schema hijacking
AS $$ BEGIN
  INSERT INTO public.university_stats (university_id, review_count, avg_rating, has_verified_review)
  VALUES (
    NEW.university_id,
    1,
    NEW.rating,
    NEW.user_id IS NOT NULL
  )
  ON CONFLICT (university_id) DO UPDATE SET
    review_count = public.university_stats.review_count + 1,
    avg_rating = (
      (public.university_stats.avg_rating * public.university_stats.review_count + NEW.rating)::NUMERIC /
      (public.university_stats.review_count + 1)
    ),
    has_verified_review = public.university_stats.has_verified_review OR (NEW.user_id IS NOT NULL),
    updated_at = NOW();
  RETURN NEW;
END;
 $$ LANGUAGE plpgsql;

-- Trigger function to update stats on review delete
CREATE OR REPLACE FUNCTION update_university_stats_on_delete()
RETURNS TRIGGER 
SECURITY DEFINER 
SET search_path = ''  -- ✅ Most secure
AS $$ DECLARE
  old_rating INT;
BEGIN
  old_rating := OLD.rating;

  UPDATE public.university_stats
  SET
    review_count = GREATEST(review_count - 1, 0),
    avg_rating = CASE
      WHEN review_count <= 1 THEN 0
      ELSE ((avg_rating * review_count::numeric - old_rating) / GREATEST(review_count - 1, 1))
    END,
    has_verified_review = has_verified_review, 
    updated_at = NOW()
  WHERE university_id = OLD.university_id;
    
  RETURN OLD;
END;
 $$ LANGUAGE plpgsql;

-- Trigger function to update stats on review update (rating/verification change)
CREATE OR REPLACE FUNCTION update_university_stats_on_update()
RETURNS TRIGGER 
SECURITY DEFINER 
SET search_path = ''  -- ✅ Most secure
AS $$ BEGIN
  IF OLD.rating != NEW.rating OR (OLD.user_id IS NULL) != (NEW.user_id IS NULL) THEN
    UPDATE public.university_stats
    SET
      avg_rating = avg_rating + (NEW.rating - OLD.rating)::numeric / GREATEST(review_count, 1),
      has_verified_review = has_verified_review OR (NEW.user_id IS NOT NULL),
      updated_at = NOW()
    WHERE university_id = NEW.university_id;
  END IF;
  RETURN NEW;
END;
 $$ LANGUAGE plpgsql;

-- ==========================================
-- TRIGGER BINDINGS
-- ==========================================

CREATE TRIGGER trigger_update_stats_on_insert
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_university_stats_on_insert();

CREATE TRIGGER trigger_update_stats_on_delete
  AFTER DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_university_stats_on_delete();

CREATE TRIGGER trigger_update_stats_on_update
  AFTER UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_university_stats_on_update();