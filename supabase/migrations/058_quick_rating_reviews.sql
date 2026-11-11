-- Quick ratings: a review can carry a rating (+ optional tags) with no
-- written text. text becomes nullable; review_kind derives the label so the
-- API, the UI, and the SEO indexable rule read one definition that can never
-- drift (a text added later flips the kind to 'full' automatically).
-- Numbered 058: trc-staging already holds remote-only versions 049-055 from
-- another branch, so this goes after the highest remote version (057).

ALTER TABLE public.reviews ALTER COLUMN text DROP NOT NULL;

-- Presence is now optional; when present the same length bounds apply.
-- NOT VALID keeps existing rows out of the check (unchanged semantics).
ALTER TABLE public.reviews
DROP CONSTRAINT IF EXISTS chk_reviews_text_length,
ADD CONSTRAINT chk_reviews_text_length
  CHECK (text IS NULL OR char_length(text) BETWEEN 10 AND 5000)
  NOT VALID;

-- 'quick' = no written text (rating-only or tag-only). 'full' = has text.
-- Stored generated: readable in selects and indexable, never writable.
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS review_kind TEXT
GENERATED ALWAYS AS (
  CASE WHEN text IS NULL OR btrim(text) = '' THEN 'quick' ELSE 'full' END
) STORED;
