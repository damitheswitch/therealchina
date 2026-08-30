-- ============================================
-- TRC 015: Security patch — high-priority fixes
-- ============================================
--
-- 1. Fix search_path on public.toggle_upvote and public.enforce_comment_nesting
--    to prevent pg_temp table substitution (search-path hijack).
-- 2. Revoke pg_net (net.http_get/net.http_post) access from public/anon/auth
--    to prevent SSRF / outbound HTTP abuse.
-- 3. Revoke pgbouncer.get_auth from PUBLIC to prevent database role password
--    hash disclosure.
-- 4. Hardening: make UPDATE policies on comments and profiles explicit with
--    WITH CHECK (no behavior change, PostgreSQL already does this implicitly).
--
-- Safe to re-run: every statement is idempotent.
-- ============================================

-- 1. toggle_upvote: SECURITY DEFINER but missing a safe search_path.
--    Re-create with search_path = '' and fully-qualified public.upvotes refs.
CREATE OR REPLACE FUNCTION public.toggle_upvote(p_review_id uuid)
RETURNS TABLE(upvoted boolean, upvote_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user_id UUID;
  v_existing_upvote public.upvotes;
  v_count BIGINT;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to upvote';
  END IF;

  SELECT * INTO v_existing_upvote
  FROM public.upvotes
  WHERE user_id = v_user_id AND review_id = p_review_id;

  IF v_existing_upvote IS NOT NULL THEN
    DELETE FROM public.upvotes
    WHERE id = v_existing_upvote.id;

    SELECT COUNT(*) INTO v_count
    FROM public.upvotes
    WHERE review_id = p_review_id;

    RETURN QUERY SELECT FALSE::BOOLEAN AS upvoted, v_count AS upvote_count;
  ELSE
    INSERT INTO public.upvotes (user_id, review_id)
    VALUES (v_user_id, p_review_id)
    ON CONFLICT (user_id, review_id) DO NOTHING;

    SELECT COUNT(*) INTO v_count
    FROM public.upvotes
    WHERE review_id = p_review_id;

    RETURN QUERY SELECT TRUE::BOOLEAN AS upvoted, v_count AS upvote_count;
  END IF;
END;
$$;

-- Restrict the upvote RPC to the roles that should be able to call it.
-- (anon cannot upvote anyway because the function errors when auth.uid() is null.)
DO $$
DECLARE
  grantees TEXT;
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.toggle_upvote(uuid) FROM PUBLIC';

  SELECT string_agg(quote_ident(rolname), ', ')
  INTO grantees
  FROM pg_roles
  WHERE rolname IN ('authenticated', 'service_role');

  IF grantees IS NOT NULL THEN
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.toggle_upvote(uuid) TO %s', grantees);
  END IF;
END $$;

-- 2. enforce_comment_nesting: missing safe search_path on public.comments reference.
CREATE OR REPLACE FUNCTION public.enforce_comment_nesting()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
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
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Lock down pg_net so only service/admin roles can make outbound HTTP.
--    This prevents anon/authenticated users from using the database as an HTTP proxy.
DO $$
DECLARE
  net_roles TEXT;
  grantees TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'net') THEN
    RETURN;
  END IF;

  -- Build the list of public-facing auth roles that may currently be granted.
  SELECT string_agg(quote_ident(rolname), ', ')
  INTO net_roles
  FROM pg_roles
  WHERE rolname IN ('anon', 'authenticated', 'PUBLIC');

  IF net_roles IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA net FROM %s', net_roles);
    EXECUTE format('REVOKE USAGE ON SCHEMA net FROM %s', net_roles);
  END IF;

  -- Re-grant to the roles that legitimately need it.
  SELECT string_agg(quote_ident(rolname), ', ')
  INTO grantees
  FROM pg_roles
  WHERE rolname IN ('postgres', 'service_role');

  IF grantees IS NOT NULL THEN
    EXECUTE format('GRANT USAGE ON SCHEMA net TO %s', grantees);
    EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO %s', grantees);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_functions_admin') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA net TO supabase_functions_admin';
    EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO supabase_functions_admin';
  END IF;
END $$;

-- 4. Lock down pgbouncer.get_auth so it cannot be called by PUBLIC.
--    This function returns the rolpassword (hash) for any database role from pg_authid.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.routines
    WHERE routine_schema = 'pgbouncer' AND routine_name = 'get_auth'
  ) THEN
    RETURN;
  END IF;

  EXECUTE 'REVOKE ALL ON FUNCTION pgbouncer.get_auth(text) FROM PUBLIC';
  EXECUTE 'REVOKE USAGE ON SCHEMA pgbouncer FROM PUBLIC';

  -- Re-grant to the pgbouncer service role if it exists, so the pooler keeps working.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgbouncer') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA pgbouncer TO pgbouncer';
    EXECUTE 'GRANT EXECUTE ON FUNCTION pgbouncer.get_auth(text) TO pgbouncer';
  END IF;
END $$;

-- 5. Hardening: make UPDATE policies explicit. PostgreSQL already uses USING
--    as WITH CHECK when WITH CHECK is omitted, but being explicit avoids future
--    misconfiguration.
DROP POLICY IF EXISTS "Authenticated update access to own comments" ON public.comments;
CREATE POLICY "Authenticated update access to own comments"
  ON public.comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated update access to own profile" ON public.profiles;
CREATE POLICY "Authenticated update access to own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ============================================
-- COMPLETED
-- ============================================
