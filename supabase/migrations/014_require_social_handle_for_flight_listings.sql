-- ============================================
-- TRC 014: Require at least one social handle to post flight listings
--
-- Enforces that authenticated users cannot insert flight_listings rows unless
-- their profile has at least one non-empty social handle (legacy single
-- social_handle column or the social_handles JSONB array).
--
-- Safe to re-run: every statement is idempotent.
-- ============================================

-- Helper function: does a profile have any usable social handle?
CREATE OR REPLACE FUNCTION public.profile_has_social_handle(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND (
        (social_handle IS NOT NULL AND length(trim(social_handle)) > 0)
        OR (
          jsonb_typeof(social_handles) = 'array'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(social_handles) h
            WHERE length(trim(COALESCE(h->>'handle', ''))) > 0
          )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.profile_has_social_handle(UUID) TO authenticated;

-- Update the flight_listings INSERT policy to require a social handle
DROP POLICY IF EXISTS "Authenticated insert access to flight listings" ON public.flight_listings;
CREATE POLICY "Authenticated insert access to flight listings"
  ON public.flight_listings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.profile_has_social_handle(auth.uid())
  );

NOTIFY pgrst, 'reload schema';

-- ============================================
-- COMPLETED
-- ============================================
