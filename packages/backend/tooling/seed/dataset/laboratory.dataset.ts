import { z } from 'zod';
import { defineDatasetFor } from '../seed.definition.js';
import { facilityKind, receiptKind } from '../seeder/seed.kind.js';

export const facilityDataset = defineDatasetFor(facilityKind)({
    id: 'laboratory-facility',
    version: 1,
    tags: ['facility', 'topology', 'demo'],
    description: 'One cabinet with exclusive storage positions',
    parameters: z.strictObject({ positions: z.number().int().min(1).max(100).default(50) }),
    build: ({ positions }) => ({ positions, name: 'Seed storage cabinet' }),
});

export const receiptDataset = defineDatasetFor(receiptKind)({
    id: 'laboratory-receipt',
    version: 1,
    tags: ['inventory', 'receipt', 'demo'],
    description: 'Receive one instance per active material through the real inventory workflow',
    parameters: z.strictObject({}),
    build: () => ({ quantity: '10' }),
});
