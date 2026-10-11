import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { AccountDataSource } from '../data/source';
import type { AccountProfile } from './account';

export const useAccountStore = defineStore('account-profile', () => {
    const profile = ref<AccountProfile | null>(null);
    const busy = ref(false);
    const error = ref('');
    const syncError = ref('');
    let source: AccountDataSource;

    async function initialize(dataSource: AccountDataSource) {
        source = dataSource;
        profile.value = await source.load();
    }
    async function updateDisplayName(name: string) {
        if (busy.value) return '账户资料正在更新';
        if (syncError.value) return '请先重新同步账户资料';
        busy.value = true;
        error.value = '';
        try {
            await source.updateDisplayName(name);
            await synchronize();
        } catch (cause) {
            error.value = cause instanceof Error ? cause.message : '更新资料失败';
        } finally {
            busy.value = false;
        }
        return error.value;
    }
    async function synchronize() {
        try {
            profile.value = await source.load();
            syncError.value = '';
        } catch (cause) {
            syncError.value = cause instanceof Error ? cause.message : '账户资料同步失败';
        }
    }
    async function retrySync() {
        if (busy.value || !syncError.value) return;
        busy.value = true;
        try {
            await synchronize();
        } finally {
            busy.value = false;
        }
    }
    return { profile, busy, error, syncError, initialize, updateDisplayName, retrySync };
});
