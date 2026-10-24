-- Posting history survives content deletion. Existing recent posts retain
-- their quota usage when upgrading from the row-counting triggers.
--
-- Explicit BEGIN/COMMIT: the Supabase CLI sends a migration's statements one
-- at a time, outside any transaction, so LOCK TABLE fails without one
-- ("can only be used in transaction blocks", seen in `db reset` and CI). The
-- transaction also keeps the backfill and the trigger swap atomic, and holds
-- the lock until both are in place.
BEGIN;

-- Hold writes until both the backfill and trigger replacements are installed.
LOCK TABLE public.comments, public.flight_listings IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE public.posting_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('comment', 'flight')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX posting_events_user_kind_created
  ON public.posting_events (user_id, kind, created_at);
ALTER TABLE public.posting_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.posting_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.posting_events TO service_role;

INSERT INTO public.posting_events (user_id, kind, created_at)
SELECT user_id, 'comment', created_at FROM public.comments
WHERE created_at > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT user_id, 'flight', created_at FROM public.flight_listings
WHERE created_at > NOW() - INTERVAL '24 hours';

CREATE OR REPLACE FUNCTION public.consume_posting_quota(p_user_id UUID, p_kind TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit INT;
  v_window INTERVAL;
BEGIN
  IF p_kind = 'comment' THEN
    v_limit := 20;
    v_window := INTERVAL '1 hour';
  ELSIF p_kind = 'flight' THEN
    v_limit := 10;
    v_window := INTERVAL '24 hours';
  ELSE
    RAISE EXCEPTION 'Unknown posting quota';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('posting:' || p_kind || ':' || p_user_id::TEXT, 0));
  DELETE FROM public.posting_events
  WHERE user_id = p_user_id AND kind = p_kind
    AND created_at <= NOW() - v_window;
  IF (SELECT COUNT(*) FROM public.posting_events
      WHERE user_id = p_user_id AND kind = p_kind
        AND created_at > NOW() - v_window) >= v_limit THEN
    RAISE EXCEPTION 'Posting limit reached. Please try again later.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.posting_events (user_id, kind) VALUES (p_user_id, p_kind);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_posting_quota(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_posting_quota(UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_comment_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.created_at := NOW();
    PERFORM public.consume_posting_quota(NEW.user_id, 'comment');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_flight_listing_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.created_at := OLD.created_at;
    ELSE
      NEW.created_at := NOW();
      PERFORM public.consume_posting_quota(NEW.user_id, 'flight');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
