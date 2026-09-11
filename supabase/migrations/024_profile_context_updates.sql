-- =========================================================
-- 024_profile_context_updates.sql
--
-- Repurpose profiles.journey_stage -> current_status (what the
-- user is doing now, not where they are in the China journey)
-- and turn languages_spoken into a multi-value array.
-- =========================================================

ALTER TABLE public.profiles
  RENAME COLUMN journey_stage TO current_status;

-- Old column-level CHECK keeps its auto name after the rename;
-- drop whichever name it ended up with, then re-add.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_journey_stage_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_current_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_current_status_check
    CHECK (current_status IS NULL OR current_status IN
      ('studying','working','internship','job_hunting','break','other'));

ALTER TABLE public.profiles
  ALTER COLUMN languages_spoken TYPE TEXT[]
    USING (CASE
      WHEN languages_spoken IS NULL THEN NULL
      ELSE string_to_array(languages_spoken, ',')
    END);
ALTER TABLE public.profiles
  ALTER COLUMN languages_spoken SET DEFAULT '{}';
