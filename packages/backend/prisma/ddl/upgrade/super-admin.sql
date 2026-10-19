BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSuperAdmin" boolean NOT NULL DEFAULT false;
COMMIT;
