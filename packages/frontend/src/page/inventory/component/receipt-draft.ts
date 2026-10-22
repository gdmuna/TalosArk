import type { InventoryReceipt } from '@/module/inventory';

export type ReceiptDraft = {
    body: InventoryReceipt;
    materialName: string;
    quantityUnit: string;
    positionPath: string;
};
