import { z } from 'zod';
import { defineDatasetFor } from '../../definition/dataset.js';
import { receiptKind } from './receipt.kind.js';

export const receiptDataset = defineDatasetFor(receiptKind)({
    id: 'laboratory-receipt',
    version: 1,
    tags: ['inventory', 'receipt', 'demo'],
    description: 'Receive one instance per active material through the real inventory workflow',
    parameters: z.strictObject({}),
    build: () => ({ quantity: '10' }),
});
