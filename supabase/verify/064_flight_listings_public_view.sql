-- Verification for migration 064 (guest-safe flight board). Local stack only:
--   docker exec -i supabase_db_<project_id> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/verify/064_flight_listings_public_view.sql
-- Every probe row must read PASS.
BEGIN;

CREATE TEMP TABLE probe_results (probe TEXT, outcome TEXT);

INSERT INTO probe_results
SELECT 'anon cannot select flight_listings',
  CASE WHEN NOT has_table_privilege('anon', 'public.flight_listings', 'SELECT') THEN 'PASS' ELSE 'FAIL' END;

INSERT INTO probe_results
SELECT 'anon cannot select flight_listings_with_profile',
  CASE WHEN NOT has_table_privilege('anon', 'public.flight_listings_with_profile', 'SELECT') THEN 'PASS' ELSE 'FAIL' END;

INSERT INTO probe_results
SELECT 'anon can select flight_listings_public',
  CASE WHEN has_table_privilege('anon', 'public.flight_listings_public', 'SELECT') THEN 'PASS' ELSE 'FAIL' END;

INSERT INTO probe_results
SELECT 'anon cannot write flight_listings_public',
  CASE WHEN NOT has_table_privilege('anon', 'public.flight_listings_public', 'INSERT, UPDATE, DELETE') THEN 'PASS' ELSE 'FAIL' END;

INSERT INTO probe_results
SELECT 'authenticated keeps with_profile and table access',
  CASE WHEN has_table_privilege('authenticated', 'public.flight_listings_with_profile', 'SELECT')
        AND has_table_privilege('authenticated', 'public.flight_listings', 'SELECT')
       THEN 'PASS' ELSE 'FAIL' END;

INSERT INTO probe_results
SELECT 'public view exposes no owner or contact columns',
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL: ' || string_agg(column_name, ',') END
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'flight_listings_public'
  AND column_name IN ('user_id', 'notes', 'contact_platforms', 'social_handles', 'avatar_url', 'display_name');

INSERT INTO probe_results
SELECT 'table SELECT policy is authenticated-only',
  CASE WHEN roles = '{authenticated}' THEN 'PASS' ELSE 'FAIL: ' || roles::text END
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'flight_listings' AND cmd = 'SELECT';

SELECT * FROM probe_results;

ROLLBACK;
