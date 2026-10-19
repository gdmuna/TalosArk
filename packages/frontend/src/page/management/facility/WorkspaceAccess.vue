<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useWorkspaceStore } from '@/module/workspace';
import { useFacilityDataSource, useFacilityRead, type FacilityDetail, type FacilityScope } from '@/module/facility';
import { Button } from '@/ui/button';
import { SelectField } from '@/component/select-field';
import { DataSyncNotice } from '@/component/data-sync';
import ReadFeedback from './ReadFeedback.vue';
const props = defineProps<{ facility: FacilityDetail; scope: FacilityScope; contextKey: string }>();
const emit = defineEmits<{ changed: [] }>();
const source = useFacilityDataSource(),
    workspace = useWorkspaceStore();
const key = computed(() => (source && props.contextKey ? JSON.stringify([props.contextKey, props.facility.id]) : ''));
const { data, loading, busy, error, conflict, syncError, refresh, write } = useFacilityRead(
    key,
    (signal) => source?.detail(props.scope, props.facility.id, signal) ?? Promise.resolve(undefined)
);
const workspaceId = ref(''),
    level = ref('USE');
const options = computed(() =>
    workspace.workspaces
        .filter(
            (item) =>
                item.organizationId === props.scope.organizationId && item.id !== data.value?.managementWorkspaceId
        )
        .map((item) => ({ value: item.id, label: item.name }))
);
const disabled = computed(
    () =>
        busy.value ||
        loading.value ||
        conflict.value ||
        !!syncError.value ||
        !data.value?.capabilities.govern ||
        !!data.value?.archivedAt
);
watch(
    key,
    () => {
        workspaceId.value = '';
        level.value = 'USE';
    },
    { flush: 'sync' }
);
async function save(id: string, next: 'USE' | 'MANAGE' | null) {
    if (!source || !data.value || disabled.value) return;
    const scope = props.scope,
        facility = data.value;
    if (
        await write((signal) =>
            source.access(
                scope,
                facility.id,
                { expectedRevision: facility.revision, workspaceId: id, level: next },
                signal
            )
        )
    )
        emit('changed');
}
</script>
<template>
    <div class="space-y-5">
        <p class="text-sm text-muted-foreground">设施归组织所有。共享整处设施不授予内部材料或库存内容的访问权限。</p>
        <ReadFeedback :error="error" :loading="loading" :stale="!!data" @retry="refresh" />
        <DataSyncNotice scope="设施共享" :error="syncError" :busy="busy || loading" @retry="refresh" />
        <p v-if="data" class="text-sm">
            管理工作区：{{
                workspace.workspaces.find((item) => item.id === data?.managementWorkspaceId)?.name ??
                data.managementWorkspaceId
            }}
        </p>
        <p v-if="data?.workspaceAccess === null" class="text-sm text-muted-foreground">
            当前上下文无权查看完整共享关系。
        </p>
        <ul v-else class="divide-y border-y">
            <li
                v-for="item in data?.workspaceAccess ?? []"
                :key="item.workspaceId"
                class="flex flex-wrap items-center justify-between gap-3 py-3"
            >
                <span class="min-w-0 break-words font-medium">{{ item.name }}</span>
                <div class="flex items-center gap-2">
                    <span class="text-sm text-muted-foreground">{{ item.level === 'MANAGE' ? '管理' : '使用' }}</span>
                    <Button
                        v-if="data?.capabilities.govern"
                        variant="outline"
                        size="sm"
                        :disabled="disabled"
                        @click="save(item.workspaceId, item.level === 'MANAGE' ? 'USE' : 'MANAGE')"
                    >
                        改为{{ item.level === 'MANAGE' ? '使用' : '管理' }}
                    </Button>
                    <Button
                        v-if="data?.capabilities.govern"
                        variant="outline"
                        size="sm"
                        :disabled="disabled"
                        @click="save(item.workspaceId, null)"
                    >
                        撤销
                    </Button>
                </div>
            </li>
        </ul>
        <form
            v-if="data?.capabilities.govern"
            class="flex flex-wrap items-end gap-3"
            @submit.prevent="save(workspaceId, level === 'MANAGE' ? 'MANAGE' : 'USE')"
        >
            <SelectField
                v-model="workspaceId"
                label="共享工作区"
                :options="options"
                :disabled="disabled"
                class="w-64 max-w-full"
            />
            <SelectField
                v-model="level"
                label="关系"
                :options="[
                    { value: 'USE', label: '使用' },
                    { value: 'MANAGE', label: '管理' },
                ]"
                :disabled="disabled"
                class="w-36"
            />
            <Button :disabled="disabled || !workspaceId">保存共享关系</Button>
        </form>
    </div>
</template>
