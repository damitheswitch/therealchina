-- ============================================
-- Check for NULL university_id values in reviews table
-- ============================================

-- This query checks if there are any reviews with NULL university_id
-- Run this to see if any data cleanup is needed before enforcing NOT NULL
SELECT COUNT(*) as null_count
FROM reviews
WHERE university_id IS NULL;

-- If the count is 0, we can safely proceed with the migration
-- If the count > 0, we need to decide on a cleanup strategy
