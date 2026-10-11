-- 044_anonymous_boost.sql
-- Phase 3: anonymous Boost. A new anonymous review carries a per-review
-- capability: the browser mints a crypto-random token and review-submit stores
-- only its SHA-256 digest on the private reviewer_context row. The
-- review-boost Edge Function hashes the presented token and calls
-- apply_anonymous_boost, which authorizes AND updates in one transaction:
-- review row and context row are locked FOR UPDATE, so a concurrent claim
-- (review-claim writes reviews.user_id or reviewer_context.owner_id) can never
-- interleave with a Boost save.
--
-- reviewer_context stays service-role only (RLS, no policies, grants revoked);
-- the new columns inherit that. The hash column never holds the raw token.
--
-- Limits (D3.2 / D3.4): 24h from review publication, 30 successful saves per
-- review, and 20 wrong-token attempts per review — all enforced inside the
-- transaction so they cannot be bypassed or raced. A locked-out or expired
-- review still resolves through the normal sign-up claim path.

ALTER TABLE public.reviewer_context
  ADD COLUMN IF NOT EXISTS boost_secret_hash TEXT
    CHECK (boost_secret_hash IS NULL OR boost_secret_hash ~ '^[0-9a-f]{64}$'),
  ADD COLUMN IF NOT EXISTS boost_save_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS boost_fail_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_reviewer_context_boost_secret_hash
  ON public.reviewer_context(boost_secret_hash)
  WHERE boost_secret_hash IS NOT NULL;

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
  -- Cheap format guards: no token or no patch never reach the tables.
  IF p_boost_hash IS NULL OR p_boost_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN 'bad_token';
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' OR p_patch = '{}'::jsonb THEN
    RETURN 'empty';
  END IF;

  -- The RPC is the last line of the allowlist: anything outside the Boost
  -- columns is rejected even if a caller reaches this function directly.
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

  -- Lock the review row first, then the context row — always this order. These
  -- locks serialize against every claim write in review-claim, so a review can
  -- never be boosted after a claim commits.
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

  -- Wrong-token attempts are bounded per review. Once the budget is spent the
  -- anonymous path is locked; sign-up + claim is unaffected.
  IF v_ctx.boost_fail_count >= 20 THEN
    RETURN 'locked';
  END IF;

  IF v_ctx.boost_secret_hash <> p_boost_hash THEN
    UPDATE public.reviewer_context
      SET boost_fail_count = boost_fail_count + 1
      WHERE review_id = p_review_id;
    RETURN 'bad_token';
  END IF;

  -- Token verified. Remaining gates don't consume the fail budget.
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

  -- Rules that span stored and incoming values are checked against the merged
  -- result, so a partial patch cannot create a state a full update rejects.
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
    SET boost_save_count = boost_save_count + 1
    WHERE review_id = p_review_id;

  RETURN 'ok';
END;
$$;

-- Service-role only: anonymous and authenticated callers can never invoke the
-- authorization boundary directly — they must go through review-boost.
REVOKE ALL ON FUNCTION public.apply_anonymous_boost(UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_anonymous_boost(UUID, TEXT, JSONB)
  TO service_role;
