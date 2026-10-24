import { z } from 'zod';
import {
    ApprovalSubmitSchema,
    ApprovalDecisionSchema,
    ApprovalCommandSchema,
    ApprovalExecuteSchema,
    type ApprovalScope,
    type ApprovalSelection,
    type ApprovalQuery,
    type ApprovalPageQuery,
    type ApprovalContext,
    type ApprovalSummary,
    type ApprovalCandidate,
    type ApprovalRequestPage,
    type ApprovalRequest,
    type ApprovalLinePage,
    type ApprovalEventPage,
    type ApprovalOperationResult,
} from '@talos-ark/contracts/approval';

export const approvalMutationSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('submit'), body: ApprovalSubmitSchema }),
    z.object({ kind: z.literal('decide'), requestId: z.uuid(), body: ApprovalDecisionSchema }),
    z.object({ kind: z.literal('withdraw'), requestId: z.uuid(), body: ApprovalCommandSchema }),
    z.object({
        kind: z.enum(['abandon', 'revoke']),
        requestId: z.uuid(),
        lineId: z.uuid(),
        body: ApprovalCommandSchema,
    }),
    z.object({
        kind: z.literal('execute'),
        requestId: z.uuid(),
        lineId: z.uuid(),
        body: ApprovalExecuteSchema,
    }),
]);
export type ApprovalMutation = z.infer<typeof approvalMutationSchema>;
export interface ApprovalDataSource {
    context(scope: ApprovalScope, signal: AbortSignal): Promise<ApprovalContext>;
    summary(scope: ApprovalScope, signal: AbortSignal): Promise<ApprovalSummary>;
    candidates(
        scope: ApprovalScope,
        selection: ApprovalSelection,
        signal: AbortSignal
    ): Promise<{ items: ApprovalCandidate[] }>;
    list(
        scope: ApprovalScope,
        query: ApprovalQuery,
        signal: AbortSignal
    ): Promise<ApprovalRequestPage>;
    get(scope: ApprovalScope, id: string, signal: AbortSignal): Promise<ApprovalRequest>;
    lines(
        scope: ApprovalScope,
        id: string,
        query: ApprovalPageQuery,
        signal: AbortSignal
    ): Promise<ApprovalLinePage>;
    events(
        scope: ApprovalScope,
        id: string,
        query: ApprovalPageQuery,
        signal: AbortSignal
    ): Promise<ApprovalEventPage>;
    mutate(
        scope: ApprovalScope,
        mutation: ApprovalMutation,
        signal: AbortSignal
    ): Promise<ApprovalOperationResult>;
    operation(
        scope: ApprovalScope,
        id: string,
        signal: AbortSignal
    ): Promise<ApprovalOperationResult>;
}
