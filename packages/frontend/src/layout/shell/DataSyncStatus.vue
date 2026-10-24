<script setup lang="ts">
import { useAccountStore } from '@/module/account';
import { useWorkspaceStore } from '@/module/workspace';
import { useWorkbenchStore } from '@/module/workbench';
import { DataSyncNotice } from '@/component/data-sync';

const owners = [
    { scope: '账户资料', store: useAccountStore() },
    { scope: '工作区', store: useWorkspaceStore() },
    { scope: '工作台', store: useWorkbenchStore() },
];
</script>

<template>
    <div v-if="owners.some(({ store }) => store.syncError)" class="shrink-0 space-y-2 px-4 py-3 lg:px-6">
        <DataSyncNotice
            v-for="owner in owners"
            :key="owner.scope"
            :scope="owner.scope"
            :error="owner.store.syncError"
            :busy="owner.store.busy"
            @retry="owner.store.retrySync()"
        />
    </div>
</template>
