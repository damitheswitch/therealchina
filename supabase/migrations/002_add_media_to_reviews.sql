-- ============================================
-- TRC Database Migration: Add Media Support to Reviews
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Add media JSONB column to reviews table
-- Stores array of media objects: [{ "url": "...", "type": "image" | "video", "name": "..." }]
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS media JSONB DEFAULT '[]'::jsonb;

-- 2. Create storage bucket for review media
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-media', 'review-media', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS Policies for review-media bucket
DROP POLICY IF EXISTS "Public read access on review-media" ON storage.objects;
CREATE POLICY "Public read access on review-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'review-media');

DROP POLICY IF EXISTS "Public upload access on review-media" ON storage.objects;
CREATE POLICY "Public upload access on review-media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'review-media');

DROP POLICY IF EXISTS "Public delete access on review-media" ON storage.objects;
CREATE POLICY "Public delete access on review-media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'review-media');
