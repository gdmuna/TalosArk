BEGIN;

-- Preserve existing account spelling while enforcing the login equivalence rule.
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_normalized_key"
    ON public."User" (lower(btrim("email")));

COMMIT;
