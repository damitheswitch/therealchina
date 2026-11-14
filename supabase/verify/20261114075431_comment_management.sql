-- Local/CI only. Transactional fixtures are rolled back, including pg_net jobs.
BEGIN;
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('00000000-0000-4000-8000-0000000067a1', 'owner067@example.test', '{}', 'authenticated', 'authenticated'),
       ('00000000-0000-4000-8000-0000000067a2', 'reply067@example.test', '{}', 'authenticated', 'authenticated');
UPDATE public.profiles SET onboarding_completed = true
WHERE id IN ('00000000-0000-4000-8000-0000000067a1', '00000000-0000-4000-8000-0000000067a2');
INSERT INTO public.universities (id, name, city, slug)
VALUES ('00000000-0000-4000-8000-0000000067b1', 'Comment Verify Uni', 'Beijing', 'comment-verify-067');
INSERT INTO public.reviews (id, university_id, rating, text)
VALUES ('00000000-0000-4000-8000-0000000067c1', '00000000-0000-4000-8000-0000000067b1', 4, 'Comment management fixture');
INSERT INTO public.comments (id, review_id, user_id, parent_id, text)
VALUES ('00000000-0000-4000-8000-0000000067d1', '00000000-0000-4000-8000-0000000067c1', '00000000-0000-4000-8000-0000000067a1', NULL, 'parent text'),
       ('00000000-0000-4000-8000-0000000067d2', '00000000-0000-4000-8000-0000000067c1', '00000000-0000-4000-8000-0000000067a2', '00000000-0000-4000-8000-0000000067d1', 'reply text');

DO $$
DECLARE
  v_row public.comments;
  v_original public.comments;
  v_deleted_at TIMESTAMPTZ;
  v_invalid TEXT;
