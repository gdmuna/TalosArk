import type { AuthorizationMetadata } from '@/core/permission/authorization-definition.js';
export const approvalPermission = {
    consumeApply: 'approval.consume.apply',
    transferApply: 'approval.transfer.apply',
    consumeReview: 'approval.consume.review',
    transferReview: 'approval.transfer.review',
    readAll: 'approval.read.all',
    revoke: 'approval.revoke',
} as const;
export const approvalAuthorization = {
    namespace: 'approval',
    definitions: Object.entries(approvalPermission).map(([name, code]) => ({
        code,
        name: `Approval ${name}`,
        scope: 'WORKSPACE' as const,
    })),
} satisfies AuthorizationMetadata;
