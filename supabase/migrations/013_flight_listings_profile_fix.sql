-- ============================================
-- TRC 013: Fix flight listings author profile visibility
--
-- The 011a migration restricted the profiles table to own-row SELECT. That
-- broke the security-invoker flight_listings_with_profile view: for every
-- listing posted by another user, display_name, avatar_url, show_social_handle
-- and social_handles came back as NULL. The card then rendered the author as
-- "Anonymous" and the "Show Contact" button disappeared.
--
-- This migration recreates the view in definer (non-invoker) mode so it can
-- read the joined profile data while still enforcing the active/own row filter
-- for flight_listings. It only exposes social_handles and show_social_handle to
-- authenticated users; anonymous users still see display_name and avatar_url
-- (same as profile_public) but not contact details.
--
-- Safe to re-run: every statement is idempotent.
-- ============================================

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
    WHEN auth.role() = 'authenticated' THEN
      CASE
        WHEN jsonb_typeof(p.social_handles) = 'array' THEN p.social_handles
        WHEN jsonb_typeof(p.social_handles) = 'object' THEN jsonb_build_array(p.social_handles)
        ELSE '[]'::jsonb
      END
    ELSE '[]'::jsonb
  END AS social_handles,
  CASE
    WHEN auth.role() = 'authenticated' THEN COALESCE(p.show_social_handle, true)
    ELSE false
  END AS show_social_handle
FROM flight_listings fl
LEFT JOIN profiles p ON fl.user_id = p.id
WHERE fl.is_active = true OR auth.uid() = fl.user_id;

GRANT SELECT ON flight_listings_with_profile TO anon;
GRANT SELECT ON flight_listings_with_profile TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ============================================
-- COMPLETED
-- ============================================
