<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAccountStore } from '@/module/account';
import { useWorkspaceStore } from '@/module/workspace';
import { useFacilityDataSource, useFacilityRead, type StorageNodeDetail } from '@/module/facility';
import { FacilityPicker, FacilityReadFeedback as ReadFeedback } from '@/module/facility/ui';
import StorageBrowser from './component/InventoryStorageBrowser.vue';
import { CopyableId } from '@/component/inspector';
import { Button } from '@/ui/button';
import { X } from '@lucide/vue';
import ResourcePage from '../resource/ResourcePage.vue';
const route = useRoute(),
    router = useRouter(),
    workspace = useWorkspaceStore(),
    account = useAccountStore(),
    source = useFacilityDataSource();
const scope = computed(() => ({ organizationId: workspace.organization?.id ?? '', workspaceId: workspace.activeId }));
const context = computed(() =>
    account.profile?.id && scope.value.organizationId && scope.value.workspaceId
        ? JSON.stringify([account.profile.id, scope.value])
        : ''
);
const facilityId = computed({
    get: () => (typeof route.query.facility === 'string' ? route.query.facility : ''),
    set: (id: string) => {
        void router.replace({
            query: { ...route.query, facility: id || undefined, node: undefined, topology: undefined },
            hash: route.hash,
        });
    },
});
const key = computed(() =>
    source && context.value && facilityId.value ? JSON.stringify([context.value, facilityId.value]) : ''
);
const { data, loading, error, refresh } = useFacilityRead(
    key,
    (signal) => source?.detail(scope.value, facilityId.value, signal) ?? Promise.resolve(undefined)
);
const selectedPosition = ref<StorageNodeDetail>();
watch(
    key,
    () => {
        selectedPosition.value = undefined;
    },
    { flush: 'sync' }
);
watch(
    data,
    () => {
        selectedPosition.value = undefined;
    },
    { flush: 'sync' }
);
function relocate(id: string, node: string) {
    void router.replace({ query: { ...route.query, facility: id, node, topology: undefined }, hash: route.hash });
}
</script>
<template>
    <ResourcePage label="存储浏览" layout="tool">
        <FacilityPicker
            v-if="source && context"
            :key="context"
            v-model="facilityId"
            :scope="scope"
            :context-key="context"
            :label="data?.name"
            class="max-w-xl"
        />
        <p v-if="!source || !context" class="py-8 text-sm text-muted-foreground">请先选择有效工作区后查看存储设施。</p>
        <ReadFeedback :error="error" :loading="loading" :stale="!!data" @retry="refresh" />
        <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在读取设施</p>
        <div
            v-if="selectedPosition"
            role="status"
            class="flex flex-wrap items-center justify-between gap-3 border-y py-3"
        >
            <div class="min-w-0 space-y-1 text-sm">
                <p class="break-words">
                    已选择位置：{{
                        [
                            data?.name,
                            ...selectedPosition.ancestors.map((item) => item.name),
                            selectedPosition.name,
                        ].join(' / ')
                    }}
                </p>
                <CopyableId :value="selectedPosition.id" label="位置 ID" />
            </div>
            <Button
                variant="ghost"
                size="icon-sm"
                use-tooltip
                title="取消位置选择"
                @click="selectedPosition = undefined"
            >
                <X aria-hidden="true" />
            </Button>
        </div>
        <StorageBrowser
            v-if="data"
            :key="JSON.stringify([context, facilityId])"
            :facility="data"
            :context-key="key"
            :workspace-id="scope.workspaceId"
            selectable
            @changed="refresh"
            @relocated="relocate"
            @select-position="selectedPosition = $event"
        />
        <p v-else-if="!facilityId && context" class="py-12 text-center text-sm text-muted-foreground">
            选择设施浏览存储结构和位置。
        </p>
    </ResourcePage>
</template>
