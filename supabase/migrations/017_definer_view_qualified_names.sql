-- ============================================
-- TRC 017: Qualify table names in definer views
-- ============================================
--
-- SECURITY DEFINER views are powerful: they run as the view owner and can
-- bypass RLS. A subtle extra hardening step for definer views is to always
-- use schema-qualified table names in their definition (public.<table>).
--
-- Why? When a view is created, unqualified names are resolved through the
-- session's search_path. If pg_temp is first and a temporary table with the
-- same name exists, the view could be bound to the wrong object. Using
-- public.profiles and public.flight_listings removes that ambiguity.
--
-- The three views stay SECURITY DEFINER on purpose — that mode is required
-- because the underlying profiles table is own-row-only. This migration does
-- not change the privacy filters from 016; it only makes the table references
-- explicit and safe.
--
-- Safe to re-run: every statement is idempotent.
-- ============================================

-- 1. profile_public: public author attribution.
CREATE OR REPLACE VIEW public.profile_public AS
SELECT
  id,
  display_name,
  avatar_url
FROM public.profiles
WHERE display_name IS NOT NULL
  AND is_discoverable = true
  AND onboarding_completed = true;

GRANT SELECT ON public.profile_public TO anon;
GRANT SELECT ON public.profile_public TO authenticated;

-- 2. member_profiles: authenticated user directory.
CREATE OR REPLACE VIEW public.member_profiles AS
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
FROM public.profiles
WHERE display_name IS NOT NULL
  AND is_discoverable = true
  AND onboarding_completed = true;

GRANT SELECT ON public.member_profiles TO authenticated;

-- 3. flight_listings_with_profile: show listing owner info only when the owner
--    is discoverable/onboarded. Always show social handles only to authenticated
--    callers and only when the owner has show_social_handle enabled.
CREATE OR REPLACE VIEW public.flight_listings_with_profile AS
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
FROM public.flight_listings fl
LEFT JOIN public.profiles p
  ON fl.user_id = p.id
  AND (
    (p.is_discoverable = true AND p.onboarding_completed = true AND p.display_name IS NOT NULL)
    OR auth.uid() = fl.user_id
  )
WHERE fl.is_active = true OR auth.uid() = fl.user_id;

GRANT SELECT ON public.flight_listings_with_profile TO anon;
GRANT SELECT ON public.flight_listings_with_profile TO authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ============================================
-- COMPLETED
-- ============================================
