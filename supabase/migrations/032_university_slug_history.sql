-- 032_university_slug_history.sql
--
-- Slug permanence for SEO: when a university's slug changes, the old slug is
-- kept in slug_aliases automatically so the site can 301 the old URL. Also
-- normalizes slug_aliases on every write (dedupe, no empties, never contains
-- the canonical slug) and enforces the URL-safe slug format on new writes.

CREATE OR REPLACE FUNCTION public.track_university_slug_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.slug_aliases := COALESCE((
    SELECT array_agg(DISTINCT a ORDER BY a)
    FROM unnest(
      CASE WHEN TG_OP = 'UPDATE' AND NEW.slug IS DISTINCT FROM OLD.slug
           THEN array_append(COALESCE(NEW.slug_aliases, '{}'), OLD.slug)
           ELSE COALESCE(NEW.slug_aliases, '{}') END
    ) AS a
    WHERE a IS NOT NULL AND a <> '' AND a <> NEW.slug
  ), '{}');
  RETURN NEW;
END;
$$;

-- Two triggers (one per event type) because UPDATE OF <columns> cannot be
-- combined with other event types in a single trigger definition.
DROP TRIGGER IF EXISTS university_slug_history_ins ON public.universities;
CREATE TRIGGER university_slug_history_ins
  BEFORE INSERT ON public.universities
  FOR EACH ROW
  EXECUTE FUNCTION public.track_university_slug_change();

DROP TRIGGER IF EXISTS university_slug_history_upd ON public.universities;
CREATE TRIGGER university_slug_history_upd
  BEFORE UPDATE OF slug, slug_aliases ON public.universities
  FOR EACH ROW
  EXECUTE FUNCTION public.track_university_slug_change();

-- URL-safe slugs only. NOT VALID so the (already slug-shaped) existing rows
-- are not scanned; the check applies to all new writes immediately.
ALTER TABLE public.universities
  DROP CONSTRAINT IF EXISTS universities_slug_format,
  ADD CONSTRAINT universities_slug_format
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') NOT VALID;
