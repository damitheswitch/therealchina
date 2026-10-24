-- Verification for migration 049 (close direct write paths). Local stack only:
--   docker exec -i supabase_db_<project_id> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/verify/049_write_paths.sql
-- Every probe row must read PASS. Runs in one transaction and rolls back.
BEGIN;

SELECT 'reviews INSERT authenticated' AS check, has_table_privilege('authenticated', 'public.reviews', 'INSERT') AS value
UNION ALL SELECT 'reviews INSERT anon', has_table_privilege('anon', 'public.reviews', 'INSERT')
UNION ALL SELECT 'reviews SELECT anon', has_table_privilege('anon', 'public.reviews', 'SELECT')
UNION ALL SELECT 'comments UPDATE authenticated', has_table_privilege('authenticated', 'public.comments', 'UPDATE')
UNION ALL SELECT 'comments INSERT authenticated', has_table_privilege('authenticated', 'public.comments', 'INSERT')
UNION ALL SELECT 'comments DELETE authenticated', has_table_privilege('authenticated', 'public.comments', 'DELETE');

SELECT tablename, policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('reviews', 'comments')
ORDER BY tablename, cmd;

-- Fixture: a user with a completed profile, a university, a review and a
-- top-level comment + reply.
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('00000000-0000-4000-8000-0000000000a1', 'verify049@example.test', '{}', 'authenticated', 'authenticated');
UPDATE public.profiles SET display_name = 'Verify Bot', onboarding_completed = true
WHERE id = '00000000-0000-4000-8000-0000000000a1';
INSERT INTO public.universities (id, name, city, slug)
VALUES ('00000000-0000-4000-8000-0000000000b1', 'Verify Uni', 'Hangzhou', 'verify-uni-049');
INSERT INTO public.reviews (id, university_id, rating, text)
VALUES ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b1', 4, 'A review for the 049 check.'),
       ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000b1', 3, 'A second review for the 049 check.');
INSERT INTO public.comments (id, review_id, user_id, parent_id, text)
VALUES ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000a1', NULL, 'top'),
       ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000d1', 'reply'),
       ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000a1', NULL, 'another top');

-- Each probe runs in its own subtransaction and reports pass/fail.
CREATE TEMP TABLE probe_results (probe TEXT, outcome TEXT);

DO $$
BEGIN
  -- 1. Signed-in user posting a review straight to the table.
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
    INSERT INTO public.reviews (university_id, user_id, rating, text)
    VALUES ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 5, 'Direct insert should fail.');
    RESET ROLE;
    INSERT INTO probe_results VALUES ('direct review insert blocked', 'FAIL: insert succeeded');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO probe_results VALUES ('direct review insert blocked', 'PASS (' || SQLERRM || ')');
  END;

  -- 2. Author editing their own comment through PostgREST.
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
    UPDATE public.comments SET review_id = '00000000-0000-4000-8000-0000000000c2'
    WHERE id = '00000000-0000-4000-8000-0000000000d3';
    RESET ROLE;
    INSERT INTO probe_results VALUES ('comment update blocked', 'FAIL: update succeeded');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO probe_results VALUES ('comment update blocked', 'PASS (' || SQLERRM || ')');
  END;

  -- 3. Privileged update that would create a reply-to-reply.
  BEGIN
    UPDATE public.comments SET parent_id = '00000000-0000-4000-8000-0000000000d2'
    WHERE id = '00000000-0000-4000-8000-0000000000d3';
    INSERT INTO probe_results VALUES ('nesting enforced on update', 'FAIL: update succeeded');
  EXCEPTION WHEN raise_exception THEN
    INSERT INTO probe_results VALUES ('nesting enforced on update', 'PASS (' || SQLERRM || ')');
  END;

  -- 4. Reply pointing at a parent on a different review.
  BEGIN
    INSERT INTO public.comments (review_id, user_id, parent_id, text)
    VALUES ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000d1', 'cross-review reply');
    INSERT INTO probe_results VALUES ('cross-review reply blocked', 'FAIL: insert succeeded');
  EXCEPTION WHEN raise_exception THEN
    INSERT INTO probe_results VALUES ('cross-review reply blocked', 'PASS (' || SQLERRM || ')');
  END;

  -- 5. Normal reply still works for a signed-in, onboarded user.
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
    INSERT INTO public.comments (review_id, user_id, parent_id, text)
    VALUES ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000d3', 'valid reply');
    RESET ROLE;
    INSERT INTO probe_results VALUES ('valid reply allowed', 'PASS');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO probe_results VALUES ('valid reply allowed', 'FAIL (' || SQLERRM || ')');
  END;

  -- 6. Author can still delete their own comment.
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
    DELETE FROM public.comments WHERE id = '00000000-0000-4000-8000-0000000000d2';
    RESET ROLE;
    INSERT INTO probe_results VALUES ('own comment delete allowed', CASE WHEN EXISTS (SELECT 1 FROM public.comments WHERE id = '00000000-0000-4000-8000-0000000000d2') THEN 'FAIL: row still there' ELSE 'PASS' END);
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO probe_results VALUES ('own comment delete allowed', 'FAIL (' || SQLERRM || ')');
  END;
END $$;

DO $$
DECLARE
  v_slug TEXT;
  v_created BOOLEAN;
BEGIN
  -- 7. A case/whitespace variant of an existing name reuses that row.
  SELECT r.slug, r.created INTO v_slug, v_created
  FROM public.find_or_create_university_by_name('  verify   UNI ', 'Hangzhou', 'verify-uni-049-dup') r;
  INSERT INTO probe_results VALUES ('uni name match ignores case',
    CASE WHEN v_slug = 'verify-uni-049' AND NOT v_created THEN 'PASS' ELSE 'FAIL: got ' || v_slug END);

  -- 8. Clients can't call the resolver directly.
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM public.find_or_create_university_by_name('Direct Call Uni', 'Hangzhou', 'direct-call-uni-049');
    RESET ROLE;
    INSERT INTO probe_results VALUES ('uni resolver not client-callable', 'FAIL: call succeeded');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO probe_results VALUES ('uni resolver not client-callable', 'PASS (' || SQLERRM || ')');
  END;
END $$;

SELECT * FROM probe_results;

ROLLBACK;
