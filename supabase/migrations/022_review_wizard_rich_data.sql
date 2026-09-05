-- =========================================================
-- 022_review_wizard_rich_data.sql
--
-- Adds structured sub-scores, review context, cost data,
-- tags, and user profile fields to support the multi-step
-- review wizard. Also adds country/type to universities.
-- =========================================================

-- ---------------------------------------------------------
-- Reviews: sub-scores (nullable, 1-5 each)
-- ---------------------------------------------------------
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS rating_academics INT CHECK (rating_academics IS NULL OR rating_academics BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_campus INT CHECK (rating_campus IS NULL OR rating_campus BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_accommodation INT CHECK (rating_accommodation IS NULL OR rating_accommodation BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_cost INT CHECK (rating_cost IS NULL OR rating_cost BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_intl_office INT CHECK (rating_intl_office IS NULL OR rating_intl_office BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_social INT CHECK (rating_social IS NULL OR rating_social BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_extracurricular INT CHECK (rating_extracurricular IS NULL OR rating_extracurricular BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_career INT CHECK (rating_career IS NULL OR rating_career BETWEEN 1 AND 5);

-- ---------------------------------------------------------
-- Reviews: structured context
-- ---------------------------------------------------------
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS enrollment_status TEXT
    CHECK (enrollment_status IS NULL OR enrollment_status IN ('current','alumni','exchange','applicant')),
  ADD COLUMN IF NOT EXISTS start_year INT
    CHECK (start_year IS NULL OR (start_year BETWEEN 1990 AND EXTRACT(YEAR FROM NOW())::INT + 1)),
  ADD COLUMN IF NOT EXISTS end_year INT
    CHECK (end_year IS NULL OR (end_year BETWEEN 1990 AND EXTRACT(YEAR FROM NOW())::INT + 1)),
  ADD COLUMN IF NOT EXISTS language_of_instruction TEXT,
  ADD COLUMN IF NOT EXISTS tuition_range TEXT,
  ADD COLUMN IF NOT EXISTS living_cost_range TEXT,
  ADD COLUMN IF NOT EXISTS funding_type TEXT
    CHECK (funding_type IS NULL OR funding_type IN ('self','csc','school','province')),
  ADD COLUMN IF NOT EXISTS funding_coverage TEXT
    CHECK (funding_coverage IS NULL OR funding_coverage IN ('partial','full')),
  ADD COLUMN IF NOT EXISTS recommend TEXT
    CHECK (recommend IS NULL OR recommend IN ('yes','no','maybe')),
  ADD COLUMN IF NOT EXISTS pros TEXT,
  ADD COLUMN IF NOT EXISTS cons TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Index for tag-based filtering
CREATE INDEX IF NOT EXISTS idx_reviews_tags ON public.reviews USING gin(tags);

-- ---------------------------------------------------------
-- Profiles: user context for commercial value
-- ---------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_country TEXT,
  ADD COLUMN IF NOT EXISTS journey_stage TEXT
    CHECK (journey_stage IS NULL OR journey_stage IN ('researching','applying','admitted','enrolled','alumni')),
  ADD COLUMN IF NOT EXISTS monthly_budget TEXT,
  ADD COLUMN IF NOT EXISTS languages_spoken TEXT,
  ADD COLUMN IF NOT EXISTS email_consent BOOLEAN DEFAULT FALSE;

-- ---------------------------------------------------------
-- Universities: structured attributes
-- ---------------------------------------------------------
ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS uni_type TEXT
    CHECK (uni_type IS NULL OR uni_type IN ('public','private')),
  ADD COLUMN IF NOT EXISTS languages_of_instruction TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS website TEXT;
