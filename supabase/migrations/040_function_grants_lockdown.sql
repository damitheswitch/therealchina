-- Migration 040: Lock down function EXECUTE grants to the roles that need them
--
-- Supabase default privileges grant EXECUTE on new functions directly to
-- `anon` and `authenticated` — `REVOKE ... FROM PUBLIC` does not remove those
-- per-role grants. Verified on prod: use_upload_session executed as anon,
-- which lets anyone poison rate-limit counters (DoS a user's review/upload
-- ability) or burn upload-session slots.
--
-- Service-role-only functions: revoke from PUBLIC, anon, authenticated and
-- re-grant to service_role. Authenticated-intended functions keep their
-- authenticated grant and lose PUBLIC + anon only.
--
-- RETURNS TRIGGER functions are never exposed through PostgREST, so trigger
-- helpers are out of scope; enqueue_comment_notification is tightened anyway
-- since it already carried a PUBLIC revoke.
--
-- IMPORTANT: CREATE FUNCTION re-applies default grants — any migration that
-- DROPs/recreates a function must re-run its revoke (CREATE OR REPLACE
-- preserves grants).

-- service_role only
REVOKE ALL ON FUNCTION public.record_upload_attempt(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_upload_attempt(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.use_upload_session(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.use_upload_session(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.cleanup_upload_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_upload_rate_limits() TO service_role;

REVOKE ALL ON FUNCTION public.refresh_university_stats(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_university_stats(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.enqueue_comment_notification() FROM PUBLIC, anon, authenticated;

-- authenticated callers (frontend) still need these; anon does not
REVOKE ALL ON FUNCTION public.profile_has_social_handle(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toggle_upvote(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_upvote(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
