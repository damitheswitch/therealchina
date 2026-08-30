-- ============================================
-- TRC 011a: Profile security fixes
-- - Restrict profiles SELECT to the caller's own row
-- - Recreate profile_public as a definer view for public author attribution
-- - Enforce case-insensitive unique display names at insert/update time
-- - Update handle_new_user trigger to surface a friendly duplicate-name error
-- Safe to re-run: every statement is idempotent
-- ============================================

-- 1. Profiles SELECT policy: own row only
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read access to profiles" ON profiles;
CREATE POLICY "Authenticated read access to profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- UPDATE policy is intentionally left as-is (auth.uid() = id) from previous migrations

-- 2. Recreate profile_public as an intentional definer (non-invoker) view.
--    It exposes only non-sensitive columns (id, display_name, avatar_url) for
--    public author attribution. If security_invoker were true, the view would
--    inherit the own-row-only SELECT policy on profiles and would return no
--    public author data; definer mode is the correct pattern here.
DROP VIEW IF EXISTS profile_public;
CREATE VIEW profile_public AS
SELECT
  id,
  display_name,
  avatar_url
FROM profiles
WHERE display_name IS NOT NULL;

GRANT SELECT ON profile_public TO anon;
GRANT SELECT ON profile_public TO authenticated;

-- 3. Case-insensitive UNIQUE constraint on display_name.
--    Postgres unique constraints cannot be defined directly on an expression,
--    so we add a generated lower-case column and place the constraint there.
--    This enforces uniqueness at insert/update time and removes the need for
--    a client-side precheck that queries all profiles.
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS display_name_lower TEXT
GENERATED ALWAYS AS (LOWER(display_name)) STORED;

-- Drop the old expression-based unique index now that the constraint handles it
DROP INDEX IF EXISTS idx_profiles_display_name_ci;

ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_display_name_ci_unique;
ALTER TABLE profiles
ADD CONSTRAINT profiles_display_name_ci_unique
UNIQUE (display_name_lower);

-- 4. Update the new-user trigger to surface a friendly error when the display
--    name conflicts with the new unique constraint, instead of a raw unique_violation.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Display name is already taken.';
    WHEN OTHERS THEN
      RAISE;
  END;
  RETURN NEW;
END;
$$;

-- 5. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ============================================
-- COMPLETED
-- ============================================
