-- 048_community_qa.sql
-- Community Q&A: real tables replacing the frontend mock (Phase 6, PR #49/#57
-- prototype). The whole /community read surface goes through two public
-- views that mask anonymous authors and expose only aggregate counts; every
-- write goes through the community-submit Edge Function or the security
-- definer RPCs below. There are no direct client INSERT/UPDATE/DELETE paths.
--
-- Moderation model (owner memo, docs/engagement/06-qa-cold-start.md):
-- soft delete via deleted_at, set by service role only (dashboard / SQL).
-- qa_reports collects user reports for the owner to review — no public read.

-- ---------------------------------------------------------
-- Tables
-- ---------------------------------------------------------

CREATE TABLE public.qa_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT,
  university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  -- Author opt-in for answer notification emails (ask-form checkbox +
  -- per-question toggle). The qa-notify function skips when false.
  notify_on_answer BOOLEAN NOT NULL DEFAULT TRUE,
  accepted_answer_id UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qa_questions_slug_format
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 140),
  CONSTRAINT qa_questions_title_length
    CHECK (char_length(btrim(title)) BETWEEN 10 AND 160),
  CONSTRAINT qa_questions_body_length
    CHECK (char_length(btrim(body)) BETWEEN 20 AND 5000),
  -- Mirrors COMMUNITY_CATEGORIES in frontend/src/lib/community.ts — update
  -- both together.
  CONSTRAINT qa_questions_category
    CHECK (category IN (
      'visas', 'driving', 'money', 'housing', 'academics',
      'work', 'health', 'tech', 'life', 'other'
    )),
  CONSTRAINT qa_questions_city_length
    CHECK (city IS NULL OR char_length(city) <= 120)
);

CREATE UNIQUE INDEX qa_questions_slug_key ON public.qa_questions(slug);
CREATE INDEX idx_qa_questions_created_at ON public.qa_questions(created_at DESC);
CREATE INDEX idx_qa_questions_category ON public.qa_questions(category);
CREATE INDEX idx_qa_questions_university ON public.qa_questions(university_id);
CREATE INDEX idx_qa_questions_author ON public.qa_questions(author_id);
CREATE INDEX idx_qa_questions_active ON public.qa_questions(deleted_at) WHERE deleted_at IS NULL;

CREATE TABLE public.qa_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.qa_questions(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  body TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qa_answers_body_length
    CHECK (char_length(btrim(body)) BETWEEN 10 AND 5000)
);

CREATE INDEX idx_qa_answers_question ON public.qa_answers(question_id);
CREATE INDEX idx_qa_answers_author ON public.qa_answers(author_id);
CREATE INDEX idx_qa_answers_active ON public.qa_answers(deleted_at) WHERE deleted_at IS NULL;

-- Added after qa_answers exists (circular reference).
ALTER TABLE public.qa_questions
  ADD CONSTRAINT qa_questions_accepted_fk
  FOREIGN KEY (accepted_answer_id) REFERENCES public.qa_answers(id) ON DELETE SET NULL;

-- Votes are rows per user; counts are computed, never stored, so they cannot
-- drift. Writes only via the toggle_*_vote RPCs.
CREATE TABLE public.qa_question_votes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.qa_questions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

CREATE TABLE public.qa_answer_votes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer_id UUID NOT NULL REFERENCES public.qa_answers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, answer_id)
);

CREATE INDEX idx_qa_question_votes_question ON public.qa_question_votes(question_id);
CREATE INDEX idx_qa_answer_votes_answer ON public.qa_answer_votes(answer_id);

-- Reports: one row per reporter per target (the two partial UNIQUEs; NULLs
-- stay distinct so the question constraint never sees answer reports).
CREATE TABLE public.qa_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.qa_questions(id) ON DELETE CASCADE,
  answer_id UUID REFERENCES public.qa_answers(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qa_reports_one_target
    CHECK (num_nonnulls(question_id, answer_id) = 1),
  CONSTRAINT qa_reports_reason_length
    CHECK (reason IS NULL OR char_length(reason) <= 500)
);

