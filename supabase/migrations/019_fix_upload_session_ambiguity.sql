-- Migration 019: Fix ambiguous column references in use_upload_session
-- The RETURNS TABLE column names (ip, is_anon, user_id, files_used, max_files,
-- expires_at) can shadow the underlying table columns, causing "column reference
-- is ambiguous" errors inside PL/pgSQL. Fully qualify every table reference.

CREATE OR REPLACE FUNCTION public.use_upload_session(p_session_id UUID)
RETURNS TABLE(
  ip TEXT,
  is_anon BOOLEAN,
  user_id UUID,
  files_used INT,
  max_files INT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.upload_sessions
  SET files_used = public.upload_sessions.files_used + 1
  WHERE public.upload_sessions.id = p_session_id
    AND public.upload_sessions.expires_at > NOW()
    AND public.upload_sessions.files_used < public.upload_sessions.max_files
  RETURNING public.upload_sessions.ip,
            public.upload_sessions.is_anon,
            public.upload_sessions.user_id,
            public.upload_sessions.files_used,
            public.upload_sessions.max_files,
            public.upload_sessions.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.use_upload_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.use_upload_session(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
