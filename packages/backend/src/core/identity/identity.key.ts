import { defineKvsKeyFamily } from '@/infra/kvs/index.js';

import z from 'zod';

export const identityOidcTransactionKey = defineKvsKeyFamily({
    id: 'identity.oidc.transaction',
    canonical: 1,
    family: {
        1: {
            category: 'identity',
            subtype: 'oidc.transaction',
            segments: [['id', z.string()]],
        },
    },
});
