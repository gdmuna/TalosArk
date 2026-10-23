import { z } from 'zod';
import { defineDatasetFor } from '../seed.definition.js';
import { accountsKind } from '../seeder/account.kind.js';
import { teamKind } from '../seeder/governance.kind.js';
import { materialPermission } from '../../../src/modules/material/contribution/material-authorization.contribution.js';

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
export const memberVolume = defineDatasetFor(teamKind)({
    id: 'team-member-volume',
    version: 1,
    tags: ['team', 'membership', 'volume', 'legal'],
    description: 'Real accepted invitations, members and reader-role bindings',
    parameters: memberVolumeParameters,
    build: ({ count }) => ({
        roles: [
            {
                key: 'reader',
                input: {
                    code: 'seed-reader',
                    name: 'Reader',
                    scope: 'WORKSPACE',
                    permissions: [materialPermission.read],
                },
            },
        ],
        members: Array.from({ length: count }, (_, index) => ({
            account: `member-${String(index + 1).padStart(3, '0')}`,
            roles: ['reader'],
        })),
        invitations: [],
    }),
});
