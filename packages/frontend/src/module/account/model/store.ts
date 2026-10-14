import { onScopeDispose, ref } from 'vue';
import { defineStore } from 'pinia';
import { createTaskScope, waitFor } from '@/platform/task';
import type { AccountDataSource } from '../data/source';
import type { AccountProfile } from './account';

export const useAccountStore = defineStore('account-profile', () => {
    const profile = ref<AccountProfile | null>(null);
    const busy = ref(false);
    const error = ref('');
    const syncError = ref('');
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
    }
    async function load(signal?: AbortSignal) {
        const task = createTaskScope([sourceScope.signal, signal]);
        try {
            task.signal.throwIfAborted();
            const snapshot = await waitFor(source.load(task.signal), task.signal);
            task.signal.throwIfAborted();
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
        if (syncError.value) return '请先重新同步账户资料';
        busy.value = true;
        error.value = '';
        const scope = sourceScope;
        try {
            await source.updateDisplayName(name);
            scope.signal.throwIfAborted();
            await synchronize();
        } catch (cause) {
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
        } catch (cause) {
            if (!scope.signal.aborted)
                syncError.value = cause instanceof Error ? cause.message : '账户资料同步失败';
        }
    }
    async function retrySync() {
        if (busy.value || !syncError.value) return;
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
        canUpdateDisplayName,
        reset,
        connect,
        load,
        initialize,
        updateDisplayName,
        retrySync,
    };
});
