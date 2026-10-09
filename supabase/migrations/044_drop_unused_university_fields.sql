-- 044_drop_unused_university_fields.sql
--
-- universities.uni_type and universities.languages_of_instruction were
-- populated only for the 12-row dev seed fixture and are never rendered
-- anywhere in the app. Dead columns: drop them.
--
-- Deploy order matters: the frontend select lists must stop requesting
-- these columns before this migration lands on an environment, otherwise
-- PostgREST 400s on the unknown column. Apply only after the matching
-- frontend change is deployed to that env.

ALTER TABLE public.universities
  DROP COLUMN IF EXISTS uni_type,
  DROP COLUMN IF EXISTS languages_of_instruction;
