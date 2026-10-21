<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ui/dialog';
import { SelectField } from '@/component/select-field';
import { DataSyncNotice } from '@/component/data-sync';
import { useWorkspaceStore } from '../model/store';

const open = defineModel<boolean>('open', { default: false });
const props = defineProps<{ mode: 'organization' | 'workspace' | 'join'; organizationId?: string }>();
const emit = defineEmits<{ 'close-auto-focus': [event: Event] }>();
const workspace = useWorkspaceStore();
const name = ref('');
const workspaceName = ref('');
const organizationId = ref('');
const error = ref('');
const committed = ref(false);
let generation = 0;
const title = computed(() => ({ organization: '新建组织', workspace: '新建工作区', join: '加入工作区' })[props.mode]);
const options = computed(() =>
    workspace.organizations
        .filter((item) => item.canCreateWorkspace)
        .map((item) => ({ value: item.id, label: item.name }))
);
watch(
    [open, () => props.mode],
    ([value]) => {
        generation++;
        if (!value) return;
        name.value = workspaceName.value = error.value = '';
        committed.value = false;
        organizationId.value =
            options.value.find((item) => item.value === props.organizationId)?.value ??
            options.value.find((item) => item.value === workspace.organization?.id)?.value ??
            options.value[0]?.value ??
            '';
    },
    { flush: 'sync' }
);
watch([name, workspaceName, organizationId], () => {
    error.value = '';
});
watch(
    () => workspace.syncPending,
    (value) => {
        if (!value && committed.value) open.value = false;
    }
);

async function submit() {
    const current = generation;
    const result =
        props.mode === 'organization'
            ? await workspace.createOrganization(name.value, workspaceName.value)
            : props.mode === 'workspace'
              ? await workspace.create(name.value, organizationId.value)
              : await workspace.join(name.value);
    if (current !== generation || !open.value) return;
    error.value = result ?? '';
    if (result === '') {
        committed.value = true;
        if (!workspace.syncPending) open.value = false;
    }
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent @close-auto-focus="emit('close-auto-focus', $event)">
            <DialogTitle>{{ title }}</DialogTitle>
            <DialogDescription class="sr-only">{{ title }}</DialogDescription>
            <form class="space-y-4" @submit.prevent="submit">
                <label v-if="mode === 'workspace'" class="block space-y-2">
                    <span>所属组织</span>
                    <SelectField
                        v-model="organizationId"
                        label="所属组织"
                        class="w-full"
                        :options="options"
                        :disabled="workspace.busy || committed"
                    />
                </label>
                <label class="block space-y-2">
                    <span>
                        {{ mode === 'organization' ? '组织名称' : mode === 'workspace' ? '工作区名称' : '邀请码' }}
                    </span>
                    <Input
                        v-model="name"
                        maxlength="40"
                        required
                        :disabled="workspace.busy || committed"
                        :aria-label="
                            mode === 'organization' ? '组织名称' : mode === 'workspace' ? '工作区名称' : '邀请码'
                        "
                    />
                </label>
                <label v-if="mode === 'organization'" class="block space-y-2">
                    <span>首个工作区名称</span>
                    <Input
                        v-model="workspaceName"
                        maxlength="40"
                        required
                        aria-label="首个工作区名称"
                        :disabled="workspace.busy || committed"
                    />
                </label>
                <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
                <DataSyncNotice
                    scope="工作区"
                    :error="workspace.syncError"
                    :pending="workspace.syncPending"
                    :busy="workspace.busy"
                    @retry="workspace.retrySync()"
                />
                <div class="flex justify-end gap-2">
                    <Button type="button" variant="outline" @click="open = false">
                        {{ committed ? '关闭' : '取消' }}
                    </Button>
                    <Button
                        type="submit"
                        :disabled="
                            workspace.busy ||
                            workspace.switching ||
                            workspace.syncPending ||
                            committed ||
                            (mode === 'workspace' && !organizationId)
                        "
                    >
                        {{ mode === 'join' ? '加入' : '创建' }}
                    </Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
</template>
