-- 035_reviews_soft_delete.sql
-- Users can edit and delete their own reviews through the review-manage Edge
-- Function (service role; ownership checked against the verified JWT).
-- Deletion is soft: the row stays for moderation/audit, but RLS makes
-- soft-deleted reviews invisible to every client read path. No UPDATE or
-- DELETE policies are added on purpose — there is intentionally no direct
-- write path to reviews from any client.

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Review listings always filter to active rows; the partial index keeps those
-- scans small even as the soft-deleted tail grows.
CREATE INDEX IF NOT EXISTS idx_reviews_university_active
  ON public.reviews(university_id)
  WHERE deleted_at IS NULL;

DROP POLICY IF EXISTS "Public read access to reviews" ON public.reviews;
CREATE POLICY "Public read access to reviews"
  ON public.reviews FOR SELECT
  TO public
  USING (deleted_at IS NULL);

-- Aggregate stats must ignore soft-deleted rows. Soft delete runs as UPDATE,
-- which the existing trigger_update_stats_on_update already routes through
-- this function — the filter is the only change needed.
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
    AND r.deleted_at IS NULL
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
