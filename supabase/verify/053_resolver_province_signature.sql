-- Verification for migration 053 (province-aware resolver installed). Local
-- stack only:
--   docker exec -i supabase_db_<project_id> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/verify/053_resolver_province_signature.sql
-- Every probe row must read PASS. Reads the catalog, so it also flags a
-- database still carrying the 3-argument draft from an early 049.
BEGIN;

CREATE TEMP TABLE probe_results (probe TEXT, outcome TEXT);

INSERT INTO probe_results
SELECT 'only the province-aware resolver exists',
  CASE WHEN string_agg(oid::regprocedure::text, ', ')
            = 'find_or_create_university_by_name(text,text,text,text)'
       THEN 'PASS' ELSE 'FAIL: ' || coalesce(string_agg(oid::regprocedure::text, ', '), 'none') END
FROM pg_proc
WHERE proname = 'find_or_create_university_by_name'
  AND pronamespace = 'public'::regnamespace;

-- to_regprocedure: a missing function reads as FAIL instead of erroring.
INSERT INTO probe_results
SELECT 'resolver is service-role only',
  CASE WHEN p IS NULL THEN 'FAIL: province-aware resolver missing'
       WHEN has_function_privilege('service_role', p, 'EXECUTE')
        AND NOT has_function_privilege('authenticated', p, 'EXECUTE')
        AND NOT has_function_privilege('anon', p, 'EXECUTE')
       THEN 'PASS' ELSE 'FAIL' END
FROM (SELECT to_regprocedure('public.find_or_create_university_by_name(text,text,text,text)') AS p) s;

SELECT * FROM probe_results;

ROLLBACK;
