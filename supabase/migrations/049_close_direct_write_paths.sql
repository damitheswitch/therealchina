-- Migration 049: close the last direct client write paths that bypass the
-- gated Edge Functions.
--
-- 1. reviews: every submission (anonymous and signed-in) goes through the
--    review-submit Edge Function (rate limit, media URL allowlist, field
--    validation, service-role write). The leftover authenticated INSERT
--    policy let any onboarded user POST straight to PostgREST and skip all of
--    that (arbitrary media URLs, backdated created_at, no rate limit). The
--    frontend never used it. Drop the policy and the table privileges behind
--    it; reviews has no UPDATE/DELETE policies either (review-manage only).
--
-- 2. comments: the UPDATE policy let authors rewrite review_id, parent_id
--    and created_at. enforce_comment_nesting only ran on INSERT, so an update
--    could build reply-to-reply chains or move a comment onto another review.
--    The frontend has no comment edit. Drop the policy, revoke UPDATE, and
--    run the nesting check on UPDATE too so service-role/admin edits can't
--    break the invariant either.
--
-- 3. universities: review-submit resolves a "not listed" university whose
--    name has no identifying slug (non-Latin or generic-only) by name. Doing
--    the lookup and insert as two client calls let concurrent submissions
--    both miss and create two rows, and an exact .eq() match missed case and
--    whitespace variants. find_or_create_university_by_name does both under
--    a per-name advisory lock with a case-insensitive match. Service role only.
--
-- Revokes are per role: Supabase default privileges grant directly to anon
-- and authenticated, so FROM PUBLIC alone would not remove them.

DROP POLICY IF EXISTS "Authenticated users can insert reviews after onboarding" ON public.reviews;
REVOKE INSERT, UPDATE, DELETE ON public.reviews FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Authenticated update access to own comments" ON public.comments;
REVOKE UPDATE ON public.comments FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_comment_nesting()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  parent_comment public.comments;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT * INTO parent_comment
    FROM public.comments
    WHERE id = NEW.parent_id;

    IF parent_comment.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Replies to replies are not allowed. Maximum nesting depth is 1.';
    END IF;

    -- A reply must live on the same review as the comment it answers.
    IF parent_comment.review_id IS DISTINCT FROM NEW.review_id THEN
      RAISE EXCEPTION 'A reply must belong to the same review as its parent comment.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_comment_nesting_trigger ON public.comments;
CREATE TRIGGER enforce_comment_nesting_trigger
  BEFORE INSERT OR UPDATE OF parent_id, review_id ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_comment_nesting();

CREATE OR REPLACE FUNCTION public.find_or_create_university_by_name(
  p_name TEXT,
  p_city TEXT,
  p_slug TEXT
)
RETURNS TABLE(id UUID, slug TEXT, created BOOLEAN)
LANGUAGE plpgsql
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_key TEXT := lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
BEGIN
  IF v_key = '' THEN
    RAISE EXCEPTION 'University name is required.';
  END IF;

  -- Serialize concurrent submissions of the same name; the lock is released
  -- at the end of the calling transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended('universities.name:' || v_key, 0));

  RETURN QUERY
  SELECT u.id, u.slug, false
  FROM public.universities u
  WHERE lower(regexp_replace(btrim(u.name), '\s+', ' ', 'g')) = v_key
     OR lower(regexp_replace(btrim(u.name_zh), '\s+', ' ', 'g')) = v_key
  ORDER BY (lower(btrim(u.city)) IS NOT DISTINCT FROM lower(btrim(p_city))) DESC,
           u.created_at
  LIMIT 1;
  IF FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO public.universities AS u (name, city, slug)
  VALUES (btrim(p_name), p_city, p_slug)
  RETURNING u.id, u.slug, true;
END;
$$;

REVOKE ALL ON FUNCTION public.find_or_create_university_by_name(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_university_by_name(TEXT, TEXT, TEXT) TO service_role;
