-- Migration 051: fixes from the review of migrations 049 and 050.
--
-- 1. find_or_create_university_by_name ranked name matches by city but never
--    restricted them, so "International University" in Shanghai reused the
--    Beijing row and its reviews landed on the wrong school. Reuse only a row
--    in the same (normalized) city; otherwise insert a new row under the
--    caller's suffixed slug. The per-name lock stays.
--
-- 2. The comment and flight listing limits counted rows by created_at, which
--    clients set. A backdated insert never counted toward the quota. API
--    inserts now get created_at = NOW(), owners can't rewrite created_at on
--    their listings, and each user's check runs under a per-user lock so
--    parallel inserts can't all pass the count together.
--
-- 3. flight_listings_with_profile hides departed trips (050), but the table's
--    public SELECT policy still returned every active row. The policy now
--    applies the same date rule as the view.

-- ---- 1. University resolver: same-city matches only -------------------------

CREATE OR REPLACE FUNCTION public.find_or_create_university_by_name(
  p_name TEXT,
  p_city TEXT,
  p_slug TEXT
)
RETURNS TABLE(id UUID, slug TEXT, created BOOLEAN)
LANGUAGE plpgsql
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_key TEXT := lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
  v_city TEXT := lower(regexp_replace(btrim(coalesce(p_city, '')), '\s+', ' ', 'g'));
BEGIN
  IF v_key = '' THEN
    RAISE EXCEPTION 'University name is required.';
  END IF;

  -- Serialize concurrent submissions of the same name; the lock is released
  -- at the end of the calling transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended('universities.name:' || v_key, 0));

  RETURN QUERY
  SELECT u.id, u.slug, false
  FROM public.universities u
  WHERE (lower(regexp_replace(btrim(u.name), '\s+', ' ', 'g')) = v_key
         OR lower(regexp_replace(btrim(u.name_zh), '\s+', ' ', 'g')) = v_key)
    -- Same city, or no recorded city (province-only rows). Two known,
    -- different cities never match; an exact city match wins.
    AND (u.city IS NULL OR btrim(u.city) = ''
         OR lower(regexp_replace(btrim(u.city), '\s+', ' ', 'g')) = v_city)
  ORDER BY (lower(regexp_replace(btrim(coalesce(u.city, '')), '\s+', ' ', 'g')) = v_city) DESC,
           u.created_at
  LIMIT 1;
  IF FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO public.universities AS u (name, city, slug)
  VALUES (btrim(p_name), p_city, p_slug)
  RETURNING u.id, u.slug, true;
END;
$$;

-- CREATE OR REPLACE keeps the 049 grants; restated so the intent is local.
REVOKE ALL ON FUNCTION public.find_or_create_university_by_name(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_university_by_name(TEXT, TEXT, TEXT) TO service_role;

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

-- ---- 3. Departed flights hidden on the table too ----------------------------

DROP POLICY IF EXISTS "Public read access to active flight listings" ON public.flight_listings;
CREATE POLICY "Public read access to active flight listings"
  ON public.flight_listings FOR SELECT
  TO public
  USING ((is_active = true AND departure_date >= CURRENT_DATE) OR auth.uid() = user_id);
