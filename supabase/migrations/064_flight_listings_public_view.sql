-- ============================================
-- TRC 064: Public flight board without contact or owner data
-- ============================================
--
-- Finding: anon could read public.flight_listings directly through the REST
-- API (SELECT policy TO public plus Supabase's default per-role table grant).
-- That exposed, for every active listing: user_id (owner identity, joinable
-- to profile_public), contact_platforms (which platforms the owner uses) and
-- the free-text notes column (users paste WeChat ids and phone numbers
-- there). public.flight_listings_with_profile was also granted to anon and
-- returned user_id, notes, display_name and avatar_url.
-- Handle VALUES were never exposed to anon: they live in profiles (own-row
-- RLS) and the with_profile view only fills them for auth.role() =
-- 'authenticated'.
--
-- Fix:
--   1. Guests read a new definer view, flight_listings_public, that carries
--      only route, dates, space, price and a coarse poster label (first word
--      of a discoverable profile's display name).
--   2. Anon loses all access to flight_listings and
--      flight_listings_with_profile. Signed-in users keep both (the
--      with_profile view is definer, so it still reads the table).
--   3. The table SELECT policy becomes authenticated-only.
--
-- Grants: CREATE VIEW auto-grants to anon/authenticated, so privileges are
-- revoked per role and re-granted explicitly.
-- ============================================

CREATE OR REPLACE VIEW public.flight_listings_public AS
SELECT
  fl.id,
  fl.departure_country,
  fl.arrival_country,
  fl.departure_city,
  fl.arrival_city,
  fl.departure_date,
  fl.arrival_date,
  fl.available_kgs,
  fl.price_per_kg,
  fl.currency,
  fl.created_at,
  NULLIF(left(split_part(btrim(p.display_name), ' ', 1), 30), '') AS poster_label
FROM public.flight_listings fl
LEFT JOIN public.profiles p
  ON fl.user_id = p.id
  AND p.is_discoverable = true
  AND p.onboarding_completed = true
  AND p.display_name IS NOT NULL
WHERE fl.is_active = true;

REVOKE ALL ON public.flight_listings_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.flight_listings_public TO anon, authenticated;

-- Anon: no direct access to the table or the member view.
REVOKE ALL ON public.flight_listings FROM PUBLIC, anon;
REVOKE ALL ON public.flight_listings_with_profile FROM PUBLIC, anon;
GRANT SELECT ON public.flight_listings_with_profile TO authenticated;

DROP POLICY IF EXISTS "Public read access to active flight listings" ON public.flight_listings;
DROP POLICY IF EXISTS "Authenticated read access to active flight listings" ON public.flight_listings;
CREATE POLICY "Authenticated read access to active flight listings"
  ON public.flight_listings FOR SELECT
  TO authenticated
  USING (is_active = true OR auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
