-- Migration 053: install the province-aware university resolver on databases
-- that applied an earlier draft of migration 049.
--
-- 049 gained find_or_create_university_by_name(name, city, slug, province)
-- after staging had already applied it, and db push never re-runs an applied
-- migration. Such a database keeps only the 3-argument draft (or none), so
-- review-submit, which passes p_province, would fail for weak-slug "not
-- listed" universities. This migration drops the 3-argument draft if present
-- and installs the final definition with its service-role grants. On a
-- database that ran the final 049 it re-creates the same function.

-- p_province joined the signature, so the earlier 3-argument version is
-- dropped first (it exists on databases that ran an earlier draft of this
-- migration). Grants are restated below for the new signature.
DROP FUNCTION IF EXISTS public.find_or_create_university_by_name(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.find_or_create_university_by_name(
  p_name TEXT,
  p_city TEXT,
  p_slug TEXT,
  p_province TEXT DEFAULT NULL
)
RETURNS TABLE(id UUID, slug TEXT, created BOOLEAN)
LANGUAGE plpgsql
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_key TEXT := lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
  v_city TEXT := lower(regexp_replace(btrim(coalesce(p_city, '')), '\s+', ' ', 'g'));
  v_province TEXT := lower(regexp_replace(btrim(coalesce(p_province, '')), '\s+', ' ', 'g'));
BEGIN
  IF v_key = '' THEN
    RAISE EXCEPTION 'University name is required.';
  END IF;

  -- Serialize concurrent submissions of the same name; the lock is released
  -- at the end of the calling transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended('universities.name:' || v_key, 0));

  -- Same name, and then either the same city, or a row with no recorded city
  -- (province-only) in the same province. Known cities or provinces that
  -- differ never match: a generic name can belong to different universities,
  -- and a review attached to the wrong one can't be moved back automatically.
  -- An exact city match wins.
  RETURN QUERY
  SELECT u.id, u.slug, false
  FROM public.universities u
  WHERE (lower(regexp_replace(btrim(u.name), '\s+', ' ', 'g')) = v_key
         OR lower(regexp_replace(btrim(u.name_zh), '\s+', ' ', 'g')) = v_key)
    AND (
      (v_city <> ''
       AND lower(regexp_replace(btrim(coalesce(u.city, '')), '\s+', ' ', 'g')) = v_city)
      OR (coalesce(btrim(u.city), '') = ''
          AND v_province <> ''
          AND lower(regexp_replace(btrim(coalesce(u.province, '')), '\s+', ' ', 'g')) = v_province)
    )
    AND (coalesce(btrim(u.province), '') = ''
         OR v_province = ''
         OR lower(regexp_replace(btrim(u.province), '\s+', ' ', 'g')) = v_province)
  ORDER BY (lower(regexp_replace(btrim(coalesce(u.city, '')), '\s+', ' ', 'g')) = v_city) DESC,
           u.created_at
  LIMIT 1;
  IF FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO public.universities AS u (name, city, province, slug)
  VALUES (btrim(p_name), p_city, nullif(btrim(coalesce(p_province, '')), ''), p_slug)
  RETURNING u.id, u.slug, true;
END;
$$;

REVOKE ALL ON FUNCTION public.find_or_create_university_by_name(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_university_by_name(TEXT, TEXT, TEXT, TEXT) TO service_role;
