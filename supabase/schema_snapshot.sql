-- =========================================================
-- TRC Schema Snapshot
-- Consolidated, idempotent view of the current database schema
-- as of migration 040_function_grants_lockdown.sql
-- (026 is demo seed data only — no schema change).
--
-- This is a READ-ONLY REFERENCE for agents/developers.
-- Deployment still happens through the numbered migrations in
-- supabase/migrations/.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enabled by migration 033 for the daily rate-limit cleanup job.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- ---------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_zh TEXT,
  -- NULL when only the province is known (migration 034) — never a province name
  city TEXT,
  country TEXT,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  uni_type TEXT CHECK (uni_type IS NULL OR uni_type IN ('public','private')),
  languages_of_instruction TEXT[] DEFAULT '{}',
  website TEXT,
  province TEXT,
  -- 软科 subject category, English token (comprehensive/stem/normal/…)
  uni_category TEXT CHECK (uni_category IS NULL OR uni_category IN ('comprehensive','stem','normal','agriculture','forestry','medicine','finance','language','politics','ethnic','sports','arts','tcm','cooperative','other')),
  -- { "<source>": rank, "<source>_url": link } e.g. {"shanghai_national": 1, "shanghai_url": "https://..."}
  rankings JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- alternate slugs that resolve to this row (e.g. 'zhejiang', 'tsinghua-university')
  slug_aliases TEXT[] NOT NULL DEFAULT '{}',
  -- covers province + slug_aliases so search matches abbreviations (migration 043)
  search_text TEXT GENERATED ALWAYS AS (
    lower(
      replace(coalesce(name, ''), '&amp;', '&') || ' ' ||
      replace(coalesce(name_zh, ''), '&amp;', '&') || ' ' ||
      replace(coalesce(city, ''), '&amp;', '&') || ' ' ||
      replace(coalesce(province, ''), '&amp;', '&') || ' ' ||
      replace(coalesce(slug, ''), '&amp;', '&') || ' ' ||
      public.immutable_array_to_string(slug_aliases, ' ')
    )
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- URL-safe slugs only (migration 032). NOT VALID: existing rows unscanned,
-- all new writes checked.
ALTER TABLE public.universities
  DROP CONSTRAINT IF EXISTS universities_slug_format,
  ADD CONSTRAINT universities_slug_format
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') NOT VALID;

CREATE TABLE IF NOT EXISTS public.review_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  progress SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT review_drafts_payload_size CHECK (pg_column_size(payload) <= 262144),
  CONSTRAINT review_drafts_progress_range CHECK (progress BETWEEN 0 AND 5)
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
  -- Sub-scores (nullable, 1-5 each)
  rating_academics INT CHECK (rating_academics IS NULL OR rating_academics BETWEEN 1 AND 5),
  rating_campus INT CHECK (rating_campus IS NULL OR rating_campus BETWEEN 1 AND 5),
  rating_accommodation INT CHECK (rating_accommodation IS NULL OR rating_accommodation BETWEEN 1 AND 5),
  rating_cost INT CHECK (rating_cost IS NULL OR rating_cost BETWEEN 1 AND 5),
  rating_intl_office INT CHECK (rating_intl_office IS NULL OR rating_intl_office BETWEEN 1 AND 5),
  rating_social INT CHECK (rating_social IS NULL OR rating_social BETWEEN 1 AND 5),
  rating_extracurricular INT CHECK (rating_extracurricular IS NULL OR rating_extracurricular BETWEEN 1 AND 5),
  rating_career INT CHECK (rating_career IS NULL OR rating_career BETWEEN 1 AND 5),
  -- Structured context
  enrollment_status TEXT CHECK (enrollment_status IS NULL OR enrollment_status IN ('current','alumni','exchange','applicant')),
  start_year INT CHECK (start_year IS NULL OR (start_year BETWEEN 1990 AND EXTRACT(YEAR FROM NOW())::INT + 1)),
  end_year INT CHECK (end_year IS NULL OR (end_year BETWEEN 1990 AND EXTRACT(YEAR FROM NOW())::INT + 1)),
  language_of_instruction TEXT,
  tuition_range TEXT,
  living_cost_range TEXT,
  funding_type TEXT CHECK (funding_type IS NULL OR funding_type IN ('self','csc','school','province')),
  funding_coverage TEXT CHECK (funding_coverage IS NULL OR funding_coverage IN ('partial','full')),
  recommend TEXT CHECK (recommend IS NULL OR recommend IN ('yes','no','maybe')),
  pros TEXT,
  cons TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Soft delete: set by review-manage; row hidden by RLS, kept for audit.
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_reviews_end_after_start
    CHECK (end_year IS NULL OR start_year IS NULL OR end_year >= start_year)
);

