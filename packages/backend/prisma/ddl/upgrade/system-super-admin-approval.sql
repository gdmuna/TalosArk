-- Actor authorization belongs to the application; keep request state integrity.
BEGIN;
ALTER TABLE "ApprovalRequest" DROP CONSTRAINT IF EXISTS "ApprovalRequest_state_check";
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_state_check" CHECK (
    version > 0 AND
    ((status = 'DECIDED' AND "decidedAt" IS NOT NULL) OR
     (status <> 'DECIDED' AND "decidedAt" IS NULL)));
COMMIT;