BEGIN
  ASSERT NOT has_table_privilege('authenticated', 'public.comments', 'UPDATE');
  ASSERT NOT has_table_privilege('authenticated', 'public.comments', 'DELETE');
  ASSERT NOT has_table_privilege('anon', 'public.comments', 'TRUNCATE');
  ASSERT NOT has_function_privilege('anon', 'public.edit_comment(uuid,text)', 'EXECUTE');
  ASSERT NOT has_function_privilege('anon', 'public.delete_comment(uuid)', 'EXECUTE');
  ASSERT has_column_privilege('authenticated', 'public.comments', 'text', 'INSERT');
  ASSERT NOT has_column_privilege('authenticated', 'public.comments', 'deleted_at', 'INSERT');
  ASSERT NOT has_column_privilege('authenticated', 'public.comments', 'edited_at', 'INSERT');
  ASSERT NOT has_column_privilege('authenticated', 'public.comments', 'created_at', 'INSERT');

  SELECT * INTO v_original FROM public.comments WHERE id = '00000000-0000-4000-8000-0000000067d1';
  SET LOCAL ROLE authenticated;
  -- Authenticated role without a user identity also fails closed.
  PERFORM set_config('request.jwt.claims', '{}', true);
  BEGIN
    PERFORM public.edit_comment(v_original.id, 'no identity');
    RAISE EXCEPTION 'FAIL: missing identity accepted';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000067a1","role":"authenticated"}', true);
  BEGIN
    UPDATE public.comments SET text = 'bypass' WHERE id = v_original.id;
    RAISE EXCEPTION 'FAIL: direct update accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.comments WHERE id = v_original.id;
    RAISE EXCEPTION 'FAIL: direct delete accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.comments (review_id, user_id, text, deleted_at)
    VALUES (v_original.review_id, v_original.user_id, 'forged', NOW());
    RAISE EXCEPTION 'FAIL: forged deletion metadata accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- Existing composers continue to insert using exactly these columns.
  INSERT INTO public.comments (review_id, user_id, parent_id, text)
  VALUES (v_original.review_id, v_original.user_id, NULL, 'new comment');

  FOREACH v_invalid IN ARRAY ARRAY[NULL, '', E' \t\n ', repeat('a', 2001)] LOOP
    BEGIN
      PERFORM public.edit_comment(v_original.id, v_invalid);
      RAISE EXCEPTION 'FAIL: invalid text accepted';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
  END LOOP;
  SELECT * INTO v_row FROM public.edit_comment(v_original.id, E' \tupdated\n ');
  ASSERT v_row.text = 'updated' AND v_row.edited_at IS NOT NULL;
  ASSERT v_row.id = v_original.id AND v_row.user_id = v_original.user_id
     AND v_row.review_id = v_original.review_id AND v_row.parent_id IS NOT DISTINCT FROM v_original.parent_id
     AND v_row.created_at IS NOT DISTINCT FROM v_original.created_at;
  SELECT * INTO v_original FROM public.edit_comment(v_original.id, 'updated');
  ASSERT v_original.edited_at = v_row.edited_at, 'Unchanged text must not update edit timestamp';
  SELECT * INTO v_row FROM public.edit_comment(v_original.id, repeat('a', 2000));
  ASSERT char_length(v_row.text) = 2000;
  SELECT * INTO v_row FROM public.edit_comment(v_original.id, 'x');
  ASSERT v_row.text = 'x';

  -- Another user's reply and a missing row are indistinguishable.
  BEGIN
    PERFORM public.edit_comment('00000000-0000-4000-8000-0000000067d2', 'stolen');
    RAISE EXCEPTION 'FAIL: edited another author';
  EXCEPTION WHEN no_data_found THEN ASSERT SQLERRM = 'Comment unavailable';
  END;
  BEGIN
    PERFORM public.delete_comment('00000000-0000-4000-8000-0000000067d2');
    RAISE EXCEPTION 'FAIL: deleted another author';
  EXCEPTION WHEN no_data_found THEN ASSERT SQLERRM = 'Comment unavailable';
  END;
  BEGIN
    PERFORM public.delete_comment('00000000-0000-4000-8000-0000000067ff');
    RAISE EXCEPTION 'FAIL: missing row accepted';
  EXCEPTION WHEN no_data_found THEN ASSERT SQLERRM = 'Comment unavailable';
  END;

  SELECT * INTO v_row FROM public.delete_comment(v_original.id);
  ASSERT v_row.deleted_at IS NOT NULL AND v_row.text = 'Comment deleted';
  v_deleted_at := v_row.deleted_at;
  SELECT * INTO v_row FROM public.delete_comment(v_original.id);
  ASSERT v_row.deleted_at = v_deleted_at, 'Deletion must be idempotent';
  ASSERT EXISTS (SELECT 1 FROM public.comments WHERE id = '00000000-0000-4000-8000-0000000067d2' AND text = 'reply text' AND deleted_at IS NULL);
  BEGIN
    PERFORM public.edit_comment(v_original.id, 'resurrect');
    RAISE EXCEPTION 'FAIL: edited a deleted comment';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  -- Reply authors can manage their own replies after the parent is deleted.
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000067a2","role":"authenticated"}', true);
  SELECT * INTO v_row FROM public.edit_comment('00000000-0000-4000-8000-0000000067d2', 'reply edited');
  ASSERT v_row.parent_id = v_original.id AND v_row.text = 'reply edited';
  PERFORM public.delete_comment(v_row.id);
  RESET ROLE;
  ASSERT (SELECT COUNT(*) FROM public.comments WHERE review_id = v_original.review_id AND deleted_at IS NULL) = 1;
  -- Administrative review deletion retains its existing cascade behavior.
  DELETE FROM public.reviews WHERE id = v_original.review_id;
  ASSERT NOT EXISTS (SELECT 1 FROM public.comments WHERE review_id = v_original.review_id);
END $$;
SELECT 'comment management ownership, validation, permissions, replies and idempotency' AS probe, 'PASS' AS outcome;
ROLLBACK;
