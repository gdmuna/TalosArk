import { z } from 'zod';
import { defineDatasetFor } from '../../definition/dataset.js';
import { batchKind } from './batch.kind.js';

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
