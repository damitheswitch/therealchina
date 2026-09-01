-- Gate anonymous submissions behind the review-submit Edge Function.
--
-- Previously anonymous clients could INSERT reviews (any user_id = NULL row)
-- and universities directly, with no CAPTCHA or rate limiting — an unlimited
-- spam vector. All review submissions now route through the review-submit
-- Edge Function, which verifies Turnstile for anonymous callers, rate-limits
-- every caller, validates the payload, and writes with the service role key.
--
-- Authenticated users who completed onboarding keep direct INSERT permission
-- on reviews (unchanged policy below). University creation moves entirely to
-- the Edge Function (service role).

DROP POLICY IF EXISTS "Anonymous users can insert reviews" ON public.reviews;

DROP POLICY IF EXISTS "Public insert access to universities" ON public.universities;
