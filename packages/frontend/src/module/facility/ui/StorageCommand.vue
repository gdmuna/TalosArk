<script setup lang="ts">
import { computed, ref, watch, useId } from 'vue';
import {
    StorageNodeCreateSchema,
    StorageNodeUpdateSchema,
    StorageGridSchema,
    StorageNodeMoveSchema,
    StorageNodeReorderSchema,
    StorageNodeStateSchema,
    StorageContainerTypeSchema,
} from '@talos-ark/contracts/facility';
import { useFacilityDataSource, useFacilityRead } from '../model/read';
import type { StorageScope, StorageNodeDetail } from '../data/source';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/ui/dialog';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { SelectField } from '@/component/select-field';
import { DataSyncNotice } from '@/component/data-sync';
import { HttpError } from '@/platform/http';
import FacilityPicker from './FacilityPicker.vue';
import NodePicker from './NodePicker.vue';
import ReadFeedback from './ReadFeedback.vue';
import { Field, FieldError, FieldLabel } from '@/ui/field';
import { OverlayDraftDialog, useOverlayDraft } from '@/component/overlay-draft';
const standaloneFieldId = useId();

const formFieldId = useId();

const props = defineProps<{
    scope: StorageScope;
    contextKey: string;
    node?: StorageNodeDetail;
    mode: 'create' | 'edit' | 'grid' | 'move' | 'reorder' | 'state';
    state?: 'active' | 'disabled' | 'archived';
}>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ changed: [id?: string, facilityId?: string] }>();
const source = useFacilityDataSource();
const code = ref(''),
    name = ref(''),
    description = ref(''),
    kind = ref('CONTAINER'),
    containerType = ref('OTHER');
const rowIndex = ref<string | number>(''),
    columnIndex = ref<string | number>(''),
    rowCount = ref<string | number>(''),
    columnCount = ref<string | number>('');
const gridRows = ref<string | number>(1),
    gridColumns = ref<string | number>(1),
    prefix = ref('P-');
const targetId = ref(''),
    targetParent = ref<string | null>(null),
    beforeId = ref<string | null>(null);
