-- Verification for migration 050 (audit follow-ups). Local stack only:
--   docker exec -i supabase_db_<project_id> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/verify/050_audit_followups.sql
-- Every probe row must read PASS. Runs in one transaction and rolls back.
BEGIN;

CREATE TEMP TABLE probe_results (probe TEXT, outcome TEXT);
-- Probes run as client roles, and some record their result as that role.
GRANT ALL ON probe_results TO PUBLIC;

-- Fixture: two onboarded users, a university, two reviews (one soft-deleted).
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000050a1', 'verify050a@example.test', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000050a2', 'verify050b@example.test', '{}', 'authenticated', 'authenticated');
UPDATE public.profiles SET display_name = 'Verify A', onboarding_completed = true
  WHERE id = '00000000-0000-4000-8000-0000000050a1';
UPDATE public.profiles SET display_name = 'Verify B', onboarding_completed = true,
  social_handles = '[{"platform":"wechat","handle":"verifyb"}]'
  WHERE id = '00000000-0000-4000-8000-0000000050a2';
INSERT INTO public.universities (id, name, city, slug)
  VALUES ('00000000-0000-4000-8000-0000000050b1', 'Verify 050 Uni', 'Hangzhou', 'verify-050-uni');
INSERT INTO public.reviews (id, university_id, rating, text, media, updated_at) VALUES
  ('00000000-0000-4000-8000-0000000050c1', '00000000-0000-4000-8000-0000000050b1', 4,
   'A review for the 050 check.',
   '[{"url":"http://x/storage/v1/object/public/review-media/reviews/kept/1-photo.jpg","type":"image"}]',
   '2020-01-01T00:00:00Z'),
  ('00000000-0000-4000-8000-0000000050c2', '00000000-0000-4000-8000-0000000050b1', 2,
   'A deleted review for the 050 check.', '[]', '2020-01-01T00:00:00Z');
UPDATE public.reviews SET deleted_at = NOW() WHERE id = '00000000-0000-4000-8000-0000000050c2';

DO $$
DECLARE
  v_count INT;
  v_updated TIMESTAMPTZ;
  v_res RECORD;
  i INT;
BEGIN
  -- upvote_count follows toggle_upvote both ways; updated_at stays put.
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000050a1","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;
  SELECT * INTO v_res FROM public.toggle_upvote('00000000-0000-4000-8000-0000000050c1');
  RESET ROLE;
  SELECT upvote_count, updated_at INTO v_count, v_updated FROM public.reviews
    WHERE id = '00000000-0000-4000-8000-0000000050c1';
  INSERT INTO probe_results VALUES ('upvote increments count',
    CASE WHEN v_res.upvoted AND v_res.upvote_count = 1 AND v_count = 1 THEN 'PASS' ELSE 'FAIL: ' || v_count END);
  INSERT INTO probe_results VALUES ('vote does not bump updated_at',
    CASE WHEN v_updated = '2020-01-01T00:00:00Z' THEN 'PASS' ELSE 'FAIL: ' || v_updated END);

  SET LOCAL ROLE authenticated;
  SELECT * INTO v_res FROM public.toggle_upvote('00000000-0000-4000-8000-0000000050c1');
  RESET ROLE;
  SELECT upvote_count INTO v_count FROM public.reviews WHERE id = '00000000-0000-4000-8000-0000000050c1';
  INSERT INTO probe_results VALUES ('second toggle decrements count',
    CASE WHEN NOT v_res.upvoted AND v_count = 0 THEN 'PASS' ELSE 'FAIL: ' || v_count END);

  -- Soft-deleted reviews can't be upvoted.
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM public.toggle_upvote('00000000-0000-4000-8000-0000000050c2');
    RESET ROLE;
    INSERT INTO probe_results VALUES ('deleted review upvote rejected', 'FAIL: accepted');
  EXCEPTION WHEN raise_exception THEN
    RESET ROLE;
    INSERT INTO probe_results VALUES ('deleted review upvote rejected', 'PASS (' || SQLERRM || ')');
  END;

  -- A content edit still bumps updated_at.
  UPDATE public.reviews SET text = 'An edited review for the 050 check.'
    WHERE id = '00000000-0000-4000-8000-0000000050c1';
  SELECT updated_at INTO v_updated FROM public.reviews WHERE id = '00000000-0000-4000-8000-0000000050c1';
  INSERT INTO probe_results VALUES ('content edit bumps updated_at',
    CASE WHEN v_updated > '2020-01-01T00:00:00Z' THEN 'PASS' ELSE 'FAIL' END);

  -- Comment rate limit: 20 per hour, the 21st is rejected.
  BEGIN
    SET LOCAL ROLE authenticated;
    FOR i IN 1..21 LOOP
      INSERT INTO public.comments (review_id, user_id, text)
      VALUES ('00000000-0000-4000-8000-0000000050c1', '00000000-0000-4000-8000-0000000050a1', 'comment ' || i);
    END LOOP;
    RESET ROLE;
    INSERT INTO probe_results VALUES ('21st comment in an hour rejected', 'FAIL: all accepted');
  EXCEPTION WHEN raise_exception THEN
    RESET ROLE;
    INSERT INTO probe_results VALUES ('21st comment in an hour rejected', 'PASS (' || SQLERRM || ')');
  END;

  -- Flight listing rate limit: 10 per 24h, the 11th is rejected.
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000050a2","role":"authenticated"}', true);
  BEGIN
    SET LOCAL ROLE authenticated;
    FOR i IN 1..11 LOOP
      INSERT INTO public.flight_listings (user_id, departure_country, arrival_country, departure_date, arrival_date, available_kgs, price_per_kg)
      VALUES ('00000000-0000-4000-8000-0000000050a2', 'Morocco', 'China', CURRENT_DATE + 10, CURRENT_DATE + 11, 5, 50);
    END LOOP;
    RESET ROLE;
    INSERT INTO probe_results VALUES ('11th flight listing in a day rejected', 'FAIL: all accepted');
  EXCEPTION WHEN raise_exception THEN
    RESET ROLE;
    INSERT INTO probe_results VALUES ('11th flight listing in a day rejected', 'PASS (' || SQLERRM || ')');
  END;
