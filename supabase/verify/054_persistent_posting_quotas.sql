-- Local-only, transactional fixtures. Every probe must return PASS.
BEGIN;
CREATE TEMP TABLE probe_results (probe TEXT, outcome TEXT);

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('00000000-0000-4000-8000-0000000054a1', 'verify054@example.test', '{}', 'authenticated', 'authenticated');
UPDATE public.profiles
SET display_name = 'Verify 054', onboarding_completed = true,
    social_handles = '[{"platform":"wechat","handle":"verify054"}]'
WHERE id = '00000000-0000-4000-8000-0000000054a1';
INSERT INTO public.universities (id, name, city, slug)
VALUES ('00000000-0000-4000-8000-0000000054b1', 'Verify 054', 'Beijing', 'verify-054');
INSERT INTO public.reviews (id, university_id, rating, text)
VALUES ('00000000-0000-4000-8000-0000000054c1', '00000000-0000-4000-8000-0000000054b1', 4, 'Quota regression fixture');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000054a1","role":"authenticated"}', true);

DO $$
DECLARE
  v_id UUID;
  i INT;
BEGIN
  SET LOCAL ROLE authenticated;
  FOR i IN 1..20 LOOP
    INSERT INTO public.comments (review_id, user_id, text)
    VALUES ('00000000-0000-4000-8000-0000000054c1', '00000000-0000-4000-8000-0000000054a1', 'comment')
    RETURNING id INTO v_id;
    DELETE FROM public.comments WHERE id = v_id;
  END LOOP;
  RESET ROLE;
  BEGIN
    SET LOCAL ROLE authenticated;
    INSERT INTO public.comments (review_id, user_id, text)
    VALUES ('00000000-0000-4000-8000-0000000054c1', '00000000-0000-4000-8000-0000000054a1', 'over quota');
    RESET ROLE;
    INSERT INTO probe_results VALUES ('deleted comments still consume quota', 'FAIL');
  EXCEPTION WHEN raise_exception THEN
    RESET ROLE;
    INSERT INTO probe_results VALUES ('deleted comments still consume quota',
      CASE WHEN SQLERRM = 'Posting limit reached. Please try again later.' THEN 'PASS' ELSE 'FAIL: ' || SQLERRM END);
  END;

  SET LOCAL ROLE authenticated;
  FOR i IN 1..10 LOOP
    INSERT INTO public.flight_listings (user_id, departure_country, arrival_country, departure_date, arrival_date, available_kgs, price_per_kg)
    VALUES ('00000000-0000-4000-8000-0000000054a1', 'Morocco', 'China', CURRENT_DATE+10, CURRENT_DATE+11, 5, 50)
    RETURNING id INTO v_id;
    DELETE FROM public.flight_listings WHERE id = v_id;
  END LOOP;
  RESET ROLE;
  BEGIN
    SET LOCAL ROLE authenticated;
    INSERT INTO public.flight_listings (user_id, departure_country, arrival_country, departure_date, arrival_date, available_kgs, price_per_kg)
    VALUES ('00000000-0000-4000-8000-0000000054a1', 'Morocco', 'China', CURRENT_DATE+10, CURRENT_DATE+11, 5, 50);
    RESET ROLE;
    INSERT INTO probe_results VALUES ('deleted flights still consume quota', 'FAIL');
  EXCEPTION WHEN raise_exception THEN
    RESET ROLE;
    INSERT INTO probe_results VALUES ('deleted flights still consume quota',
      CASE WHEN SQLERRM = 'Posting limit reached. Please try again later.' THEN 'PASS' ELSE 'FAIL: ' || SQLERRM END);
  END;

  -- Expired history no longer blocks new posts.
  UPDATE public.posting_events SET created_at = NOW() - INTERVAL '2 days'
  WHERE user_id = '00000000-0000-4000-8000-0000000054a1';
  SET LOCAL ROLE authenticated;
  INSERT INTO public.comments (review_id, user_id, text)
  VALUES ('00000000-0000-4000-8000-0000000054c1', '00000000-0000-4000-8000-0000000054a1', 'after window');
  INSERT INTO public.flight_listings (user_id, departure_country, arrival_country, departure_date, arrival_date, available_kgs, price_per_kg)
  VALUES ('00000000-0000-4000-8000-0000000054a1', 'Morocco', 'China', CURRENT_DATE+10, CURRENT_DATE+11, 5, 50);
  RESET ROLE;
  INSERT INTO probe_results VALUES ('posting resumes after quota window', 'PASS');
END $$;

INSERT INTO probe_results
SELECT 'quota history and helper closed to clients',
  CASE WHEN NOT has_table_privilege('authenticated', 'public.posting_events', 'SELECT,INSERT,UPDATE,DELETE')
    AND NOT has_table_privilege('anon', 'public.posting_events', 'SELECT,INSERT,UPDATE,DELETE')
    AND NOT has_function_privilege('authenticated', 'public.consume_posting_quota(uuid,text)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.consume_posting_quota(uuid,text)', 'EXECUTE')
  THEN 'PASS' ELSE 'FAIL' END;
SELECT * FROM probe_results;
ROLLBACK;
