-- 037_review_claims.sql
-- Anonymous reviews become claimable. A reviewer's browser generates a random
-- claim token at submit time (localStorage) and review-submit stores it on the
-- private reviewer_context row. When that person later signs up or logs in,
-- the review-claim Edge Function offers the matching reviews and they pick,
-- per review: put their name on it (reviews.user_id = them — public author,
-- Verified seal), keep it anonymous (reviewer_context.owner_id = them — shows
-- in their account, still renders "Anonymous" publicly), or say it is not
-- theirs (token cleared, never offered again). Email stored on the context row
-- doubles as a second matcher so reviews written on another device can still
-- be found once the same address signs up.
--
-- Everything here stays inside reviewer_context, which is service-role only
-- (RLS enabled, no policies, all client grants revoked). Public reads of
-- reviews therefore can never reveal an anonymously-claimed reviewer.

ALTER TABLE public.reviewer_context
  ADD COLUMN IF NOT EXISTS claim_token UUID,
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claim_dismissed BOOLEAN NOT NULL DEFAULT FALSE;

-- Lookups are always equality on a present token / owner, so partial indexes
-- keep the mostly-null columns cheap.
CREATE INDEX IF NOT EXISTS idx_reviewer_context_claim_token
  ON public.reviewer_context(claim_token)
  WHERE claim_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviewer_context_owner_id
  ON public.reviewer_context(owner_id)
  WHERE owner_id IS NOT NULL;
