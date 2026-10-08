import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { AccountDataSource } from '../data/source';
import type { AccountProfile } from './account';

export const useAccountStore = defineStore('account-profile', () => {
    const profile = ref<AccountProfile | null>(null);
    const busy = ref(false);
    const error = ref('');
    let source: AccountDataSource;

    async function initialize(dataSource: AccountDataSource) {
        source = dataSource;
        profile.value = await source.load();
    }
    async function updateDisplayName(name: string) {
        if (busy.value) return '账户资料正在更新';
        busy.value = true;
        error.value = '';
        try {
            await source.updateDisplayName(name);
            profile.value = await source.load();
        } catch (cause) {
            error.value = cause instanceof Error ? cause.message : '更新资料失败';
        } finally {
            busy.value = false;
        }
        return error.value;
    }
    return { profile, busy, error, initialize, updateDisplayName };
});
