-- Verification for migration 051 (review fixes for 049/050). Local stack only:
--   docker exec -i supabase_db_<project_id> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/verify/051_review_fixes.sql
-- Every probe row must read PASS. Runs in one transaction and rolls back.
BEGIN;

CREATE TEMP TABLE probe_results (probe TEXT, outcome TEXT);
GRANT ALL ON probe_results TO PUBLIC;

-- Fixture: an onboarded user with a contact handle, a university and a review.
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000051a1', 'verify051@example.test', '{}', 'authenticated', 'authenticated');
UPDATE public.profiles SET display_name = 'Verify 051', onboarding_completed = true,
  social_handles = '[{"platform":"wechat","handle":"verify051"}]'
  WHERE id = '00000000-0000-4000-8000-0000000051a1';
INSERT INTO public.universities (id, name, city, slug)
  VALUES ('00000000-0000-4000-8000-0000000051b1', 'Verify 051 International University', 'Beijing', 'verify-051-intl');
INSERT INTO public.reviews (id, university_id, rating, text)
  VALUES ('00000000-0000-4000-8000-0000000051c1', '00000000-0000-4000-8000-0000000051b1', 4, 'A review for the 051 check.');
INSERT INTO public.flight_listings (id, user_id, departure_country, arrival_country, departure_date, arrival_date, available_kgs, price_per_kg)
  VALUES ('00000000-0000-4000-8000-0000000051f1', '00000000-0000-4000-8000-0000000051a1', 'Morocco', 'China',
          CURRENT_DATE - 3, CURRENT_DATE - 2, 5, 10);

DO $$
DECLARE
  v_id UUID;
  v_slug TEXT;
  v_created BOOLEAN;
  v_ts TIMESTAMPTZ;
  v_count INT;
BEGIN
  -- Same name in the same city (case/space variants) reuses the row.
  SELECT r.id, r.created INTO v_id, v_created
  FROM public.find_or_create_university_by_name('verify 051 international  university', ' beijing ', 'verify-051-intl-x1') r;
  INSERT INTO probe_results VALUES ('same-city name reuses row',
    CASE WHEN v_id = '00000000-0000-4000-8000-0000000051b1' AND NOT v_created THEN 'PASS' ELSE 'FAIL: ' || v_id END);

  -- Same name in another city gets its own row.
  SELECT r.id, r.slug, r.created INTO v_id, v_slug, v_created
  FROM public.find_or_create_university_by_name('Verify 051 International University', 'Shanghai', 'verify-051-intl-x2') r;
  INSERT INTO probe_results VALUES ('other-city name creates row',
    CASE WHEN v_id <> '00000000-0000-4000-8000-0000000051b1' AND v_created AND v_slug = 'verify-051-intl-x2'
      THEN 'PASS' ELSE 'FAIL: ' || v_slug END);

  -- Backdated client inserts are stamped with the server time.
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000051a1","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.comments (id, review_id, user_id, text, created_at)
    VALUES ('00000000-0000-4000-8000-0000000051d1', '00000000-0000-4000-8000-0000000051c1',
            '00000000-0000-4000-8000-0000000051a1', 'backdated', '2000-01-01T00:00:00Z');
  INSERT INTO public.flight_listings (id, user_id, departure_country, arrival_country, departure_date, arrival_date, available_kgs, price_per_kg, created_at)
    VALUES ('00000000-0000-4000-8000-0000000051f2', '00000000-0000-4000-8000-0000000051a1', 'Morocco', 'China',
            CURRENT_DATE + 30, CURRENT_DATE + 31, 5, 10, '2000-01-01T00:00:00Z');
  RESET ROLE;
  SELECT created_at INTO v_ts FROM public.comments WHERE id = '00000000-0000-4000-8000-0000000051d1';
  INSERT INTO probe_results VALUES ('backdated comment stamped now',
    CASE WHEN v_ts > NOW() - INTERVAL '1 minute' THEN 'PASS' ELSE 'FAIL: ' || v_ts END);
  SELECT created_at INTO v_ts FROM public.flight_listings WHERE id = '00000000-0000-4000-8000-0000000051f2';
  INSERT INTO probe_results VALUES ('backdated listing stamped now',
    CASE WHEN v_ts > NOW() - INTERVAL '1 minute' THEN 'PASS' ELSE 'FAIL: ' || v_ts END);

  -- Owners can't move a listing's created_at afterwards.
  SET LOCAL ROLE authenticated;
  UPDATE public.flight_listings SET created_at = '2000-01-01T00:00:00Z'
    WHERE id = '00000000-0000-4000-8000-0000000051f2';
  RESET ROLE;
  SELECT created_at INTO v_ts FROM public.flight_listings WHERE id = '00000000-0000-4000-8000-0000000051f2';
  INSERT INTO probe_results VALUES ('listing created_at not rewritable',
    CASE WHEN v_ts > NOW() - INTERVAL '1 minute' THEN 'PASS' ELSE 'FAIL: ' || v_ts END);

  -- Both the owner and other readers see active departed and upcoming listings (for the Past Flights tab).
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM public.flight_listings WHERE id = '00000000-0000-4000-8000-0000000051f1';
  RESET ROLE;
  INSERT INTO probe_results VALUES ('owner sees departed listing',
    CASE WHEN v_count = 1 THEN 'PASS' ELSE 'FAIL: ' || v_count END);

  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  -- Guests read the public view since 064.
  SELECT count(*) INTO v_count FROM public.flight_listings_public WHERE id = '00000000-0000-4000-8000-0000000051f1';
  RESET ROLE;
  INSERT INTO probe_results VALUES ('active departed listing visible for past flights tab',
    CASE WHEN v_count = 1 THEN 'PASS' ELSE 'FAIL: ' || v_count END);

  SET LOCAL ROLE anon;
  -- Guests read the public view since 064.
  SELECT count(*) INTO v_count FROM public.flight_listings_public WHERE id = '00000000-0000-4000-8000-0000000051f2';
  RESET ROLE;
  INSERT INTO probe_results VALUES ('upcoming listing visible to anon',
    CASE WHEN v_count = 1 THEN 'PASS' ELSE 'FAIL: ' || v_count END);
END $$;

SELECT * FROM probe_results;

ROLLBACK;
