import { z } from 'zod';
import { defineDatasetFor } from '../../definition/dataset.js';
import { facilityLifecycleKind } from './lifecycle.kind.js';

export const facilityLifecycleDataset = defineDatasetFor(facilityLifecycleKind)({
    id: 'facility-lifecycle',
    version: 1,
    tags: ['facility', 'storage-node', 'governance', 'legal'],
    description:
        'Disabled/archived facilities, USE/MANAGE grants, a 2x3 grid, node states, subtree movement and ordering',
    parameters: z.strictObject({}),
    build: () => ({
        facilities: [
            {
                key: 'disabled',
                input: { code: 'DISABLED', name: 'Disabled cabinet' },
                state: 'disabled',
            },
            {
                key: 'archived',
                input: { name: 'Archived cabinet without code' },
                state: 'archived',
            },
        ],
        grants: [
            { workspace: 'secondary', level: 'MANAGE' },
            { workspace: 'empty', level: 'USE' },
        ],
    }),
});
