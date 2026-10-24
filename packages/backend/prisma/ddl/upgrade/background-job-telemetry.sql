-- Additive upgrade for existing databases; does not change payloads or task state.
BEGIN;
ALTER TABLE "BackgroundJob"
    ADD COLUMN IF NOT EXISTS "traceParent" varchar(256),
    ADD COLUMN IF NOT EXISTS "traceState" varchar(512);
CREATE INDEX IF NOT EXISTS "BackgroundJob_status_availableAt_id_idx"
    ON "BackgroundJob" ("status", "availableAt", id);
COMMIT;
