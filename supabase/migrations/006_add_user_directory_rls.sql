-- ============================================
-- TRC Database Migration: Add User Directory RLS
-- Allows authenticated users to read other profiles for directory
-- ============================================

-- Update RLS policy on profiles table to allow authenticated users to read all profiles
-- This enables the user directory feature where authenticated users can browse other profiles

DROP POLICY IF EXISTS "Authenticated read access to profiles" ON profiles;
CREATE POLICY "Authenticated read access to profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ============================================
-- COMPLETED
-- ============================================
