-- 036_comment_notifications.sql
--
-- Email the review owner when someone comments on their review:
--
--   comments INSERT trigger → net.http_post → comment-notify Edge Function
--   → Resend API → owner inbox
--
-- The trigger reads two secrets from Supabase Vault so the same migration
-- works unchanged on local, staging, and prod:
--   comment_notify_url     e.g. https://<project-ref>.supabase.co/functions/v1/comment-notify
--                        locally: http://kong:8000/functions/v1/comment-notify
--   comment_notify_secret  shared secret the function checks via the
--                        x-notify-secret header (never the service key)
-- Set them once per environment with vault.create_secret(). When either is
-- missing the trigger is a no-op, so environments without a mailer (fresh
-- local stacks, CI) still accept comments.
--
-- comment_email_log is the dedupe + audit table: one row per comment,
-- written only by the comment-notify function (service role).

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

CREATE TABLE IF NOT EXISTS public.comment_email_log (
  comment_id UUID PRIMARY KEY REFERENCES public.comments(id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comment_email_log_recipient
  ON public.comment_email_log (recipient_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_comment_email_log_review_recipient
  ON public.comment_email_log (review_id, recipient_user_id, created_at);

-- Internal-only, same posture as reviewer_context: RLS on, no client
-- policies, clients fully revoked. Only the service role reads/writes it.
ALTER TABLE public.comment_email_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.comment_email_log FROM anon, authenticated;
GRANT ALL ON public.comment_email_log TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_comment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
BEGIN
  SELECT s.decrypted_secret INTO v_url
    FROM vault.decrypted_secrets AS s
    WHERE s.name = 'comment_notify_url'
    LIMIT 1;
  SELECT s.decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets AS s
    WHERE s.name = 'comment_notify_secret'
    LIMIT 1;

  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', v_secret
    ),
    body := jsonb_build_object('comment_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- A notification must never block or roll back the comment insert.
  RAISE WARNING 'comment notification enqueue failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_comment_notification() FROM PUBLIC;

DROP TRIGGER IF EXISTS comment_notify_inserted ON public.comments;
CREATE TRIGGER comment_notify_inserted
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_comment_notification();
