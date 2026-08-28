-- ============================================
-- TRC Database Migration: Fix University Stats Triggers
-- Run this in your Supabase SQL Editor
-- ============================================

-- Recalculate cached stats from reviews so rating, count, and verification
-- status stay correct after inserts, updates, deletes, and reassignment.
CREATE OR REPLACE FUNCTION public.refresh_university_stats(p_university_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.university_stats (
    university_id,
    review_count,
    avg_rating,
    has_verified_review,
    updated_at
  )
  SELECT
    p_university_id,
    COUNT(*)::BIGINT,
    COALESCE(AVG(r.rating), 0)::NUMERIC(3,2),
    COALESCE(BOOL_OR(r.user_id IS NOT NULL), FALSE),
    NOW()
  FROM public.reviews AS r
  WHERE r.university_id = p_university_id
  ON CONFLICT (university_id) DO UPDATE SET
    review_count = EXCLUDED.review_count,
    avg_rating = EXCLUDED.avg_rating,
    has_verified_review = EXCLUDED.has_verified_review,
    updated_at = EXCLUDED.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_university_stats_on_insert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.refresh_university_stats(NEW.university_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_university_stats_on_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.refresh_university_stats(OLD.university_id);

  IF NEW.university_id IS DISTINCT FROM OLD.university_id THEN
    PERFORM public.refresh_university_stats(NEW.university_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_university_stats_on_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.refresh_university_stats(OLD.university_id);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Repair any stats cached by the previous trigger logic.
SELECT public.refresh_university_stats(id)
FROM public.universities;

NOTIFY pgrst, 'reload schema';
