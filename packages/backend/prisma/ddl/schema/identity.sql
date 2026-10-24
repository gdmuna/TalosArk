BEGIN;

-- Application writes canonical email; Prisma's ordinary unique index owns uniqueness.
-- Validate existing rows before removing the redundant expression index.
ALTER TABLE public."User"
    DROP CONSTRAINT IF EXISTS "User_email_normalized_check";

ALTER TABLE public."User"
    ADD CONSTRAINT "User_email_normalized_check"
    CHECK ("email" = lower(btrim("email")));

DROP INDEX IF EXISTS public."User_email_normalized_key";

COMMIT;
