-- 029_university_slug_aliases.sql
--
-- One row per university, many resolvable slugs. `slug` stays canonical;
-- `slug_aliases` holds alternates (legacy seed slugs like 'zhejiang',
-- ShanghaiRanking institution slugs like 'tsinghua-university', common
-- abbreviations). Lookups use `slug = X OR slug_aliases @> {X}`.
-- No DB-level uniqueness on alias members — enforced by the merge/audit
-- scripts, which warn on collisions.

ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS slug_aliases TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS universities_slug_aliases_gin
  ON public.universities USING gin (slug_aliases);
