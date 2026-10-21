import { onScopeDispose, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { z } from 'zod';
import { InventoryActionSchema, OperationReceiptSchema } from '@talos-ark/contracts/inventory';
import { HttpError, isResponseValidationError } from '@/platform/http';
import type {
    InventoryAction,
    InventoryDataSource,
    InventoryScope,
    InventoryStock,
} from '../data/source';
import { inventoryErrorMessage } from './read';

const attemptSchema = z.object({
    scope: z.object({ organizationId: z.uuid(), workspaceId: z.uuid() }),
    stockItemId: z.uuid(),
    instanceId: z.uuid(),
    code: z.string(),
    command: InventoryActionSchema,
    receipt: OperationReceiptSchema.optional(),
    responseValidationFailed: z.boolean().optional(),
});
type Attempt = z.infer<typeof attemptSchema>;

export const useInventoryActionStore = defineStore('inventory-action', () => {
    const attempts = shallowRef<Attempt[]>([]);
    const busy = ref(false);
    const error = ref('');
    const recoveryError = ref('');
    let source: InventoryDataSource;
    let owner: string | undefined;
    let storageOwner = '';
    let request: AbortController | undefined;
    const storageKey = () => `talos.inventory.action.${storageOwner}`;
    const current = (scope: InventoryScope | null) =>
        scope
            ? attempts.value.find(
                  (item) =>
                      item.scope.organizationId === scope.organizationId &&
                      item.scope.workspaceId === scope.workspaceId
              )
            : undefined;

    function persist() {
        try {
            sessionStorage.setItem(storageKey(), JSON.stringify(attempts.value));
            recoveryError.value = '';
            return true;
        } catch {
            recoveryError.value = '无法保存操作恢复信息。请检查浏览器存储，勿另建请求重复操作。';
            return false;
        }
    }
    function connect(value: InventoryDataSource, userId?: string) {
        source = value;
        if (owner === userId) return;
        request?.abort();
        if (storageOwner && (userId === '' || (userId && userId !== storageOwner))) {
            try {
                sessionStorage.removeItem(storageKey());
            } catch {
                /* Memory is cleared below. */
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
            recoveryError.value = '操作恢复信息无法读取。请先核对库存与流水，勿重复提交。';
        }
    }
    async function execute(scope: InventoryScope, stock: InventoryStock, command: InventoryAction) {
        if (!owner || busy.value || recoveryError.value || current(scope)) return;
        if (
            stock.organizationId !== scope.organizationId ||
            stock.workspaceId !== scope.workspaceId
        )
            return;
        const attempt = attemptSchema.parse({
            scope,
            stockItemId: stock.id,
            instanceId: stock.instanceId,
            code: stock.code,
            command,
        });
        attempts.value = [...attempts.value, attempt];
        if (!persist()) return;
        await send(attempt, false);
    }
    async function recover(scope: InventoryScope) {
        const attempt = current(scope);
        return attempt ? send(attempt, true) : false;
    }
    async function send(attempt: Attempt, recovering: boolean) {
        if (!owner || !source || busy.value || !persist()) return;
        const controller = new AbortController();
        request = controller;
        busy.value = true;
        error.value = '';
        try {
            const receipt = attempt.receipt
                ? await source.operation(
                      attempt.scope.organizationId,
                      attempt.receipt.operationId,
                      controller.signal
                  )
                : await source.act(
                      attempt.scope,
                      attempt.stockItemId,
                      attempt.command,
                      controller.signal
                  );
            if (controller.signal.aborted) return;
            if (
                receipt.kind !== `inventory.${attempt.command.kind}` ||
                receipt.stockItemId !== attempt.stockItemId ||
                receipt.instanceId !== attempt.instanceId
            )
                throw new HttpError('库存动作回执身份不一致', 'protocol');
            attempts.value = attempts.value.map((item) =>
                item === attempt ? { ...item, receipt, responseValidationFailed: false } : item
            );
            return true;
        } catch (cause) {
            if (controller.signal.aborted) return;
            // A recovery rejection does not establish that the original request rolled back.
            const rejected =
                !recovering &&
                cause instanceof HttpError &&
                cause.kind === 'api' &&
                (cause.status ?? 500) >= 400 &&
                (cause.status ?? 500) < 500 &&
                cause.code !== 'INVENTORY_RESULT_UNAVAILABLE';
            if (rejected) attempts.value = attempts.value.filter((item) => item !== attempt);
            else
                attempts.value = attempts.value.map((item) =>
                    item === attempt
                        ? { ...item, responseValidationFailed: isResponseValidationError(cause) }
                        : item
                );
            error.value = inventoryErrorMessage(cause);
            return false;
        } finally {
            if (!controller.signal.aborted) {
                busy.value = false;
                persist();
            }
        }
    }
    function acknowledge(scope: InventoryScope) {
        const attempt = current(scope);
        if (busy.value || !attempt?.receipt) return false;
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
    };
});
