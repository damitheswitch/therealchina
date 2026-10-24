-- Verification for migration 055 (set-based orphan scan, missing media
-- lookup). Local stack only:
--   docker exec -i supabase_db_<project_id> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/verify/055_media_reference_set.sql
-- Every probe row must read PASS. Runs in one transaction and rolls back.
BEGIN;

CREATE TEMP TABLE probe_results (probe TEXT, outcome TEXT);

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('00000000-0000-4000-8000-0000000055a1', 'verify055@example.test', '{}', 'authenticated', 'authenticated');
INSERT INTO public.universities (id, name, city, slug)
VALUES ('00000000-0000-4000-8000-0000000055b1', 'Verify 055 Uni', 'Wuhan', 'verify-055-uni');

-- References in every shape the scan must recognise: a public URL, a URL with
-- a query string, a nested draft payload, and a soft-deleted review.
INSERT INTO public.reviews (university_id, rating, text, media, deleted_at) VALUES
  ('00000000-0000-4000-8000-0000000055b1', 4, 'Verify 055 review with a photo',
   '[{"url":"http://127.0.0.1:54321/storage/v1/object/public/review-media/reviews/v055/url.jpg","type":"image"},
     {"url":"http://127.0.0.1:54321/storage/v1/object/public/review-media/reviews/v055/query.jpg?t=1","type":"image"}]',
   NULL),
  ('00000000-0000-4000-8000-0000000055b1', 3, 'Verify 055 deleted review with a photo',
   '[{"url":"http://127.0.0.1:54321/storage/v1/object/public/review-media/reviews/v055/deleted.jpg","type":"image"}]',
   NOW());
INSERT INTO public.review_drafts (user_id, payload, progress) VALUES
  ('00000000-0000-4000-8000-0000000055a1',
   '{"v":2,"media":[{"url":"http://127.0.0.1:54321/storage/v1/object/public/review-media/reviews/v055/draft.jpg","type":"image"}]}',
   1);

INSERT INTO storage.objects (bucket_id, name, created_at) VALUES
  ('review-media', 'reviews/v055/url.jpg', NOW() - INTERVAL '10 days'),
  ('review-media', 'reviews/v055/query.jpg', NOW() - INTERVAL '10 days'),
  ('review-media', 'reviews/v055/deleted.jpg', NOW() - INTERVAL '10 days'),
  ('review-media', 'reviews/v055/draft.jpg', NOW() - INTERVAL '10 days'),
  ('review-media', 'reviews/v055/orphan.jpg', NOW() - INTERVAL '10 days'),
  ('review-media', 'reviews/v055/fresh.jpg', NOW()),
  ('review-media', 'reviews/v055/odd name.jpg', NOW() - INTERVAL '10 days');

INSERT INTO probe_results
SELECT 'only the unreferenced old object is listed',
  CASE WHEN ARRAY(SELECT name FROM public.list_orphan_media('2 days', 1000)
                  WHERE name LIKE 'reviews/v055/%' ORDER BY name)
            = ARRAY['reviews/v055/orphan.jpg']
       THEN 'PASS' ELSE 'FAIL' END;

INSERT INTO probe_results
SELECT 'missing media lookup',
  CASE WHEN ARRAY(SELECT name FROM public.missing_review_media(
                    ARRAY['reviews/v055/url.jpg', 'reviews/v055/gone.jpg', 'reviews/v055/gone.jpg'])
                  ORDER BY name)
            = ARRAY['reviews/v055/gone.jpg']
        AND NOT EXISTS (SELECT 1 FROM public.missing_review_media(ARRAY[]::TEXT[]))
       THEN 'PASS' ELSE 'FAIL' END;

INSERT INTO probe_results
SELECT 'media functions closed to clients',
  CASE WHEN NOT has_function_privilege('anon', 'public.missing_review_media(text[])', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.missing_review_media(text[])', 'EXECUTE')
        AND NOT has_function_privilege('anon', 'public.list_orphan_media(interval, integer)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.list_orphan_media(interval, integer)', 'EXECUTE')
       THEN 'PASS' ELSE 'FAIL' END;

SELECT * FROM probe_results;

ROLLBACK;
