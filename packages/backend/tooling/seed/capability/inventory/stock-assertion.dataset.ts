import { defineDatasetFor } from '../../definition/dataset.js';
import { stockAssertionKind } from './stock-assertion.kind.js';

export const stockAssertionDataset = defineDatasetFor(stockAssertionKind)({
    id: 'inventory-stock-assertion',
    version: 1,
    tags: ['inventory', 'regression', 'assertion'],
    description:
        'Read only the declared stock IDs and compare authored quantity/status/position expectations',
    parameters: stockAssertionKind.data,
    build: (parameters) => parameters,
});
