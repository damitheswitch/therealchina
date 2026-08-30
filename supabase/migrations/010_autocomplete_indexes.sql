-- ============================================
-- TRC Migration 010: Autocomplete performance
-- Faster, accurate city/university search for the full university seed,
-- including searches by acronym/slug (e.g. "ustc", "uestc", "njust").
-- Run in your Supabase SQL editor.
-- Safe to re-run: every statement is idempotent.
-- ============================================

-- 1. Make sure trigram support is available
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Clean HTML-encoded ampersands from the imported CSV so labels and search
--    match what users actually type.
UPDATE universities
SET
  name = replace(name, '&amp;', '&'),
  city = replace(city, '&amp;', '&'),
  name_zh = replace(name_zh, '&amp;', '&')
WHERE name LIKE '%&amp;%' OR city LIKE '%&amp;%' OR name_zh LIKE '%&amp;%';

-- 3. Drop the old search column/index so we can redefine it to include slug.
DROP INDEX IF EXISTS idx_universities_search_trgm;
ALTER TABLE universities
DROP COLUMN IF EXISTS search_text;

-- 4. Add a generated, lowercased search column spanning name, Chinese name, city, and slug.
--    Using STORED so we can index it and avoid recomputing on every search.
ALTER TABLE universities
ADD COLUMN search_text TEXT
GENERATED ALWAYS AS (
  lower(
    replace(coalesce(name, ''), '&amp;', '&') || ' ' ||
    replace(coalesce(name_zh, ''), '&amp;', '&') || ' ' ||
    replace(coalesce(city, ''), '&amp;', '&') || ' ' ||
    replace(coalesce(slug, ''), '&amp;', '&')
  )
) STORED;

-- 5. GIN trigram indexes for fast prefix/substring search
CREATE INDEX IF NOT EXISTS idx_universities_search_trgm
  ON universities USING gin (search_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_universities_city_trgm
  ON universities USING gin (city gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_universities_name_trgm
  ON universities USING gin (name gin_trgm_ops);

-- 6. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ============================================
-- COMPLETED
-- ============================================
