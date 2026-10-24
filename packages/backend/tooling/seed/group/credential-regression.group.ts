import { z } from 'zod';
import { defineGroup } from '../definition/group.js';
import { ownerAccount } from '../capability/identity/account.dataset.js';
import { credentialDataset } from '../capability/identity/credential.dataset.js';

export const credentialRegressionGroup = defineGroup({
    id: 'credential-regression',
    version: 2,
    purpose: 'regression',
    description: 'Local activation, authentication and recovery without IAM or SMTP',
    parameters: z.strictObject({}),
    scopeModes: ['provision'],
    build(_p, b) {
        const account = b.step('account', ownerAccount, {}, { from: {}, bind: () => ({}) });
        b.step(
            'credential',
            credentialDataset,
            {},
            { from: { account }, bind: ({ account }) => account }
        );
        b.expose({ accounts: account });
    },
});