-- Length caps mirroring _shared/reviewFields.ts (migration 041): the direct
-- authenticated INSERT path bypasses edge validation, so the table enforces
-- the same bounds. NOT VALID keeps existing rows out of the check.
ALTER TABLE public.reviews
DROP CONSTRAINT IF EXISTS chk_reviews_text_length,
ADD CONSTRAINT chk_reviews_text_length
  CHECK (char_length(text) BETWEEN 10 AND 5000)
  NOT VALID,
DROP CONSTRAINT IF EXISTS chk_reviews_pros_length,
ADD CONSTRAINT chk_reviews_pros_length
  CHECK (pros IS NULL OR char_length(pros) <= 1000)
  NOT VALID,
DROP CONSTRAINT IF EXISTS chk_reviews_cons_length,
ADD CONSTRAINT chk_reviews_cons_length
  CHECK (cons IS NULL OR char_length(cons) <= 1000)
  NOT VALID,
DROP CONSTRAINT IF EXISTS chk_reviews_program_length,
ADD CONSTRAINT chk_reviews_program_length
  CHECK (program IS NULL OR char_length(program) <= 120)
  NOT VALID,
DROP CONSTRAINT IF EXISTS chk_reviews_degree_level_length,
ADD CONSTRAINT chk_reviews_degree_level_length
  CHECK (degree_level IS NULL OR char_length(degree_level) <= 60)
  NOT VALID,
DROP CONSTRAINT IF EXISTS chk_reviews_language_length,
ADD CONSTRAINT chk_reviews_language_length
  CHECK (language_of_instruction IS NULL OR char_length(language_of_instruction) <= 60)
  NOT VALID,
DROP CONSTRAINT IF EXISTS chk_reviews_tuition_range_length,
ADD CONSTRAINT chk_reviews_tuition_range_length
  CHECK (tuition_range IS NULL OR char_length(tuition_range) <= 40)
  NOT VALID,
DROP CONSTRAINT IF EXISTS chk_reviews_living_cost_range_length,
ADD CONSTRAINT chk_reviews_living_cost_range_length
  CHECK (living_cost_range IS NULL OR char_length(living_cost_range) <= 40)
  NOT VALID,
DROP CONSTRAINT IF EXISTS chk_reviews_tags_cardinality,
ADD CONSTRAINT chk_reviews_tags_cardinality
  CHECK (cardinality(tags) <= 20)
  NOT VALID;

