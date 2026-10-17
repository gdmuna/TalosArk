<script setup lang="ts">
import { ref } from 'vue';
import ManagementPage from './component/ManagementPage.vue';
import { TeamManagement } from '@/module/workspace/ui';
import PrototypeLink from './detail/PrototypeLink.vue';
const context = ref('');
</script>

<template>
    <ManagementPage title="成员" layout="table" :context="context">
        <template #actions><PrototypeLink kind="member" /></template>
        <TeamManagement view="members" @scope-label="context = $event" />
    </ManagementPage>
</template>
