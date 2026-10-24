-- Migration 050: audit follow-ups (2026-10-24).
--
-- 1. reviews.upvote_count, maintained by triggers on upvotes. Clients read
--    counts from the review row instead of downloading the upvotes table,
--    which silently truncated at PostgREST's 1000-row cap. Expand step only:
--    the public SELECT on upvotes (voter identity) is revoked in a later
--    migration, once no deployed client reads counts from it.
-- 2. update_reviews_updated_at ignores upvote_count-only updates, and the
--    stats trigger only fires on the columns refresh_university_stats reads
--    (it used to recompute on every Boost save).
-- 3. toggle_upvote rejects soft-deleted reviews.
-- 4. Per-user rate limits on direct comment and flight-listing inserts,
--    enforced only for API callers (auth.uid() set) so seeds/admin SQL pass.
-- 5. content_reports: reports on reviews and comments, written by the
--    content-report Edge Function only.
-- 6. profiles.notify_on_comments: opt-out for comment notification emails.
-- 7. qa_answers_public hides answers under soft-deleted questions.
-- 8. Orphan media cleanup: list_orphan_media() + a daily cron that calls the
--    media-cleanup Edge Function (URL + secret from Vault; no-op until the
--    owner provisions them).
-- 9. Defense in depth: client grants revoked on upload_rate_limits and
--    upload_sessions; disposable-email messages without dashes.

-- ---- 1. upvote_count -------------------------------------------------------

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS upvote_count INT NOT NULL DEFAULT 0;

-- ---- 2. updated_at + stats triggers ----------------------------------------
-- Defined before the backfill so the backfill neither bumps updated_at nor
-- recomputes stats.

CREATE OR REPLACE FUNCTION public.update_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Vote-count bookkeeping is not an edit of the review.
  IF (to_jsonb(NEW) - 'upvote_count' - 'updated_at')
     = (to_jsonb(OLD) - 'upvote_count' - 'updated_at') THEN
    RETURN NEW;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_stats_on_update ON public.reviews;
CREATE TRIGGER trigger_update_stats_on_update
  AFTER UPDATE OF rating, recommend, deleted_at, university_id, user_id ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_university_stats_on_update();

UPDATE public.reviews AS r
SET upvote_count = c.n
FROM (
  SELECT review_id, COUNT(*)::INT AS n
  FROM public.upvotes
  GROUP BY review_id
) AS c
WHERE r.id = c.review_id
  AND r.upvote_count IS DISTINCT FROM c.n;

