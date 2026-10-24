-- Migration 051: fixes from the review of migrations 049 and 050.
--
-- 1. (Moved) The resolver fixes from review now live in 049 itself, which
--    has not reached production; 051 no longer redefines that function.
--
-- 2. The comment and flight listing limits counted rows by created_at, which
--    clients set. A backdated insert never counted toward the quota. API
--    inserts now get created_at = NOW(), owners can't rewrite created_at on
--    their listings, and each user's check runs under a per-user lock so
--    parallel inserts can't all pass the count together.

-- ---- 2. Rate limits count server timestamps ---------------------------------

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

  -- The quota counts created_at, so API callers can't choose it.
  NEW.created_at := NOW();

  PERFORM pg_advisory_xact_lock(hashtextextended('comments.rate:' || NEW.user_id::TEXT, 0));

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

REVOKE ALL ON FUNCTION public.enforce_comment_rate_limit() FROM PUBLIC, anon, authenticated;

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

  IF TG_OP = 'UPDATE' THEN
    NEW.created_at := OLD.created_at;
    RETURN NEW;
  END IF;

  NEW.created_at := NOW();

  PERFORM pg_advisory_xact_lock(hashtextextended('flight_listings.rate:' || NEW.user_id::TEXT, 0));

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

REVOKE ALL ON FUNCTION public.enforce_flight_listing_rate_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_flight_listing_rate_limit_trigger ON public.flight_listings;
CREATE TRIGGER enforce_flight_listing_rate_limit_trigger
  BEFORE INSERT OR UPDATE OF created_at ON public.flight_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_flight_listing_rate_limit();
