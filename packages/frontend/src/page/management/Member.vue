<script setup lang="ts">
import ManagementPage from './component/ManagementPage.vue';
import { TeamManagement } from '@/module/workspace/ui';
</script>

<template>
    <ManagementPage title="成员" layout="table"><TeamManagement view="members" /></ManagementPage>
</template>
