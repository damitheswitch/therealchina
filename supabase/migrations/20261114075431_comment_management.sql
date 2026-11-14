-- Preserve replies when an author removes their comment. Browser clients can
-- insert only composer fields; edits and deletions go through owner-checked RPCs.
ALTER TABLE public.comments
  ADD COLUMN edited_at TIMESTAMPTZ,
  ADD COLUMN deleted_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "Authenticated delete access to own comments" ON public.comments;
REVOKE ALL ON public.comments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.comments TO anon, authenticated;
GRANT INSERT (review_id, user_id, parent_id, text) ON public.comments TO authenticated;

CREATE OR REPLACE FUNCTION public.edit_comment(p_comment_id UUID, p_text TEXT)
RETURNS SETOF public.comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
ROWS 1
AS $$
DECLARE
  v_comment public.comments;
  v_text TEXT;
BEGIN
  SELECT * INTO v_comment FROM public.comments
  WHERE id = p_comment_id AND user_id = (SELECT auth.uid())
  FOR UPDATE;
  IF NOT FOUND OR v_comment.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Comment unavailable' USING ERRCODE = 'P0002';
  END IF;

  v_text := pg_catalog.regexp_replace(p_text, '^\s+|\s+$', '', 'g');
  IF v_text IS NULL OR pg_catalog.char_length(v_text) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Comment must be between 1 and 2000 characters' USING ERRCODE = '22023';
  END IF;

  IF v_comment.text IS DISTINCT FROM v_text THEN
    UPDATE public.comments SET text = v_text, edited_at = pg_catalog.clock_timestamp()
    WHERE id = v_comment.id RETURNING * INTO v_comment;
  END IF;
  RETURN NEXT v_comment;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_comment(p_comment_id UUID)
RETURNS SETOF public.comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
ROWS 1
AS $$
DECLARE
  v_comment public.comments;
BEGIN
  SELECT * INTO v_comment FROM public.comments
  WHERE id = p_comment_id AND user_id = (SELECT auth.uid())
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment unavailable' USING ERRCODE = 'P0002';
  END IF;

  IF v_comment.deleted_at IS NULL THEN
    UPDATE public.comments
    SET text = 'Comment deleted', deleted_at = pg_catalog.clock_timestamp()
    WHERE id = v_comment.id RETURNING * INTO v_comment;
  END IF;
  RETURN NEXT v_comment;
END;
$$;

REVOKE ALL ON FUNCTION public.edit_comment(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_comment(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.edit_comment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_comment(UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';
