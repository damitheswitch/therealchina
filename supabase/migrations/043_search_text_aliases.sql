-- Migration 043: widen universities.search_text for search
--
-- Site search (directory .or() and UniversityAutocomplete) never matched
-- slug_aliases, so abbreviations already stored there (ustc, njust, buaa)
-- returned zero results. Province was also searchable in the directory but
-- absent from search_text. Fold both into the generated column so every
-- search path gets them through the existing trigram index.
-- Generated columns can't be altered in place: drop and re-add. The index
-- depends on the column so it is recreated afterwards. Table grants are
-- unaffected (the table itself is not recreated).

-- array_to_string is STABLE, so a generated column can't call it directly.
-- For text[] its output is deterministic, so an IMMUTABLE wrapper is sound.
-- Internal-only: STORED columns compute at write time, so clients never
-- execute this; revoke the default grants.
CREATE OR REPLACE FUNCTION public.immutable_array_to_string(arr TEXT[], sep TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT pg_catalog.array_to_string(arr, sep)
$$;

REVOKE ALL ON FUNCTION public.immutable_array_to_string(TEXT[], TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.immutable_array_to_string(TEXT[], TEXT) TO service_role;

DROP INDEX IF EXISTS public.idx_universities_search_trgm;

ALTER TABLE public.universities DROP COLUMN search_text;
ALTER TABLE public.universities ADD COLUMN search_text TEXT GENERATED ALWAYS AS (
  lower(
    replace(coalesce(name, ''), '&amp;', '&') || ' ' ||
    replace(coalesce(name_zh, ''), '&amp;', '&') || ' ' ||
    replace(coalesce(city, ''), '&amp;', '&') || ' ' ||
    replace(coalesce(province, ''), '&amp;', '&') || ' ' ||
    replace(coalesce(slug, ''), '&amp;', '&') || ' ' ||
    public.immutable_array_to_string(slug_aliases, ' ')
  )
) STORED;

CREATE INDEX idx_universities_search_trgm
  ON public.universities USING gin (search_text gin_trgm_ops);
