-- 033_rate_limit_retention_cron.sql
--
-- upload_rate_limits / upload_sessions hold IP addresses, so they should not
-- be kept forever. The existing cleanup function deleted rows older than 24h
-- but was never scheduled. This keeps 7 days (enough to investigate an abuse
-- wave; the limiter itself only reads the current hour) and runs it daily.

CREATE OR REPLACE FUNCTION public.cleanup_upload_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  DELETE FROM public.upload_rate_limits WHERE window_start < NOW() - INTERVAL '7 days';
  DELETE FROM public.upload_sessions WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_upload_rate_limits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_upload_rate_limits() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- cron.schedule upserts by job name (pg_cron >= 1.5), so re-runs are safe.
SELECT cron.schedule(
  'cleanup-upload-rate-limits',
  '17 3 * * *',
  $$SELECT public.cleanup_upload_rate_limits();$$
);
