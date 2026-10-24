import { z } from 'zod';
import { datasetStep } from '../seed.definition.js';
import { ownerAccount } from '../dataset/account.dataset.js';
import { credentialDataset } from '../dataset/credential.dataset.js';
import type { DatasetGroup } from './seed.group.js';

export const credentialRegressionGroup: DatasetGroup = {
    id: 'credential-regression',
    version: 1,
    description:
        'Account activation, password authentication and recovery without IAM, SMTP or KVS',
    build(parameters, context) {
        if (context.actorUserId || context.target)
            throw new Error('Credential scenarios create isolated accounts');
        const account = datasetStep('account', ownerAccount, {}, context.generation, () => ({}));
        const credential = datasetStep(
            'credential',
            credentialDataset,
            {},
            context.generation,
            (results) => results.get(account)
        );
        return { parameters: z.strictObject({}).parse(parameters), steps: [account, credential] };
    },
};
