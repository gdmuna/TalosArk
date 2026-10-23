<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { Copy, Pencil, Plus, Trash2 } from '@lucide/vue';
import type { InventoryScope, InventoryReceipt } from '@/module/inventory';
import { useInventoryReceiptStore } from '@/module/inventory';
import { BatchOperationPanel } from '@/component/batch-operation';
import { DataTable, type DataTableColumn } from '@/component/data-table';
import { ScrollSurface } from '@/component/scroll-surface';
import { useOverlayDraft } from '@/component/overlay-draft';
import { useWorkspaceStore } from '@/module/workspace';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/ui/dialog';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/ui/sheet';
import InventoryReceiptDialog from './InventoryReceiptDialog.vue';
import type { ReceiptDraft } from './receipt-draft';
const props = defineProps<{
    scope: InventoryScope | null;
    canReceive: boolean;
    canManageBatch: boolean;
    businessDate?: string;
    onSynchronized: () => Promise<boolean>;
}>();
const open = defineModel<boolean>('open', { default: false });
const store = useInventoryReceiptStore();
const workspace = useWorkspaceStore();
const operationWorkspace = computed(
    () =>
        workspace.workspaces.find((item) => item.id === props.scope?.workspaceId)?.name ??
        props.scope?.workspaceId ??
        '未选择工作区'
);
const key = computed(() => store.batchKey(props.scope)),
    batch = computed(() => store.batch.current(key.value));
type Row = ReceiptDraft & { id: string };
const drafts = shallowRef<Row[]>([]),
    editing = ref<string>(),
    initial = shallowRef<InventoryReceipt>(),
    formOpen = ref(false);
