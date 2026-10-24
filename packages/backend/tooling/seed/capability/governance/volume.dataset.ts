import { defineDatasetFor } from '../../definition/dataset.js';
import { memberVolumeParameters } from '../identity/account-volume.dataset.js';
import { teamKind } from './governance.kind.js';
import { materialPermission } from '../../../../src/modules/material/contribution/material-authorization.contribution.js';

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
