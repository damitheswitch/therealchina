-- ============================================
-- TRC Database Migration: Add Multiple Social Handles
-- Add social_handles array column to support multiple social profiles
-- ============================================

-- Add new column for multiple social handles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS social_handles JSONB DEFAULT '[]'::jsonb;

-- Migrate existing single social handle to array format
UPDATE profiles 
SET social_handles = JSONB_BUILD_OBJECT(
  'platform', COALESCE(social_platform, 'other'),
  'handle', social_handle
)::jsonb
WHERE social_handle IS NOT NULL 
AND social_handle != ''
AND (social_handles IS NULL OR social_handles = '[]'::jsonb);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ============================================
-- COMPLETED
-- ============================================
