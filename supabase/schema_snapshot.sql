-- =========================================================
-- TRC Schema Snapshot
-- Consolidated, idempotent view of the current database schema
-- as of migration 020_gate_anonymous_submissions.sql.
--
-- This is a READ-ONLY REFERENCE for agents/developers.
-- Deployment still happens through the numbered migrations in
-- supabase/migrations/.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_zh TEXT,
  city TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  search_text TEXT GENERATED ALWAYS AS (
    lower(
      replace(coalesce(name, ''), '&amp;', '&') || ' ' ||
      replace(coalesce(name_zh, ''), '&amp;', '&') || ' ' ||
      replace(coalesce(city, ''), '&amp;', '&') || ' ' ||
      replace(coalesce(slug, ''), '&amp;', '&')
    )
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT NOT NULL,
  program TEXT,
  degree_level TEXT,
  media JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, review_id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  display_name_lower TEXT GENERATED ALWAYS AS (LOWER(display_name)) STORED,
  avatar_url TEXT,
  location TEXT,
  university TEXT,
  program TEXT,
  bio TEXT,
  show_social_handle BOOLEAN DEFAULT TRUE,
  social_platform TEXT,
  social_handle TEXT,
  social_handles JSONB DEFAULT '[]'::jsonb,
  is_discoverable BOOLEAN DEFAULT TRUE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT profiles_display_name_ci_unique UNIQUE (display_name_lower)
);

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_display_name_check,
ADD CONSTRAINT profiles_display_name_check
  CHECK (
    display_name IS NULL
    OR (
      LENGTH(display_name) BETWEEN 2 AND 32
      AND display_name !~ '\s{2,}'
    )
  )
  NOT VALID;

