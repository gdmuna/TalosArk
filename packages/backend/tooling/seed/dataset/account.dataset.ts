import { z } from 'zod';
import { defineDatasetFor } from '../seed.definition.js';
import { accountsKind } from '../seeder/account.kind.js';

export const ownerAccount = defineDatasetFor(accountsKind)({
    id: 'account-owner',
    version: 1,
    tags: ['account', 'baseline', 'legal'],
    description: 'One activated local account for an isolated fixture scope',
    parameters: z.strictObject({}),
    build: () => ({
        accounts: [{ key: 'owner', input: { username: 'owner', email: 'owner@seed.invalid' } }],
    }),
});

export const governanceAccounts = defineDatasetFor(accountsKind)({
    id: 'account-governance',
    version: 1,
    tags: ['account', 'governance', 'legal'],
    description:
        'Twelve local personas, profiles and an unactivated account; no system administrator',
    parameters: z.strictObject({}),
    build: () => ({
        accounts: [
            'owner-a',
            'owner-b',
            'manager',
            'operator',
            'reviewer',
            'reader',
            'org-only',
            'basic',
            'departed',
            'outsider',
            'multi',
            'pending',
        ].map((key, index) => ({
            key,
            input: { username: key, email: `${key}@seed.invalid` },
            active: key !== 'pending',
            profile:
                index % 3 === 0
                    ? {
                          nickname: `Seed ${key}`,
                          bio: 'Development fixture',
                          sexVisible: false,
                          birthday: '1990-01-01',
                      }
                    : undefined,
        })),
    }),
});
