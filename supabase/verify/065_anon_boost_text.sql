-- Verification for migration 065 (anonymous Boost may edit `text`). Local stack only:
--   docker exec -i supabase_db_<project_id> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/verify/065_anon_boost_text.sql
-- Every probe row must read PASS. Runs in one transaction and rolls back.
BEGIN;

CREATE TEMP TABLE probe_results (probe TEXT, outcome TEXT);

INSERT INTO public.universities (id, name, city, slug)
VALUES ('00000000-0000-4000-8000-0000000065b1', 'Verify 065 Uni', 'Wuhan', 'verify-065-uni');

-- A fresh guest review (no owner) with a Boost capability, 3 stars, 2 tags and a photo.
INSERT INTO public.reviews (id, university_id, rating, text, tags, media)
VALUES ('00000000-0000-4000-8000-0000000065c1', '00000000-0000-4000-8000-0000000065b1', 3,
        'Short first draft.', ARRAY['Good dorms', 'Great food'],
        '[{"url":"http://127.0.0.1:54321/storage/v1/object/public/review-media/reviews/v065/a.jpg","type":"image"}]');
INSERT INTO public.reviewer_context (review_id, boost_secret_hash)
VALUES ('00000000-0000-4000-8000-0000000065c1', repeat('a', 64));

-- 1. A valid text patch applies, is trimmed, and uses one save.
-- Call first, check after: Postgres may evaluate uncorrelated subqueries in the
-- same CASE before the function runs.
CREATE TEMP TABLE call_1 AS SELECT public.apply_anonymous_boost('00000000-0000-4000-8000-0000000065c1', repeat('a', 64),
              '{"text": "  Teachers were kind, dorms felt small, canteen prices stayed cheap.  "}'::jsonb) AS res;
INSERT INTO probe_results
SELECT 'text patch applies',
  CASE WHEN (SELECT res FROM call_1) = 'ok'
        AND (SELECT text FROM public.reviews WHERE id = '00000000-0000-4000-8000-0000000065c1')
            = 'Teachers were kind, dorms felt small, canteen prices stayed cheap.'
        AND (SELECT boost_save_count FROM public.reviewer_context
             WHERE review_id = '00000000-0000-4000-8000-0000000065c1') = 1
       THEN 'PASS' ELSE 'FAIL' END;

-- 2. A text patch beside another allowed field applies both; other columns keep their values.
-- Call first, check after: Postgres may evaluate uncorrelated subqueries in the
-- same CASE before the function runs.
CREATE TEMP TABLE call_2 AS SELECT public.apply_anonymous_boost('00000000-0000-4000-8000-0000000065c1', repeat('a', 64),
              '{"text": "Second version of the words, a bit longer now.", "program": "Computer Science"}'::jsonb) AS res;
INSERT INTO probe_results
SELECT 'text with program applies and leaves rating, tags, media alone',
  CASE WHEN (SELECT res FROM call_2) = 'ok'
        AND (SELECT text FROM public.reviews WHERE id = '00000000-0000-4000-8000-0000000065c1')
            = 'Second version of the words, a bit longer now.'
        AND (SELECT program FROM public.reviews WHERE id = '00000000-0000-4000-8000-0000000065c1') = 'Computer Science'
        AND (SELECT rating FROM public.reviews WHERE id = '00000000-0000-4000-8000-0000000065c1') = 3
        AND (SELECT tags FROM public.reviews WHERE id = '00000000-0000-4000-8000-0000000065c1')
            = ARRAY['Good dorms', 'Great food']
        AND (SELECT jsonb_array_length(media) FROM public.reviews WHERE id = '00000000-0000-4000-8000-0000000065c1') = 1
       THEN 'PASS' ELSE 'FAIL' END;

-- 3. Empty, blank, too short, too long, null and non-string text are rejected and change nothing.
INSERT INTO probe_results
SELECT 'bad text rejected as bad_fields',
  CASE WHEN public.apply_anonymous_boost('00000000-0000-4000-8000-0000000065c1', repeat('a', 64), '{"text": ""}'::jsonb) = 'bad_fields'
        AND public.apply_anonymous_boost('00000000-0000-4000-8000-0000000065c1', repeat('a', 64), '{"text": "     "}'::jsonb) = 'bad_fields'
        AND public.apply_anonymous_boost('00000000-0000-4000-8000-0000000065c1', repeat('a', 64), '{"text": "too short"}'::jsonb) = 'bad_fields'
        AND public.apply_anonymous_boost('00000000-0000-4000-8000-0000000065c1', repeat('a', 64),
              jsonb_build_object('text', repeat('x', 5001))) = 'bad_fields'
        AND public.apply_anonymous_boost('00000000-0000-4000-8000-0000000065c1', repeat('a', 64), '{"text": null}'::jsonb) = 'bad_fields'
        AND public.apply_anonymous_boost('00000000-0000-4000-8000-0000000065c1', repeat('a', 64), '{"text": 42}'::jsonb) = 'bad_fields'
        AND (SELECT text FROM public.reviews WHERE id = '00000000-0000-4000-8000-0000000065c1')
            = 'Second version of the words, a bit longer now.'
        AND (SELECT boost_save_count FROM public.reviewer_context
             WHERE review_id = '00000000-0000-4000-8000-0000000065c1') = 2
       THEN 'PASS' ELSE 'FAIL' END;

