import { onScopeDispose, shallowRef, ref } from 'vue';
import { defineStore } from 'pinia';
import { z } from 'zod';
import { ReceiptSchema, OperationReceiptSchema } from '@talos-ark/contracts/inventory';
import { HttpError, isResponseValidationError } from '@/platform/http';
import { createCommandBatch } from '@/component/batch-operation';
import { useWorkspaceStore } from '@/module/workspace';
import type { InventoryDataSource, InventoryReceipt, InventoryScope } from '../data/source';
import { inventoryErrorMessage } from './read';

const attemptSchema = z.object({
    scope: z.object({ organizationId: z.uuid(), workspaceId: z.uuid() }),
    body: ReceiptSchema,
    uncertain: z.boolean(),
    receipt: OperationReceiptSchema.optional(),
    responseValidationFailed: z.boolean().optional(),
});
type Attempt = z.infer<typeof attemptSchema>;
const isRejection = (cause: unknown) =>
    cause instanceof HttpError &&
    cause.kind === 'api' &&
    (cause.status ?? 500) >= 400 &&
    (cause.status ?? 500) < 500 &&
    cause.code !== 'INVENTORY_RESULT_UNAVAILABLE';
const sameScope = (a: InventoryScope, b: InventoryScope) =>
    a.organizationId === b.organizationId && a.workspaceId === b.workspaceId;

export const useInventoryReceiptStore = defineStore('inventory-receipt', () => {
    const attempts = shallowRef<Attempt[]>([]);
    const busy = ref(false);
    const error = ref('');
    const recoveryError = ref('');
    let source: InventoryDataSource;
    let owner: string | undefined;
    let storageOwner = '';
    let request: AbortController | undefined;
    const storageKey = () => `talos.inventory.receipt.${storageOwner}`;
    const current = (scope: InventoryScope | null) =>
        scope ? attempts.value.find((item) => sameScope(item.scope, scope)) : undefined;
    const workspace = useWorkspaceStore();
    const batchKey = (scope: InventoryScope | null) =>
        scope ? `${scope.organizationId}/${scope.workspaceId}` : '';
    const activeScope = () =>
        workspace.current
            ? {
                  organizationId: workspace.current.organizationId,
                  workspaceId: workspace.current.id,
              }
            : null;
    const batch = createCommandBatch({
        key: 'receipt',
        input: z.object({ scope: attemptSchema.shape.scope, body: ReceiptSchema }),
        result: OperationReceiptSchema,
        activeScope: () => batchKey(activeScope()),
        scopeOf: (input) => batchKey(input.scope),
        canStart: () => !busy.value && !recoveryError.value && !current(activeScope()),
        send: (input, signal) => source.receive(input.scope, input.body, signal),
        verify: async (input, original, signal) => {
            const value = await source.operation(
                input.scope.organizationId,
                original.operationId,
                signal
            );
            if (
                value.kind !== 'inventory.receive' ||
                value.stockItemId !== original.stockItemId ||
                value.instanceId !== original.instanceId
            )
                throw new HttpError('批次回执与原入库不一致', 'protocol');
            return value;
        },
        message: inventoryErrorMessage,
        isRejection,
    });

    function persist() {
        try {
            sessionStorage.setItem(storageKey(), JSON.stringify(attempts.value));
            recoveryError.value = '';
            return true;
        } catch {
            recoveryError.value = '无法保存入库恢复信息，请检查浏览器存储后重试。';
            return false;
        }
    }
    function connect(value: InventoryDataSource, userId?: string) {
        source = value;
        batch.connect(userId);
        if (owner === userId) return;
        request?.abort();
        if (storageOwner && (userId === '' || (userId && userId !== storageOwner))) {
            try {
                sessionStorage.removeItem(storageKey());
            } catch {
                /* Logout must still clear in-memory state. */
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
            if (saved)
                attempts.value = z
                    .array(attemptSchema)
                    .parse(JSON.parse(saved))
                    .map((item) => ({ ...item, uncertain: true }));
        } catch {
            recoveryError.value = '入库恢复信息无法读取，请先核对原登记结果，勿重复登记。';
        }
    }
    function begin(scope: InventoryScope, body: InventoryReceipt) {
        if (
            !owner ||
            busy.value ||
            batch.busy ||
            batch.error ||
            batch.current(batchKey(scope)) ||
            recoveryError.value ||
            current(scope)
        )
            return false;
        attempts.value = [...attempts.value, { scope: { ...scope }, body, uncertain: false }];
        return persist();
    }
    async function send(scope: InventoryScope) {
        const attempt = current(scope);
        if (
            !owner ||
            !source ||
            !attempt ||
            attempt.receipt ||
            busy.value ||
            batch.busy ||
            batch.error ||
            batch.current(batchKey(scope)) ||
            !persist()
        )
            return;
        const controller = new AbortController();
        request = controller;
        busy.value = true;
        error.value = '';
        try {
            const receipt = await source.receive(attempt.scope, attempt.body, controller.signal);
            if (controller.signal.aborted) return;
            attempts.value = attempts.value.map((item) =>
                item === attempt ? { ...item, receipt, responseValidationFailed: false } : item
            );
        } catch (cause) {
            if (controller.signal.aborted) return;
            const rejected = !attempt.uncertain && isRejection(cause);
            attempts.value = rejected
                ? attempts.value.filter((item) => item !== attempt)
                : attempts.value.map((item) =>
                      item === attempt
                          ? {
                                ...item,
                                uncertain: true,
                                responseValidationFailed: isResponseValidationError(cause),
                            }
                          : item
                  );
            error.value = inventoryErrorMessage(cause);
            return cause;
        } finally {
            if (!controller.signal.aborted) {
                busy.value = false;
                persist();
            }
        }
    }
    function acknowledge(scope: InventoryScope) {
        if (!current(scope)?.receipt) return;
        const previous = attempts.value;
        attempts.value = attempts.value.filter((item) => !sameScope(item.scope, scope));
        if (!persist()) {
            attempts.value = previous;
            return false;
        }
        return true;
    }
    onScopeDispose(() => request?.abort());
    return {
        attempts,
        busy,
        error,
        recoveryError,
        current,
        connect,
        begin,
        send,
        acknowledge,
        batch,
        batchKey,
    };
});
