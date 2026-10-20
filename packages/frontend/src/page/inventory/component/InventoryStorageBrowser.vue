<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { MoveRight } from '@lucide/vue';
import { StorageBrowser } from '@/module/facility/ui';
import type { FacilityDetail, StorageNodeDetail } from '@/module/facility';
import { Button } from '@/ui/button';
import { useInventoryDataSource, useInventoryRelocationStore, useInventoryScope } from '@/module/inventory';
import InventoryRelocationDialog from './InventoryRelocationDialog.vue';
import InventoryPositionContent from './InventoryPositionContent.vue';

const props = defineProps<{
    facility: FacilityDetail;
    contextKey: string;
    workspaceId?: string;
    selectable?: boolean;
}>();
const emit = defineEmits<{
    changed: [];
    relocated: [facilityId: string, nodeId: string];
    'select-position': [node: StorageNodeDetail | undefined];
}>();
const source = useInventoryDataSource();
const inventoryScope = useInventoryScope();
const store = useInventoryRelocationStore();
const open = ref(false);
const selected = ref<StorageNodeDetail>();
const epoch = ref(0);
const context = computed(() => JSON.stringify([props.contextKey, epoch.value]));
const scope = computed(() => ({
    organizationId: props.facility.organizationId,
    facilityId: props.facility.id,
    topologyId: props.facility.topology?.id ?? '',
    workspaceId: props.workspaceId,
}));
const attempt = computed(() => store.current(props.facility.organizationId));
watch(
    () => props.contextKey,
    () => {
        open.value = false;
        selected.value = undefined;
    },
    { flush: 'sync' }
);
function committed(facilityId: string, nodeId: string) {
    epoch.value++;
    emit('changed');
    emit('relocated', facilityId, nodeId);
}
</script>
<template>
    <div class="space-y-4">
        <div
            v-if="source && (attempt || store.recoveryError)"
            role="status"
            class="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/50 p-3 text-sm"
        >
            <p>
                {{
                    store.recoveryError ||
                    (attempt?.receipt ? '搬迁已成功，页面数据尚待同步。' : '有一项搬迁结果待确认，请继续核对原操作。')
                }}
            </p>
            <Button
                v-if="attempt"
                variant="outline"
                size="sm"
                @click="
                    selected = undefined;
                    open = true;
                "
            >
                恢复搬迁操作
            </Button>
        </div>
        <StorageBrowser
            :key="context"
            v-bind="props"
            :context-key="context"
            @changed="emit('changed')"
            @relocated="(facilityId, nodeId) => emit('relocated', facilityId, nodeId)"
            @select-position="emit('select-position', $event)"
        >
            <template #node-content="{ node }">
                <InventoryPositionContent
                    v-if="
                        node.kind === 'POSITION' &&
                        inventoryScope?.organizationId === facility.organizationId &&
                        inventoryScope?.workspaceId === workspaceId
                    "
                    :key="node.id"
                    :node="node"
                    @changed="emit('changed')"
                />
            </template>
            <template #node-action="{ node }">
                <Button
                    v-if="source && node.kind === 'CONTAINER' && !node.archivedAt"
                    variant="outline"
                    size="sm"
                    :disabled="store.busy || !!attempt || !!store.recoveryError"
                    @click="
                        selected = node;
                        open = true;
                    "
                >
                    <MoveRight aria-hidden="true" />
                    带存量搬迁
                </Button>
            </template>
        </StorageBrowser>
        <InventoryRelocationDialog
            v-model:open="open"
            :scope="scope"
            :context-key="context"
            :node="selected"
            @committed="committed"
        />
    </div>
</template>
