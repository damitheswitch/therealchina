-- Fix: review_kind (stored generated column, 058) breaks the "vote-only
-- update" guard in update_reviews_updated_at. BEFORE UPDATE triggers see
-- generated columns as NULL in NEW while OLD carries the stored value, so the
-- jsonb diff always found a change and bumped updated_at on every upvote.
-- Strip review_kind from both sides; the generated value can never be written
-- directly, so excluding it cannot hide a real edit.

CREATE OR REPLACE FUNCTION public.update_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Vote-count bookkeeping is not an edit of the review.
  IF (to_jsonb(NEW) - 'upvote_count' - 'updated_at' - 'review_kind')
     = (to_jsonb(OLD) - 'upvote_count' - 'updated_at' - 'review_kind') THEN
    RETURN NEW;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
