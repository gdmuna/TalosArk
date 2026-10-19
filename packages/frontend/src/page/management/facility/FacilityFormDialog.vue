<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FacilityWriteSchema } from '@talos-ark/contracts/facility';
import { useAccountStore } from '@/module/account';
import { useWorkspaceStore } from '@/module/workspace';
import { useFacilityDataSource, useFacilityRead, type FacilityScope, type FacilitySummary } from '@/module/facility';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ui/dialog';
import { SelectField } from '@/component/select-field';
import { DataSyncNotice } from '@/component/data-sync';
import ReadFeedback from './ReadFeedback.vue';

const open = defineModel<boolean>('open', { default: false });
const props = defineProps<{ scope: FacilityScope; facility?: FacilitySummary | null }>();
const emit = defineEmits<{ saved: [id: string] }>();
const source = useFacilityDataSource(),
    account = useAccountStore(),
    workspace = useWorkspaceStore();
const code = ref(''),
    name = ref(''),
    location = ref(''),
    description = ref(''),
    managementWorkspaceId = ref('');
const validation = ref(''),
    committedId = ref('');
const key = computed(() =>
    open.value && source && account.profile?.id
        ? JSON.stringify([account.profile.id, props.scope.organizationId, props.facility?.id])
        : ''
);
const { data, loading, busy, conflict, error, syncError, refresh, write } = useFacilityRead(key, async (signal) => {
    if (!source) return;
    const governance = await source.governance(props.scope, signal);
    const detail = props.facility ? await source.detail(props.scope, props.facility.id, signal) : null;
    return { governance, detail };
});
const allowed = computed(() =>
    props.facility
        ? !!data.value?.detail?.capabilities.govern && !data.value.detail.archivedAt
        : !!data.value?.governance.canCreate && !!data.value.governance.canGovern
);
const disabled = computed(
    () => busy.value || loading.value || conflict.value || !!syncError.value || !!committedId.value || !allowed.value
);
const options = computed(() => {
    const items = workspace.workspaces
        .filter((item) => item.organizationId === props.scope.organizationId)
        .map((item) => ({ value: item.id, label: item.name }));
    if (managementWorkspaceId.value && !items.some((item) => item.value === managementWorkspaceId.value))
        items.push({ value: managementWorkspaceId.value, label: managementWorkspaceId.value });
    return items;
});
watch(
    key,
    () => {
        code.value = props.facility?.code ?? '';
        name.value = props.facility?.name ?? '';
        location.value = props.facility?.location ?? '';
        description.value = props.facility?.description ?? '';
        managementWorkspaceId.value = props.facility?.managementWorkspaceId ?? options.value[0]?.value ?? '';
        validation.value = committedId.value = '';
    },
    { immediate: true, flush: 'sync' }
);
watch(syncError, (value) => {
    if (!value && committedId.value) {
        emit('saved', committedId.value);
        open.value = false;
    }
});
async function submit() {
    if (!source || disabled.value) return;
    const parsed = FacilityWriteSchema.safeParse({
        code: code.value,
        name: name.value,
        location: location.value.trim() || null,
        description: description.value.trim() || null,
        managementWorkspaceId: managementWorkspaceId.value,
    });
    validation.value = parsed.success ? '' : '请填写有效的编号、名称和同组织管理工作区，并检查字段长度。';
    if (!parsed.success) return;
    const scope = props.scope,
        detail = data.value?.detail;
    let savedId = '';
    const saved = await write(async (signal) => {
        const result = detail
            ? await source.update(scope, detail.id, { ...parsed.data, expectedRevision: detail.revision }, signal)
            : await source.create(scope, parsed.data, signal);
        savedId = result.id;
    });
    if (!saved) return;
    committedId.value = savedId;
    if (!syncError.value) {
        emit('saved', savedId);
        open.value = false;
    }
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="max-h-[85vh] overflow-y-auto">
            <DialogTitle>{{ facility ? '编辑设施' : '登记设施' }}</DialogTitle>
            <DialogDescription>设施归组织所有；管理工作区负责结构维护。</DialogDescription>
            <ReadFeedback :error="error" :loading="loading" @retry="refresh" />
            <DataSyncNotice scope="设施" :error="syncError" :busy="busy || loading" @retry="refresh" />
            <form v-if="data" class="space-y-4" @submit.prevent="submit">
                <label class="block space-y-2">
                    <span>设施编号</span>
                    <Input v-model="code" required maxlength="160" :disabled="disabled" />
                </label>
                <label class="block space-y-2">
                    <span>设施名称</span>
                    <Input v-model="name" required maxlength="160" :disabled="disabled" />
                </label>
                <SelectField
                    v-model="managementWorkspaceId"
                    label="管理工作区"
                    :options="options"
                    :disabled="disabled"
                    class="w-full"
                />
                <label class="block space-y-2">
                    <span>位置说明</span>
                    <Input v-model="location" maxlength="500" :disabled="disabled" />
                </label>
                <label class="block space-y-2">
                    <span>描述</span>
                    <Textarea v-model="description" maxlength="2000" :disabled="disabled" />
                </label>
                <p v-if="validation" role="alert" class="text-sm text-destructive">{{ validation }}</p>
                <div class="flex justify-end gap-2">
                    <Button type="button" variant="outline" :disabled="busy" @click="open = false">关闭</Button>
                    <Button type="submit" :disabled="disabled">{{ busy ? '保存中' : '保存' }}</Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
</template>
