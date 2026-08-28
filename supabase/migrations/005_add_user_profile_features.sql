-- ============================================
-- TRC Database Migration: Add User Profile Features
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Add new columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS show_social_handle BOOLEAN DEFAULT TRUE;

-- 2. Create public-safe view for anonymous author display
CREATE OR REPLACE VIEW profile_public AS
SELECT 
  id,
  display_name,
  avatar_url
FROM profiles;

-- 3. Grant public access to the view
GRANT SELECT ON profile_public TO anon;
GRANT SELECT ON profile_public TO authenticated;

-- 4. Update RLS policies on base profiles table
-- First, verify current policy names (manual step before running this)
-- SELECT policyname FROM pg_policies WHERE tablename = 'profiles';

-- Drop existing public read policy and create authenticated-only policy
DROP POLICY IF EXISTS "Public read access to profiles" ON profiles;
CREATE POLICY "Authenticated read access to profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Ensure update policy is correct
DROP POLICY IF EXISTS "Authenticated update access to own profile" ON profiles;
CREATE POLICY "Authenticated update access to own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- 5. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ============================================
-- COMPLETED
-- ============================================