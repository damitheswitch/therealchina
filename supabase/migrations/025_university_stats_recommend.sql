-- =========================================================
-- 025_university_stats_recommend.sql
--
-- Add recommend-yes/maybe/no counts to university_stats so
-- listing cards can show a "👍 X% recommend" pill without
-- touching the reviews table. Counts (not a stored %) keep
-- presentation flexible and honest.
-- =========================================================

ALTER TABLE public.university_stats
  ADD COLUMN IF NOT EXISTS recommend_yes_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recommend_maybe_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recommend_no_count BIGINT NOT NULL DEFAULT 0;

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
    recommend_yes_count,
    recommend_maybe_count,
    recommend_no_count,
    updated_at
  )
  SELECT
    p_university_id,
    COUNT(*)::BIGINT,
    COALESCE(AVG(r.rating), 0)::NUMERIC(3,2),
    COALESCE(BOOL_OR(r.user_id IS NOT NULL), FALSE),
    COUNT(*) FILTER (WHERE r.recommend = 'yes'),
    COUNT(*) FILTER (WHERE r.recommend = 'maybe'),
    COUNT(*) FILTER (WHERE r.recommend = 'no'),
    NOW()
  FROM public.reviews AS r
  WHERE r.university_id = p_university_id
  ON CONFLICT (university_id) DO UPDATE SET
    review_count = EXCLUDED.review_count,
    avg_rating = EXCLUDED.avg_rating,
    has_verified_review = EXCLUDED.has_verified_review,
    recommend_yes_count = EXCLUDED.recommend_yes_count,
    recommend_maybe_count = EXCLUDED.recommend_maybe_count,
    recommend_no_count = EXCLUDED.recommend_no_count,
    updated_at = EXCLUDED.updated_at;
END;
$$;

-- Backfill ONLY universities that have reviews — preserves the existing
-- "stats row exists only after first review" semantics and avoids ~900
-- zero-rows that would subtly change LEFT-JOIN/nullsFirst ordering.
SELECT public.refresh_university_stats(u.id)
FROM public.universities u
WHERE EXISTS (
  SELECT 1 FROM public.reviews r WHERE r.university_id = u.id
);
