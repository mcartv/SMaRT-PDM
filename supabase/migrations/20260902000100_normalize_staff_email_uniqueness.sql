-- Account emails are compared case-insensitively by the application. Enforce
-- that same identity rule in Postgres, including accidental outer whitespace.
CREATE UNIQUE INDEX IF NOT EXISTS users_normalized_email_key
    ON public.users (LOWER(TRIM(email)))
    WHERE NULLIF(TRIM(email), '') IS NOT NULL;