CREATE UNIQUE INDEX qa_reports_unique_question
  ON public.qa_reports(reporter_id, question_id) WHERE question_id IS NOT NULL;
CREATE UNIQUE INDEX qa_reports_unique_answer
  ON public.qa_reports(reporter_id, answer_id) WHERE answer_id IS NOT NULL;

-- ---------------------------------------------------------
-- RLS: base tables are not client-readable at all. Reads happen through the
-- *_public views below so anonymous authorship stays masked at the database
-- level, not just in the UI.
-- ---------------------------------------------------------

ALTER TABLE public.qa_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_question_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_answer_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.qa_questions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.qa_answers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.qa_question_votes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.qa_answer_votes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.qa_reports FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.qa_questions TO service_role;
GRANT ALL ON public.qa_answers TO service_role;
GRANT ALL ON public.qa_question_votes TO service_role;
GRANT ALL ON public.qa_answer_votes TO service_role;
GRANT ALL ON public.qa_reports TO service_role;

-- ---------------------------------------------------------
-- Public read views (security-definer semantics: the view owner reads the
-- locked-down tables; the view itself is granted to clients).
-- ---------------------------------------------------------

-- One row per live question, with aggregate counts and the viewer's own
-- vote/ownership flags computed from auth.uid() — the same pattern as
-- flight_listings_with_profile (047). Voter identity is never projected,
-- only counts. accepted_answer_id is hidden when the accepted answer was
-- soft-deleted so the feed never shows a dangling "answered" mark.
CREATE OR REPLACE VIEW public.qa_questions_public AS
SELECT
  q.id,
  q.slug,
  q.title,
  q.body,
  q.category,
  q.city,
  q.university_id,
  u.name AS university_name,
  u.slug AS university_slug,
  CASE WHEN q.is_anonymous THEN NULL ELSE q.author_id END AS author_id,
  (auth.uid() IS NOT NULL AND auth.uid() = q.author_id) AS is_author,
  CASE WHEN auth.uid() = q.author_id THEN q.notify_on_answer END AS notify_on_answer,
  CASE WHEN ans.deleted_at IS NULL THEN q.accepted_answer_id END AS accepted_answer_id,
  q.created_at,
  (SELECT count(*) FROM public.qa_answers a
    WHERE a.question_id = q.id AND a.deleted_at IS NULL) AS answer_count,
  (SELECT count(*) FROM public.qa_question_votes v
    WHERE v.question_id = q.id) AS upvote_count,
  EXISTS (
    SELECT 1 FROM public.qa_question_votes v
    WHERE v.question_id = q.id AND v.user_id = auth.uid()
  ) AS viewer_upvoted
FROM public.qa_questions q
LEFT JOIN public.universities u ON u.id = q.university_id
LEFT JOIN public.qa_answers ans ON ans.id = q.accepted_answer_id
WHERE q.deleted_at IS NULL;

GRANT SELECT ON public.qa_questions_public TO anon;
GRANT SELECT ON public.qa_questions_public TO authenticated;

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
WHERE a.deleted_at IS NULL;

GRANT SELECT ON public.qa_answers_public TO anon;
GRANT SELECT ON public.qa_answers_public TO authenticated;

-- ---------------------------------------------------------
-- Functions
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_qa_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_qa_questions_updated_at_trigger ON public.qa_questions;
CREATE TRIGGER update_qa_questions_updated_at_trigger
  BEFORE UPDATE ON public.qa_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_qa_questions_updated_at();

