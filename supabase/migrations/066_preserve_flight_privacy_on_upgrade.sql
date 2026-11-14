-- Production received 064 as an early privacy hotfix. Applying the older
-- pending migration 052 afterwards recreates its obsolete public SELECT
-- policy. Restate the final 064 policy so out-of-order upgrades converge.
DROP POLICY IF EXISTS "Public read access to active flight listings" ON public.flight_listings;
REVOKE ALL ON public.flight_listings FROM PUBLIC, anon;
REVOKE ALL ON public.flight_listings_with_profile FROM PUBLIC, anon;
NOTIFY pgrst, 'reload schema';
