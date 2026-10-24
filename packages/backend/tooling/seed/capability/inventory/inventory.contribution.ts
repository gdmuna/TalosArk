import { defineSeedContribution, datasetListing } from '../../plan/catalog.js';
import { receiptKind } from './receipt.kind.js';
import { inventoryHistoryKind } from './history.kind.js';
import { lifecycleReceiptDataset, inventoryHistoryDataset } from './inventory.dataset.js';
import { receiptDataset } from './receipt.dataset.js';
import { inventoryDatabase } from './inventory.database.js';
import { stockAssertionKind } from './stock-assertion.kind.js';
import { stockAssertionDataset } from './stock-assertion.dataset.js';
import { databaseTables } from '../../definition/database.js';

export const inventoryContribution = defineSeedContribution({
    definition: {
        id: 'inventory',
        kinds: [receiptKind, inventoryHistoryKind, stockAssertionKind],
        database: [
            {
                kindId: receiptKind.id,
                requires: inventoryDatabase,
                hint: 'Synchronize the inventory schema and apply db:apply-ddl and db:apply-inventory-ddl for the selected environment.',
            },
            {
                kindId: inventoryHistoryKind.id,
                requires: inventoryDatabase,
                hint: 'Synchronize the inventory schema and apply db:apply-ddl and db:apply-inventory-ddl for the selected environment.',
            },
            {
                kindId: stockAssertionKind.id,
                requires: databaseTables('StockItem', 'Placement'),
                hint: 'Synchronize the inventory schema for the selected environment.',
            },
        ],
        datasets: [
            datasetListing(receiptDataset),
            datasetListing(lifecycleReceiptDataset),
            datasetListing(inventoryHistoryDataset),
            datasetListing(stockAssertionDataset),
        ],
    },
    load: async () => (await import('./inventory.runtime.js')).inventoryRuntime,
});
