-- Signup should never fail because a display name is taken.
--
-- handle_new_user previously re-raised the unique violation from the
-- profiles insert, which rolled back the whole auth.users insert and showed
-- the user a cryptic "Database error creating new user". Now the profile is
-- created with a NULL display name as a fallback: the user is signed up
-- successfully, and the onboarding flow (which already treats a missing or
-- invalid display name as editable) lets them pick a different one.

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
      -- let onboarding collect a fresh one.
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
