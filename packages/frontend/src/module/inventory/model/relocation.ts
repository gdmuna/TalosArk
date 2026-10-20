import { onScopeDispose, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { z } from 'zod';
import { OperationReceiptSchema, RelocationExecuteSchema } from '@talos-ark/contracts/inventory';
import { HttpError } from '@/platform/http';
import type { InventoryDataSource, InventoryRelocationExecute } from '../data/source';
import { inventoryErrorMessage } from './read';

const attemptSchema = z.object({
    organizationId: z.uuid(),
    body: RelocationExecuteSchema,
    receipt: OperationReceiptSchema.optional(),
});
type Attempt = z.infer<typeof attemptSchema>;

export function relocationErrorMessage(cause: unknown) {
    const messages: Record<string, string> = {
        FACILITY_INVALID_INPUT: '目标不能位于自身子树内；请检查父容器和成对的网格坐标。',
        FACILITY_CODE_CONFLICT: '目标编号或坐标已被占用，请调整后重新预览。',
        FACILITY_INVALID_STATE: '设施或容器的当前状态不允许搬迁，请重新选择目标。',
        INVENTORY_LIMIT_EXCEEDED: '搬迁规模超过本次操作上限，请缩小范围。',
        INVENTORY_RESULT_UNAVAILABLE:
            '原搬迁回执暂不可用，请核对结构和流水，不要另建请求重复搬迁。',
    };
    return (
        (cause instanceof HttpError && messages[cause.code ?? '']) || inventoryErrorMessage(cause)
    );
}

export const useInventoryRelocationStore = defineStore('inventory-relocation', () => {
    const attempts = shallowRef<Attempt[]>([]);
    const busy = ref(false);
    const error = ref('');
    const recoveryError = ref('');
    let source: InventoryDataSource;
    let owner: string | undefined;
    let storageOwner = '';
    let request: AbortController | undefined;
    const storageKey = () => `talos.inventory.relocation.${storageOwner}`;
    const current = (organizationId: string) =>
        attempts.value.find((item) => item.organizationId === organizationId);

    function persist() {
        try {
            sessionStorage.setItem(storageKey(), JSON.stringify(attempts.value));
            recoveryError.value = '';
            return true;
        } catch {
            recoveryError.value = '无法保存搬迁恢复信息，请检查浏览器存储。请勿另建请求重复搬迁。';
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
                /* Clear memory even if storage is unavailable. */
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
            recoveryError.value = '搬迁恢复信息无法读取，请先核对原搬迁结果，勿重复提交。';
        }
    }
    async function execute(organizationId: string, body: InventoryRelocationExecute) {
        if (!owner || busy.value || recoveryError.value || current(organizationId)) return;
        const attempt = attemptSchema.parse({ organizationId, body });
        attempts.value = [...attempts.value, attempt];
        if (!persist()) return;
        await send(attempt, false);
    }
    async function recover(organizationId: string) {
        const attempt = current(organizationId);
        if (attempt) await send(attempt, true);
    }
    async function send(attempt: Attempt, recovering: boolean) {
        if (!owner || !source || busy.value || !persist()) return;
        const controller = new AbortController();
        request = controller;
        busy.value = true;
        error.value = '';
        try {
            // A known receipt needs only a current-authorized read, never another write.
            const receipt = attempt.receipt
                ? await source.operation(
                      attempt.organizationId,
                      attempt.receipt.operationId,
                      controller.signal
                  )
                : await source.relocate(attempt.organizationId, attempt.body, controller.signal);
            if (controller.signal.aborted) return;
            if (
                receipt.kind !== 'inventory.relocate' ||
                (receipt.nodeId !== null && receipt.nodeId !== attempt.body.nodeId)
            )
                throw new HttpError('搬迁回执身份不一致', 'protocol');
            attempts.value = attempts.value.map((item) =>
                item === attempt ? { ...item, receipt } : item
            );
        } catch (cause) {
            if (controller.signal.aborted) return;
            // A rejected recovery cannot prove whether the original request committed.
            const rejected =
                !recovering &&
                cause instanceof HttpError &&
                cause.kind === 'api' &&
                (cause.status ?? 500) >= 400 &&
                (cause.status ?? 500) < 500 &&
                cause.code !== 'INVENTORY_RESULT_UNAVAILABLE';
            if (rejected) attempts.value = attempts.value.filter((item) => item !== attempt);
            error.value =
                cause instanceof HttpError && cause.status === 409 && rejected
                    ? '搬迁预览已失效或目标已改变。请重新预览并确认。'
                    : relocationErrorMessage(cause);
            return cause;
        } finally {
            if (!controller.signal.aborted) {
                busy.value = false;
                persist();
            }
        }
    }
    function acknowledge(organizationId: string) {
        if (busy.value || !current(organizationId)?.receipt) return false;
        const previous = attempts.value;
        attempts.value = attempts.value.filter((item) => item.organizationId !== organizationId);
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