-- 4. The longest allowed text (5000 characters) applies.
-- Call first, check after: Postgres may evaluate uncorrelated subqueries in the
-- same CASE before the function runs.
CREATE TEMP TABLE call_4 AS SELECT public.apply_anonymous_boost('00000000-0000-4000-8000-0000000065c1', repeat('a', 64),
              jsonb_build_object('text', repeat('x', 5000))) AS res;
INSERT INTO probe_results
SELECT 'text at the 5000 character cap applies',
  CASE WHEN (SELECT res FROM call_4) = 'ok'
        AND (SELECT char_length(text) FROM public.reviews WHERE id = '00000000-0000-4000-8000-0000000065c1') = 5000
       THEN 'PASS' ELSE 'FAIL' END;

-- 5. Rating, tags, media, ownership and deletion are still outside the allowlist.
INSERT INTO probe_results
SELECT 'rating, tags, media, owner and deleted_at still rejected',
  CASE WHEN public.apply_anonymous_boost('00000000-0000-4000-8000-0000000065c1', repeat('a', 64), '{"rating": 5}'::jsonb) = 'bad_fields'
        AND public.apply_anonymous_boost('00000000-0000-4000-8000-0000000065c1', repeat('a', 64), '{"tags": ["Cheap city"]}'::jsonb) = 'bad_fields'
        AND public.apply_anonymous_boost('00000000-0000-4000-8000-0000000065c1', repeat('a', 64), '{"media": []}'::jsonb) = 'bad_fields'
        AND public.apply_anonymous_boost('00000000-0000-4000-8000-0000000065c1', repeat('a', 64),
              '{"user_id": "00000000-0000-4000-8000-0000000065a1"}'::jsonb) = 'bad_fields'
        AND public.apply_anonymous_boost('00000000-0000-4000-8000-0000000065c1', repeat('a', 64),
              '{"deleted_at": "2026-01-01T00:00:00Z"}'::jsonb) = 'bad_fields'
        AND public.apply_anonymous_boost('00000000-0000-4000-8000-0000000065c1', repeat('a', 64),
              '{"text": "Valid words that are long enough.", "rating": 1}'::jsonb) = 'bad_fields'
        AND (SELECT rating FROM public.reviews WHERE id = '00000000-0000-4000-8000-0000000065c1') = 3
        AND (SELECT tags FROM public.reviews WHERE id = '00000000-0000-4000-8000-0000000065c1')
            = ARRAY['Good dorms', 'Great food']
        AND (SELECT jsonb_array_length(media) FROM public.reviews WHERE id = '00000000-0000-4000-8000-0000000065c1') = 1
        AND (SELECT user_id FROM public.reviews WHERE id = '00000000-0000-4000-8000-0000000065c1') IS NULL
        AND (SELECT deleted_at FROM public.reviews WHERE id = '00000000-0000-4000-8000-0000000065c1') IS NULL
       THEN 'PASS' ELSE 'FAIL' END;

-- 6. A wrong token still cannot write text.
INSERT INTO probe_results
SELECT 'wrong token cannot edit text',
  CASE WHEN public.apply_anonymous_boost('00000000-0000-4000-8000-0000000065c1', repeat('b', 64),
              '{"text": "Someone else tries to rewrite this."}'::jsonb) = 'bad_token'
        AND (SELECT char_length(text) FROM public.reviews WHERE id = '00000000-0000-4000-8000-0000000065c1') = 5000
       THEN 'PASS' ELSE 'FAIL' END;

-- 7. Grants unchanged: service_role only.
INSERT INTO probe_results
SELECT 'apply_anonymous_boost closed to clients',
  CASE WHEN NOT has_function_privilege('anon', 'public.apply_anonymous_boost(uuid, text, jsonb)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.apply_anonymous_boost(uuid, text, jsonb)', 'EXECUTE')
        AND has_function_privilege('service_role', 'public.apply_anonymous_boost(uuid, text, jsonb)', 'EXECUTE')
       THEN 'PASS' ELSE 'FAIL' END;

SELECT * FROM probe_results;

ROLLBACK;
