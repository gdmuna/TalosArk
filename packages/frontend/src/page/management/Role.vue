<script setup lang="ts">
import { ref } from 'vue';
import ManagementPage from './component/ManagementPage.vue';
import { TeamManagement } from '@/module/workspace/ui';
import { useTeamListQuery } from './team-query';
const context = ref('');
const { state, update } = useTeamListQuery('roles');
</script>

<template>
    <ManagementPage title="角色与权限" layout="tool" :context="context">
        <TeamManagement view="roles" :list-state="state" @update:list-state="update" @scope-label="context = $event" />
    </ManagementPage>
</template>
