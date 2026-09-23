-- 028_university_rankings.sql
--
-- Adds a flexible `rankings` JSONB column to universities. One column instead
-- of one-per-source so future ranking providers (QS, THE, ARWU) don't need
-- more schema churn. Shape: { "<source_key>": <rank:int> }, e.g.
--   {"shanghai_national": 1, "arwu_world": 22}
-- Empty object = no ranking data; UI renders the row only when a known key
-- is present.

ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS rankings JSONB NOT NULL DEFAULT '{}'::jsonb;
