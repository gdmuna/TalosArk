<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue';
import { useManagementDataSource } from '@/module/workspace';
import { HttpError } from '@/platform/http';
import { inventoryErrorMessage, useInventoryDataSource, useInventoryRead, useInventoryScope } from '@/module/inventory';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ui/dialog';

const props = defineProps<{ onCommitted: () => Promise<boolean> }>();
const source = useInventoryDataSource();
const management = useManagementDataSource();
const scope = useInventoryScope();
const key = computed(() => (scope.value ? JSON.stringify(scope.value) : ''));
const team = useInventoryRead(key, (current, signal) =>
    management.team.load({ organizationId: current.organizationId }, { page: 1, pageSize: 1, search: '' }, signal)
);
const required = [
    'inventory.read',
    'inventory.receive',
    'inventory.instance.update',
    'inventory.transfer',
    'inventory.consume',
    'inventory.adjust',
    'inventory.dispose',
    'material.batch.manage',
];
const needsSetup = computed(
    () =>
        team.data.value?.isOwner &&
        !required.every((code) =>
            team.data.value?.roles.find((role) => role.code === 'workspace-manager')?.permissions.includes(code)
        )
);
const open = ref(false),
    busy = ref(false),
    committed = ref(false),
    syncPending = ref(false),
    error = ref('');
let request: AbortController | undefined;
let generation = 0;
watch(
    scope,
    () => {
        generation++;
        request?.abort();
        open.value = busy.value = committed.value = syncPending.value = false;
        error.value = '';
    },
    { flush: 'sync' }
);
onScopeDispose(() => {
    generation++;
    request?.abort();
});
const dialogOpen = computed({
    get: () => open.value,
    set: (value) => {
        if (!busy.value) open.value = value;
    },
});
async function synchronize() {
    const results = await Promise.all([props.onCommitted(), team.refresh()]);
    return results.every(Boolean);
}
async function initialize() {
    if (!source || !scope.value || !team.data.value?.isOwner || busy.value) return;
    const current = generation;
    request = new AbortController();
    const signal = request.signal;
    busy.value = true;
    error.value = '';
    try {
        if (!committed.value) {
            await source.initialize(scope.value.organizationId, signal);
            if (signal.aborted || current !== generation) return;
            committed.value = true;
        }
        const synchronized = await synchronize();
        if (current !== generation) return;
        syncPending.value = !synchronized;
        if (synchronized) open.value = false;
    } catch (cause) {
        if (signal.aborted || current !== generation) return;
        if (committed.value) syncPending.value = true;
        else
            error.value =
                cause instanceof HttpError && cause.code === 'INVENTORY_INVALID_STATE'
                    ? '请先在管理中心完成团队预置角色初始化。'
                    : inventoryErrorMessage(cause);
    } finally {
        if (current === generation) busy.value = false;
    }
}
</script>
<template>
    <div v-if="needsSetup" class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 text-sm">
        <p>当前组织的工作区管理员角色尚未包含完整的库存与批次权限。</p>
        <Button variant="outline" @click="open = true">配置库存预置权限</Button>
    </div>
    <Dialog v-model:open="dialogOpen">
        <DialogContent>
            <DialogTitle>配置库存预置权限</DialogTitle>
            <DialogDescription>
                将库存读取、入库、资料更正、消耗、转移、数量核实、移出管理和批次维护权限加入当前组织的“工作区管理员”角色，影响该组织中所有使用此角色的成员。
            </DialogDescription>
            <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
            <p v-if="committed" role="status" class="text-sm text-success">
                权限已更新。{{ syncPending ? '页面尚未同步，请只重新加载。' : '' }}
            </p>
            <div class="flex justify-end gap-2">
                <Button variant="outline" :disabled="busy" @click="open = false">关闭</Button>
                <Button :disabled="busy" @click="initialize">
                    {{ busy ? '正在处理' : committed ? '只重新加载' : '确认配置' }}
                </Button>
            </div>
        </DialogContent>
    </Dialog>
</template>