-- Anonymous reviewer "about you" data + review-claim linkage. Internal-only:
-- RLS enabled with no policies and all client grants revoked — service role
-- only. claim_token is the browser-held capability the review-claim function
-- matches on; owner_id links a review claimed "as anonymous" to its account
-- while reviews.user_id stays NULL (so it keeps rendering as Anonymous and
-- never earns the Verified seal or a public profile listing).
CREATE TABLE IF NOT EXISTS public.reviewer_context (
  review_id UUID PRIMARY KEY REFERENCES public.reviews(id) ON DELETE CASCADE,
  email TEXT,
  email_consent BOOLEAN NOT NULL DEFAULT FALSE,
  home_country TEXT,
  current_status TEXT
    CHECK (current_status IS NULL OR current_status IN
      ('studying','working','internship','job_hunting','break','other')),
  languages_spoken TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claim_token UUID,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  claim_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  -- Phase 3 anonymous Boost: only the SHA-256 digest of the per-review
  -- capability lives here — never the raw token. boost_save_count bounds
  -- successful saves (30); wrong-token probes are throttled by
  -- boost_next_attempt_at exponential backoff inside apply_anonymous_boost.
  boost_secret_hash TEXT
    CHECK (boost_secret_hash IS NULL OR boost_secret_hash ~ '^[0-9a-f]{64}$'),
  boost_save_count INT NOT NULL DEFAULT 0,
  boost_fail_count INT NOT NULL DEFAULT 0,
  boost_next_attempt_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cap matches the comment textareas (migration 041); comments have no edge
-- validation at all.
ALTER TABLE public.comments
DROP CONSTRAINT IF EXISTS chk_comments_text_length,
ADD CONSTRAINT chk_comments_text_length
  CHECK (char_length(text) BETWEEN 1 AND 2000)
  NOT VALID;

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
  home_country TEXT,
  current_status TEXT CHECK (current_status IS NULL OR current_status IN ('studying','working','internship','job_hunting','break','other')),
  monthly_budget TEXT,
  languages_spoken TEXT[] DEFAULT '{}',
  email_consent BOOLEAN DEFAULT FALSE,
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
  recommend_yes_count BIGINT NOT NULL DEFAULT 0,
  recommend_maybe_count BIGINT NOT NULL DEFAULT 0,
  recommend_no_count BIGINT NOT NULL DEFAULT 0,
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

-- Cap matches the notes textarea (migration 041).
ALTER TABLE public.flight_listings
DROP CONSTRAINT IF EXISTS chk_flight_listings_notes_length,
ADD CONSTRAINT chk_flight_listings_notes_length
  CHECK (notes IS NULL OR char_length(notes) <= 1000)
  NOT VALID;

-- Disposable/temp-mail domains rejected at signup and on email change.
-- Seeded by migration 031 from the community disposable-email-domains list;
-- refresh with new rows as providers appear. Legit providers the upstream
-- list over-blocks are carved out (e.g. 21cn.com, sify.com). Internal-only:
-- RLS enabled with no policies and client grants revoked — read only via
-- is_email_allowed().
CREATE TABLE IF NOT EXISTS public.blocked_email_domains (
  domain TEXT PRIMARY KEY
    CHECK (domain = lower(btrim(domain)) AND position('.' IN domain) > 0)
);

-- ---------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_reviews_university_id ON public.reviews(university_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_tags ON public.reviews USING gin(tags);
-- Active (non-deleted) reviews per university — matches every client read path.
CREATE INDEX IF NOT EXISTS idx_reviews_university_active
  ON public.reviews(university_id)
  WHERE deleted_at IS NULL;

-- Owner lookups: my-reviews and member-profile queries (migration 041).
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);

CREATE INDEX IF NOT EXISTS idx_comments_review_id ON public.comments(review_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);

-- Claim lookups always filter to a present token / owner.
CREATE INDEX IF NOT EXISTS idx_reviewer_context_claim_token
  ON public.reviewer_context(claim_token)
  WHERE claim_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviewer_context_owner_id
  ON public.reviewer_context(owner_id)
  WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviewer_context_boost_secret_hash
  ON public.reviewer_context(boost_secret_hash)
  WHERE boost_secret_hash IS NOT NULL;

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
CREATE INDEX IF NOT EXISTS universities_slug_aliases_gin
  ON public.universities USING gin (slug_aliases);

-- Draft lookups are per-user; university id is optional for "not listed" starts.
CREATE INDEX IF NOT EXISTS idx_review_drafts_user_id ON public.review_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_review_drafts_university_id ON public.review_drafts(university_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_drafts_user_university
  ON public.review_drafts(user_id, university_id)
  WHERE university_id IS NOT NULL;

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

CREATE OR REPLACE FUNCTION public.update_review_drafts_updated_at()
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
    WHEN unique_violation OR check_violation OR raise_exception THEN
      -- Display name taken or rejected by validation: fall back to NULL and
      -- let onboarding collect a fresh one instead of failing the signup.
      INSERT INTO public.profiles (id, display_name, avatar_url, is_discoverable, onboarding_completed, created_at)
      VALUES (
        NEW.id,
        NULL,
        NEW.raw_user_meta_data->>'avatar_url',
        true,
        false,
        NOW()
      );
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
    recommend_yes_count,
    recommend_maybe_count,
    recommend_no_count,
    updated_at
  )
  SELECT
    p_university_id,
    COUNT(*)::BIGINT,
    COALESCE(AVG(r.rating), 0)::NUMERIC(3,2),
    COALESCE(BOOL_OR(r.user_id IS NOT NULL), FALSE),
    COUNT(*) FILTER (WHERE r.recommend = 'yes'),
    COUNT(*) FILTER (WHERE r.recommend = 'maybe'),
    COUNT(*) FILTER (WHERE r.recommend = 'no'),
    NOW()
  FROM public.reviews AS r
  WHERE r.university_id = p_university_id
    AND r.deleted_at IS NULL
  ON CONFLICT (university_id) DO UPDATE SET
    review_count = EXCLUDED.review_count,
    avg_rating = EXCLUDED.avg_rating,
    has_verified_review = EXCLUDED.has_verified_review,
    recommend_yes_count = EXCLUDED.recommend_yes_count,
    recommend_maybe_count = EXCLUDED.recommend_maybe_count,
    recommend_no_count = EXCLUDED.recommend_no_count,
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

-- Returns false when the email's domain (or any parent domain, so
-- sub.mailinator.com matches mailinator.com) is on the blocklist.
-- Malformed/empty emails return true: format validation is Auth's job, and
-- the UX pre-check should not mask the real "invalid email" error.
CREATE OR REPLACE FUNCTION public.is_email_allowed(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_domain TEXT;
  v_labels TEXT[];
  i INT;
BEGIN
  v_domain := btrim(split_part(lower(btrim(COALESCE(p_email, ''))), '@', -1), '.');
  IF v_domain = '' THEN
    RETURN true;
  END IF;

  v_labels := string_to_array(v_domain, '.');
  -- Check 'a.b.c', then 'b.c'; never the bare TLD.
  FOR i IN 1 .. greatest(array_length(v_labels, 1) - 1, 0) LOOP
    IF EXISTS (
      SELECT 1
      FROM public.blocked_email_domains d
      WHERE d.domain = array_to_string(v_labels[i:array_length(v_labels, 1)], '.')
    ) THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

-- Supabase Auth "before user created" hook (pg-functions URI). Returning an
-- error object rejects the signup with a 403 and shows the message to the
-- client. Runs inside Auth itself, so it covers email/password AND OAuth.
CREATE OR REPLACE FUNCTION public.hook_reject_disposable_email(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email TEXT;
BEGIN
  v_email := event->'user'->>'email';
  -- Phone signups and other flows without an email pass through.
  IF v_email IS NULL OR v_email = '' THEN
    RETURN '{}'::jsonb;
  END IF;

  IF NOT public.is_email_allowed(v_email) THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Please use a permanent email address — disposable email domains are not allowed.'
      )
    );
  END IF;
  RETURN '{}'::jsonb;
