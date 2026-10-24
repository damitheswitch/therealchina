-- Verification for migration 051 (server-set timestamps, departed flights
-- listed again). Local stack only:
--   docker exec -i supabase_db_<project_id> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/verify/051_rate_limit_timestamps.sql
-- Every probe row must read PASS. Runs in one transaction and rolls back.
BEGIN;

CREATE TEMP TABLE probe_results (probe TEXT, outcome TEXT);
-- Probes run as client roles, and some record their result as that role.
GRANT ALL ON probe_results TO PUBLIC;

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000051a1', 'verify051@example.test', '{}', 'authenticated', 'authenticated');
UPDATE public.profiles SET display_name = 'Verify 051', onboarding_completed = true,
  social_handles = '[{"platform":"wechat","handle":"verify051"}]'
  WHERE id = '00000000-0000-4000-8000-0000000051a1';
INSERT INTO public.universities (id, name, city, slug)
  VALUES ('00000000-0000-4000-8000-0000000051b1', 'Verify 051 Uni', 'Hangzhou', 'verify-051-uni');
INSERT INTO public.reviews (id, university_id, rating, text)
  VALUES ('00000000-0000-4000-8000-0000000051c1', '00000000-0000-4000-8000-0000000051b1', 4,
          'A review for the 051 check.');

SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000051a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- A client-supplied created_at in the past is replaced with now().
INSERT INTO public.comments (id, review_id, user_id, text, created_at)
VALUES ('00000000-0000-4000-8000-0000000051d1', '00000000-0000-4000-8000-0000000051c1',
        '00000000-0000-4000-8000-0000000051a1', 'backdated comment', '2001-01-01T00:00:00Z');
INSERT INTO probe_results
SELECT 'backdated comment gets server time',
  CASE WHEN created_at > NOW() - INTERVAL '1 minute' THEN 'PASS' ELSE 'FAIL: ' || created_at END
FROM public.comments WHERE id = '00000000-0000-4000-8000-0000000051d1';

INSERT INTO public.flight_listings (id, user_id, departure_country, arrival_country, departure_date, arrival_date, available_kgs, price_per_kg, created_at)
VALUES ('00000000-0000-4000-8000-0000000051e1', '00000000-0000-4000-8000-0000000051a1',
        'Morocco', 'China', CURRENT_DATE + 5, CURRENT_DATE + 6, 5, 50, '2001-01-01T00:00:00Z');
INSERT INTO probe_results
SELECT 'backdated listing gets server time',
  CASE WHEN created_at > NOW() - INTERVAL '1 minute' THEN 'PASS' ELSE 'FAIL: ' || created_at END
FROM public.flight_listings WHERE id = '00000000-0000-4000-8000-0000000051e1';

-- The owner can edit a listing but not move its created_at.
UPDATE public.flight_listings SET notes = 'edited', created_at = '2001-01-01T00:00:00Z'
WHERE id = '00000000-0000-4000-8000-0000000051e1';
INSERT INTO probe_results
SELECT 'listing update keeps created_at',
  CASE WHEN notes = 'edited' AND created_at > NOW() - INTERVAL '1 minute' THEN 'PASS'
       ELSE 'FAIL: ' || created_at END
FROM public.flight_listings WHERE id = '00000000-0000-4000-8000-0000000051e1';

RESET ROLE;

-- A departed trip: the Past tab lists it for everyone, and the view and the
-- base table agree.
INSERT INTO public.flight_listings (id, user_id, departure_country, arrival_country, departure_date, arrival_date, available_kgs, price_per_kg)
VALUES ('00000000-0000-4000-8000-0000000051e2', '00000000-0000-4000-8000-0000000051a1',
        'Morocco', 'China', CURRENT_DATE - 3, CURRENT_DATE - 2, 5, 50);

SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
INSERT INTO probe_results
SELECT 'departed trip listed in view and table',
  CASE WHEN EXISTS (SELECT 1 FROM public.flight_listings_with_profile WHERE id = '00000000-0000-4000-8000-0000000051e2')
        AND EXISTS (SELECT 1 FROM public.flight_listings WHERE id = '00000000-0000-4000-8000-0000000051e2')
       THEN 'PASS' ELSE 'FAIL' END;
RESET ROLE;

SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000051a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO probe_results
SELECT 'owner still sees own departed trip',
  CASE WHEN EXISTS (SELECT 1 FROM public.flight_listings WHERE id = '00000000-0000-4000-8000-0000000051e2')
       THEN 'PASS' ELSE 'FAIL' END;
RESET ROLE;

SELECT * FROM probe_results;

ROLLBACK;
