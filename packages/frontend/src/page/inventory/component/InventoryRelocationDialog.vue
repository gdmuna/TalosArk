<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { ArrowRight, AlertTriangle } from '@lucide/vue';
import { RelocationSchema, RelocationExecuteSchema } from '@talos-ark/contracts/inventory';
import { useFacilityDataSource, useFacilityRead, type StorageScope, type StorageNodeDetail } from '@/module/facility';
import { FacilityPicker, NodePicker, FacilityReadFeedback } from '@/module/facility/ui';
import { useWorkspaceStore } from '@/module/workspace';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/ui/dialog';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { Checkbox } from '@/ui/checkbox';
import { ScrollSurface } from '@/component/scroll-surface';
import { DataSyncNotice } from '@/component/data-sync';
import { useInventoryDataSource, useInventoryRelocationStore, relocationErrorMessage } from '@/module/inventory';
import type { InventoryRelocation, InventoryRelocationPreview } from '@/module/inventory';

const props = defineProps<{ scope: StorageScope; contextKey: string; node?: StorageNodeDetail }>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ committed: [facilityId: string, nodeId: string] }>();
const source = useInventoryDataSource();
const facilities = useFacilityDataSource();
const workspace = useWorkspaceStore();
const store = useInventoryRelocationStore();
const targetId = ref('');
const parentId = ref<string | null>(null);
const code = ref('');
const row = ref<string | number>(''),
    column = ref<string | number>('');
const reason = ref('');
const confirmed = ref(false);
const loading = ref(false),
    syncing = ref(false);
const error = ref(''),
    syncError = ref('');
const preview = shallowRef<{ input: InventoryRelocation; impact: InventoryRelocationPreview }>();
let lifetime = new AbortController();
let previewRequest: AbortController | undefined;
const attempt = computed(() => store.current(props.scope.organizationId));
const locked = computed(() => store.busy || syncing.value || !!attempt.value);
const dialogOpen = computed({
    get: () => open.value,
    set: (value) => {
        if (!store.busy && !syncing.value) open.value = value;
    },
});
const targetKey = computed(() =>
    open.value && !attempt.value && targetId.value
        ? JSON.stringify([props.contextKey, props.scope, targetId.value])
        : ''
);
const target = useFacilityRead(
    targetKey,
    (signal) =>
        facilities?.detail(
            { organizationId: props.scope.organizationId, workspaceId: props.scope.workspaceId },
            targetId.value,
            signal
        ) ?? Promise.resolve(undefined)
);
const targetScope = computed<StorageScope>(() => ({
    organizationId: props.scope.organizationId,
    workspaceId: props.scope.workspaceId,
    facilityId: targetId.value,
    topologyId: target.data.value?.topology?.id ?? '',
}));
const canPreview = computed(
    () =>
        !!source &&
        !!facilities &&
        !!props.node &&
        !!targetScope.value.topologyId &&
        !!target.data.value?.capabilities.manage &&
        !target.data.value.archivedAt &&
        !target.data.value.disabledAt &&
        !target.loading.value &&
        !target.error.value &&
        !locked.value &&
        !loading.value &&
        !store.recoveryError
);
const workspaceName = (id: string) => workspace.workspaces.find((item) => item.id === id)?.name ?? id;

function invalidatePreview() {
    previewRequest?.abort();
    preview.value = undefined;
    confirmed.value = false;
    loading.value = false;
}
watch([targetId, parentId, code, row, column], invalidatePreview, { flush: 'sync' });
watch(
    targetId,
    () => {
        parentId.value = null;
        row.value = column.value = '';
    },
    { flush: 'sync' }
);
watch(
    () => props.contextKey,
    () => {
        open.value = false;
    },
    { flush: 'sync' }
);
watch(
    open,
    () => {
        lifetime.abort();
        lifetime = new AbortController();
        invalidatePreview();
        error.value = syncError.value = '';
        syncing.value = false;
        if (!open.value) return;
        targetId.value = props.scope.facilityId;
        parentId.value = props.node?.parentId ?? null;
        code.value = props.node?.code ?? '';
        row.value = props.node?.rowIndex ?? '';
        column.value = props.node?.columnIndex ?? '';
        reason.value = '';
    },
    { flush: 'sync' }
);
onScopeDispose(() => {
    lifetime.abort();
    previewRequest?.abort();
});

