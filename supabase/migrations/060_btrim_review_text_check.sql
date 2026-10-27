-- Whitespace-only text satisfied the length check (10 spaces >= 10 chars)
-- while every write path treats it as no text at all: the edge validators
-- trim it to null and review_kind reads btrim(text). Measure the trimmed
-- length so the constraint agrees with the rest of the stack.
ALTER TABLE public.reviews
DROP CONSTRAINT IF EXISTS chk_reviews_text_length,
ADD CONSTRAINT chk_reviews_text_length
  CHECK (text IS NULL OR char_length(btrim(text)) BETWEEN 10 AND 5000)
  NOT VALID;
