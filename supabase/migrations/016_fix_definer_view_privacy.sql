-- ============================================
-- TRC 016: Fix definer-view privacy filters
-- ============================================
--
-- Supabase's security advisor flags `profile_public`, `member_profiles` and
-- `flight_listings_with_profile` because they are SECURITY DEFINER views.
--
-- This is NOT a bug introduced by migration 015. These views are intentionally
-- SECURITY DEFINER because the underlying `profiles` table has an own-row-only
-- SELECT policy (`auth.uid() = id`). Without definer mode, the views could not
-- read other users' profiles and would be empty, breaking:
--   - public author attribution (profile_public)
--   - the authenticated user directory (member_profiles)
--   - flight listing owner details (flight_listings_with_profile)
--
-- The real security risk of a definer view is over-exposure: it can bypass RLS
-- and leak rows the owner did not intend to share. The previous view definitions
-- were not enforcing the user's privacy settings:
--   - is_discoverable
--   - onboarding_completed
--   - show_social_handle
--
-- This migration keeps the definer mode (which is required for the features) but
-- adds the missing privacy filters to the view definitions. The scanner may still
-- display a generic "SECURITY DEFINER" alert, but the actual exposure is now
-- controlled.
--
-- Safe to re-run: every statement is idempotent.
-- ============================================

-- 1. profile_public: public author attribution.
--    Only show users who have a display name, completed onboarding, and are
--    discoverable. (If you later decide non-discoverable users should still be
--    shown as authors, remove the `AND is_discoverable = true` line.)
DROP VIEW IF EXISTS profile_public;
CREATE VIEW profile_public AS
SELECT
  id,
  display_name,
  avatar_url
FROM profiles
WHERE display_name IS NOT NULL
  AND is_discoverable = true
  AND onboarding_completed = true;

GRANT SELECT ON profile_public TO anon;
GRANT SELECT ON profile_public TO authenticated;

-- 2. member_profiles: authenticated user directory.
--    Hide social/contact fields unless the owner explicitly allows them.
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
  CASE WHEN show_social_handle = true THEN social_platform END AS social_platform,
  CASE WHEN show_social_handle = true THEN social_handle END AS social_handle,
  CASE WHEN show_social_handle = true THEN social_handles END AS social_handles,
  is_discoverable,
  onboarding_completed,
  created_at,
  updated_at
FROM profiles
WHERE display_name IS NOT NULL
  AND is_discoverable = true
  AND onboarding_completed = true;

GRANT SELECT ON member_profiles TO authenticated;

-- 3. flight_listings_with_profile: show listing owner info only when the owner
--    is discoverable/onboarded. Always show social handles only to authenticated
--    callers and only when the owner has show_social_handle enabled.
DROP VIEW IF EXISTS flight_listings_with_profile;
CREATE VIEW flight_listings_with_profile AS
SELECT
  fl.id,
  fl.user_id,
  fl.departure_country,
  fl.arrival_country,
  fl.departure_city,
  fl.arrival_city,
  fl.departure_date,
  fl.arrival_date,
  fl.available_kgs,
  fl.price_per_kg,
  fl.currency,
  fl.notes,
  fl.is_active,
  fl.created_at,
  fl.updated_at,
  p.display_name,
  p.avatar_url,
  CASE
    WHEN p.id IS NOT NULL
      AND auth.role() = 'authenticated'
      AND COALESCE(p.show_social_handle, true) = true THEN
      CASE
        WHEN jsonb_typeof(p.social_handles) = 'array' THEN p.social_handles
        WHEN jsonb_typeof(p.social_handles) = 'object' THEN jsonb_build_array(p.social_handles)
        ELSE '[]'::jsonb
      END
    ELSE '[]'::jsonb
  END AS social_handles,
  CASE
    WHEN p.id IS NOT NULL
      AND auth.role() = 'authenticated'
      AND COALESCE(p.show_social_handle, true) = true THEN true
    ELSE false
  END AS show_social_handle
FROM flight_listings fl
LEFT JOIN profiles p
  ON fl.user_id = p.id
  AND (
    (p.is_discoverable = true AND p.onboarding_completed = true AND p.display_name IS NOT NULL)
    OR auth.uid() = fl.user_id
  )
WHERE fl.is_active = true OR auth.uid() = fl.user_id;

GRANT SELECT ON flight_listings_with_profile TO anon;
GRANT SELECT ON flight_listings_with_profile TO authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ============================================
-- COMPLETED
-- ============================================
