-- promote_descriptive_slugs.sql — UPDATE-only, idempotent, safe to replay.
-- Data file (not a migration): depends on seed_merge.sql data applied manually
-- per environment. Run AFTER seed_merge.sql on each env (local / staging / prod).
--
-- Canonical slug policy:
--   1) Rows with a ShanghaiRanking institution URL take that descriptive slug
--      (e.g. 'tsinghua' -> 'tsinghua-university').
--   2) Rows without one whose slug is "<word>-<number>" get slugify(name)
--      (e.g. 'beijing-3' -> 'beijing-university-of-technology').
-- Old slugs are preserved in slug_aliases by trigger university_slug_history
-- (migration 032), so every old URL can 301 to the new one.
DO $$
DECLARE
  r RECORD;
  v_new TEXT;
BEGIN
  FOR r IN SELECT id, slug, name, rankings FROM public.universities LOOP
    v_new := substring(r.rankings->>'shanghai_url' from '/institution/([a-z0-9-]+)$');
    IF v_new IS NULL AND r.slug ~ '-[0-9]+$' THEN
      v_new := trim(both '-' from regexp_replace(lower(r.name), '[^a-z0-9]+', '-', 'g'));
    END IF;
    IF v_new IS NULL OR v_new = '' OR v_new = r.slug THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.universities u WHERE u.id <> r.id
               AND (u.slug = v_new OR v_new = ANY(u.slug_aliases))) THEN
      RAISE NOTICE 'skip %: % already taken', r.slug, v_new;
      CONTINUE;
    END IF;
    UPDATE public.universities SET slug = v_new WHERE id = r.id;
  END LOOP;
END $$;