async function inspect() {
    if (!canPreview.value || !source || !props.node) return;
    invalidatePreview();
    error.value = '';
    store.error = '';
    const input = RelocationSchema.safeParse({
        sourceFacilityId: props.scope.facilityId,
        sourceTopologyId: props.scope.topologyId,
        nodeId: props.node.id,
        sourceWorkspaceId: props.scope.workspaceId,
        targetFacilityId: targetId.value,
        targetTopologyId: targetScope.value.topologyId,
        targetWorkspaceId: props.scope.workspaceId,
        parentId: parentId.value,
        code: code.value.trim() || undefined,
        rowIndex: row.value === '' ? null : Number(row.value),
        columnIndex: column.value === '' ? null : Number(column.value),
    });
    if (!input.success || (input.data.rowIndex === null) !== (input.data.columnIndex === null)) {
        error.value = '请选择目标设施，并填写有效且成对的行列坐标。';
        return;
    }
    const controller = new AbortController();
    previewRequest = controller;
    loading.value = true;
    try {
        const impact = await source.previewRelocation(props.scope.organizationId, input.data, controller.signal);
        if (!controller.signal.aborted) preview.value = { input: input.data, impact };
    } catch (cause) {
        if (!controller.signal.aborted) error.value = relocationErrorMessage(cause);
    } finally {
        if (!controller.signal.aborted) loading.value = false;
    }
}
async function submit() {
    if (!preview.value || !confirmed.value || !reason.value.trim() || locked.value || !canPreview.value) return;
    const body = RelocationExecuteSchema.safeParse({
        ...preview.value.input,
        expectedFingerprint: preview.value.impact.fingerprint,
        confirmGovernanceChange: true,
        reason: reason.value.trim(),
        idempotencyKey: crypto.randomUUID(),
    });
    if (!body.success) {
        error.value = '请填写搬迁原因并重新确认影响范围。';
        return;
    }
    const signal = lifetime.signal;
    await store.execute(props.scope.organizationId, body.data);
    if (signal.aborted) return;
    invalidatePreview();
    if (attempt.value?.receipt) await synchronize();
}
async function recover() {
    const signal = lifetime.signal;
    await store.recover(props.scope.organizationId);
    if (!signal.aborted && attempt.value?.receipt && !store.error) await synchronize();
}
async function synchronize() {
    const saved = attempt.value;
    if (!saved?.receipt || !facilities || syncing.value) return;
    const signal = lifetime.signal;
    syncing.value = true;
    syncError.value = '';
    try {
        const scope = { organizationId: saved.organizationId, workspaceId: saved.body.targetWorkspaceId };
        // The receipt proves this move committed; later legitimate moves must not invalidate it.
        await facilities.detail(scope, saved.body.targetFacilityId, signal);
        await facilities.detail(
            { organizationId: saved.organizationId, workspaceId: saved.body.sourceWorkspaceId },
            saved.body.sourceFacilityId,
            signal
        );
        if (signal.aborted) return;
        if (!store.acknowledge(saved.organizationId)) return;
        open.value = false;
        emit('committed', saved.body.targetFacilityId, saved.body.nodeId);
    } catch {
        if (!signal.aborted) syncError.value = '搬迁已成功，但数据尚未同步。请仅重新加载，不要重复搬迁。';
    } finally {
        if (!signal.aborted) syncing.value = false;
    }
}
</script>
<template>
    <Dialog v-model:open="dialogOpen">
        <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
            <DialogTitle>带存量容器搬迁</DialogTitle>
            <DialogDescription>
                {{
                    node ? `${node.name} · ${node.code}` : '恢复原搬迁操作'
                }}。整体移动容器、下属结构与实物；库存工作区归属和数量不变。
            </DialogDescription>
            <p v-if="store.recoveryError" role="alert" class="text-sm text-destructive">{{ store.recoveryError }}</p>
            <p v-if="error || store.error" role="alert" class="text-sm text-destructive">{{ error || store.error }}</p>
            <template v-if="attempt">
                <div class="space-y-3 rounded-md border bg-muted/50 p-4 text-sm" role="status">
                    <p class="font-medium">{{ attempt.receipt ? '搬迁已成功' : '原搬迁结果尚未确认' }}</p>
                    <p>
                        {{
                            attempt.receipt
                                ? '仅重新读取并同步结构，不会再次发起搬迁。'
                                : '保留了原始请求。继续确认将复用原参数和幂等键，不会另建搬迁。'
                        }}
                    </p>
                    <p class="break-all text-xs text-muted-foreground">节点：{{ attempt.body.nodeId }}</p>
                </div>
                <DataSyncNotice scope="搬迁结果" :error="syncError" :busy="store.busy || syncing" @retry="recover" />
                <Button :disabled="store.busy || syncing" @click="recover">
                    {{ store.busy || syncing ? '正在核对' : attempt.receipt ? '只重新加载' : '继续确认原操作' }}
                </Button>
            </template>
            <form v-else class="space-y-5" @submit.prevent="submit">
                <fieldset :disabled="locked" class="space-y-4">
                    <legend class="mb-3 text-sm font-semibold">目标位置</legend>
                    <FacilityPicker
                        v-model="targetId"
                        :scope="scope"
                        :context-key="open ? contextKey : ''"
                        :label="target.data.value?.name"
                    />
                    <FacilityReadFeedback
                        :error="target.error.value"
                        :loading="target.loading.value"
                        @retry="target.refresh"
                    />
                    <NodePicker
                        v-if="targetScope.topologyId"
                        :key="targetKey"
                        v-model="parentId"
                        :scope="targetScope"
                        :context-key="targetKey"
                        :exclude="node?.id"
                        label="目标父容器"
                        root-label="设施顶层"
                    />
                    <div class="grid gap-3 sm:grid-cols-3">
                        <label class="grid gap-2 text-sm">
                            目标编号
                            <Input v-model="code" maxlength="160" />
                        </label>
                        <label class="grid gap-2 text-sm">
                            所在行（可空）
                            <Input v-model="row" type="number" min="1" max="10000" />
                        </label>
                        <label class="grid gap-2 text-sm">
                            所在列（可空）
                            <Input v-model="column" type="number" min="1" max="10000" />
                        </label>
                    </div>
                    <Button type="button" variant="outline" :disabled="!canPreview" @click="inspect">
                        {{ loading ? '正在检查影响' : preview ? '重新预览影响' : '预览搬迁影响' }}
                    </Button>
                </fieldset>
                <section v-if="preview" class="space-y-4 border-t pt-4" aria-label="搬迁影响预览">
                    <h3 class="text-sm font-semibold">搬迁影响</h3>
                    <div class="grid gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                        <p class="break-words">{{ preview.impact.sourcePath }}</p>
                        <ArrowRight class="size-4 self-center text-muted-foreground" aria-hidden="true" />
                        <p class="break-words">{{ preview.impact.targetPath }}</p>
                    </div>
                    <p class="text-sm">
                        {{ preview.impact.nodeCount }} 个结构节点 · {{ preview.impact.itemCount }} 件实物 ·
                        {{ preview.impact.workspaceIds.length }} 个库存工作区
                    </p>
                    <div class="grid gap-4 text-sm sm:grid-cols-2">
                        <section class="min-w-0 space-y-2">
                            <h4 class="font-medium">搬迁前</h4>
                            <p class="break-words">
                                管理工作区：{{ workspaceName(preview.impact.sourceManagementWorkspaceId) }}
                            </p>
                            <p class="text-muted-foreground">设施准入工作区</p>
                            <p v-for="id in preview.impact.sourceAccessWorkspaceIds" :key="id" class="break-all">
                                {{ workspaceName(id) }}
                            </p>
                        </section>
                        <section class="min-w-0 space-y-2">
                            <h4 class="font-medium">搬迁后</h4>
                            <p class="break-words">
                                管理工作区：{{ workspaceName(preview.impact.targetManagementWorkspaceId) }}
                            </p>
                            <p class="text-muted-foreground">设施准入工作区</p>
                            <p v-for="id in preview.impact.targetAccessWorkspaceIds" :key="id" class="break-all">
                                {{ workspaceName(id) }}
                            </p>
                        </section>
                    </div>
                    <ScrollSurface v-if="preview.impact.items.length" class="max-h-64 border-y" edge-effect="line">
                        <table class="w-full table-fixed text-left text-sm">
                            <thead class="bg-muted">
                                <tr>
                                    <th class="p-2">实物编号</th>
                                    <th class="p-2">所属工作区</th>
                                    <th class="p-2 text-right">数量（原单位）</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="item in preview.impact.items" :key="item.stockItemId" class="border-t">
                                    <td class="break-all p-2">{{ item.code }}</td>
                                    <td class="break-all p-2">{{ workspaceName(item.workspaceId) }}</td>
                                    <td class="break-all p-2 text-right tabular-nums">{{ item.quantity }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </ScrollSurface>
                    <div class="flex gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning-foreground">
                        <AlertTriangle class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <p>
                            结构管理与共享范围将按目标设施规则生效；库存仍归原工作区所有，不向目标设施管理员自动开放库存明细。全部实物一起搬迁，任一校验失败则整次不执行。
                        </p>
                    </div>
                    <label class="grid gap-2 text-sm">
                        搬迁原因
                        <Textarea v-model="reason" required maxlength="1000" :disabled="locked" />
                    </label>
                    <label class="flex items-start gap-3 text-sm">
                        <Checkbox v-model="confirmed" :disabled="locked" class="mt-0.5" />
                        <span>我已核对全部受影响实物，并确认搬迁后的结构管理与共享范围。</span>
                    </label>
                </section>
                <div class="flex justify-end gap-2 border-t pt-4">
                    <Button type="button" variant="outline" :disabled="locked" @click="open = false">取消</Button>
                    <Button :disabled="!preview || !confirmed || !reason.trim() || !canPreview">
                        {{ store.busy ? '搬迁中' : '确认整体搬迁' }}
                    </Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
</template>
