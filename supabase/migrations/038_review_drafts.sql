-- Saved review drafts: authenticated users can resume abandoned reviews from
-- their profile, and the university page can gently prompt them to finish.
-- Drafts are private (RLS), never surfaced to search engines or public pages.

CREATE TABLE IF NOT EXISTS public.review_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  progress SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT review_drafts_payload_size CHECK (pg_column_size(payload) <= 262144),
  CONSTRAINT review_drafts_progress_range CHECK (progress BETWEEN 0 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_review_drafts_user_id ON public.review_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_review_drafts_university_id ON public.review_drafts(university_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_drafts_user_university
  ON public.review_drafts(user_id, university_id)
  WHERE university_id IS NOT NULL;

ALTER TABLE public.review_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read own drafts" ON public.review_drafts;
CREATE POLICY "Authenticated users can read own drafts"
  ON public.review_drafts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert own drafts" ON public.review_drafts;
CREATE POLICY "Authenticated users can insert own drafts"
  ON public.review_drafts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can update own drafts" ON public.review_drafts;
CREATE POLICY "Authenticated users can update own drafts"
  ON public.review_drafts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can delete own drafts" ON public.review_drafts;
CREATE POLICY "Authenticated users can delete own drafts"
  ON public.review_drafts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_review_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_review_drafts_updated_at_trigger ON public.review_drafts;
CREATE TRIGGER update_review_drafts_updated_at_trigger
  BEFORE UPDATE ON public.review_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_review_drafts_updated_at();
