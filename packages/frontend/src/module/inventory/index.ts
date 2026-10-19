export { createHttpInventoryDataSource } from './data/api';
export type * from './data/source';
export { default as InventoryTransactionInspector } from './ui/InventoryTransactionInspector.vue';
export { default as InventoryFactsEditor } from './ui/InventoryFactsEditor.vue';
export { useInventoryReceiptStore } from './model/receipt';
export {
    inventoryStatusLabel,
    inventoryExpiryLabel,
    inventoryTransactionLabel,
} from './model/presentation';
export {
    inventoryDataSourceKey,
    inventoryErrorMessage,
    useInventoryDataSource,
    useInventoryRead,
    useInventoryScope,
} from './model/read';