CREATE INDEX IF NOT EXISTS idx_reviews_upvote_count
  ON public.reviews (upvote_count DESC, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.sync_review_upvote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reviews
      SET upvote_count = upvote_count + 1
      WHERE id = NEW.review_id;
    RETURN NEW;
  END IF;

  UPDATE public.reviews
    SET upvote_count = GREATEST(upvote_count - 1, 0)
    WHERE id = OLD.review_id;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_review_upvote_count() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_review_upvote_count_trigger ON public.upvotes;
CREATE TRIGGER sync_review_upvote_count_trigger
  AFTER INSERT OR DELETE ON public.upvotes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_review_upvote_count();

-- ---- 3. toggle_upvote ------------------------------------------------------

CREATE OR REPLACE FUNCTION public.toggle_upvote(p_review_id uuid)
RETURNS TABLE(upvoted boolean, upvote_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_deleted BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to upvote';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.reviews
    WHERE id = p_review_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Review not found';
  END IF;

  DELETE FROM public.upvotes
  WHERE user_id = v_user_id AND review_id = p_review_id;
  v_deleted := FOUND;

  IF NOT v_deleted THEN
    INSERT INTO public.upvotes (user_id, review_id)
    VALUES (v_user_id, p_review_id)
    ON CONFLICT (user_id, review_id) DO NOTHING;
  END IF;

  RETURN QUERY
    SELECT NOT v_deleted, r.upvote_count::BIGINT
    FROM public.reviews AS r
    WHERE r.id = p_review_id;
END;
$$;

-- CREATE OR REPLACE keeps the 040 grants; restated so the intent is local.
REVOKE ALL ON FUNCTION public.toggle_upvote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_upvote(uuid) TO authenticated, service_role;

-- ---- 4. Direct-insert rate limits ------------------------------------------

CREATE INDEX IF NOT EXISTS idx_comments_user_created
  ON public.comments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flight_listings_user_created
  ON public.flight_listings (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.enforce_comment_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only API callers are limited; seeds and admin SQL run without a JWT.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF (
    SELECT COUNT(*) FROM public.comments
    WHERE user_id = NEW.user_id
      AND created_at > NOW() - INTERVAL '1 hour'
  ) >= 20 THEN
    RAISE EXCEPTION 'You have posted a lot of comments in the last hour. Please wait a little and try again.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_comment_rate_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_comment_rate_limit_trigger ON public.comments;
CREATE TRIGGER enforce_comment_rate_limit_trigger
  BEFORE INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_comment_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_flight_listing_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF (
    SELECT COUNT(*) FROM public.flight_listings
    WHERE user_id = NEW.user_id
      AND created_at > NOW() - INTERVAL '24 hours'
  ) >= 10 THEN
    RAISE EXCEPTION 'You have posted 10 listings in the last 24 hours. Please try again tomorrow.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_flight_listing_rate_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_flight_listing_rate_limit_trigger ON public.flight_listings;
CREATE TRIGGER enforce_flight_listing_rate_limit_trigger
  BEFORE INSERT ON public.flight_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_flight_listing_rate_limit();

-- ---- 5. content_reports ----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_id UUID REFERENCES public.reviews(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_reports_one_target
    CHECK (num_nonnulls(review_id, comment_id) = 1),
  CONSTRAINT content_reports_reason_length
    CHECK (reason IS NULL OR char_length(reason) <= 500)
);

CREATE UNIQUE INDEX IF NOT EXISTS content_reports_unique_review
  ON public.content_reports (reporter_id, review_id) WHERE review_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS content_reports_unique_comment
  ON public.content_reports (reporter_id, comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_reports_created_at
  ON public.content_reports (created_at DESC);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.content_reports FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.content_reports TO service_role;

-- ---- 6. Comment email opt-out ----------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_on_comments BOOLEAN NOT NULL DEFAULT TRUE;

-- ---- 7. Answers under deleted questions ------------------------------------

CREATE OR REPLACE VIEW public.qa_answers_public AS
SELECT
  a.id,
  a.question_id,
  a.body,
  CASE WHEN a.is_anonymous THEN NULL ELSE a.author_id END AS author_id,
  (auth.uid() IS NOT NULL AND auth.uid() = a.author_id) AS is_author,
  a.created_at,
  (SELECT count(*) FROM public.qa_answer_votes v
    WHERE v.answer_id = a.id) AS upvote_count,
  EXISTS (
    SELECT 1 FROM public.qa_answer_votes v
    WHERE v.answer_id = a.id AND v.user_id = auth.uid()
  ) AS viewer_upvoted,
  EXISTS (
    SELECT 1 FROM public.qa_questions q
    WHERE q.accepted_answer_id = a.id AND q.deleted_at IS NULL
  ) AS accepted
FROM public.qa_answers a
WHERE a.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.qa_questions pq
    WHERE pq.id = a.question_id AND pq.deleted_at IS NULL
  );

-- ---- 9. Orphan media cleanup -----------------------------------------------

-- Objects in review-media older than p_min_age that no review (live or
-- soft-deleted) and no draft references. position() is an exact substring
-- match: object names contain '_' which LIKE would treat as a wildcard.
CREATE OR REPLACE FUNCTION public.list_orphan_media(p_min_age INTERVAL, p_limit INT)
RETURNS TABLE(name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT o.name
  FROM storage.objects AS o
  WHERE o.bucket_id = 'review-media'
    AND o.created_at < NOW() - p_min_age
    AND NOT EXISTS (
      SELECT 1 FROM public.reviews AS r
      WHERE position(o.name IN r.media::text) > 0
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.review_drafts AS d
      WHERE position(o.name IN d.payload::text) > 0
    )
  ORDER BY o.created_at
  LIMIT LEAST(GREATEST(p_limit, 1), 1000);
$$;

REVOKE ALL ON FUNCTION public.list_orphan_media(INTERVAL, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_orphan_media(INTERVAL, INT) TO service_role;

-- Called by pg_cron. Reads the function URL + shared secret from Vault
-- (media_cleanup_url / media_cleanup_secret) and does nothing until both
-- exist, same pattern as enqueue_comment_notification.
CREATE OR REPLACE FUNCTION public.trigger_media_cleanup()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
BEGIN
  SELECT s.decrypted_secret INTO v_url
    FROM vault.decrypted_secrets AS s
    WHERE s.name = 'media_cleanup_url'
    LIMIT 1;
  SELECT s.decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets AS s
    WHERE s.name = 'media_cleanup_secret'
    LIMIT 1;

  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cleanup-secret', v_secret
    ),
    body := '{}'::jsonb
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'media cleanup trigger failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_media_cleanup() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'cleanup-orphan-media',
  '41 3 * * *',
  $$SELECT public.trigger_media_cleanup();$$
);

-- ---- 10. Defense in depth + copy -------------------------------------------

REVOKE ALL ON public.upload_rate_limits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.upload_sessions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hook_reject_disposable_email(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email TEXT;
BEGIN
  v_email := event->'user'->>'email';
  -- Phone signups and other flows without an email pass through.
  IF v_email IS NULL OR v_email = '' THEN
    RETURN '{}'::jsonb;
  END IF;

  IF NOT public.is_email_allowed(v_email) THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Please use a permanent email address. Disposable email domains are not allowed.'
      )
    );
  END IF;
  RETURN '{}'::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_email_domain_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- On INSERT, OLD is an all-NULL record, so this check runs whenever the
  -- new row carries an email. On UPDATE it only runs when email changed.
  IF NEW.email IS DISTINCT FROM OLD.email
     AND NEW.email IS NOT NULL
     AND NEW.email <> ''
     AND NOT public.is_email_allowed(NEW.email) THEN
    RAISE EXCEPTION 'Please use a permanent email address. Disposable email domains are not allowed.';
  END IF;
  RETURN NEW;
END;
$$;
