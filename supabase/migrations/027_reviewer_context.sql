-- =========================================================
-- 027_reviewer_context.sql
--
-- Private context for ANONYMOUS reviewers. The wizard collects
-- the same "about you" fields from everyone, but anonymous users
-- have no profiles row to write to. This table keeps their
-- answers (incl. email for early-access consent) internal-only:
-- RLS enabled with no policies + explicit REVOKE means only the
-- service role (review-submit edge function) can read or write.
-- Nothing here is ever exposed to anon or authenticated clients.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.reviewer_context (
  review_id UUID PRIMARY KEY REFERENCES public.reviews(id) ON DELETE CASCADE,
  email TEXT,
  email_consent BOOLEAN NOT NULL DEFAULT FALSE,
  home_country TEXT,
  current_status TEXT
    CHECK (current_status IS NULL OR current_status IN
      ('studying','working','internship','job_hunting','break','other')),
  languages_spoken TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reviewer_context ENABLE ROW LEVEL SECURITY;

-- Belt and braces: even if default privileges granted anything,
-- no client role may touch this table. Service role bypasses RLS.
REVOKE ALL ON public.reviewer_context FROM anon, authenticated;