END;
$$;

-- The auth hook only covers user creation; this trigger also blocks direct
-- SQL/admin-API inserts and an existing user switching their email to a
-- disposable domain afterwards.
CREATE OR REPLACE FUNCTION public.enforce_email_domain_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- On INSERT, OLD is an all-NULL record, so this check runs whenever the
  -- new row carries an email. On UPDATE it only runs when email changed.
  IF NEW.email IS DISTINCT FROM OLD.email
     AND NEW.email IS NOT NULL
     AND NEW.email <> ''
     AND NOT public.is_email_allowed(NEW.email) THEN
    RAISE EXCEPTION 'Please use a permanent email address — disposable email domains are not allowed.';
  END IF;
  RETURN NEW;
END;
$$;

-- Slug permanence (migration 032): when slug changes, the old slug is kept in
-- slug_aliases so the site can 301 the old URL. Also normalizes slug_aliases
-- on every write (dedupe, no empties, never contains the canonical slug).
CREATE OR REPLACE FUNCTION public.track_university_slug_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.slug_aliases := COALESCE((
    SELECT array_agg(DISTINCT a ORDER BY a)
    FROM unnest(
      CASE WHEN TG_OP = 'UPDATE' AND NEW.slug IS DISTINCT FROM OLD.slug
           THEN array_append(COALESCE(NEW.slug_aliases, '{}'), OLD.slug)
           ELSE COALESCE(NEW.slug_aliases, '{}') END
    ) AS a
    WHERE a IS NOT NULL AND a <> '' AND a <> NEW.slug
  ), '{}');
  RETURN NEW;
