import type { z } from 'zod';
import {
    InventoryContextSchema,
    InventoryActionSchema,
    InventoryQuerySchema,
    InstanceCorrectionSchema,
    OperationReceiptSchema,
    ReceiptSchema,
    RelocationSchema,
    RelocationExecuteSchema,
    RelocationPreviewSchema,
    StockPageSchema,
    StockSchema,
    TransactionPageSchema,
    TransactionSchema,
} from '@talos-ark/contracts/inventory';

export type InventoryScope = { organizationId: string; workspaceId: string };
export type InventoryAction = z.infer<typeof InventoryActionSchema>;
export type InventoryActionKind = InventoryAction['kind'];
export type InventoryContext = z.infer<typeof InventoryContextSchema>;
export type InventoryQuery = z.infer<typeof InventoryQuerySchema>;
export type InventoryStock = z.infer<typeof StockSchema>;
export type InventoryPage = z.infer<typeof StockPageSchema>;
export type InventoryTransaction = z.infer<typeof TransactionSchema>;
export type InventoryTransactionPage = z.infer<typeof TransactionPageSchema>;
export type InventoryReceipt = z.infer<typeof ReceiptSchema>;
export type InventoryCorrection = z.infer<typeof InstanceCorrectionSchema>;
export type InventoryOperationReceipt = z.infer<typeof OperationReceiptSchema>;
export type InventoryRelocation = z.infer<typeof RelocationSchema>;
export type InventoryRelocationExecute = z.infer<typeof RelocationExecuteSchema>;
export type InventoryRelocationPreview = z.infer<typeof RelocationPreviewSchema>;

export interface InventoryDataSource {
    context(scope: InventoryScope, signal?: AbortSignal): Promise<InventoryContext>;
    list(
        scope: InventoryScope,
        query: InventoryQuery,
        signal?: AbortSignal
    ): Promise<InventoryPage>;
    get(scope: InventoryScope, id: string, signal?: AbortSignal): Promise<InventoryStock>;
    receive(
        scope: InventoryScope,
        input: InventoryReceipt,
        signal?: AbortSignal
    ): Promise<InventoryOperationReceipt>;
    correct(
        scope: InventoryScope,
        id: string,
        input: InventoryCorrection,
        signal?: AbortSignal
    ): Promise<InventoryStock>;
    act(
        scope: InventoryScope,
        stockItemId: string,
        input: InventoryAction,
        signal?: AbortSignal
    ): Promise<InventoryOperationReceipt>;
    transactions(
        scope: InventoryScope,
        query: InventoryQuery,
        signal?: AbortSignal
    ): Promise<InventoryTransactionPage>;
    transaction(
        scope: InventoryScope,
        id: string,
        signal?: AbortSignal
    ): Promise<InventoryTransaction>;
    initialize(organizationId: string, signal?: AbortSignal): Promise<{ updated: boolean }>;
    previewRelocation(
        organizationId: string,
        input: InventoryRelocation,
        signal?: AbortSignal
    ): Promise<InventoryRelocationPreview>;
    relocate(
        organizationId: string,
        input: InventoryRelocationExecute,
        signal?: AbortSignal
    ): Promise<InventoryOperationReceipt>;
    operation(
        organizationId: string,
        id: string,
        signal?: AbortSignal
    ): Promise<InventoryOperationReceipt>;
}
