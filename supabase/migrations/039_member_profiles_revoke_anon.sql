-- Migration 039: Close member_profiles to anonymous readers
--
-- member_profiles is the authenticated member directory. Every migration that
-- recreates it (012/016/017) runs CREATE VIEW, and Supabase default privileges
-- auto-grant SELECT to `anon` on new views — the view has been readable by
-- anyone holding the publishable key (bio, location, university, program,
-- social handles). Verified against prod.
--
-- Fix: explicitly revoke anon/PUBLIC read. The `authenticated` grant is kept —
-- the member directory is for signed-in users only.
--
-- IMPORTANT: any future migration that DROPs/CREATEs this view re-applies the
-- default grants and must re-run this revoke (CREATE re-grants default
-- privileges; CREATE OR REPLACE preserves them).
REVOKE SELECT ON public.member_profiles FROM PUBLIC, anon;

NOTIFY pgrst, 'reload schema';
