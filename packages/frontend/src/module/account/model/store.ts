import { onScopeDispose, ref } from 'vue';
import { defineStore } from 'pinia';
import { createTaskScope, waitFor } from '@/platform/task';
import { HttpError, isResponseValidationError } from '@/platform/http';
import type { AccountDataSource } from '../data/source';
import type { AccountProfile } from './account';

export const useAccountStore = defineStore('account-profile', () => {
    const profile = ref<AccountProfile | null>(null);
    const busy = ref(false);
    const error = ref('');
    const syncError = ref('');
    const syncPending = ref(false);
    const canUpdateDisplayName = ref(false);
    let source: AccountDataSource;
    let sourceScope = createTaskScope([]);
    onScopeDispose(() => sourceScope.dispose());

    function connect(dataSource: AccountDataSource) {
        sourceScope.dispose();
        sourceScope = createTaskScope([]);
        source = dataSource;
        canUpdateDisplayName.value = !!dataSource.updateDisplayName;
    }
    function reset() {
        sourceScope.dispose();
        sourceScope = createTaskScope([]);
        profile.value = null;
        busy.value = false;
        error.value = syncError.value = '';
        syncPending.value = false;
    }
    async function load(signal?: AbortSignal, expectedUserId?: string) {
        const task = createTaskScope([sourceScope.signal, signal]);
        try {
            task.signal.throwIfAborted();
            const snapshot = await waitFor(source.load(task.signal), task.signal);
            task.signal.throwIfAborted();
            if (expectedUserId && snapshot.id !== expectedUserId)
                throw new HttpError('账户资料与当前登录会话不一致', 'protocol');
            profile.value = snapshot;
        } finally {
            task.dispose();
        }
    }
    async function initialize(dataSource: AccountDataSource) {
        connect(dataSource);
        await load();
    }
    async function updateDisplayName(name: string) {
        if (!source.updateDisplayName) return '当前账户资料为只读。';
        if (busy.value) return '账户资料正在更新';
        if (syncPending.value) return syncError.value || null;
        busy.value = true;
        error.value = '';
        const scope = sourceScope;
        try {
            await source.updateDisplayName(name);
            scope.signal.throwIfAborted();
            syncPending.value = true;
            if (!(await synchronize())) return syncError.value || null;
        } catch (cause) {
            if (isResponseValidationError(cause)) return null;
            if (!scope.signal.aborted)
                error.value = cause instanceof Error ? cause.message : '更新资料失败';
        } finally {
            if (scope === sourceScope) busy.value = false;
        }
        return error.value;
    }
    async function synchronize() {
        const scope = sourceScope;
        try {
            const snapshot = await source.load(scope.signal);
            scope.signal.throwIfAborted();
            profile.value = snapshot;
            syncError.value = '';
            syncPending.value = false;
            return true;
        } catch (cause) {
            if (!scope.signal.aborted)
                syncError.value = isResponseValidationError(cause)
                    ? ''
                    : cause instanceof Error
                      ? cause.message
                      : '账户资料同步失败';
            return false;
        }
    }
    async function retrySync() {
        if (busy.value || !syncPending.value) return;
        busy.value = true;
        const scope = sourceScope;
        try {
            await synchronize();
        } finally {
            if (scope === sourceScope) busy.value = false;
        }
    }
    return {
        profile,
        busy,
        error,
        syncError,
        syncPending,
        canUpdateDisplayName,
        reset,
        connect,
        load,
        initialize,
        updateDisplayName,
        retrySync,
    };
});
