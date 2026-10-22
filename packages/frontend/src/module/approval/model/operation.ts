import { onScopeDispose, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { z } from 'zod';
import {
    ApprovalScopeSchema,
    ApprovalOperationResultSchema,
    type ApprovalScope,
} from '@talos-ark/contracts/approval';
import { HttpError, isResponseValidationError } from '@/platform/http';
import { useWorkspaceStore } from '@/module/workspace';
import { createCommandBatch } from '@/component/batch-operation';
import {
    approvalMutationSchema,
    type ApprovalDataSource,
    type ApprovalMutation,
} from '../data/source';
import { approvalErrorMessage } from './read';
const attemptSchema = z.object({
    scope: ApprovalScopeSchema,
    mutation: approvalMutationSchema,
    result: ApprovalOperationResultSchema.optional(),
    responseValidationFailed: z.boolean().optional(),
});
type Attempt = z.infer<typeof attemptSchema>;
const isRejection = (cause: unknown) =>
    cause instanceof HttpError &&
    cause.kind === 'api' &&
    (cause.status ?? 500) >= 400 &&
    (cause.status ?? 500) < 500 &&
    !['APPROVAL_RESULT_UNAVAILABLE', 'INVENTORY_RESULT_UNAVAILABLE'].includes(cause.code ?? '');
export const useApprovalOperationStore = defineStore('approval-operation', () => {
    const attempts = shallowRef<Attempt[]>([]),
        busy = ref(false),
        error = ref(''),
        recoveryError = ref('');
    const workspace = useWorkspaceStore();
    let source: ApprovalDataSource,
        owner: string | undefined,
        storageOwner = '',
        request: AbortController | undefined;
    const storageKey = () => `talos.approval.operation.${storageOwner}`;
    const current = (scope: ApprovalScope | null) =>
        scope
            ? attempts.value.find(
                  (item) =>
                      item.scope.organizationId === scope.organizationId &&
                      item.scope.workspaceId === scope.workspaceId
              )
            : undefined;
    const batchKey = (scope: ApprovalScope | null) =>
        scope ? `${scope.organizationId}/${scope.workspaceId}` : '';
    const activeScope = () =>
        workspace.current
            ? {
                  organizationId: workspace.current.organizationId,
                  workspaceId: workspace.current.id,
              }
            : null;
    const batch = createCommandBatch({
        key: 'approval',
        input: z.object({
            scope: ApprovalScopeSchema,
            mutation: approvalMutationSchema.refine(
                (value) => value.kind === 'execute' || value.kind === 'decide'
            ),
        }),
        result: ApprovalOperationResultSchema,
        activeScope: () => batchKey(activeScope()),
        scopeOf: (input) => batchKey(input.scope),
        canStart: () => !busy.value && !recoveryError.value && !current(activeScope()),
        send: (input, signal) => source.mutate(input.scope, input.mutation, signal),
        verify: async (input, original, signal) => {
            const id =
                original.kind === 'approval'
                    ? original.receipt.operationId
                    : original.receipt.receipt.operationId;
            const value = await source.operation(input.scope, id, signal);
            if (
                value.kind !== original.kind ||
                value.receipt.requestId !== original.receipt.requestId ||
                value.receipt.lineId !== original.receipt.lineId
            )
                throw new HttpError('批次回执与原操作不一致', 'protocol');
            return value;
        },
        message: approvalErrorMessage,
        isRejection,
    });
    function persist() {
        try {
            sessionStorage.setItem(storageKey(), JSON.stringify(attempts.value));
            recoveryError.value = '';
            return true;
        } catch {
            recoveryError.value = '无法保存审批操作恢复信息，请先核对原申请，勿重复提交';
            return false;
        }
    }
    function connect(value: ApprovalDataSource, userId?: string) {
        source = value;
        batch.connect(userId);
        if (owner === userId) return;
        request?.abort();
        if (storageOwner && (userId === '' || (userId && userId !== storageOwner))) {
            try {
                sessionStorage.removeItem(storageKey());
            } catch {
                /* Clear memory below. */
            }
        }
        owner = userId;
        if (userId !== undefined) storageOwner = userId;
        attempts.value = [];
        busy.value = false;
        error.value = recoveryError.value = '';
        if (!owner) return;
        try {
            const saved = sessionStorage.getItem(storageKey());
            if (saved) attempts.value = z.array(attemptSchema).parse(JSON.parse(saved));
        } catch {
            recoveryError.value = '审批恢复信息无法读取，请先核对申请和库存记录';
        }
    }
    async function send(attempt: Attempt, recovering: boolean) {
        if (
            !owner ||
            busy.value ||
            batch.busy ||
            batch.error ||
            batch.current(batchKey(attempt.scope)) ||
            !persist()
        )
            return;
        const controller = new AbortController();
        request = controller;
        busy.value = true;
        error.value = '';
        try {
            const id =
                attempt.result?.kind === 'approval'
                    ? attempt.result.receipt.operationId
                    : attempt.result?.receipt.receipt.operationId;
            const result = id
                ? await source.operation(attempt.scope, id, controller.signal)
                : await source.mutate(attempt.scope, attempt.mutation, controller.signal);
            if (controller.signal.aborted) return;
            const mutation = attempt.mutation;
            if (
                (mutation.kind === 'execute' && result.kind !== 'inventory') ||
                (mutation.kind !== 'execute' &&
                    (result.kind !== 'approval' ||
                        result.receipt.kind !== `approval.${mutation.kind}`)) ||
                ('requestId' in mutation && result.receipt.requestId !== mutation.requestId) ||
                ('lineId' in mutation && result.receipt.lineId !== mutation.lineId) ||
                (attempt.result && result.receipt.requestId !== attempt.result.receipt.requestId)
            )
                throw new HttpError('审批恢复结果与原请求不一致', 'protocol');
            const saved = { ...attempt, result, responseValidationFailed: false };
            attempts.value = attempts.value.map((item) => (item === attempt ? saved : item));
        } catch (cause) {
            if (controller.signal.aborted) return;
            const rejected = !recovering && isRejection(cause);
            if (rejected) attempts.value = attempts.value.filter((item) => item !== attempt);
            else
                attempts.value = attempts.value.map((item) =>
                    item === attempt
                        ? { ...item, responseValidationFailed: isResponseValidationError(cause) }
                        : item
                );
            error.value = approvalErrorMessage(cause);
        } finally {
            if (!controller.signal.aborted) {
                busy.value = false;
                persist();
            }
        }
    }
    async function execute(scope: ApprovalScope, mutation: ApprovalMutation) {
        if (
            !owner ||
            busy.value ||
            recoveryError.value ||
            batch.busy ||
            batch.error ||
            batch.current(batchKey(scope)) ||
            current(scope) ||
            workspace.current?.id !== scope.workspaceId ||
            workspace.current.organizationId !== scope.organizationId
        )
            return;
        const attempt = attemptSchema.parse({ scope, mutation });
        attempts.value = [...attempts.value, attempt];
        if (persist()) await send(attempt, false);
    }
    async function recover(scope: ApprovalScope) {
        const attempt = current(scope);
        if (attempt) await send(attempt, true);
    }
    function acknowledge(scope: ApprovalScope) {
        const attempt = current(scope);
        if (busy.value || !attempt?.result) return false;
        const previous = attempts.value;
        attempts.value = attempts.value.filter((item) => item !== attempt);
        if (persist()) return true;
        attempts.value = previous;
        return false;
    }
    onScopeDispose(() => request?.abort());
    return {
        attempts,
        busy,
        error,
        recoveryError,
        connect,
        current,
        execute,
        recover,
        acknowledge,
        batch,
        batchKey,
    };
});
