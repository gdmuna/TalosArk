import { defineSeedContribution, datasetListing } from '../../plan/catalog.js';
import { receiptKind } from './receipt.kind.js';
import { inventoryHistoryKind } from './history.kind.js';
import { lifecycleReceiptDataset, inventoryHistoryDataset } from './inventory.dataset.js';
import { receiptDataset } from './receipt.dataset.js';
import { stockAssertionKind } from './stock-assertion.kind.js';
import { stockAssertionDataset } from './stock-assertion.dataset.js';

export const inventoryContribution = defineSeedContribution({
    definition: {
        id: 'inventory',
        kinds: [receiptKind, inventoryHistoryKind, stockAssertionKind],
        datasets: [
            datasetListing(receiptDataset),
            datasetListing(lifecycleReceiptDataset),
            datasetListing(inventoryHistoryDataset),
            datasetListing(stockAssertionDataset),
        ],
    },
    load: async () => (await import('./inventory.runtime.js')).inventoryRuntime,
});
