import { z } from 'zod';
import { defineDatasetFor } from '../../definition/dataset.js';
import { accountsKind } from './account.kind.js';

export const memberVolumeParameters = z.strictObject({
    count: z.number().int().min(1).max(199).default(50),
});

export const memberAccounts = defineDatasetFor(accountsKind)({
    id: 'account-member-volume',
    version: 1,
    tags: ['account', 'volume', 'legal'],
    description: 'Bounded real credential creation for team pagination',
    parameters: memberVolumeParameters,
    build: ({ count }) => ({
        accounts: [
            { key: 'owner', input: { username: 'owner', email: 'owner@seed.invalid' } },
            ...Array.from({ length: count }, (_, index) => {
                const key = `member-${String(index + 1).padStart(3, '0')}`;
                return { key, input: { username: key, email: `${key}@seed.invalid` } };
            }),
        ],
    }),
});
