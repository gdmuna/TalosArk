<script setup lang="ts">
import { UsersRound } from '@lucide/vue';
import { Button } from '@/ui/button';
import { ref } from 'vue';
import { useWorkspaceStore } from '@/module/workspace';
import { WorkspaceCreateDialog } from '@/module/workspace/ui';
const workspace = useWorkspaceStore();
const createOpen = ref(false);
</script>

<template>
    <div
        data-slot="workspace-unavailable"
        class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
    >
        <UsersRound class="size-8 text-muted-foreground" aria-hidden="true" />
        <h1 class="text-lg font-medium">暂无可用工作区</h1>
        <Button v-if="workspace.canCreateOrganization" @click="createOpen = true">新建组织</Button>
        <Button as-child variant="outline">
            <RouterLink to="/main/management/account-setting">账户设置</RouterLink>
        </Button>
    </div>
    <WorkspaceCreateDialog v-model:open="createOpen" mode="organization" />
</template>
