-- ============================================
-- TRC Database Schema (Phase 1)
-- Supabase + Postgres with Row Level Security
-- Idempotent schema (safe to run on fresh or existing DB)
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- 1. UNIVERSITIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS universities (
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

DROP TRIGGER IF EXISTS update_universities_updated_at_trigger ON universities;
CREATE TRIGGER update_universities_updated_at_trigger
  BEFORE UPDATE ON universities
  FOR EACH ROW
  EXECUTE FUNCTION update_universities_updated_at();

-- ============================================
-- 2. REVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
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

CREATE INDEX IF NOT EXISTS idx_reviews_university_id ON reviews(university_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

-- Trigger to auto-update updated_at on reviews
CREATE OR REPLACE FUNCTION update_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_reviews_updated_at_trigger ON reviews;
CREATE TRIGGER update_reviews_updated_at_trigger
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_reviews_updated_at();

-- ============================================
-- 3. COMMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_review_id ON comments(review_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);

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

DROP TRIGGER IF EXISTS enforce_comment_nesting_trigger ON comments;
CREATE TRIGGER enforce_comment_nesting_trigger
  BEFORE INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_comment_nesting();

-- ============================================
-- 4. UPVOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, review_id)
);

CREATE INDEX IF NOT EXISTS idx_upvotes_review_id ON upvotes(review_id);
CREATE INDEX IF NOT EXISTS idx_upvotes_user_id ON upvotes(user_id);

-- ============================================
-- 5. PROFILES TABLE (1:1 with auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
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
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    NOW()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger to auto-update updated_at on profiles
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at_trigger ON profiles;
CREATE TRIGGER update_profiles_updated_at_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- ============================================
-- 6. UNIVERSITY STATS TABLE
-- Pre-computed stats table with automatic triggers on reviews
-- ============================================
CREATE TABLE IF NOT EXISTS university_stats (
  university_id UUID PRIMARY KEY REFERENCES universities(id) ON DELETE CASCADE,
  review_count BIGINT NOT NULL DEFAULT 0,
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  has_verified_review BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_university_stats_avg_rating ON university_stats(avg_rating);
CREATE INDEX IF NOT EXISTS idx_university_stats_review_count ON university_stats(review_count);

ALTER TABLE university_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access to university_stats" ON university_stats;
CREATE POLICY "Public read access to university_stats"
  ON university_stats
  FOR SELECT
  TO public
  USING (true);

-- Trigger function to update stats on review insert
CREATE OR REPLACE FUNCTION update_university_stats_on_insert()
RETURNS TRIGGER 
SECURITY DEFINER 
SET search_path = ''
AS $$ BEGIN
  INSERT INTO public.university_stats (university_id, review_count, avg_rating, has_verified_review)
  VALUES (
    NEW.university_id,
    1,
    NEW.rating,
    NEW.user_id IS NOT NULL
  )
  ON CONFLICT (university_id) DO UPDATE SET
    review_count = public.university_stats.review_count + 1,
    avg_rating = (
      (public.university_stats.avg_rating * public.university_stats.review_count + NEW.rating)::NUMERIC /
      (public.university_stats.review_count + 1)
    ),
    has_verified_review = public.university_stats.has_verified_review OR (NEW.user_id IS NOT NULL),
    updated_at = NOW();
  RETURN NEW;
END;
 $$ LANGUAGE plpgsql;

-- Trigger function to update stats on review delete
CREATE OR REPLACE FUNCTION update_university_stats_on_delete()
RETURNS TRIGGER 
SECURITY DEFINER 
SET search_path = ''
AS $$ DECLARE
  old_rating INT;
BEGIN
  old_rating := OLD.rating;

  UPDATE public.university_stats
  SET
    review_count = GREATEST(review_count - 1, 0),
    avg_rating = CASE
      WHEN review_count <= 1 THEN 0
      ELSE ((avg_rating * review_count::numeric - old_rating) / GREATEST(review_count - 1, 1))
    END,
    has_verified_review = has_verified_review, 
    updated_at = NOW()
  WHERE university_id = OLD.university_id;
    
  RETURN OLD;
END;
 $$ LANGUAGE plpgsql;

-- Trigger function to update stats on review update (rating/verification change)
CREATE OR REPLACE FUNCTION update_university_stats_on_update()
RETURNS TRIGGER 
SECURITY DEFINER 
SET search_path = ''
AS $$ BEGIN
  IF OLD.rating != NEW.rating OR (OLD.user_id IS NULL) != (NEW.user_id IS NULL) THEN
    UPDATE public.university_stats
    SET
      avg_rating = avg_rating + (NEW.rating - OLD.rating)::numeric / GREATEST(review_count, 1),
      has_verified_review = has_verified_review OR (NEW.user_id IS NOT NULL),
      updated_at = NOW()
    WHERE university_id = NEW.university_id;
  END IF;
  RETURN NEW;
END;
 $$ LANGUAGE plpgsql;

-- Trigger bindings for university_stats
DROP TRIGGER IF EXISTS trigger_update_stats_on_insert ON reviews;
CREATE TRIGGER trigger_update_stats_on_insert
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_university_stats_on_insert();

DROP TRIGGER IF EXISTS trigger_update_stats_on_delete ON reviews;
CREATE TRIGGER trigger_update_stats_on_delete
  AFTER DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_university_stats_on_delete();

DROP TRIGGER IF EXISTS trigger_update_stats_on_update ON reviews;
CREATE TRIGGER trigger_update_stats_on_update
  AFTER UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_university_stats_on_update();

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

DROP POLICY IF EXISTS "Public read access to universities" ON universities;
CREATE POLICY "Public read access to universities"
  ON universities
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Public insert access to universities" ON universities;
CREATE POLICY "Public insert access to universities"
  ON universities
  FOR INSERT
  TO public
  WITH CHECK (true);

-- 8.2 Reviews: Public read, public insert (anonymous reviews allowed)
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access to reviews" ON reviews;
CREATE POLICY "Public read access to reviews"
  ON reviews
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Public insert access to reviews" ON reviews;
CREATE POLICY "Public insert access to reviews"
  ON reviews
  FOR INSERT
  TO public
  WITH CHECK (true);

-- 8.3 Comments: Public read, authenticated insert/update/delete (own)
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access to comments" ON comments;
CREATE POLICY "Public read access to comments"
  ON comments
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Authenticated insert access to comments" ON comments;
CREATE POLICY "Authenticated insert access to comments"
  ON comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated update access to own comments" ON comments;
CREATE POLICY "Authenticated update access to own comments"
  ON comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated delete access to own comments" ON comments;
CREATE POLICY "Authenticated delete access to own comments"
  ON comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 8.4 Upvotes: Public read (for counts), authenticated insert/delete (own)
ALTER TABLE upvotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access to upvotes" ON upvotes;
CREATE POLICY "Public read access to upvotes"
  ON upvotes
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Authenticated insert access to own upvotes" ON upvotes;
CREATE POLICY "Authenticated insert access to own upvotes"
  ON upvotes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated delete access to own upvotes" ON upvotes;
CREATE POLICY "Authenticated delete access to own upvotes"
  ON upvotes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 8.5 Profiles: Authenticated read, authenticated update (own)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read access to profiles" ON profiles;
CREATE POLICY "Authenticated read access to profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated update access to own profile" ON profiles;
CREATE POLICY "Authenticated update access to own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- ============================================
-- COMPLETED
-- ============================================