const {
    guardedOpen: dialogOpen,
    confirmOpen: discard,
    discard: discardDraft,
} = useOverlayDraft(open, () => JSON.stringify(drafts.value), { saved: () => !!batch.value });
const columns: DataTableColumn<Row>[] = [
    { id: 'code', label: '实例编号', value: (row) => row.body.code ?? '系统生成', size: 170 },
    { id: 'material', label: '材料', value: (row) => row.materialName, size: 240, fill: true },
    { id: 'quantity', label: '数量', value: (row) => `${row.body.quantity} ${row.quantityUnit}`, size: 120 },
    { id: 'position', label: '存储位置', value: (row) => row.positionPath, size: 260, wrap: true },
];
function edit(row?: Row) {
    editing.value = row?.id;
    initial.value = row?.body;
    formOpen.value = true;
}
function copy(row: Row) {
    editing.value = undefined;
    // Copies are drafts, not a second submission of the original command.
    initial.value = { ...row.body, code: undefined, position: { facilityId: '', topologyId: '', nodeId: '' } };
    formOpen.value = true;
}
function prepare(draft: ReceiptDraft) {
    const others = drafts.value.filter((row) => row.id !== editing.value);
    if (others.length >= 100) return '每批最多 100 件实物';
    if (others.some((row) => row.body.position.nodeId === draft.body.position.nodeId))
        return '该位置已被清单内的其他项目选用';
    if (draft.body.code && others.some((row) => row.body.code === draft.body.code)) return '清单内的实例编号不能重复';
    if (draft.body.batch.kind === 'create') {
        const number = draft.body.batch.value.batchNumber;
        if (
            others.some(
                (row) =>
                    row.body.materialId === draft.body.materialId &&
                    row.body.batch.kind === 'create' &&
                    row.body.batch.value.batchNumber === number
            )
        )
            return '清单内不能重复新建同一来源批次；同批入库请先创建来源批次，再选择已有批次';
    }
    const row = { ...draft, id: editing.value ?? crypto.randomUUID() };
    drafts.value = editing.value
        ? drafts.value.map((old) => (old.id === editing.value ? row : old))
        : [...drafts.value, row];
}
async function synchronize() {
    await store.batch.synchronize(key.value, props.onSynchronized);
}
async function run(retry = false) {
    const current = key.value;
    await store.batch.run(current, retry);
    if (open.value && current === key.value && batch.value?.items.some((row) => row.status === 'succeeded'))
        await synchronize();
}
async function submit() {
    const scope = props.scope;
    if (!scope || !props.canReceive || formOpen.value) return;
    if (
        store.batch.create(
            key.value,
            '批量入库',
            drafts.value.map((row, index) => ({
                id: row.id,
                label: `${row.body.code ?? `实物 ${index + 1}`} · ${row.materialName} · ${row.body.quantity} ${row.quantityUnit}`,
                input: { scope, body: row.body },
            }))
        )
    ) {
        drafts.value = [];
        await run();
    }
}
watch(open, (value) => {
    if (!value) {
        store.batch.pause();
        formOpen.value = false;
        drafts.value = [];
    }
});
watch(
    key,
    () => {
        open.value = false;
        formOpen.value = false;
        drafts.value = [];
    },
    { flush: 'sync' }
);
onScopeDispose(() => store.batch.pause());
</script>
<template>
    <Sheet v-model:open="dialogOpen">
        <SheetContent class="w-full gap-0 p-0 sm:max-w-4xl">
            <header class="shrink-0 space-y-2 border-b p-6 pr-12">
                <SheetTitle>批量入库</SheetTitle>
                <SheetDescription>
                    操作工作区 · {{ operationWorkspace }}
                    <br />
                    {{
                        batch ? '关闭会暂停后续提交；已提交项目保留核对记录。' : `待提交 ${drafts.length} / 100 件实物`
                    }}
                </SheetDescription>
            </header>
            <ScrollSurface class="min-h-0 flex-1">
                <div class="space-y-4 p-6">
                    <BatchOperationPanel
                        v-if="batch"
                        :rows="batch.items"
                        :busy="store.batch.busy"
                        :synchronized="batch.synchronized"
                        :error="store.batch.error || batch.syncError"
                        @run="run()"
                        @retry="run(true)"
                        @synchronize="synchronize"
                        @pause="store.batch.pause()"
                        @skip="store.batch.skipPending(key)"
                        @finish="store.batch.finish(key) && (open = false)"
                    />
                    <template v-else>
                        <p v-if="store.batch.error" role="alert" class="text-sm text-destructive">
                            {{ store.batch.error }}
                        </p>
                        <div class="flex justify-end">
                            <Button variant="outline" :disabled="drafts.length >= 100 || !canReceive" @click="edit()">
                                <Plus />
                                添加实物
                            </Button>
                        </div>
                        <DataTable
                            :data="drafts"
                            :columns="columns"
                            :filtering="false"
                            :searchable="false"
                            empty-text="尚未添加入库项目"
                            :actions="[
                                { id: 'edit', label: '编辑', icon: Pencil, primary: true, run: edit },
                                {
                                    id: 'copy',
                                    label: '复制为新项目',
                                    icon: Copy,
                                    disabled: () => drafts.length >= 100,
                                    run: copy,
                                },
                                {
                                    id: 'remove',
                                    label: '移除',
                                    icon: Trash2,
                                    run: (row) => {
                                        drafts = drafts.filter((item) => item.id !== row.id);
                                    },
                                },
                            ]"
                        />
                    </template>
                </div>
            </ScrollSurface>
            <footer class="flex shrink-0 justify-end gap-2 border-t p-6">
                <Button variant="outline" @click="dialogOpen = false">关闭</Button>
                <Button
                    v-if="!batch"
                    :disabled="
                        !drafts.length || !canReceive || store.busy || !!store.recoveryError || !!store.batch.error
                    "
                    @click="submit"
                >
                    确认登记 {{ drafts.length }} 件
                </Button>
            </footer>
        </SheetContent>
    </Sheet>
    <InventoryReceiptDialog
        v-model:open="formOpen"
        :scope="scope"
        :can-receive="canReceive"
        :can-manage-batch="canManageBatch"
        :business-date="businessDate"
        :initial-receipt="initial"
        :on-prepared="prepare"
    />
    <Dialog v-model:open="discard">
        <DialogContent>
            <DialogTitle>放弃待提交清单？</DialogTitle>
            <DialogDescription>尚未提交的 {{ drafts.length }} 个项目将被清除。</DialogDescription>
            <div class="flex justify-end gap-2">
                <Button variant="outline" @click="discard = false">继续编辑</Button>
                <Button @click="discardDraft">放弃清单</Button>
            </div>
        </DialogContent>
    </Dialog>
</template>
