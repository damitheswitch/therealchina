-- ============================================
-- TRC 012: Authenticated member-profiles view
-- Expose non-sensitive profile columns to authenticated users
-- for the User Directory and other users' profile pages.
--
-- Definer (non-invoker) mode bypasses the own-row-only SELECT
-- policy on the underlying profiles table while still restricting
-- the granted role to authenticated.
-- Safe to re-run: every statement is idempotent.
-- ============================================

DROP VIEW IF EXISTS member_profiles;

CREATE VIEW member_profiles AS
SELECT
  id,
  display_name,
  avatar_url,
  location,
  university,
  program,
  bio,
  show_social_handle,
  social_platform,
  social_handle,
  social_handles,
  is_discoverable,
  onboarding_completed,
  created_at,
  updated_at
FROM profiles
WHERE display_name IS NOT NULL;

GRANT SELECT ON member_profiles TO authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ============================================
-- COMPLETED
-- ============================================
