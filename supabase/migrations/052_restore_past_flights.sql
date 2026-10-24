-- Migration 052: keep departed trips visible on the flight board.
--
-- 050 filtered departed trips out of flight_listings_with_profile and 051
-- applied the same rule to the flight_listings SELECT policy. The board's
-- Past Flights tab lists other travelers' departed trips by design, so that
-- filter emptied it for everyone but the trip owner. Those statements were
-- later removed from 050/051, but a database that already ran them (staging)
-- keeps the filter: migrations are never re-run. This forward migration puts
-- the view and the policy back to their 047 definitions everywhere. On a
-- fresh database it is a no-op re-create.

-- Same column list (CREATE OR REPLACE keeps the grants).
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

DROP POLICY IF EXISTS "Public read access to active flight listings" ON public.flight_listings;
CREATE POLICY "Public read access to active flight listings"
  ON public.flight_listings FOR SELECT
  TO public
  USING (is_active = true OR auth.uid() = user_id);
