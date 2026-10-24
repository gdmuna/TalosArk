<script setup lang="ts">
import { UsersRound } from '@lucide/vue';
import { Button } from '@/ui/button';
import { computed, ref } from 'vue';
import { useWorkspaceStore } from '@/module/workspace';
import { WorkspaceCreateDialog } from '@/module/workspace/ui';
const workspace = useWorkspaceStore();
const createOpen = ref(false);
const mode = ref<'organization' | 'workspace'>('organization');
const hasOrganization = computed(() => workspace.organizations.length > 0);
const creatableOrganization = computed(() => workspace.organizations.find((item) => item.canCreateWorkspace));
function create(value: 'organization' | 'workspace') {
    mode.value = value;
    createOpen.value = true;
}
</script>

<template>
    <div
        data-slot="workspace-unavailable"
        class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
    >
        <UsersRound class="size-8 text-muted-foreground" aria-hidden="true" />
        <h1 class="text-lg font-medium">{{ hasOrganization ? '暂无可用工作区' : '尚未加入组织' }}</h1>
        <p class="max-w-sm text-sm leading-6 text-muted-foreground">
            {{
                hasOrganization
                    ? '当前账户没有可进入的工作区。可联系组织管理员分配工作区，或查看组织中的工作区。'
                    : '可通过邮件中的邀请链接加入组织，或新建组织和初始工作区。'
            }}
        </p>
        <div class="flex flex-wrap items-center justify-center gap-2">
            <Button v-if="creatableOrganization" @click="create('workspace')">新建工作区</Button>
            <Button v-else-if="workspace.canCreateOrganization" @click="create('organization')">新建组织</Button>
            <Button v-if="hasOrganization" as-child variant="outline">
                <RouterLink to="/main/management/workspace">查看工作区</RouterLink>
            </Button>
            <Button as-child variant="outline">
                <RouterLink to="/main/management/account-setting">账户设置</RouterLink>
            </Button>
        </div>
    </div>
    <WorkspaceCreateDialog v-model:open="createOpen" :mode="mode" :organization-id="creatableOrganization?.id" />
</template>
