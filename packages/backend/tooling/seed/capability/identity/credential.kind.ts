import { z } from 'zod';
import { accountsKind } from './account.kind.js';
import { type SeederKind } from '../../definition/dataset.js';

export const credentialKind = {
    id: 'credential',
    version: 1,
    data: z.strictObject({ account: z.string() }),
    input: accountsKind.output,
    output: z.strictObject({
        userId: z.uuid(),
        revokedRecoveryId: z.uuid(),
        consumedRecoveryId: z.uuid(),
    }),
} satisfies SeederKind;