CREATE TABLE IF NOT EXISTS public.university_stats (
  university_id UUID PRIMARY KEY REFERENCES public.universities(id) ON DELETE CASCADE,
  review_count BIGINT NOT NULL DEFAULT 0,
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  has_verified_review BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.flight_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  departure_country TEXT NOT NULL,
  arrival_country TEXT NOT NULL,
  departure_city TEXT,
  arrival_city TEXT,
  departure_date DATE NOT NULL,
  arrival_date DATE NOT NULL,
  available_kgs NUMERIC(5,2) NOT NULL CHECK (available_kgs > 0),
  price_per_kg NUMERIC(10,2) NOT NULL CHECK (price_per_kg >= 0),
  currency TEXT DEFAULT 'CNY',
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_reviews_university_id ON public.reviews(university_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating);

CREATE INDEX IF NOT EXISTS idx_comments_review_id ON public.comments(review_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);

CREATE INDEX IF NOT EXISTS idx_upvotes_review_id ON public.upvotes(review_id);
CREATE INDEX IF NOT EXISTS idx_upvotes_user_id ON public.upvotes(user_id);

CREATE INDEX IF NOT EXISTS idx_university_stats_avg_rating ON public.university_stats(avg_rating);
CREATE INDEX IF NOT EXISTS idx_university_stats_review_count ON public.university_stats(review_count);

CREATE INDEX IF NOT EXISTS idx_flight_listings_arrival_country ON public.flight_listings(arrival_country);
CREATE INDEX IF NOT EXISTS idx_flight_listings_departure_country ON public.flight_listings(departure_country);
CREATE INDEX IF NOT EXISTS idx_flight_listings_departure_date ON public.flight_listings(departure_date);
CREATE INDEX IF NOT EXISTS idx_flight_listings_arrival_date ON public.flight_listings(arrival_date);
CREATE INDEX IF NOT EXISTS idx_flight_listings_user_id ON public.flight_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_flight_listings_is_active ON public.flight_listings(is_active);
CREATE INDEX IF NOT EXISTS idx_flight_listings_created_at ON public.flight_listings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_universities_search_trgm
  ON public.universities USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_universities_city_trgm
  ON public.universities USING gin (city gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_universities_name_trgm
  ON public.universities USING gin (name gin_trgm_ops);

-- ---------------------------------------------------------
-- 4. Functions
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_universities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_flight_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

CREATE OR REPLACE FUNCTION public.validate_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reserved_pattern TEXT := '\m(admin|moderator|support|staff|official)\M|^(admin|moderator|support|staff|official)([\s._-]|[0-9]|$)';
  trc_prefix TEXT := '^trc[_-]';
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.display_name IS NOT DISTINCT FROM OLD.display_name THEN
    RETURN NEW;
  END IF;

  IF NEW.display_name IS NULL THEN
    RETURN NEW;
  END IF;

  IF LENGTH(NEW.display_name) < 2 OR LENGTH(NEW.display_name) > 32 THEN
    RAISE EXCEPTION 'Display name must be between 2 and 32 characters.';
  END IF;

  IF NEW.display_name ~ '\s{2,}' THEN
    RAISE EXCEPTION 'Display name has invalid spacing.';
  END IF;

  IF NEW.display_name !~ '^[A-Za-z0-9\-_ .''()]+$' AND NEW.display_name !~ '[^[:ascii:]]' THEN
    RAISE EXCEPTION 'Display name contains invalid characters.';
  END IF;

  IF NEW.display_name !~ '[A-Za-z]' AND NEW.display_name !~ '[^[:ascii:]]' THEN
    RAISE EXCEPTION 'Display name must contain at least one letter.';
  END IF;

  IF NEW.display_name ~* reserved_pattern THEN
    RAISE EXCEPTION 'Display name is reserved.';
  END IF;

  IF NEW.display_name ~* trc_prefix THEN
    RAISE EXCEPTION 'Display name cannot start with "trc_" or "trc-".';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_comment_nesting()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  parent_comment public.comments;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT * INTO parent_comment
    FROM public.comments
    WHERE id = NEW.parent_id;

    IF parent_comment.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Replies to replies are not allowed. Maximum nesting depth is 1.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_university_stats(p_university_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.university_stats (
    university_id,
    review_count,
    avg_rating,
    has_verified_review,
    updated_at
  )
  SELECT
    p_university_id,
    COUNT(*)::BIGINT,
    COALESCE(AVG(r.rating), 0)::NUMERIC(3,2),
    COALESCE(BOOL_OR(r.user_id IS NOT NULL), FALSE),
    NOW()
  FROM public.reviews AS r
  WHERE r.university_id = p_university_id
  ON CONFLICT (university_id) DO UPDATE SET
    review_count = EXCLUDED.review_count,
    avg_rating = EXCLUDED.avg_rating,
    has_verified_review = EXCLUDED.has_verified_review,
    updated_at = EXCLUDED.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_university_stats_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.refresh_university_stats(NEW.university_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_university_stats_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.refresh_university_stats(OLD.university_id);

  IF NEW.university_id IS DISTINCT FROM OLD.university_id THEN
    PERFORM public.refresh_university_stats(NEW.university_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_university_stats_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.refresh_university_stats(OLD.university_id);
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_upvote(p_review_id uuid)
RETURNS TABLE(upvoted boolean, upvote_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_existing_upvote public.upvotes;
  v_count BIGINT;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to upvote';
  END IF;

  SELECT * INTO v_existing_upvote
  FROM public.upvotes
  WHERE user_id = v_user_id AND review_id = p_review_id;

  IF v_existing_upvote IS NOT NULL THEN
    DELETE FROM public.upvotes
    WHERE id = v_existing_upvote.id;

    SELECT COUNT(*) INTO v_count
    FROM public.upvotes
    WHERE review_id = p_review_id;

    RETURN QUERY SELECT FALSE::BOOLEAN AS upvoted, v_count AS upvote_count;
  ELSE
    INSERT INTO public.upvotes (user_id, review_id)
    VALUES (v_user_id, p_review_id)
    ON CONFLICT (user_id, review_id) DO NOTHING;

    SELECT COUNT(*) INTO v_count
    FROM public.upvotes
    WHERE review_id = p_review_id;

    RETURN QUERY SELECT TRUE::BOOLEAN AS upvoted, v_count AS upvote_count;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.profile_has_social_handle(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND (
        (social_handle IS NOT NULL AND length(trim(social_handle)) > 0)
        OR (
          jsonb_typeof(social_handles) = 'array'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(social_handles) h
            WHERE length(trim(COALESCE(h->>'handle', ''))) > 0
          )
        )
      )
  );
$$;

-- ---------------------------------------------------------
-- 5. Triggers
-- ---------------------------------------------------------

DROP TRIGGER IF EXISTS update_universities_updated_at_trigger ON public.universities;
CREATE TRIGGER update_universities_updated_at_trigger
  BEFORE UPDATE ON public.universities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_universities_updated_at();

DROP TRIGGER IF EXISTS update_reviews_updated_at_trigger ON public.reviews;
CREATE TRIGGER update_reviews_updated_at_trigger
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reviews_updated_at();

DROP TRIGGER IF EXISTS trigger_update_stats_on_insert ON public.reviews;
CREATE TRIGGER trigger_update_stats_on_insert
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_university_stats_on_insert();

DROP TRIGGER IF EXISTS trigger_update_stats_on_delete ON public.reviews;
CREATE TRIGGER trigger_update_stats_on_delete
  AFTER DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_university_stats_on_delete();

DROP TRIGGER IF EXISTS trigger_update_stats_on_update ON public.reviews;
CREATE TRIGGER trigger_update_stats_on_update
  AFTER UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_university_stats_on_update();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_profiles_updated_at_trigger ON public.profiles;
CREATE TRIGGER update_profiles_updated_at_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profiles_updated_at();

DROP TRIGGER IF EXISTS validate_display_name_trigger ON public.profiles;
CREATE TRIGGER validate_display_name_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_display_name();

DROP TRIGGER IF EXISTS enforce_comment_nesting_trigger ON public.comments;
CREATE TRIGGER enforce_comment_nesting_trigger
  BEFORE INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_comment_nesting();

DROP TRIGGER IF EXISTS update_flight_listings_updated_at_trigger ON public.flight_listings;
CREATE TRIGGER update_flight_listings_updated_at_trigger
  BEFORE UPDATE ON public.flight_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_flight_listings_updated_at();

-- ---------------------------------------------------------
-- 6. Row Level Security (RLS) policies
-- ---------------------------------------------------------

ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access to universities" ON public.universities;
CREATE POLICY "Public read access to universities"
  ON public.universities FOR SELECT
  TO public USING (true);

-- No direct INSERT policy on universities: rows are created server-side by the
-- review-submit Edge Function ("not listed" flow) or by admin tooling.

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access to reviews" ON public.reviews;
CREATE POLICY "Public read access to reviews"
  ON public.reviews FOR SELECT
  TO public USING (true);

DROP POLICY IF EXISTS "Public insert access to reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authenticated users can insert reviews after onboarding" ON public.reviews;
CREATE POLICY "Authenticated users can insert reviews after onboarding"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (SELECT onboarding_completed FROM public.profiles WHERE id = auth.uid()) = true
  );

-- No anonymous INSERT policy: anonymous reviews are submitted through the
-- review-submit Edge Function (Turnstile + per-IP rate limit, service-role
-- write) instead of direct table inserts.

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access to comments" ON public.comments;
CREATE POLICY "Public read access to comments"
  ON public.comments FOR SELECT
  TO public USING (true);

DROP POLICY IF EXISTS "Authenticated insert access to comments" ON public.comments;
DROP POLICY IF EXISTS "Authenticated users can insert comments after onboarding" ON public.comments;
CREATE POLICY "Authenticated users can insert comments after onboarding"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (SELECT onboarding_completed FROM public.profiles WHERE id = auth.uid()) = true
  );

DROP POLICY IF EXISTS "Authenticated update access to own comments" ON public.comments;
CREATE POLICY "Authenticated update access to own comments"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated delete access to own comments" ON public.comments;
CREATE POLICY "Authenticated delete access to own comments"
  ON public.comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.upvotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access to upvotes" ON public.upvotes;
CREATE POLICY "Public read access to upvotes"
  ON public.upvotes FOR SELECT
  TO public USING (true);

DROP POLICY IF EXISTS "Authenticated insert access to own upvotes" ON public.upvotes;
CREATE POLICY "Authenticated insert access to own upvotes"
  ON public.upvotes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated delete access to own upvotes" ON public.upvotes;
CREATE POLICY "Authenticated delete access to own upvotes"
  ON public.upvotes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated read access to profiles" ON public.profiles;
CREATE POLICY "Authenticated read access to profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Authenticated update access to own profile" ON public.profiles;
CREATE POLICY "Authenticated update access to own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

ALTER TABLE public.university_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access to university_stats" ON public.university_stats;
CREATE POLICY "Public read access to university_stats"
  ON public.university_stats FOR SELECT
  TO public USING (true);

ALTER TABLE public.flight_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access to active flight listings" ON public.flight_listings;
CREATE POLICY "Public read access to active flight listings"
  ON public.flight_listings FOR SELECT
  TO public
  USING (is_active = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated insert access to flight listings" ON public.flight_listings;
CREATE POLICY "Authenticated insert access to flight listings"
  ON public.flight_listings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.profile_has_social_handle(auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated update access to own flight listings" ON public.flight_listings;
CREATE POLICY "Authenticated update access to own flight listings"
  ON public.flight_listings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated delete access to own flight listings" ON public.flight_listings;
CREATE POLICY "Authenticated delete access to own flight listings"
  ON public.flight_listings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------
-- 7. Views and grants
-- ---------------------------------------------------------

CREATE OR REPLACE VIEW public.profile_public AS
SELECT
  id,
  display_name,
  avatar_url
FROM public.profiles
WHERE display_name IS NOT NULL
  AND is_discoverable = true
  AND onboarding_completed = true;

GRANT SELECT ON public.profile_public TO anon;
GRANT SELECT ON public.profile_public TO authenticated;

CREATE OR REPLACE VIEW public.member_profiles AS
SELECT
  id,
  display_name,
  avatar_url,
  location,
  university,
  program,
  bio,
  show_social_handle,
  CASE WHEN show_social_handle = true THEN social_platform END AS social_platform,
  CASE WHEN show_social_handle = true THEN social_handle END AS social_handle,
  CASE WHEN show_social_handle = true THEN social_handles END AS social_handles,
  is_discoverable,
  onboarding_completed,
  created_at,
  updated_at
FROM public.profiles
WHERE display_name IS NOT NULL
  AND is_discoverable = true
  AND onboarding_completed = true;

GRANT SELECT ON public.member_profiles TO authenticated;

CREATE OR REPLACE VIEW public.flight_listings_with_profile AS
SELECT
  fl.id,
  fl.user_id,
  fl.departure_country,
  fl.arrival_country,
  fl.departure_city,
  fl.arrival_city,
  fl.departure_date,
  fl.arrival_date,
  fl.available_kgs,
  fl.price_per_kg,
  fl.currency,
  fl.notes,
  fl.is_active,
  fl.created_at,
  fl.updated_at,
  p.display_name,
  p.avatar_url,
  CASE
    WHEN p.id IS NOT NULL
      AND auth.role() = 'authenticated'
      AND COALESCE(p.show_social_handle, true) = true THEN
      CASE
        WHEN jsonb_typeof(p.social_handles) = 'array' THEN p.social_handles
        WHEN jsonb_typeof(p.social_handles) = 'object' THEN jsonb_build_array(p.social_handles)
        ELSE '[]'::jsonb
      END
    ELSE '[]'::jsonb
  END AS social_handles,
  CASE
    WHEN p.id IS NOT NULL
      AND auth.role() = 'authenticated'
      AND COALESCE(p.show_social_handle, true) = true THEN true
    ELSE false
  END AS show_social_handle
FROM public.flight_listings fl
LEFT JOIN public.profiles p
  ON fl.user_id = p.id
  AND (
    (p.is_discoverable = true AND p.onboarding_completed = true AND p.display_name IS NOT NULL)
    OR auth.uid() = fl.user_id
  )
WHERE fl.is_active = true OR auth.uid() = fl.user_id;

GRANT SELECT ON public.flight_listings_with_profile TO anon;
GRANT SELECT ON public.flight_listings_with_profile TO authenticated;

-- ---------------------------------------------------------
-- 8. Function grants
-- ---------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.profile_has_social_handle(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.toggle_upvote(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_upvote(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------
-- 9. Storage bucket and policies
-- ---------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('review-media', 'review-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read access on review-media" ON storage.objects;
CREATE POLICY "Public read access on review-media"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'review-media');

-- Uploads and deletes are now routed through the media-upload Edge Function
-- using the service role key. No browser role can write or delete directly.
DROP POLICY IF EXISTS "Public upload access on review-media" ON storage.objects;
DROP POLICY IF EXISTS "Public delete access on review-media" ON storage.objects;

-- Note: storage.objects is owned by supabase_storage_admin. If the DROP/CREATE
-- POLICY statements fail in the SQL Editor, apply them manually through the
-- Supabase Dashboard under Storage > review-media > Policies.

-- ---------------------------------------------------------
-- 10. Security hardening
-- ---------------------------------------------------------

DO $$
DECLARE
  net_roles TEXT;
  grantees TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'net') THEN
    RETURN;
  END IF;

  SELECT string_agg(quote_ident(rolname), ', ')
  INTO net_roles
  FROM pg_roles
  WHERE rolname IN ('anon', 'authenticated', 'PUBLIC');

  IF net_roles IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA net FROM %s', net_roles);
    EXECUTE format('REVOKE USAGE ON SCHEMA net FROM %s', net_roles);
  END IF;

  SELECT string_agg(quote_ident(rolname), ', ')
  INTO grantees
  FROM pg_roles
  WHERE rolname IN ('postgres', 'service_role');

  IF grantees IS NOT NULL THEN
    EXECUTE format('GRANT USAGE ON SCHEMA net TO %s', grantees);
    EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO %s', grantees);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_functions_admin') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA net TO supabase_functions_admin';
    EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO supabase_functions_admin';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.routines
    WHERE routine_schema = 'pgbouncer' AND routine_name = 'get_auth'
  ) THEN
    RETURN;
  END IF;

  EXECUTE 'REVOKE ALL ON FUNCTION pgbouncer.get_auth(text) FROM PUBLIC';
  EXECUTE 'REVOKE USAGE ON SCHEMA pgbouncer FROM PUBLIC';

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgbouncer') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA pgbouncer TO pgbouncer';
    EXECUTE 'GRANT EXECUTE ON FUNCTION pgbouncer.get_auth(text) TO pgbouncer';
  END IF;
END $$;

-- ---------------------------------------------------------
-- 11. Upload rate limiting and sessions
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.upload_rate_limits (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_upload_rate_limits_last_attempt
  ON public.upload_rate_limits (last_attempt_at);

CREATE TABLE IF NOT EXISTS public.upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT NOT NULL,
  is_anon BOOLEAN NOT NULL DEFAULT TRUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  files_used INT NOT NULL DEFAULT 0,
  max_files INT NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires_at
  ON public.upload_sessions (expires_at);

CREATE OR REPLACE FUNCTION public.record_upload_attempt(p_key TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_window TIMESTAMPTZ;
  v_count INT;
BEGIN
  v_window := date_trunc('hour', NOW());
  INSERT INTO public.upload_rate_limits (key, window_start, count, last_attempt_at)
  VALUES (p_key, v_window, 1, NOW())
  ON CONFLICT (key, window_start) DO UPDATE
  SET count = public.upload_rate_limits.count + 1,
      last_attempt_at = NOW()
  RETURNING count INTO v_count;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_upload_attempt(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_upload_attempt(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.use_upload_session(p_session_id UUID)
RETURNS TABLE(
  ip TEXT,
  is_anon BOOLEAN,
  user_id UUID,
  files_used INT,
  max_files INT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.upload_sessions
  SET files_used = public.upload_sessions.files_used + 1
  WHERE public.upload_sessions.id = p_session_id
    AND public.upload_sessions.expires_at > NOW()
    AND public.upload_sessions.files_used < public.upload_sessions.max_files
  RETURNING public.upload_sessions.ip,
            public.upload_sessions.is_anon,
            public.upload_sessions.user_id,
            public.upload_sessions.files_used,
            public.upload_sessions.max_files,
            public.upload_sessions.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.use_upload_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.use_upload_session(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_upload_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  DELETE FROM public.upload_rate_limits WHERE window_start < NOW() - INTERVAL '24 hours';
  DELETE FROM public.upload_sessions WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_upload_rate_limits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_upload_rate_limits() TO service_role;

ALTER TABLE public.upload_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.upload_rate_limits TO service_role;
GRANT ALL ON public.upload_sessions TO service_role;

-- ---------------------------------------------------------
-- 12. PostgREST schema reload
-- ---------------------------------------------------------

NOTIFY pgrst, 'reload schema';
