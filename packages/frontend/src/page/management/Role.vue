<script setup lang="ts">
import { ref } from 'vue';
import ManagementPage from './component/ManagementPage.vue';
import { TeamManagement } from '@/module/workspace/ui';
const context = ref('');
</script>

<template>
    <ManagementPage title="角色与权限" layout="table" :context="context">
        <TeamManagement view="roles" @scope-label="context = $event" />
    </ManagementPage>
</template>