END;
$$;

-- Migration 043: array_to_string is STABLE so generated columns can't call
-- it; this IMMUTABLE wrapper is sound for text[] (deterministic output).
-- Only used by universities.search_text at write time.
CREATE OR REPLACE FUNCTION public.immutable_array_to_string(arr TEXT[], sep TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT pg_catalog.array_to_string(arr, sep)
$$;

-- Migration 044: anonymous Boost — authorization and update in one
-- transaction. Locks the review then the context row FOR UPDATE (claim writes
-- serialize against these locks), enforces the 24h window, the 30-save budget,
-- the 20 wrong-token lockout, and the column allowlist; returns a status code
-- the review-boost Edge Function maps to HTTP. Service-role only.
CREATE OR REPLACE FUNCTION public.apply_anonymous_boost(
  p_review_id UUID,
  p_boost_hash TEXT,
  p_patch JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_review public.reviews%ROWTYPE;
  v_ctx public.reviewer_context%ROWTYPE;
  v_new_start INT;
  v_new_end INT;
  v_new_funding TEXT;
BEGIN
  IF p_boost_hash IS NULL OR p_boost_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN 'bad_token';
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' OR p_patch = '{}'::jsonb THEN
    RETURN 'empty';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_patch) AS k
    WHERE k NOT IN (
      'program', 'degree_level',
      'rating_academics', 'rating_campus', 'rating_accommodation',
      'rating_cost', 'rating_intl_office', 'rating_social',
      'rating_extracurricular', 'rating_career',
      'enrollment_status', 'start_year', 'end_year',
      'language_of_instruction', 'tuition_range', 'living_cost_range',
      'funding_type', 'funding_coverage', 'pros', 'cons'
    )
  ) THEN
    RETURN 'bad_fields';
  END IF;

  SELECT * INTO v_review
    FROM public.reviews
    WHERE id = p_review_id
    FOR UPDATE;
  IF NOT FOUND OR v_review.deleted_at IS NOT NULL THEN
    RETURN 'not_found';
  END IF;

  SELECT * INTO v_ctx
    FROM public.reviewer_context
    WHERE review_id = p_review_id
    FOR UPDATE;
  IF NOT FOUND OR v_ctx.boost_secret_hash IS NULL THEN
    RETURN 'not_found';
  END IF;

  IF v_ctx.boost_secret_hash <> p_boost_hash THEN
    IF v_ctx.boost_next_attempt_at IS NOT NULL AND now() < v_ctx.boost_next_attempt_at THEN
      RETURN 'locked';
    END IF;
    UPDATE public.reviewer_context
      SET boost_fail_count = boost_fail_count + 1,
          boost_next_attempt_at =
            now() + LEAST(power(2, LEAST(boost_fail_count + 1, 10))::int, 600)
              * INTERVAL '1 second'
      WHERE review_id = p_review_id;
    RETURN 'bad_token';
  END IF;

  IF v_review.user_id IS NOT NULL
     OR v_ctx.owner_id IS NOT NULL
     OR v_ctx.claim_dismissed THEN
    RETURN 'claimed';
  END IF;

  IF v_review.created_at + INTERVAL '24 hours' <= NOW() THEN
    RETURN 'expired';
  END IF;

  IF v_ctx.boost_save_count >= 30 THEN
    RETURN 'over_limit';
  END IF;

  v_new_start := CASE WHEN p_patch ? 'start_year'
    THEN (p_patch->>'start_year')::int ELSE v_review.start_year END;
  v_new_end := CASE WHEN p_patch ? 'end_year'
    THEN (p_patch->>'end_year')::int ELSE v_review.end_year END;
  IF v_new_start IS NOT NULL AND v_new_end IS NOT NULL AND v_new_end < v_new_start THEN
    RETURN 'bad_fields';
  END IF;

  v_new_funding := CASE WHEN p_patch ? 'funding_type'
    THEN p_patch->>'funding_type' ELSE v_review.funding_type END;

  UPDATE public.reviews SET
    program                 = CASE WHEN p_patch ? 'program'                 THEN p_patch->>'program'                          ELSE program END,
    degree_level            = CASE WHEN p_patch ? 'degree_level'            THEN p_patch->>'degree_level'                     ELSE degree_level END,
    rating_academics        = CASE WHEN p_patch ? 'rating_academics'        THEN (p_patch->>'rating_academics')::int          ELSE rating_academics END,
    rating_campus           = CASE WHEN p_patch ? 'rating_campus'           THEN (p_patch->>'rating_campus')::int             ELSE rating_campus END,
    rating_accommodation    = CASE WHEN p_patch ? 'rating_accommodation'    THEN (p_patch->>'rating_accommodation')::int      ELSE rating_accommodation END,
    rating_cost             = CASE WHEN p_patch ? 'rating_cost'             THEN (p_patch->>'rating_cost')::int               ELSE rating_cost END,
    rating_intl_office      = CASE WHEN p_patch ? 'rating_intl_office'      THEN (p_patch->>'rating_intl_office')::int        ELSE rating_intl_office END,
    rating_social           = CASE WHEN p_patch ? 'rating_social'           THEN (p_patch->>'rating_social')::int             ELSE rating_social END,
    rating_extracurricular  = CASE WHEN p_patch ? 'rating_extracurricular'  THEN (p_patch->>'rating_extracurricular')::int    ELSE rating_extracurricular END,
    rating_career           = CASE WHEN p_patch ? 'rating_career'           THEN (p_patch->>'rating_career')::int             ELSE rating_career END,
    enrollment_status       = CASE WHEN p_patch ? 'enrollment_status'       THEN p_patch->>'enrollment_status'                ELSE enrollment_status END,
    start_year              = CASE WHEN p_patch ? 'start_year'              THEN (p_patch->>'start_year')::int                ELSE start_year END,
    end_year                = CASE WHEN p_patch ? 'end_year'                THEN (p_patch->>'end_year')::int                  ELSE end_year END,
    language_of_instruction = CASE WHEN p_patch ? 'language_of_instruction' THEN p_patch->>'language_of_instruction'          ELSE language_of_instruction END,
    tuition_range           = CASE WHEN p_patch ? 'tuition_range'           THEN p_patch->>'tuition_range'                    ELSE tuition_range END,
    living_cost_range       = CASE WHEN p_patch ? 'living_cost_range'       THEN p_patch->>'living_cost_range'                ELSE living_cost_range END,
    funding_type            = CASE WHEN p_patch ? 'funding_type'            THEN p_patch->>'funding_type'                     ELSE funding_type END,
    funding_coverage        = CASE
                                WHEN v_new_funding = 'self' THEN NULL
                                WHEN p_patch ? 'funding_coverage' THEN p_patch->>'funding_coverage'
                                ELSE funding_coverage
                              END,
    pros                    = CASE WHEN p_patch ? 'pros'                    THEN p_patch->>'pros'                             ELSE pros END,
    cons                    = CASE WHEN p_patch ? 'cons'                    THEN p_patch->>'cons'                             ELSE cons END
  WHERE id = p_review_id;

  UPDATE public.reviewer_context
    SET boost_save_count = boost_save_count + 1,
        boost_fail_count = 0,
        boost_next_attempt_at = NULL
    WHERE review_id = p_review_id;

  RETURN 'ok';