-- Vote toggles mirror toggle_upvote: auth required, idempotent, returns the
-- fresh count so the UI never re-fetches. Voting on your own post is allowed
-- ("me too" semantics); voting on soft-deleted targets is not.
CREATE OR REPLACE FUNCTION public.toggle_question_upvote(p_question_id UUID)
RETURNS TABLE(upvoted boolean, upvote_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_count BIGINT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to upvote';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.qa_questions
    WHERE id = p_question_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Question not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.qa_question_votes
    WHERE user_id = v_user_id AND question_id = p_question_id
  ) THEN
    DELETE FROM public.qa_question_votes
    WHERE user_id = v_user_id AND question_id = p_question_id;
    SELECT count(*) INTO v_count FROM public.qa_question_votes
      WHERE question_id = p_question_id;
    RETURN QUERY SELECT FALSE, v_count;
  ELSE
    INSERT INTO public.qa_question_votes (user_id, question_id)
    VALUES (v_user_id, p_question_id)
    ON CONFLICT (user_id, question_id) DO NOTHING;
    SELECT count(*) INTO v_count FROM public.qa_question_votes
      WHERE question_id = p_question_id;
    RETURN QUERY SELECT TRUE, v_count;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_answer_upvote(p_answer_id UUID)
RETURNS TABLE(upvoted boolean, upvote_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_count BIGINT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to upvote';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.qa_answers
    WHERE id = p_answer_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Answer not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.qa_answer_votes
    WHERE user_id = v_user_id AND answer_id = p_answer_id
  ) THEN
    DELETE FROM public.qa_answer_votes
    WHERE user_id = v_user_id AND answer_id = p_answer_id;
    SELECT count(*) INTO v_count FROM public.qa_answer_votes
      WHERE answer_id = p_answer_id;
    RETURN QUERY SELECT FALSE, v_count;
  ELSE
    INSERT INTO public.qa_answer_votes (user_id, answer_id)
    VALUES (v_user_id, p_answer_id)
    ON CONFLICT (user_id, answer_id) DO NOTHING;
    SELECT count(*) INTO v_count FROM public.qa_answer_votes
      WHERE answer_id = p_answer_id;
    RETURN QUERY SELECT TRUE, v_count;
  END IF;
END;
$$;

-- Question author marks (or clears, p_answer_id NULL) the accepted answer.
-- The answer must belong to that question and be live.
CREATE OR REPLACE FUNCTION public.set_accepted_answer(p_question_id UUID, p_answer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.qa_questions
    WHERE id = p_question_id AND author_id = v_user_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Question not found';
  END IF;

  IF p_answer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.qa_answers
    WHERE id = p_answer_id AND question_id = p_question_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Answer not found';
  END IF;

  UPDATE public.qa_questions
    SET accepted_answer_id = p_answer_id
    WHERE id = p_question_id;
END;
$$;

-- Opt-out path for answer notifications: the question author flips
-- notify_on_answer. qa-notify re-reads it at send time.
CREATE OR REPLACE FUNCTION public.set_question_notify(p_question_id UUID, p_enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  UPDATE public.qa_questions
    SET notify_on_answer = p_enabled
    WHERE id = p_question_id
      AND author_id = v_user_id
      AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found';
  END IF;
END;
$$;

-- Same lockdown as toggle_upvote (migration 040): callable by signed-in
-- users, never by anon or PUBLIC.
REVOKE ALL ON FUNCTION public.toggle_question_upvote(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toggle_answer_upvote(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_accepted_answer(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_question_notify(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_question_upvote(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_answer_upvote(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_accepted_answer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_question_notify(UUID, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.update_qa_questions_updated_at() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------
-- Answer notification log (service-role only, mirrors comment_email_log).
-- The queue hop is community-submit -> qa-notify over HTTP with a shared
-- secret (QA_NOTIFY_SECRET), not a pg_net trigger: community-submit is the
-- only write path, so no DB trigger or Vault secrets are needed.
-- ---------------------------------------------------------

CREATE TABLE public.qa_email_log (
  answer_id UUID PRIMARY KEY REFERENCES public.qa_answers(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.qa_questions(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qa_email_log_recipient
  ON public.qa_email_log (recipient_user_id, created_at);
CREATE INDEX idx_qa_email_log_question_recipient
  ON public.qa_email_log (question_id, recipient_user_id, created_at);

ALTER TABLE public.qa_email_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qa_email_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.qa_email_log TO service_role;

NOTIFY pgrst, 'reload schema';
