-- ============================================
-- TRC 044: Per-listing contact platform selection
-- ============================================
--
-- Flight listings used to expose every social handle on the owner's profile
-- (gated by show_social_handle). Owners can now pick which platforms a
-- listing shows:
--
--   contact_platforms = NULL      -> all profile handles (legacy rows, default)
--   contact_platforms = '[]'      -> no contact shown on this listing
--   contact_platforms = '["wechat"]' -> only handles on those platforms
--
-- Only platform keys are stored, never handle values: flight_listings is
-- publicly readable (SELECT TO public) while handle values stay members-only
-- behind the view gate. Storing keys also means a listing always shows the
-- profile's current handle value for the chosen platforms, and a deleted
-- profile handle disappears from every listing automatically.
-- ============================================

ALTER TABLE public.flight_listings
  ADD COLUMN IF NOT EXISTS contact_platforms jsonb DEFAULT NULL;

ALTER TABLE public.flight_listings
  DROP CONSTRAINT IF EXISTS chk_flight_listings_contact_platforms_array,
  ADD CONSTRAINT chk_flight_listings_contact_platforms_array
    CHECK (contact_platforms IS NULL OR jsonb_typeof(contact_platforms) = 'array')
    NOT VALID;

-- Same privacy gates as before; the only change is filtering the shown
-- handles by fl.contact_platforms and exposing the stored selection back to
-- the owner so the edit form can prefill it.
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
      (
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(p.social_handles) = 'array' THEN p.social_handles
            WHEN jsonb_typeof(p.social_handles) = 'object' THEN jsonb_build_array(p.social_handles)
            ELSE '[]'::jsonb
          END
        ) AS elem
        WHERE fl.contact_platforms IS NULL
          OR elem ->> 'platform' IN (
            SELECT jsonb_array_elements_text(fl.contact_platforms)
          )
      )
    ELSE '[]'::jsonb
  END AS social_handles,
  CASE
    WHEN p.id IS NOT NULL
      AND auth.role() = 'authenticated'
      AND COALESCE(p.show_social_handle, true) = true THEN true
    ELSE false
  END AS show_social_handle,
  CASE WHEN auth.uid() = fl.user_id THEN fl.contact_platforms END AS contact_platforms
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
