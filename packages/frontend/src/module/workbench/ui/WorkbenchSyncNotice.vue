<script setup lang="ts">
import { DataSyncNotice } from '@/component/data-sync';
import { useWorkbenchStore } from '../model/store';

const workbench = useWorkbenchStore();
</script>

<template>
    <DataSyncNotice scope="工作台" :error="workbench.syncError" :busy="workbench.busy" @retry="workbench.retrySync()" />
</template>