END $$;

-- Active departed and upcoming listings stay visible for the Past/Upcoming tabs.
INSERT INTO public.flight_listings (id, user_id, departure_country, arrival_country, departure_date, arrival_date, available_kgs, price_per_kg)
VALUES
  ('00000000-0000-4000-8000-0000000050d1', '00000000-0000-4000-8000-0000000050a2', 'Morocco', 'China', CURRENT_DATE - 3, CURRENT_DATE - 2, 5, 50),
  ('00000000-0000-4000-8000-0000000050d2', '00000000-0000-4000-8000-0000000050a2', 'Morocco', 'China', CURRENT_DATE + 3, CURRENT_DATE + 4, 5, 50);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
INSERT INTO probe_results
SELECT 'past and upcoming active listings shown',
  CASE WHEN EXISTS (SELECT 1 FROM public.flight_listings_with_profile WHERE id = '00000000-0000-4000-8000-0000000050d1')
        AND EXISTS (SELECT 1 FROM public.flight_listings_with_profile WHERE id = '00000000-0000-4000-8000-0000000050d2')
       THEN 'PASS' ELSE 'FAIL' END;
RESET ROLE;

-- content_reports and the new helpers are closed to clients.
INSERT INTO probe_results
SELECT 'content_reports closed to clients',
  CASE WHEN NOT has_table_privilege('anon', 'public.content_reports', 'SELECT')
        AND NOT has_table_privilege('authenticated', 'public.content_reports', 'INSERT')
        AND NOT has_table_privilege('authenticated', 'public.content_reports', 'SELECT')
       THEN 'PASS' ELSE 'FAIL' END;
INSERT INTO probe_results
SELECT 'cleanup functions closed to clients',
  CASE WHEN NOT has_function_privilege('anon', 'public.list_orphan_media(interval, integer)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.list_orphan_media(interval, integer)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.trigger_media_cleanup()', 'EXECUTE')
       THEN 'PASS' ELSE 'FAIL' END;
INSERT INTO probe_results
SELECT 'upload tables closed to clients',
  CASE WHEN NOT has_table_privilege('anon', 'public.upload_sessions', 'SELECT')
        AND NOT has_table_privilege('authenticated', 'public.upload_rate_limits', 'INSERT')
       THEN 'PASS' ELSE 'FAIL' END;
INSERT INTO probe_results
SELECT 'notify_on_comments defaults on',
  CASE WHEN (SELECT notify_on_comments FROM public.profiles WHERE id = '00000000-0000-4000-8000-0000000050a1')
       THEN 'PASS' ELSE 'FAIL' END;

-- Orphan media: referenced objects are kept, unreferenced old ones listed.
INSERT INTO storage.objects (bucket_id, name, created_at) VALUES
  ('review-media', 'reviews/kept/1-photo.jpg', NOW() - INTERVAL '10 days'),
  ('review-media', 'reviews/orphan/1-photo.jpg', NOW() - INTERVAL '10 days'),
  ('review-media', 'reviews/fresh/1-photo.jpg', NOW());
INSERT INTO probe_results
SELECT 'orphan media listing',
  CASE WHEN ARRAY(SELECT name FROM public.list_orphan_media('2 days', 100)
                  WHERE name LIKE 'reviews/%/1-photo.jpg' ORDER BY name)
            = ARRAY['reviews/orphan/1-photo.jpg']
       THEN 'PASS' ELSE 'FAIL' END;

-- Answers under a soft-deleted question disappear from the public view.
INSERT INTO public.qa_questions (id, slug, title, body, category, author_id) VALUES
  ('00000000-0000-4000-8000-0000000050e1', 'verify-050-question', 'A question for the 050 check',
   'Body text long enough for the check constraint.', 'life', '00000000-0000-4000-8000-0000000050a1');
INSERT INTO public.qa_answers (id, question_id, author_id, body) VALUES
  ('00000000-0000-4000-8000-0000000050e2', '00000000-0000-4000-8000-0000000050e1',
   '00000000-0000-4000-8000-0000000050a2', 'An answer for the 050 check.');
UPDATE public.qa_questions SET deleted_at = NOW() WHERE id = '00000000-0000-4000-8000-0000000050e1';
INSERT INTO probe_results
SELECT 'answers of deleted question hidden',
  CASE WHEN NOT EXISTS (SELECT 1 FROM public.qa_answers_public WHERE id = '00000000-0000-4000-8000-0000000050e2')
       THEN 'PASS' ELSE 'FAIL' END;

SELECT * FROM probe_results;

ROLLBACK;
