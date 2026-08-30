-- ============================================
-- TRC Migration 009: Display name validation + onboarding
-- Run in your Supabase SQL Editor
-- Safe to re-run: every statement is idempotent
-- ============================================

-- 1. Add onboarding flag and ensure is_discoverable defaults to true
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

ALTER TABLE profiles
ALTER COLUMN is_discoverable SET DEFAULT true;

-- 2. Backfill: normalize names, NULL invalid names for users WITHOUT content,
--    suffix-rename duplicates so the unique index can be built.
DO $$
DECLARE
  affected_count INT;
BEGIN
  -- 2a. Normalize spacing and trim existing display names
  UPDATE profiles
  SET display_name = TRIM(REGEXP_REPLACE(REGEXP_REPLACE(display_name, '\s+', ' ', 'g'), '^\s+|\s+$', '', 'g'))
  WHERE display_name IS NOT NULL;

  -- 2b. Users WITHOUT content and invalid names (length/no letter): NULL them.
  --     CJK-only names are kept because they contain non-ASCII characters.
  UPDATE profiles
  SET display_name = NULL
  WHERE display_name IS NOT NULL
    AND (
      LENGTH(display_name) < 2
      OR LENGTH(display_name) > 32
      OR (display_name !~ '[A-Za-z]' AND display_name !~ '[^[:ascii:]]')
    )
    AND id NOT IN (SELECT DISTINCT user_id FROM reviews WHERE user_id IS NOT NULL)
    AND id NOT IN (SELECT DISTINCT user_id FROM comments WHERE user_id IS NOT NULL);

  -- 2c. Resolve ALL remaining duplicates (both with and without content):
  --     keep the oldest account's name as-is, suffix newer ones ("Alex 2", ...).
  UPDATE profiles p
  SET display_name = LEFT(p.display_name, 28) || ' ' || ranked.rn
  FROM (
    SELECT id, created_at,
      ROW_NUMBER() OVER (PARTITION BY LOWER(display_name) ORDER BY created_at ASC) AS rn
    FROM profiles
    WHERE display_name IS NOT NULL
  ) ranked
  WHERE p.id = ranked.id AND ranked.rn > 1;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Duplicate names suffixed: %', affected_count;
END $$;

-- 3. Backfill onboarding_completed and is_discoverable.
--    onboarding_completed = true only for users with a currently-valid name.
--    CJK-only names count as valid because they contain non-ASCII characters.
--    is_discoverable is set to true directly so the directory is not empty.
UPDATE profiles
SET
  onboarding_completed = (
    display_name IS NOT NULL
    AND LENGTH(display_name) BETWEEN 2 AND 32
    AND (display_name ~ '[A-Za-z]' OR display_name ~ '[^[:ascii:]]')
  ),
  is_discoverable = true;

-- 4. Public view for author attribution.
DROP VIEW IF EXISTS profile_public;
CREATE OR REPLACE VIEW profile_public AS
SELECT
  id,
  display_name,
  avatar_url
FROM profiles
WHERE display_name IS NOT NULL;

GRANT SELECT ON profile_public TO anon;
GRANT SELECT ON profile_public TO authenticated;

-- 5. Unique index on lowercased display_name
DROP INDEX IF EXISTS idx_profiles_display_name_ci;
CREATE UNIQUE INDEX idx_profiles_display_name_ci
  ON profiles (LOWER(display_name))
  WHERE display_name IS NOT NULL;

-- 6. CHECK constraint -- NOT VALID so legacy rows kept for attribution
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_display_name_check;
ALTER TABLE profiles
ADD CONSTRAINT profiles_display_name_check
  CHECK (
    display_name IS NULL
    OR (
      LENGTH(display_name) BETWEEN 2 AND 32
      AND display_name !~ '\s{2,}'
    )
  )
  NOT VALID;

-- 7. Validation trigger.
CREATE OR REPLACE FUNCTION validate_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reserved_pattern TEXT := '\m(admin|moderator|support|staff|official)\M|^(admin|moderator|support|staff|official)([\s._-]|[0-9]|$)';
  trc_prefix TEXT := '^trc[_-]';
BEGIN
  -- Skip when the name did not change
  IF TG_OP = 'UPDATE' AND NEW.display_name IS NOT DISTINCT FROM OLD.display_name THEN
    RETURN NEW;
  END IF;

  IF NEW.display_name IS NULL THEN
    RETURN NEW;
  END IF;

  IF LENGTH(NEW.display_name) < 2 OR LENGTH(NEW.display_name) > 32 THEN
    RAISE EXCEPTION 'Display name must be between 2 and 32 characters.';
  END IF;

  IF NEW.display_name ~ '\s{2,}' THEN
    RAISE EXCEPTION 'Display name has invalid spacing.';
  END IF;

  -- ASCII names must match allowed character set; non-ASCII (e.g. CJK) names bypass this
  IF NEW.display_name !~ '^[A-Za-z0-9\-_ .''()]+$' AND NEW.display_name !~ '[^[:ascii:]]' THEN
    RAISE EXCEPTION 'Display name contains invalid characters.';
  END IF;

  IF NEW.display_name !~ '[A-Za-z]' AND NEW.display_name !~ '[^[:ascii:]]' THEN
    RAISE EXCEPTION 'Display name must contain at least one letter.';
  END IF;

  IF NEW.display_name ~* reserved_pattern THEN
    RAISE EXCEPTION 'Display name is reserved.';
  END IF;

  IF NEW.display_name ~* trc_prefix THEN
    RAISE EXCEPTION 'Display name cannot start with "trc_" or "trc-".';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_display_name_trigger ON profiles;
CREATE TRIGGER validate_display_name_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_display_name();

-- 8. Update handle_new_user to remove email fallback and set onboarding flag
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, is_discoverable, onboarding_completed, created_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'avatar_url',
    true,
    false,
    NOW()
  );
  RETURN NEW;
END;
$$;

-- 9. Tighten reviews/comments RLS for authenticated users
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public insert access to reviews" ON reviews;
DROP POLICY IF EXISTS "Authenticated users can insert reviews after onboarding" ON reviews;
CREATE POLICY "Authenticated users can insert reviews after onboarding"
  ON reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (SELECT onboarding_completed FROM public.profiles WHERE id = auth.uid()) = true
  );

DROP POLICY IF EXISTS "Anonymous users can insert reviews" ON reviews;
CREATE POLICY "Anonymous users can insert reviews"
  ON reviews
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated insert access to comments" ON comments;
DROP POLICY IF EXISTS "Authenticated users can insert comments after onboarding" ON comments;
CREATE POLICY "Authenticated users can insert comments after onboarding"
  ON comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (SELECT onboarding_completed FROM public.profiles WHERE id = auth.uid()) = true
  );

-- 10. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ============================================
-- COMPLETED
-- ============================================
