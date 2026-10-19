-- Apply after Prisma schema synchronization. These checks do not normalize invalid data.
BEGIN;
ALTER TABLE "Material" DROP CONSTRAINT IF EXISTS "Material_quantityScale_check";
ALTER TABLE "Material" ADD CONSTRAINT "Material_quantityScale_check" CHECK ("quantityScale" BETWEEN 0 AND 6);
ALTER TABLE "MaterialBatch" DROP CONSTRAINT IF EXISTS "MaterialBatch_expiry_check";
ALTER TABLE "MaterialBatch" ADD CONSTRAINT "MaterialBatch_expiry_check" CHECK (
    ("expiryKind" = 'DATED' AND "expiresOn" IS NOT NULL AND ("manufacturedOn" IS NULL OR "manufacturedOn" <= "expiresOn"))
    OR ("expiryKind" IN ('UNKNOWN', 'NONE') AND "expiresOn" IS NULL));
ALTER TABLE "MaterialInstance" DROP CONSTRAINT IF EXISTS "MaterialInstance_expiry_check";
ALTER TABLE "MaterialInstance" ADD CONSTRAINT "MaterialInstance_expiry_check" CHECK (
    ("expiryKind" = 'DATED' AND "expiresOn" IS NOT NULL AND ("manufacturedOn" IS NULL OR "manufacturedOn" <= "expiresOn"))
    OR ("expiryKind" IN ('UNKNOWN', 'NONE') AND "expiresOn" IS NULL));
ALTER TABLE "MaterialInstance" DROP CONSTRAINT IF EXISTS "MaterialInstance_initialQuantity_check";
ALTER TABLE "MaterialInstance" ADD CONSTRAINT "MaterialInstance_initialQuantity_check" CHECK ("initialQuantity" >= 0);
ALTER TABLE "StockItem" DROP CONSTRAINT IF EXISTS "StockItem_quantity_check";
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_quantity_check" CHECK (quantity >= 0);
ALTER TABLE "InventoryOperation" DROP CONSTRAINT IF EXISTS "InventoryOperation_scope_check";
ALTER TABLE "InventoryOperation" ADD CONSTRAINT "InventoryOperation_scope_check" CHECK (
    "scopeKind" IN ('workspace', 'organization-user') AND ("scopeKind" <> 'organization-user' OR "scopeId" = "actorUserId"));
COMMIT;
