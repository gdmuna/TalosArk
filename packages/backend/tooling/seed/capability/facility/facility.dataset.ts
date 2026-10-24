import { z } from 'zod';
import { defineDatasetFor } from '../../definition/dataset.js';
import { facilityKind } from './facility.kind.js';

export const facilityDataset = defineDatasetFor(facilityKind)({
    id: 'laboratory-facility',
    version: 1,
    tags: ['facility', 'topology', 'demo'],
    description: 'One cabinet with exclusive storage positions',
    parameters: z.strictObject({ positions: z.number().int().min(1).max(100).default(50) }),
    build: ({ positions }) => ({ positions, name: 'Seed storage cabinet' }),
});
