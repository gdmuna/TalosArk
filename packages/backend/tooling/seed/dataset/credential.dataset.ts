import { z } from 'zod';
import { defineDatasetFor } from '../seed.definition.js';
import { credentialKind } from '../seeder/credential.kind.js';

export const credentialDataset = defineDatasetFor(credentialKind)({
    id: 'credential-recovery',
    version: 1,
    tags: ['account', 'credential', 'recovery', 'legal'],
    description:
        'Real local authentication and revoked/consumed password recovery; not a session or OIDC fixture',
    parameters: z.strictObject({}),
    build: () => ({ account: 'owner' }),
});
