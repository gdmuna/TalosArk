import { z } from 'zod';
import { defineGroup } from '../definition/group.js';
import { addGovernance } from './governance-demo.group.js';
import {
    chemicalDemo,
    biologicalDemo,
    consumableDemo,
    materialVolume,
} from '../capability/material/material.dataset.js';
import { facilityDataset } from '../capability/facility/facility.dataset.js';
import {
    lifecycleReceiptDataset,
    inventoryHistoryDataset,
} from '../capability/inventory/inventory.dataset.js';
import { batchDataset } from '../capability/material/batch.dataset.js';
import { approvalDataset } from '../capability/approval/approval.dataset.js';
import { facilityLifecycleDataset } from '../capability/facility/lifecycle.dataset.js';

export const businessDemoGroup = defineGroup({
    id: 'business-demo',
    version: 2,
    purpose: 'demo',
    description:
        'Daily development workspace: governance, three material branches, batches, topology, stock and approvals; no volume or external integration',
    parameters: z.strictObject({}),
    scopeModes: ['provision'],
    build(_p, b) {
        const governance = addGovernance(b);
        const materials = b.step(
            'chemical',
            chemicalDemo,
            {},
            { from: { scope: governance.primary }, bind: ({ scope }) => scope }
        );
        const consumable = b.step(
            'consumable',
            consumableDemo,
            {},
            { from: { scope: governance.primary }, bind: ({ scope }) => scope }
        );
        const biological = b.step(
            'biological',
            biologicalDemo,
            {},
            { from: { scope: governance.primary }, bind: ({ scope }) => scope }
        );
        b.step(
            'isolated-material',
            materialVolume,
            { branch: 'chemical', count: 2 },
            { from: { scope: governance.other }, bind: ({ scope }) => scope }
        );
        const batch = b.step(
            'batch',
            batchDataset,
            {},
            { from: { materials }, bind: ({ materials }) => materials }
        );
        const facility = b.step(
            'facility',
            facilityDataset,
            { positions: 20 },
            { from: { scope: governance.primary }, bind: ({ scope }) => scope }
        );
        b.step(
            'facility-lifecycle',
            facilityLifecycleDataset,
            {},
            {
                from: { facility, secondary: governance.secondary, empty: governance.empty },
                bind: (values) => values,
            }
        );
        const receipt = b.step(
            'receipt',
            lifecycleReceiptDataset,
            {},
            {
                from: { materials, facility, batch },
                bind: ({ materials, facility, batch }) => ({ materials, facility, batches: batch }),
            }
        );
        b.step(
            'inventory-history',
            inventoryHistoryDataset,
            {},
            { from: { receipt, facility }, bind: (values) => values }
        );
        const approvals = b.step(
            'approval',
            approvalDataset,
            {},
            {
                from: { receipt, facility, accounts: governance.accounts },
                bind: ({ receipt, facility, accounts }) => ({
                    receipt,
                    facility,
                    reviewer: accounts.reviewer,
                }),
            }
        );
        b.expose({
            chemicals: materials,
            consumables: consumable,
            biologicals: biological,
            facility,
            stock: receipt,
            approvals,
        });
    },
});
