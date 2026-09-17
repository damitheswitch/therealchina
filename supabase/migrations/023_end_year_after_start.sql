-- =========================================================
-- 023_end_year_after_start.sql
--
-- Cross-column constraint: a review's end_year must not be
-- before its start_year when both are provided.
-- =========================================================

ALTER TABLE public.reviews
  ADD CONSTRAINT chk_reviews_end_after_start
    CHECK (end_year IS NULL OR start_year IS NULL OR end_year >= start_year);
