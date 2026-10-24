-- Apply after Prisma synchronization. Invalid combinations remain database errors.
BEGIN;
ALTER TABLE "ApprovalRequest" DROP CONSTRAINT IF EXISTS "ApprovalRequest_state_check";
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_state_check" CHECK (
    version > 0 AND
    ((status = 'DECIDED' AND "decidedAt" IS NOT NULL) OR
     (status <> 'DECIDED' AND "decidedAt" IS NULL)));
ALTER TABLE "ApprovalLine" DROP CONSTRAINT IF EXISTS "ApprovalLine_state_check";
ALTER TABLE "ApprovalLine" ADD CONSTRAINT "ApprovalLine_state_check" CHECK (
    version > 0 AND "lineNumber" > 0 AND
    ((quantity IS NOT NULL AND quantity > 0 AND "destinationNodeId" IS NULL AND "destinationFacilityId" IS NULL) OR
     (quantity IS NULL AND "destinationNodeId" IS NOT NULL AND "destinationFacilityId" IS NOT NULL AND "sourceNodeId" <> "destinationNodeId")) AND
    ((decision = 'APPROVED' AND "executionStatus" IS NOT NULL) OR
     (decision <> 'APPROVED' AND "executionStatus" IS NULL)) AND
    (("executionStatus" IN ('EXECUTED', 'ABANDONED', 'REVOKED') AND "terminalAt" IS NOT NULL) OR
     (("executionStatus" IS NULL OR "executionStatus" = 'PENDING') AND "terminalAt" IS NULL)));
COMMIT;