END;
$$;

-- ---------------------------------------------------------
-- 5. Triggers
-- ---------------------------------------------------------

DROP TRIGGER IF EXISTS update_universities_updated_at_trigger ON public.universities;
CREATE TRIGGER update_universities_updated_at_trigger
  BEFORE UPDATE ON public.universities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_universities_updated_at();

DROP TRIGGER IF EXISTS university_slug_history_ins ON public.universities;
CREATE TRIGGER university_slug_history_ins
  BEFORE INSERT ON public.universities
  FOR EACH ROW
  EXECUTE FUNCTION public.track_university_slug_change();

DROP TRIGGER IF EXISTS university_slug_history_upd ON public.universities;
CREATE TRIGGER university_slug_history_upd
  BEFORE UPDATE OF slug, slug_aliases ON public.universities
  FOR EACH ROW
  EXECUTE FUNCTION public.track_university_slug_change();

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

DROP TRIGGER IF EXISTS enforce_email_domain_block ON auth.users;
CREATE TRIGGER enforce_email_domain_block
  BEFORE INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_email_domain_block();

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

DROP TRIGGER IF EXISTS update_review_drafts_updated_at_trigger ON public.review_drafts;
CREATE TRIGGER update_review_drafts_updated_at_trigger
  BEFORE UPDATE ON public.review_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_review_drafts_updated_at();

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

