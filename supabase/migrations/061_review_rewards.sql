-- 061: thank-you gift for full reviews. Up-only; the feature stays off until the
-- REWARD_ENABLED secret is set, so applying this changes nothing for reviewers.

-- Thank-you gift for full reviews (migration 061). One row per review that
-- asked for the gift. Holds NO email: the guest's address stays on the private
-- reviewer_context row and a member's address comes from auth.users at send
-- time. email_key is an HMAC of the normalized address, used only to give one
-- gift per person. Service role only: RLS on, no policies, client grants
-- revoked (new public tables are auto-granted to anon/authenticated).
CREATE TABLE IF NOT EXISTS public.review_rewards (
  review_id UUID PRIMARY KEY REFERENCES public.reviews(id) ON DELETE CASCADE,
  auth_kind TEXT NOT NULL CHECK (auth_kind IN ('anonymous', 'signed_in')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN (
      'waiting', 'sending', 'sent', 'failed', 'email_used', 'email_blocked',
      'contacted', 'fulfilled', 'declined', 'expired'
    )),
  reward_code TEXT NOT NULL UNIQUE CHECK (reward_code ~ '^TRC-[0-9A-HJKMNP-TV-Z]{6}$'),
  email_key TEXT UNIQUE CHECK (email_key IS NULL OR email_key ~ '^[0-9a-f]{64}$'),
  own_word_count INT NOT NULL DEFAULT 0,
  detail_areas TEXT[] NOT NULL DEFAULT '{}',
  similarity_max REAL,
  flags TEXT[] NOT NULL DEFAULT '{}',
  send_attempts INT NOT NULL DEFAULT 0,
  resend_id TEXT,
  owner_note TEXT CHECK (owner_note IS NULL OR char_length(owner_note) <= 500),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  handled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_review_rewards_status ON public.review_rewards(status);

ALTER TABLE public.review_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_rewards FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.review_rewards TO service_role;

-- Called by the Edge Functions right before sending. Locks the row, enforces
-- one gift per email key and a copy-paste check on the reviewer's own words,
-- and returns 'send', 'email_used', 'duplicate_text' or 'skip'.
CREATE OR REPLACE FUNCTION public.dispatch_review_reward(
  p_review_id UUID,
  p_email_key TEXT,
  p_own_text TEXT,
  p_own_words INT,
  p_areas TEXT[]
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.review_rewards%ROWTYPE;
  v_sim REAL := 0;
BEGIN
  SELECT * INTO v_row
  FROM public.review_rewards
  WHERE review_id = p_review_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'skip';
  END IF;
  -- 'sending' older than 5 minutes means the sender died mid-send; allow a retry.
  IF v_row.send_attempts >= 3 OR NOT (
    v_row.status IN ('waiting', 'failed')
    OR (v_row.status = 'sending' AND v_row.last_attempt_at < NOW() - INTERVAL '5 minutes')
  ) THEN
    RETURN 'skip';
  END IF;

  IF p_email_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.review_rewards o
    WHERE o.email_key = p_email_key AND o.review_id <> p_review_id
  ) THEN
    UPDATE public.review_rewards SET status = 'email_used' WHERE review_id = p_review_id;
    RETURN 'email_used';
  END IF;

  SELECT COALESCE(max(public.similarity(p_own_text, o.text)), 0) INTO v_sim
  FROM public.reviews o
  WHERE o.id <> p_review_id
    AND o.deleted_at IS NULL
    AND o.text IS NOT NULL
    AND o.created_at > NOW() - INTERVAL '180 days';

  IF v_sim >= 0.85 THEN
    UPDATE public.review_rewards
    SET status = 'declined',
        similarity_max = v_sim,
        flags = array_append(flags, 'near_duplicate'),
        owner_note = 'auto: near-duplicate text'
    WHERE review_id = p_review_id;
    RETURN 'duplicate_text';
  END IF;

  UPDATE public.review_rewards
  SET email_key = p_email_key,
      own_word_count = p_own_words,
      detail_areas = p_areas,
      similarity_max = v_sim,
      flags = CASE
        WHEN v_sim >= 0.6 AND NOT ('near_duplicate' = ANY (flags))
          THEN array_append(flags, 'near_duplicate')
        ELSE flags
      END,
      send_attempts = send_attempts + 1,
      status = 'sending',
      last_attempt_at = NOW()
  WHERE review_id = p_review_id;

  RETURN 'send';
EXCEPTION WHEN unique_violation THEN
  UPDATE public.review_rewards SET status = 'email_used' WHERE review_id = p_review_id;
  RETURN 'email_used';
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_review_reward(UUID, TEXT, TEXT, INT, TEXT[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_review_reward(UUID, TEXT, TEXT, INT, TEXT[])
  TO service_role;

-- Daily retention: drop the guest's private email 90 days after the gift email
-- (or 90 days after the request if the review never became full), mark stale
-- requests expired, and delete the bookkeeping rows after a year.
CREATE OR REPLACE FUNCTION public.cleanup_review_rewards()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.reviewer_context rc
  SET email = NULL
  FROM public.review_rewards rr
  WHERE rr.review_id = rc.review_id
    AND rc.email IS NOT NULL
    AND COALESCE(rr.sent_at, rr.requested_at) < NOW() - INTERVAL '90 days';

  UPDATE public.review_rewards
  SET status = 'expired'
  WHERE status = 'waiting' AND requested_at < NOW() - INTERVAL '90 days';

  DELETE FROM public.review_rewards WHERE requested_at < NOW() - INTERVAL '1 year';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_review_rewards() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_review_rewards() TO service_role;

SELECT cron.schedule(
  'cleanup-review-rewards',
  '29 3 * * *',
  $$SELECT public.cleanup_review_rewards();$$
);
