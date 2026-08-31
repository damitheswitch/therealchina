-- Migration 018: Secure media uploads
-- All uploads now route through the media-upload Edge Function.
-- Storage writes are restricted to the service role key; the browser can only read.

-- 1. Rate limit counter (one row per key/hour, not per attempt)
CREATE TABLE IF NOT EXISTS public.upload_rate_limits (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_upload_rate_limits_last_attempt
  ON public.upload_rate_limits (last_attempt_at);

-- 2. Short-lived upload sessions
CREATE TABLE IF NOT EXISTS public.upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT NOT NULL,
  is_anon BOOLEAN NOT NULL DEFAULT TRUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  files_used INT NOT NULL DEFAULT 0,
  max_files INT NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires_at
  ON public.upload_sessions (expires_at);

-- 3. Atomic rate-limit tick
CREATE OR REPLACE FUNCTION public.record_upload_attempt(p_key TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_window TIMESTAMPTZ;
  v_count INT;
BEGIN
  v_window := date_trunc('hour', NOW());
  INSERT INTO public.upload_rate_limits (key, window_start, count, last_attempt_at)
  VALUES (p_key, v_window, 1, NOW())
  ON CONFLICT (key, window_start) DO UPDATE
  SET count = public.upload_rate_limits.count + 1,
      last_attempt_at = NOW()
  RETURNING count INTO v_count;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_upload_attempt(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_upload_attempt(TEXT) TO service_role;

-- 4. Atomic session use
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
  SET files_used = files_used + 1
  WHERE id = p_session_id
    AND expires_at > NOW()
    AND files_used < max_files
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

-- 5. Cleanup helper (call manually, via pg_cron, or a scheduled edge function)
CREATE OR REPLACE FUNCTION public.cleanup_upload_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  DELETE FROM public.upload_rate_limits WHERE window_start < NOW() - INTERVAL '24 hours';
  DELETE FROM public.upload_sessions WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_upload_rate_limits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_upload_rate_limits() TO service_role;

-- 6. RLS: only the service role (and table owners) can touch these
ALTER TABLE public.upload_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.upload_rate_limits TO service_role;
GRANT ALL ON public.upload_sessions TO service_role;

-- 7. Storage hardening: remove public write/delete, keep public read
DROP POLICY IF EXISTS "Public upload access on review-media" ON storage.objects;
DROP POLICY IF EXISTS "Public delete access on review-media" ON storage.objects;

DROP POLICY IF EXISTS "Public read access on review-media" ON storage.objects;
CREATE POLICY "Public read access on review-media"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'review-media');

-- Note: storage.objects is owned by supabase_storage_admin. If the DROP/CREATE
-- above fails in the SQL Editor with a permission/owner error, apply the changes
-- manually via the Supabase Dashboard: Storage > review-media > Policies.

-- 8. Schema cache reload
NOTIFY pgrst, 'reload schema';