-- Soft-deleted reviews are invisible to every client read path. There are no
-- UPDATE/DELETE policies: edits and deletes go through the review-manage Edge
-- Function only, which enforces ownership against the verified JWT.
DROP POLICY IF EXISTS "Public read access to reviews" ON public.reviews;
CREATE POLICY "Public read access to reviews"
  ON public.reviews FOR SELECT
  TO public USING (deleted_at IS NULL);

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

-- reviewer_context: no policies at all — anonymous reviewer context is
-- written and read only by the review-submit Edge Function (service role).
ALTER TABLE public.reviewer_context ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reviewer_context FROM anon, authenticated;

ALTER TABLE public.review_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read own drafts" ON public.review_drafts;
CREATE POLICY "Authenticated users can read own drafts"
  ON public.review_drafts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert own drafts" ON public.review_drafts;
CREATE POLICY "Authenticated users can insert own drafts"
  ON public.review_drafts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can update own drafts" ON public.review_drafts;
CREATE POLICY "Authenticated users can update own drafts"
  ON public.review_drafts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can delete own drafts" ON public.review_drafts;
CREATE POLICY "Authenticated users can delete own drafts"
  ON public.review_drafts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- blocked_email_domains: no policies at all — the blocklist is read only by
-- the security-definer is_email_allowed / hook functions.
ALTER TABLE public.blocked_email_domains ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocked_email_domains FROM anon, authenticated;

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

-- Migration 039: member_profiles is members-only. Supabase default privileges
-- auto-grant SELECT to anon on CREATE VIEW, so without this revoke the view is
-- publicly readable. Re-run this revoke after any future DROP/CREATE of the
-- view (CREATE re-applies default grants; CREATE OR REPLACE preserves them).
REVOKE SELECT ON public.member_profiles FROM PUBLIC, anon;

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

