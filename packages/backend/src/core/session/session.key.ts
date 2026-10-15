import { defineKvsKeyFamily } from '@/infra/kvs/index.js';

import z from 'zod';

export const sessionKey = defineKvsKeyFamily({
    id: 'access.session',
    canonical: 1,
    family: {
        1: {
            category: 'access',
            subtype: 'session',
            segments: [['id', z.string()]],
        },
    },
});
