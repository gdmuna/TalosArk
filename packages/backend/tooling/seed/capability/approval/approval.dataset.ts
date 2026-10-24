import { z } from 'zod';
import { defineDatasetFor } from '../../definition/dataset.js';
import { approvalKind } from './approval.kind.js';

export const approvalDataset = defineDatasetFor(approvalKind)({
    id: 'approval-lifecycle',
    version: 1,
    tags: ['approval', 'history', 'legal'],
    description:
        'Consume and transfer requests, mixed decisions and all supported terminal transitions',
    parameters: z.strictObject({}),
    build: () => ({
        scenarios: [
            ...(
                [
                    'pending',
                    'withdrawn',
                    'approved',
                    'rejected',
                    'mixed',
                    'abandoned',
                    'revoked',
                    'executed',
                ] as const
            ).map((outcome) => ({
                key: `consume-${outcome}`,
                type: 'CONSUME' as const,
                outcome,
                stockIndices: outcome === 'mixed' ? [8, 9] : [8],
            })),
            {
                key: 'transfer-pending',
                type: 'TRANSFER',
                outcome: 'pending',
                stockIndices: [9],
                targetPosition: 16,
            },
            {
                key: 'transfer-executed',
                type: 'TRANSFER',
                outcome: 'executed',
                stockIndices: [9],
                targetPosition: 17,
            },
        ],
    }),
});
