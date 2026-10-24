-- Verification for migration 052 (departed trips visible again). Local stack
-- only:
--   docker exec -i supabase_db_<project_id> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/verify/052_restore_past_flights.sql
-- Every probe row must read PASS. Reads the catalog, so it also catches a
-- database that still carries the 050/051 date filter.
BEGIN;

CREATE TEMP TABLE probe_results (probe TEXT, outcome TEXT);

INSERT INTO probe_results
SELECT 'view has no departure-date filter',
  CASE WHEN pg_get_viewdef('public.flight_listings_with_profile'::regclass) !~ 'departure_date\s*>='
       THEN 'PASS' ELSE 'FAIL: view still filters departed trips' END;

INSERT INTO probe_results
SELECT 'table policy has no departure-date filter',
  CASE WHEN qual !~ 'departure_date' THEN 'PASS' ELSE 'FAIL: ' || qual END
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'flight_listings'
  AND policyname = 'Public read access to active flight listings';

INSERT INTO probe_results
SELECT 'table policy present', CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL: ' || count(*) END
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'flight_listings'
  AND policyname = 'Public read access to active flight listings';

SELECT * FROM probe_results;

ROLLBACK;
