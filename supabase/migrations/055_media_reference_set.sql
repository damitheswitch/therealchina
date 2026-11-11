-- Migration 055: cheaper orphan-media scan, and a lookup for media that no
-- longer exists.
--
-- 1. list_orphan_media (050) ran position(object name IN media::text) against
--    every review and draft for every object older than the cutoff. Objects
--    that are in use never leave that candidate set, so the work grew as
--    objects x reviews every day until the call would time out. It now builds
--    the set of referenced object names once (every string anywhere in
--    reviews.media and review_drafts.payload, reduced to the part after
--    /review-media/) and anti-joins storage.objects against it.
--
--    Exact name equality replaces substring matching, so it is only safe for
--    names that appear verbatim in a URL. Objects whose names contain
--    anything outside [A-Za-z0-9/._-] (which a URL might percent-encode) are
--    never listed. media-upload's safeObjectName only produces that charset.
--
-- 2. missing_review_media: object names from a submission that are not in the
--    review-media bucket. review-submit uses it to reject media that cleanup
--    already removed (an anonymous draft kept in localStorage is invisible to
--    the cleanup), instead of publishing a review with broken images.
--
-- Both are service role only. CREATE OR REPLACE keeps the 050 grants on
-- list_orphan_media; they are restated so the intent is local.

CREATE OR REPLACE FUNCTION public.list_orphan_media(p_min_age INTERVAL, p_limit INT)
RETURNS TABLE(name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH strings AS (
    SELECT s #>> '{}' AS s
    FROM public.reviews AS r,
         jsonb_path_query(coalesce(r.media, '[]'::jsonb), 'strict $.** ? (@.type() == "string")') AS s
    UNION ALL
    SELECT s #>> '{}'
    FROM public.review_drafts AS d,
         jsonb_path_query(d.payload, 'strict $.** ? (@.type() == "string")') AS s
  ),
  referenced AS (
    -- A public URL keeps the part after /review-media/ (query and fragment
    -- dropped); a bare string is kept as is in case it is already a path.
    SELECT DISTINCT coalesce(substring(s FROM '/review-media/([^?#]+)'), s) AS name
    FROM strings
  )
  SELECT o.name
  FROM storage.objects AS o
  WHERE o.bucket_id = 'review-media'
    AND o.created_at < NOW() - p_min_age
    AND o.name ~ '^[A-Za-z0-9/._-]+$'
    AND NOT EXISTS (SELECT 1 FROM referenced AS x WHERE x.name = o.name)
  ORDER BY o.created_at
  LIMIT LEAST(GREATEST(p_limit, 1), 1000);
$$;

REVOKE ALL ON FUNCTION public.list_orphan_media(INTERVAL, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_orphan_media(INTERVAL, INT) TO service_role;

CREATE OR REPLACE FUNCTION public.missing_review_media(p_names TEXT[])
RETURNS TABLE(name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT n
  FROM unnest(coalesce(p_names, ARRAY[]::TEXT[])) AS n
  WHERE NOT EXISTS (
    SELECT 1 FROM storage.objects AS o
    WHERE o.bucket_id = 'review-media' AND o.name = n
  );
$$;

REVOKE ALL ON FUNCTION public.missing_review_media(TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.missing_review_media(TEXT[]) TO service_role;
