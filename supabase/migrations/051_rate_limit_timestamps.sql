-- Migration 051: review follow-ups to 050.
--
-- 1. The 050 insert limits count rows by created_at, but API callers could
--    send their own created_at (or rewrite it on a flight-listing UPDATE) and
--    keep every post outside the counting window. The limit triggers now set
--    created_at to NOW() for API callers, and a new BEFORE UPDATE trigger
--    keeps a flight listing's created_at fixed. Seeds and admin SQL (no JWT)
--    are untouched.
-- 2. Undo 050's date filter on flight_listings_with_profile. The flight
--    board's Past tab intentionally lists other travelers' departed trips;
--    hiding them in the view emptied that tab (and the base table policy
--    never matched it anyway). The view goes back to the 047 WHERE clause.

CREATE OR REPLACE FUNCTION public.enforce_comment_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only API callers are limited; seeds and admin SQL run without a JWT.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- The window below counts created_at, so the client never sets it.
  NEW.created_at := NOW();

  IF (
    SELECT COUNT(*) FROM public.comments
    WHERE user_id = NEW.user_id
      AND created_at > NOW() - INTERVAL '1 hour'
  ) >= 20 THEN
    RAISE EXCEPTION 'You have posted a lot of comments in the last hour. Please wait a little and try again.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_flight_listing_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- The window below counts created_at, so the client never sets it.
  NEW.created_at := NOW();

  IF (
    SELECT COUNT(*) FROM public.flight_listings
    WHERE user_id = NEW.user_id
      AND created_at > NOW() - INTERVAL '24 hours'
  ) >= 10 THEN
    RAISE EXCEPTION 'You have posted 10 listings in the last 24 hours. Please try again tomorrow.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

-- Owners can update their listings (edit, close); created_at is not theirs to
-- change, or an old timestamp would free up rate-limit budget.
CREATE OR REPLACE FUNCTION public.preserve_flight_listing_created_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.preserve_flight_listing_created_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS preserve_flight_listing_created_at_trigger ON public.flight_listings;
CREATE TRIGGER preserve_flight_listing_created_at_trigger
  BEFORE UPDATE ON public.flight_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_flight_listing_created_at();

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
