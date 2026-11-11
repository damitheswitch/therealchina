-- 062: share-link referrals + keep a guest's email only when they opted in.
--
-- 1. review_referrals: a review that came in through a reviewer's share link
--    (?ref=<gift code>). Written only by review-submit (service role), after it
--    checked the code belongs to an existing gift. The owner counts referrals
--    per gift code to hand out the second gift by hand. No client access.
-- 2. cleanup_review_rewards(): the 90-day email deletion now skips guests who
--    ticked "email me when students ask about my university"
--    (reviewer_context.email_consent). Everyone else is unchanged.

CREATE TABLE IF NOT EXISTS public.review_referrals (
  review_id UUID PRIMARY KEY REFERENCES public.reviews(id) ON DELETE CASCADE,
  ref_code TEXT NOT NULL CHECK (ref_code ~ '^TRC-[0-9A-HJKMNP-TV-Z]{6}$'),
  referrer_review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (review_id <> referrer_review_id)
);

CREATE INDEX IF NOT EXISTS idx_review_referrals_ref_code ON public.review_referrals(ref_code);

ALTER TABLE public.review_referrals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_referrals FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.review_referrals TO service_role;

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
    AND rc.email_consent = FALSE
    AND COALESCE(rr.sent_at, rr.requested_at) < NOW() - INTERVAL '90 days';

  UPDATE public.review_rewards
  SET status = 'expired'
  WHERE status = 'waiting' AND requested_at < NOW() - INTERVAL '90 days';

  DELETE FROM public.review_rewards WHERE requested_at < NOW() - INTERVAL '1 year';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_review_rewards() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_review_rewards() TO service_role;
