-- ============================================
-- TRC 011b: Storage policy reference
-- DO NOT RUN THIS FILE IN THE SUPABASE SQL EDITOR.
--
-- storage.objects is owned by supabase_storage_admin; SQL Editor cannot
-- create or drop policies on it without ownership errors. Apply these policies
-- manually through the Supabase Dashboard instead:
--   Storage > Buckets > review-media > Policies
--
-- This file is documentation only.
-- ============================================

-- Existing public read policy can remain as-is (public bucket, public read):
--   Name:  Public read access on review-media
--   Operation: SELECT
--   Roles: public
--   Expression: bucket_id = 'review-media'

-- Replace the public upload policy with an authenticated, owner-restricted one:
DROP POLICY IF EXISTS "Public upload access on review-media" ON storage.objects;
CREATE POLICY "Authenticated upload access on review-media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'review-media' AND auth.uid() = owner);

-- Replace the public delete policy with an authenticated, owner-restricted one:
DROP POLICY IF EXISTS "Public delete access on review-media" ON storage.objects;
CREATE POLICY "Authenticated delete access on review-media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'review-media' AND auth.uid() = owner);
