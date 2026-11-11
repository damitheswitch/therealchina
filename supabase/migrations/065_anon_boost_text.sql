-- Migration 065: anonymous Boost may edit `text`.
--
-- A guest who published with too few words could never finish the thank-you
-- gift, because `text` was outside the Boost allowlist. Add it (and only it:
-- tags, rating and media stay unreachable). The patch must be a string of
-- 10 to 5000 characters after btrim, the same bounds review-submit and
-- chk_reviews_text_length enforce; anything else returns 'bad_fields'. The 24h
-- window, 30-save budget, claim checks and token backoff are unchanged.
-- CREATE OR REPLACE keeps the existing grants; they are re-asserted below.

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
      'text', 'program', 'degree_level',
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

  -- Migration 065: text must be a string with the same bounds as review-submit
  -- (chk_reviews_text_length: 10 to 5000 characters after trim). A Boost can
  -- add words, never blank the review.
  IF p_patch ? 'text' AND (
       jsonb_typeof(p_patch->'text') <> 'string'
       OR char_length(btrim(p_patch->>'text')) NOT BETWEEN 10 AND 5000
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
    text                    = CASE WHEN p_patch ? 'text'                    THEN btrim(p_patch->>'text')                      ELSE text END,
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

REVOKE ALL ON FUNCTION public.apply_anonymous_boost(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_anonymous_boost(UUID, TEXT, JSONB) TO service_role;