const validation = ref('');
const committed = ref(false);
let resultId: string | undefined, resultFacilityId: string | undefined;
const key = computed(() =>
    open.value && source && props.contextKey
        ? JSON.stringify([props.contextKey, props.scope, props.node?.id, props.mode])
        : ''
);
const { data, loading, busy, conflict, error, syncError, pendingSync, refresh, write } = useFacilityRead(
    key,
    async (signal) => {
        if (!source) return;
        const scope = props.scope,
            selected = props.node;
        const facility = await source.detail(scope, scope.facilityId, signal);
        const node =
            selected && !(resultFacilityId && resultFacilityId !== scope.facilityId)
                ? await source.node(scope, selected.id, signal)
                : undefined;
        if (facility.topology?.id !== scope.topologyId) throw new HttpError('布局已改变', 'protocol');
        return { facility, node };
    }
);
const { guardedOpen, confirmOpen, discard } = useOverlayDraft(
    open,
    () =>
        JSON.stringify([
            code.value,
            name.value,
            description.value,
            kind.value,
            containerType.value,
            rowIndex.value,
            columnIndex.value,
            rowCount.value,
            columnCount.value,
            gridRows.value,
            gridColumns.value,
            prefix.value,
            targetId.value,
            targetParent.value,
            beforeId.value,
        ]),
    { busy, saved: committed }
);
const targetKey = computed(() =>
    key.value && targetId.value && props.mode === 'move' ? JSON.stringify([key.value, targetId.value]) : ''
);
const target = useFacilityRead(
    targetKey,
    (signal) => source?.detail(props.scope, targetId.value, signal) ?? Promise.resolve(undefined)
);
const targetScope = computed(() => ({
    ...props.scope,
    facilityId: targetId.value,
    topologyId: target.data.value?.topology?.id ?? '',
}));
const disabled = computed(
    () =>
        loading.value ||
        busy.value ||
        conflict.value ||
        pendingSync.value ||
        committed.value ||
        !data.value?.facility.capabilities.manage ||
        !!data.value.facility.archivedAt
);
const title = computed(
    () =>
        ({
            create: '新增存储节点',
            edit: '编辑存储节点',
            grid: '生成孔位',
            move: '移动空子树',
            reorder: '调整同级顺序',
            state: props.state === 'archived' ? '归档节点' : props.state === 'disabled' ? '停用节点' : '恢复启用节点',
        })[props.mode]
);
const typeLabels: Record<string, string> = {
    FREEZER: '冰箱',
    LIQUID_NITROGEN_TANK: '液氮罐',
    CABINET: '柜体',
    SHELF: '层架',
    RACK: '提篮',
    DRAWER: '抽屉',
    BOX: '盒',
    PARTITION: '逻辑分区',
    OTHER: '其他',
};
const typeOptions = StorageContainerTypeSchema.options.map((value) => ({ value, label: typeLabels[value] ?? value }));
const number = (value: string | number) => (value === '' ? null : Number(value));
watch(
    key,
    () => {
        const node = props.mode === 'create' ? undefined : props.node;
        code.value = node?.code ?? '';
        name.value = node?.name ?? '';
        description.value = node?.description ?? '';
        kind.value = node?.kind ?? 'CONTAINER';
        containerType.value = node?.containerType ?? 'OTHER';
        rowIndex.value = node?.rowIndex ?? '';
        columnIndex.value = node?.columnIndex ?? '';
        rowCount.value = node?.rowCount ?? '';
        columnCount.value = node?.columnCount ?? '';
        gridRows.value = props.node?.rowCount ?? 1;
        gridColumns.value = props.node?.columnCount ?? 1;
        targetId.value = props.scope.facilityId;
        targetParent.value = props.node?.parentId ?? null;
        beforeId.value = null;
        validation.value = '';
        committed.value = false;
        resultId = resultFacilityId = undefined;
    },
    { immediate: true, flush: 'sync' }
);
watch(targetId, () => {
    targetParent.value = null;
    rowIndex.value = columnIndex.value = '';
});
watch(pendingSync, (value) => {
    if (!value && committed.value) {
        emit('changed', resultId, resultFacilityId);
        open.value = false;
    }
});
async function submit() {
    if (!source || disabled.value || !data.value?.facility.topology) return;
    const scope = props.scope,
        node = data.value.node;
    const expectedRevision = node?.revision ?? data.value.facility.topology.revision;
    const fields = {
        code: code.value,
        name: name.value,
        description: description.value.trim() || null,
        containerType: kind.value === 'CONTAINER' ? containerType.value : null,
        rowIndex: number(rowIndex.value),
        columnIndex: number(columnIndex.value),
        rowCount: kind.value === 'CONTAINER' ? number(rowCount.value) : null,
        columnCount: kind.value === 'CONTAINER' ? number(columnCount.value) : null,
        expectedRevision,
    };
    validation.value = '';
    if (
        (fields.rowIndex === null) !== (fields.columnIndex === null) ||
        (fields.rowCount === null) !== (fields.columnCount === null)
    ) {
        validation.value = '行列坐标和网格规格需要成对填写。';
        return;
    }
    if (
        props.mode === 'create' &&
        node?.rowCount &&
        node.columnCount &&
        (fields.rowIndex === null ||
            fields.columnIndex === null ||
            fields.rowIndex > node.rowCount ||
            fields.columnIndex > node.columnCount)
    ) {
        validation.value = `父容器网格为 ${node.rowCount} × ${node.columnCount}，请填写范围内的行列坐标。`;
        return;
    }
    let action: ((signal: AbortSignal) => Promise<unknown>) | undefined;
    if (props.mode === 'create') {
        const body = StorageNodeCreateSchema.safeParse({ ...fields, kind: kind.value, parentId: node?.id ?? null });
        if (body.success)
            action = async (signal) => {
                const result = await source.createNode(scope, body.data, signal);
                if (!signal.aborted) resultId = result.id;
            };
    } else if (node && props.mode === 'edit') {
        const body = StorageNodeUpdateSchema.safeParse(fields);
        if (body.success) action = (signal) => source.updateNode(scope, node.id, body.data, signal);
    } else if (node && props.mode === 'grid') {
        const rows = Number(gridRows.value),
            columns = Number(gridColumns.value);
        if (
            Number.isInteger(rows) &&
            Number.isInteger(columns) &&
            rows > 0 &&
            columns > 0 &&
            rows * columns <= 1000 &&
            rows <= (node.rowCount ?? 0) &&
            columns <= (node.columnCount ?? 0)
        ) {
            const positions = Array.from({ length: rows * columns }, (_, index) => ({
                code: `${prefix.value}${Math.floor(index / columns) + 1}-${(index % columns) + 1}`,
                name: `${prefix.value}${Math.floor(index / columns) + 1}-${(index % columns) + 1}`,
                rowIndex: Math.floor(index / columns) + 1,
                columnIndex: (index % columns) + 1,
            }));
            const body = StorageGridSchema.safeParse({ expectedRevision, positions });
            if (body.success) action = (signal) => source.generateGrid(scope, node.id, body.data, signal);
        }
    } else if (node && props.mode === 'move' && target.data.value?.topology && target.data.value.capabilities.manage) {
        const destination = target.data.value,
            topology = target.data.value.topology;
        const body = StorageNodeMoveSchema.safeParse({
            expectedRevision,
            targetFacilityId: destination.id,
            targetTopologyId: topology.id,
            targetRevision: topology.revision,
            parentId: targetParent.value,
            code: code.value || undefined,
            rowIndex: number(rowIndex.value),
            columnIndex: number(columnIndex.value),
        });
        if (body.success)
            action = async (signal) => {
                await source.moveNode(scope, node.id, body.data, signal);
                if (signal.aborted) return;
                resultFacilityId = destination.id;
                resultId = node.id;
            };
    } else if (node && props.mode === 'reorder') {
        const body = StorageNodeReorderSchema.safeParse({ expectedRevision, beforeNodeId: beforeId.value });
        if (body.success) action = (signal) => source.reorderNode(scope, node.id, body.data, signal);
    } else if (node && props.mode === 'state') {
        const body = StorageNodeStateSchema.safeParse({ expectedRevision, state: props.state });
        if (body.success) action = (signal) => source.stateNode(scope, node.id, body.data, signal);
    }
    if (!action) {
        validation.value = '请检查必填字段、成对的行列坐标及规格。一次仅可生成 1–1000 个实际孔位。';
        return;
    }
    const saved = await write(action);
    if (saved) {
        committed.value = true;
        if (!pendingSync.value) {
            emit('changed', resultId, resultFacilityId);
            open.value = false;
        }
    }
}
async function reload() {
    await refresh();
    if (props.mode === 'move') await target.refresh();
}
</script>
<template>
    <Dialog v-model:open="guardedOpen">
        <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-xl">
            <DialogTitle>{{ title }}</DialogTitle>
            <DialogDescription>
                {{ data?.node ? `${data.node.name} · ${data.node.code}` : '当前布局根级' }}。位置坐标从 1
                开始；操作由服务端再次检查权限、状态和布局版本。
            </DialogDescription>
            <ReadFeedback :error="error" :loading="loading" @retry="reload" />
            <DataSyncNotice
                scope="存储结构"
                :error="syncError"
                :pending="pendingSync"
                :busy="busy || loading"
                @retry="reload"
            />
            <form v-if="data" class="space-y-4" @submit.prevent="submit">
                <template v-if="mode === 'create' || mode === 'edit'">
                    <Field v-if="mode === 'create'" class="w-full">
                        <FieldLabel :for="standaloneFieldId + '-1'">节点类型</FieldLabel>
                        <SelectField
                            :id="standaloneFieldId + '-1'"
                            v-model="kind"
                            label="节点类型"
                            :options="[
                                { value: 'CONTAINER', label: '容器' },
                                { value: 'POSITION', label: '物理位置' },
                            ]"
                            :disabled="disabled"
                        />
                    </Field>
                    <Field>
                        <FieldLabel :for="formFieldId + '-1'">编号</FieldLabel>
                        <Input :id="formFieldId + '-1'" v-model="code" required maxlength="160" :disabled="disabled" />
                    </Field>
                    <Field>
                        <FieldLabel :for="formFieldId + '-2'">名称</FieldLabel>
                        <Input :id="formFieldId + '-2'" v-model="name" required maxlength="160" :disabled="disabled" />
                    </Field>
                    <Field v-if="kind === 'CONTAINER'" class="w-full">
                        <FieldLabel :for="standaloneFieldId + '-2'">容器分类</FieldLabel>
                        <SelectField
                            :id="standaloneFieldId + '-2'"
                            v-model="containerType"
                            label="容器分类"
                            :options="typeOptions"
                            :disabled="disabled"
                        />
                    </Field>
                    <div v-if="kind === 'CONTAINER'" class="grid grid-cols-2 gap-3">
                        <Field>
                            <FieldLabel :for="formFieldId + '-3'">网格行数（可空）</FieldLabel>
                            <Input
                                :id="formFieldId + '-3'"
                                v-model="rowCount"
                                type="number"
                                min="1"
                                max="10000"
                                :disabled="disabled"
                            />
                        </Field>
                        <Field>
                            <FieldLabel :for="formFieldId + '-4'">网格列数（可空）</FieldLabel>
                            <Input
                                :id="formFieldId + '-4'"
                                v-model="columnCount"
                                type="number"
                                min="1"
                                max="10000"
                                :disabled="disabled"
                            />
                        </Field>
                    </div>
                    <Field>
                        <FieldLabel :for="formFieldId + '-5'">描述</FieldLabel>
                        <Textarea
                            :id="formFieldId + '-5'"
                            v-model="description"
                            maxlength="2000"
                            :disabled="disabled"
                        />
                    </Field>
                </template>
                <template v-if="mode === 'create' || mode === 'edit' || mode === 'move'">
                    <div class="grid grid-cols-2 gap-3">
                        <Field>
                            <FieldLabel :for="formFieldId + '-6'">所在行</FieldLabel>
                            <Input
                                :id="formFieldId + '-6'"
                                v-model="rowIndex"
                                type="number"
                                min="1"
                                max="10000"
                                :disabled="disabled"
                            />
                        </Field>
                        <Field>
                            <FieldLabel :for="formFieldId + '-7'">所在列</FieldLabel>
                            <Input
                                :id="formFieldId + '-7'"
                                v-model="columnIndex"
                                type="number"
                                min="1"
                                max="10000"
                                :disabled="disabled"
                            />
                        </Field>
                    </div>
                </template>
                <template v-if="mode === 'grid'">
                    <p class="text-sm text-muted-foreground">
                        仅生成实际位置，不按网格规格推算空位或库存容量；若任一编号或坐标冲突，整批不写入。
                    </p>
                    <Field>
                        <FieldLabel :for="formFieldId + '-8'">编号前缀</FieldLabel>
                        <Input :id="formFieldId + '-8'" v-model="prefix" maxlength="120" :disabled="disabled" />
                    </Field>
                    <div class="grid grid-cols-2 gap-3">
                        <Field>
                            <FieldLabel :for="formFieldId + '-9'">生成行数</FieldLabel>
                            <Input
                                :id="formFieldId + '-9'"
                                v-model="gridRows"
                                type="number"
                                min="1"
                                :max="node?.rowCount ?? 1000"
                                :disabled="disabled"
                            />
                        </Field>
                        <Field>
                            <FieldLabel :for="formFieldId + '-10'">生成列数</FieldLabel>
                            <Input
                                :id="formFieldId + '-10'"
                                v-model="gridColumns"
                                type="number"
                                min="1"
                                :max="node?.columnCount ?? 1000"
                                :disabled="disabled"
                            />
                        </Field>
                    </div>
                    <p class="text-sm">共 {{ Number(gridRows) * Number(gridColumns) }} 个，从第 1 行、第 1 列开始</p>
                </template>
                <template v-if="mode === 'move'">
                    <p class="text-sm text-muted-foreground">
                        仅支持无库存占用的子树。节点身份保留，不执行库存或设备同步。
                    </p>
                    <FacilityPicker
                        v-model="targetId"
                        :scope="scope"
                        :context-key="key"
                        :label="target.data.value?.name"
                    />
                    <ReadFeedback :error="target.error.value" :loading="target.loading.value" @retry="target.refresh" />
                    <NodePicker
                        v-if="target.data.value?.topology"
                        :key="targetKey"
                        v-model="targetParent"
                        :scope="targetScope"
                        :context-key="targetKey"
                        :exclude="node?.id"
                        label="目标父容器"
                        root-label="目标布局根级"
                    />
                    <Field>
                        <FieldLabel :for="formFieldId + '-11'">目标编号</FieldLabel>
                        <Input :id="formFieldId + '-11'" v-model="code" maxlength="160" :disabled="disabled" />
                    </Field>
                </template>
                <NodePicker
                    v-if="mode === 'reorder' && node"
                    v-model="beforeId"
                    :scope="scope"
                    :context-key="key"
                    :parent-id="node.parentId"
                    :exclude="node.id"
                    label="移动到此相邻节点之前"
                    root-label="同级末尾"
                />
                <p v-if="mode === 'state'" class="text-sm text-muted-foreground">
                    停用阻止新增存放；归档需先处理占用和活动子节点，不删除历史。
                </p>
                <FieldError v-if="validation" role="alert" class="text-sm text-destructive">
                    {{ validation }}
                </FieldError>
                <div class="flex justify-end gap-2">
                    <Button type="button" variant="outline" :disabled="busy" @click="guardedOpen = false">关闭</Button>
                    <Button
                        :disabled="
                            disabled ||
                            (mode === 'move' &&
                                (target.loading.value ||
                                    !!target.error.value ||
                                    !target.data.value?.capabilities.manage))
                        "
                    >
                        {{ busy ? '提交中' : '确认' }}
                    </Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
    <OverlayDraftDialog v-model:open="confirmOpen" @discard="discard" />
</template>
