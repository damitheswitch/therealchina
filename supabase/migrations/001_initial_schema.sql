-- ============================================
-- TRC Database Schema (Phase 1)
-- Supabase + Postgres with Row Level Security
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- 1. UNIVERSITIES TABLE
-- ============================================
CREATE TABLE universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_zh TEXT,
  city TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-update updated_at on universities
CREATE OR REPLACE FUNCTION update_universities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_universities_updated_at_trigger
  BEFORE UPDATE ON universities
  FOR EACH ROW
  EXECUTE FUNCTION update_universities_updated_at();

-- ============================================
-- 2. REVIEWS TABLE
-- ============================================
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT NOT NULL,
  program TEXT,
  degree_level TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_university_id ON reviews(university_id);
CREATE INDEX idx_reviews_created_at ON reviews(created_at);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- Trigger to auto-update updated_at on reviews
CREATE OR REPLACE FUNCTION update_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reviews_updated_at_trigger
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_reviews_updated_at();

-- ============================================
-- 3. COMMENTS TABLE
-- ============================================
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_review_id ON comments(review_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);

-- Trigger to enforce one-level nesting: prevent replies to replies
CREATE OR REPLACE FUNCTION enforce_comment_nesting()
RETURNS TRIGGER AS $$
DECLARE
  parent_comment comments;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    -- Get the parent comment
    SELECT * INTO parent_comment FROM comments WHERE id = NEW.parent_id;

    -- If the parent has a parent (i.e., parent_id IS NOT NULL), this is a reply to a reply
    -- which violates the one-level constraint
    IF parent_comment.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Replies to replies are not allowed. Maximum nesting depth is 1.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_comment_nesting_trigger
  BEFORE INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_comment_nesting();

-- ============================================
-- 4. UPVOTES TABLE
-- ============================================
CREATE TABLE upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, review_id)
);

CREATE INDEX idx_upvotes_review_id ON upvotes(review_id);
CREATE INDEX idx_upvotes_user_id ON upvotes(user_id);

-- ============================================
-- 5. PROFILES TABLE (1:1 with auth.users)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  location TEXT,
  university TEXT,
  program TEXT,
  social_platform TEXT,
  social_handle TEXT,
  is_discoverable BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-create profile row when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Trigger to auto-update updated_at on profiles
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- ============================================
-- 6. UNIVERSITY STATS MATERIALIZED VIEW
-- Pre-computed stats to avoid slow AVG() calculations on landing page
-- ============================================
CREATE MATERIALIZED VIEW university_stats AS
SELECT
  u.id AS university_id,
  COUNT(r.id) AS review_count,
  COALESCE(AVG(r.rating), 0) AS avg_rating,
  COALESCE(COUNT(CASE WHEN r.user_id IS NOT NULL THEN 1 END), 0) > 0 AS has_verified_review
FROM universities u
LEFT JOIN reviews r ON u.id = r.university_id AND r.user_id IS NOT NULL
GROUP BY u.id;

CREATE UNIQUE INDEX idx_university_stats_university_id ON university_stats(university_id);
CREATE INDEX idx_university_stats_avg_rating ON university_stats(avg_rating);
CREATE INDEX idx_university_stats_review_count ON university_stats(review_count);

-- Refresh function for the materialized view
CREATE OR REPLACE FUNCTION refresh_university_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW university_stats;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers to keep stats updated on review changes
CREATE TRIGGER refresh_university_stats_on_insert
  AFTER INSERT ON reviews
  EXECUTE FUNCTION refresh_university_stats();

CREATE TRIGGER refresh_university_stats_on_delete
  AFTER DELETE ON reviews
  EXECUTE FUNCTION refresh_university_stats();

CREATE TRIGGER refresh_university_stats_on_update
  AFTER UPDATE ON reviews
  EXECUTE FUNCTION refresh_university_stats();

-- ============================================
-- 7. TOGGLE UPVOTE RPC FUNCTION
-- Atomic upvote toggle to prevent race conditions
-- ============================================
CREATE OR REPLACE FUNCTION toggle_upvote(p_review_id UUID)
RETURNS TABLE(upvoted BOOLEAN, upvote_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_existing_upvote upvotes;
  v_count BIGINT;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to upvote';
  END IF;

  -- Check if the user has already upvoted
  SELECT * INTO v_existing_upvote
  FROM upvotes
  WHERE user_id = v_user_id AND review_id = p_review_id;

  IF v_existing_upvote IS NOT NULL THEN
    -- User already upvoted, so delete (toggle off)
    DELETE FROM upvotes
    WHERE id = v_existing_upvote.id;

    -- Get the new count
    SELECT COUNT(*) INTO v_count
    FROM upvotes
    WHERE review_id = p_review_id;

    RETURN QUERY SELECT FALSE::BOOLEAN AS upvoted, v_count AS upvote_count;
  ELSE
    -- User hasn't upvoted, so insert (toggle on)
    INSERT INTO upvotes (user_id, review_id)
    VALUES (v_user_id, p_review_id)
    ON CONFLICT (user_id, review_id) DO NOTHING;

    -- Get the new count
    SELECT COUNT(*) INTO v_count
    FROM upvotes
    WHERE review_id = p_review_id;

    RETURN QUERY SELECT TRUE::BOOLEAN AS upvoted, v_count AS upvote_count;
  END IF;
END;
$$;

-- ============================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- 8.1 Universities: Public read, public insert
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to universities"
  ON universities
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public insert access to universities"
  ON universities
  FOR INSERT
  TO public
  WITH CHECK (true);

-- 8.2 Reviews: Public read, public insert (anonymous reviews allowed)
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to reviews"
  ON reviews
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public insert access to reviews"
  ON reviews
  FOR INSERT
  TO public
  WITH CHECK (true);

-- 8.3 Comments: Public read, authenticated insert/update/delete (own)
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to comments"
  ON comments
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated insert access to comments"
  ON comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated update access to own comments"
  ON comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated delete access to own comments"
  ON comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 8.4 Upvotes: Public read (for counts), authenticated insert/delete (own)
ALTER TABLE upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to upvotes"
  ON upvotes
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated insert access to own upvotes"
  ON upvotes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated delete access to own upvotes"
  ON upvotes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 8.5 Profiles: Authenticated read, authenticated update (own)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read profiles (for comment attribution, future discovery)
CREATE POLICY "Authenticated read access to profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can update their own profile
CREATE POLICY "Authenticated update access to own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- ============================================
-- COMPLETED
-- ============================================
