<script setup lang="ts">
import ManagementPage from './component/ManagementPage.vue';
import { TeamManagement } from '@/module/workspace/ui';
</script>

<template>
    <ManagementPage title="角色与权限" layout="table"><TeamManagement view="roles" /></ManagementPage>
</template>
