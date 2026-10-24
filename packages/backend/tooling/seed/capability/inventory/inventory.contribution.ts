import { defineSeedContribution, datasetListing } from '../../plan/catalog.js';
import { receiptKind } from './receipt.kind.js';
import { inventoryHistoryKind } from './history.kind.js';
import { lifecycleReceiptDataset, inventoryHistoryDataset } from './inventory.dataset.js';
import { receiptDataset } from './receipt.dataset.js';

export const inventoryContribution = defineSeedContribution({
    definition: {
        id: 'inventory',
        kinds: [receiptKind, inventoryHistoryKind],
        datasets: [
            datasetListing(receiptDataset),
            datasetListing(lifecycleReceiptDataset),
            datasetListing(inventoryHistoryDataset),
        ],
    },
    load: async () => (await import('./inventory.runtime.js')).inventoryRuntime,
});
