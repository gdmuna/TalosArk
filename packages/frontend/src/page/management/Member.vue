<script setup lang="ts">
import { ref } from 'vue';
import ManagementPage from './component/ManagementPage.vue';
import { TeamManagement } from '@/module/workspace/ui';
import { useTeamListQuery } from './team-query';
const context = ref('');
const { state, update } = useTeamListQuery('members');
</script>

<template>
    <ManagementPage title="成员" layout="table" :context="context">
        <TeamManagement
            view="members"
            :list-state="state"
            @update:list-state="update"
            @scope-label="context = $event"
        />
    </ManagementPage>
</template>
