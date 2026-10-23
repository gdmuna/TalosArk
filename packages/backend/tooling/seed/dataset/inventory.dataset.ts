import { z } from 'zod';
import { defineDatasetFor } from '../seed.definition.js';
import { batchKind } from '../seeder/batch.kind.js';
import { receiptKind } from '../seeder/seed.kind.js';
import { inventoryHistoryKind } from '../seeder/inventory-history.kind.js';

export const batchDataset = defineDatasetFor(batchKind)({
    id: 'material-batch',
    version: 1,
    tags: ['material', 'batch', 'legal'],
    description: 'Unknown, non-expiring, dated and archived batches',
    parameters: z.strictObject({}),
    build: () => ({
        batches: [
            {
                key: 'unknown',
                materialIndex: 0,
                input: { batchNumber: 'UNKNOWN', expiry: { kind: 'UNKNOWN' } },
            },
            {
                key: 'none',
                materialIndex: 1,
                input: { batchNumber: 'NONE', expiry: { kind: 'NONE' } },
            },
            {
                key: 'dated',
                materialIndex: 2,
                input: {
                    batchNumber: 'DATED',
                    manufacturedOn: '2020-01-01',
                    expiry: { kind: 'DATED', date: '2099-01-01' },
                },
            },
            {
                key: 'archived',
                materialIndex: 0,
                input: { batchNumber: 'ARCHIVED' },
                archived: true,
            },
        ],
    }),
});

export const lifecycleReceiptDataset = defineDatasetFor(receiptKind)({
    id: 'inventory-receipt-profile',
    version: 1,
    tags: ['inventory', 'receipt', 'legal'],
    description: 'Receipts with optional batches and four explicit expiry profiles',
    parameters: z.strictObject({}),
    build: () => ({
        quantity: '50',
        facts: [
            { label: 'Non-expiring fixture', expiry: { kind: 'NONE' } },
            { label: 'Unknown expiry fixture', expiry: { kind: 'UNKNOWN' } },
            {
                label: 'Dated fixture',
                manufacturedOn: '2020-01-01',
                expiry: { kind: 'DATED', date: '2099-01-01' },
            },
            {
                label: 'Expired fixture',
                manufacturedOn: '2020-01-01',
                expiry: { kind: 'DATED', date: '2020-12-31' },
            },
        ],
    }),
});

export const inventoryHistoryDataset = defineDatasetFor(inventoryHistoryKind)({
    id: 'inventory-history',
    version: 1,
    tags: ['inventory', 'history', 'legal'],
    description:
        'Partial/full consumption, zero adjustment, disposal and transfer through real commands',
    parameters: z.strictObject({}),
    build: () => ({
        actions: [
            {
                stockIndex: 0,
                action: {
                    kind: 'consume',
                    body: { quantity: '2', reason: 'Seed partial consumption' },
                },
            },
            {
                stockIndex: 1,
                action: {
                    kind: 'consume',
                    body: { quantity: '50', reason: 'Seed full consumption' },
                },
            },
            {
                stockIndex: 2,
                action: {
                    kind: 'adjust',
                    body: { actualQuantity: '0', reason: 'Seed count correction' },
                },
            },
            {
                stockIndex: 3,
                action: { kind: 'dispose', body: { reason: 'Seed expired item disposal' } },
            },
            {
                stockIndex: 4,
                action: {
                    kind: 'transfer',
                    body: { reason: 'Seed position transfer' },
                    targetPosition: 15,
                },
            },
        ],
    }),
});