-- Migration 040: EXECUTE is authenticated-only — Supabase default privileges
-- auto-grant EXECUTE to anon too, so revoke per-role (PUBLIC alone is not
-- enough). Re-run after any DROP/CREATE of the function.
REVOKE ALL ON FUNCTION public.profile_has_social_handle(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_has_social_handle(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.toggle_upvote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_upvote(uuid) TO authenticated, service_role;

-- refresh_university_stats runs inside trigger functions (security-definer
-- owner privileges); it is not a client-callable surface.
REVOKE ALL ON FUNCTION public.refresh_university_stats(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_university_stats(UUID) TO service_role;

-- immutable_array_to_string only runs inside the search_text generated
-- column at write time (migration 043) — not a client-callable surface.
REVOKE ALL ON FUNCTION public.immutable_array_to_string(TEXT[], TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.immutable_array_to_string(TEXT[], TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.is_email_allowed(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_email_allowed(TEXT) TO anon, authenticated;

-- apply_anonymous_boost is the anonymous-Boost authorization boundary
-- (migration 044) — callable only through the review-boost Edge Function.
REVOKE ALL ON FUNCTION public.apply_anonymous_boost(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_anonymous_boost(UUID, TEXT, JSONB) TO service_role;

-- Auth calls the before-user-created hook as supabase_auth_admin.
REVOKE ALL ON FUNCTION public.hook_reject_disposable_email(JSONB) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.hook_reject_disposable_email(JSONB) TO supabase_auth_admin;

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

REVOKE ALL ON FUNCTION public.record_upload_attempt(TEXT) FROM PUBLIC, anon, authenticated;
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

REVOKE ALL ON FUNCTION public.use_upload_session(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.use_upload_session(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_upload_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  DELETE FROM public.upload_rate_limits WHERE window_start < NOW() - INTERVAL '7 days';
  DELETE FROM public.upload_sessions WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_upload_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_upload_rate_limits() TO service_role;

-- Scheduled daily at 03:17 UTC by migration 033 (job name is stable —
-- cron.schedule upserts by name, so re-running migrations is safe).
SELECT cron.schedule(
  'cleanup-upload-rate-limits',
  '17 3 * * *',
  $$SELECT public.cleanup_upload_rate_limits();$$
);

ALTER TABLE public.upload_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.upload_rate_limits TO service_role;
GRANT ALL ON public.upload_sessions TO service_role;

-- ---------------------------------------------------------
-- 12. Comment email notifications
-- ---------------------------------------------------------

-- comments INSERT trigger → net.http_post → comment-notify Edge Function.
-- URL and shared secret live in Supabase Vault (comment_notify_url /
-- comment_notify_secret); the trigger no-ops when they are unset.

CREATE TABLE IF NOT EXISTS public.comment_email_log (
  comment_id UUID PRIMARY KEY REFERENCES public.comments(id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comment_email_log_recipient
  ON public.comment_email_log (recipient_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_comment_email_log_review_recipient
  ON public.comment_email_log (review_id, recipient_user_id, created_at);

ALTER TABLE public.comment_email_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.comment_email_log FROM anon, authenticated;
GRANT ALL ON public.comment_email_log TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_comment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
BEGIN
  SELECT s.decrypted_secret INTO v_url
    FROM vault.decrypted_secrets AS s
    WHERE s.name = 'comment_notify_url'
    LIMIT 1;
  SELECT s.decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets AS s
    WHERE s.name = 'comment_notify_secret'
    LIMIT 1;

  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', v_secret
    ),
    body := jsonb_build_object('comment_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'comment notification enqueue failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_comment_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS comment_notify_inserted ON public.comments;
CREATE TRIGGER comment_notify_inserted
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_comment_notification();

-- ---------------------------------------------------------
-- 13. PostgREST schema reload
-- ---------------------------------------------------------

NOTIFY pgrst, 'reload schema';
