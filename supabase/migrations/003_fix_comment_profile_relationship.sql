-- ============================================
-- TRC Database Migration: Fix Comment Profile Relationship
-- Run this in your Supabase SQL Editor
-- ============================================

-- PostgREST can only embed profiles when comments.user_id has a
-- direct foreign key relationship to profiles.id.
ALTER TABLE comments
  DROP CONSTRAINT IF EXISTS comments_user_id_fkey;

ALTER TABLE comments
  ADD CONSTRAINT comments_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(id)
  ON DELETE CASCADE;

-- Comment author names must be readable for logged-out visitors.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read access to profiles" ON profiles;
DROP POLICY IF EXISTS "Public read access to profiles" ON profiles;
CREATE POLICY "Public read access to profiles"
  ON profiles
  FOR SELECT
  TO public
  USING (true);

NOTIFY pgrst, 'reload schema';
