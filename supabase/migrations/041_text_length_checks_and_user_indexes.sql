-- Migration 041: Length CHECKs on user text + missing owner indexes
--
-- Authenticated onboarded users can INSERT reviews/comments (and flight
-- listings) directly through PostgREST — that path bypasses the edge
-- functions' field validation entirely (_shared/reviewFields.ts LIMITS).
-- These CHECKs mirror the edge caps so a crafted request can't write
-- unbounded payloads:
--   reviewFields caps: text 10..5000, program 120, degreeLevel 60,
--   pros/cons 1000, language_of_instruction 60, tuition/living ranges 40,
--   tags <= 20 items (per-element 40 isn't expressible in a CHECK).
-- Comments and flight_listings.notes have no edge validation at all; their
-- caps match the UI textarea limits (2000 / 1000).
-- All added NOT VALID: existing rows aren't scanned (deploy-safe on live
-- tables), new writes are enforced from the moment the migration lands.

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS chk_reviews_text_length,
  ADD CONSTRAINT chk_reviews_text_length
    CHECK (char_length(text) BETWEEN 10 AND 5000) NOT VALID,
  DROP CONSTRAINT IF EXISTS chk_reviews_pros_length,
  ADD CONSTRAINT chk_reviews_pros_length
    CHECK (pros IS NULL OR char_length(pros) <= 1000) NOT VALID,
  DROP CONSTRAINT IF EXISTS chk_reviews_cons_length,
  ADD CONSTRAINT chk_reviews_cons_length
    CHECK (cons IS NULL OR char_length(cons) <= 1000) NOT VALID,
  DROP CONSTRAINT IF EXISTS chk_reviews_program_length,
  ADD CONSTRAINT chk_reviews_program_length
    CHECK (program IS NULL OR char_length(program) <= 120) NOT VALID,
  DROP CONSTRAINT IF EXISTS chk_reviews_degree_level_length,
  ADD CONSTRAINT chk_reviews_degree_level_length
    CHECK (degree_level IS NULL OR char_length(degree_level) <= 60) NOT VALID,
  DROP CONSTRAINT IF EXISTS chk_reviews_language_length,
  ADD CONSTRAINT chk_reviews_language_length
    CHECK (
      language_of_instruction IS NULL OR char_length(language_of_instruction) <= 60
    ) NOT VALID,
  DROP CONSTRAINT IF EXISTS chk_reviews_tuition_range_length,
  ADD CONSTRAINT chk_reviews_tuition_range_length
    CHECK (tuition_range IS NULL OR char_length(tuition_range) <= 40) NOT VALID,
  DROP CONSTRAINT IF EXISTS chk_reviews_living_cost_range_length,
  ADD CONSTRAINT chk_reviews_living_cost_range_length
    CHECK (living_cost_range IS NULL OR char_length(living_cost_range) <= 40) NOT VALID,
  DROP CONSTRAINT IF EXISTS chk_reviews_tags_cardinality,
  ADD CONSTRAINT chk_reviews_tags_cardinality
    CHECK (cardinality(tags) <= 20) NOT VALID;

ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS chk_comments_text_length,
  ADD CONSTRAINT chk_comments_text_length
    CHECK (char_length(text) BETWEEN 1 AND 2000) NOT VALID;

ALTER TABLE public.flight_listings
  DROP CONSTRAINT IF EXISTS chk_flight_listings_notes_length,
  ADD CONSTRAINT chk_flight_listings_notes_length
    CHECK (notes IS NULL OR char_length(notes) <= 1000) NOT VALID;

-- Every "my reviews"/"my comments"/member-profile read filters on the owner
-- column; both lacked indexes and seq-scanned the whole table.
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
