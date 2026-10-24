import { z } from 'zod';
import { defineGroup } from '../definition/group.js';
import { addWorkspaceBaseline } from './baseline.js';
import { materialVolume } from '../capability/material/material.dataset.js';
import { facilityDataset } from '../capability/facility/facility.dataset.js';
import {
    lifecycleReceiptDataset,
    inventoryHistoryDataset,
} from '../capability/inventory/inventory.dataset.js';
import { stockAssertionDataset } from '../capability/inventory/stock-assertion.dataset.js';

export const inventoryRegressionGroup = defineGroup({
    id: 'inventory-regression',
    version: 1,
    purpose: 'regression',
    description: 'Five inventory actions followed by explicit scoped final-state assertions',
    parameters: z.strictObject({}),
    scopeModes: ['provision', 'actor', 'workspace'],
    build(_parameters, b) {
        const scope = addWorkspaceBaseline(b);
        const materials = b.step(
            'material',
            materialVolume,
            { count: 5, branch: 'chemical' },
            {
                from: { scope },
                bind: ({ scope }) => scope,
            }
        );
        const facility = b.step(
            'facility',
            facilityDataset,
            { positions: 20 },
            {
                from: { scope },
                bind: ({ scope }) => scope,
            }
        );
        const receipt = b.step(
            'receipt',
            lifecycleReceiptDataset,
            {},
            {
                from: { materials, facility },
                bind: (values) => values,
            }
        );
        const history = b.step(
            'inventory-history',
            inventoryHistoryDataset,
            {},
            {
                from: { receipt, facility },
                bind: (values) => values,
            }
        );
        const checked = b.step(
            'check-final-stock',
            stockAssertionDataset,
            {
                expectations: [
                    { stockIndex: 0, quantity: '48', status: 'IN_STOCK', positionIndex: 0 },
                    { stockIndex: 1, quantity: '0', status: 'DEPLETED', positionIndex: 1 },
                    { stockIndex: 2, quantity: '0', status: 'DEPLETED', positionIndex: 2 },
                    { stockIndex: 3, quantity: '0', status: 'DISPOSED', positionIndex: null },
                    { stockIndex: 4, quantity: '50', status: 'IN_STOCK', positionIndex: 15 },
                ],
            },
            {
                from: { receipt, facility, history },
                bind: ({ receipt, facility }) => ({ receipt, facility }),
            }
        );
        b.expose({ primaryScope: scope, stock: receipt, checked });
    },
});
