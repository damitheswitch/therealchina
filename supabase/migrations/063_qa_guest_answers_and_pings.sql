-- 063: guest answers on Community Q&A + reviewer ping log. Up-only.
--
-- 1. Guests can answer without an account (community-submit, Turnstile +
--    rate limits). Their rows carry author_id NULL and are always
--    is_anonymous, so they render as "Anonymous" and nobody owns them.
-- 2. qa_ping_log: one row per "a question about your university was asked"
--    email sent to a past reviewer. Used for the per-recipient 7 day throttle.

ALTER TABLE public.qa_answers
  ALTER COLUMN author_id DROP NOT NULL;

ALTER TABLE public.qa_answers
  DROP CONSTRAINT IF EXISTS qa_answers_guest_anonymous,
  ADD CONSTRAINT qa_answers_guest_anonymous
    CHECK (author_id IS NOT NULL OR is_anonymous);

-- is_author must be a plain boolean for guest rows (author_id NULL would make
-- the old expression NULL for signed-in viewers). Same columns and types, so
-- CREATE OR REPLACE keeps the existing grants.
CREATE OR REPLACE VIEW public.qa_answers_public AS
SELECT
  a.id,
  a.question_id,
  a.body,
  CASE WHEN a.is_anonymous THEN NULL ELSE a.author_id END AS author_id,
  COALESCE(auth.uid() IS NOT NULL AND auth.uid() = a.author_id, FALSE) AS is_author,
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
  -- Hidden with their soft-deleted question (migration 050).
  AND EXISTS (
    SELECT 1 FROM public.qa_questions pq
    WHERE pq.id = a.question_id AND pq.deleted_at IS NULL
  );

-- Reviewer pings. recipient_email is stored lowercased; the table is the only
-- place a ping address is kept, and it is service role only.
CREATE TABLE IF NOT EXISTS public.qa_ping_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.qa_questions(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_kind TEXT NOT NULL CHECK (recipient_kind IN ('member', 'anonymous')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qa_ping_log_question_recipient UNIQUE (question_id, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_qa_ping_log_recipient
  ON public.qa_ping_log (recipient_email, created_at);

ALTER TABLE public.qa_ping_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qa_ping_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.qa_ping_log TO service_role;

NOTIFY pgrst, 'reload schema';
