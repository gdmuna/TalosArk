<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { InventoryScope, InventoryReceipt } from '../data/source';
import { useFacilityDataSource, useFacilityRead } from '@/module/facility';
import { FacilityPicker, FacilityReadFeedback } from '@/module/facility/ui';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';

const props = defineProps<{ scope: InventoryScope; initialPosition?: InventoryReceipt['position'] }>();
const selected = defineModel<{ facilityId: string; topologyId: string; nodeId: string; path: string }>();
const source = useFacilityDataSource();
const facilityId = ref(props.initialPosition?.facilityId ?? '');
const candidateId = ref(props.initialPosition?.nodeId ?? '');
const search = ref('');
const draft = ref('');
const cursor = ref<string>();
const history = ref<(string | undefined)[]>([]);
const key = computed(() => (source && facilityId.value ? JSON.stringify([props.scope, facilityId.value]) : ''));
const facility = useFacilityRead(
    key,
    (signal) => source?.detail(props.scope, facilityId.value, signal) ?? Promise.resolve(undefined)
);
const storageScope = computed(() =>
    facility.data.value?.topology
        ? {
              ...props.scope,
              facilityId: facility.data.value.id,
              topologyId: facility.data.value.topology.id,
          }
        : null
);
const positionKey = computed(() =>
    storageScope.value ? JSON.stringify([storageScope.value, search.value, cursor.value]) : ''
);
const positions = useFacilityRead(positionKey, (signal) =>
    source && storageScope.value
        ? source.children(
              storageScope.value,
              {
                  parentId: null,
                  mode: 'positions',
                  state: 'active',
                  q: search.value,
                  limit: 100,
                  cursor: cursor.value,
              },
              signal
          )
        : Promise.resolve(undefined)
);
const items = computed(
    () => positions.data.value?.items.filter((item) => item.kind === 'POSITION' && item.usable) ?? []
);
const candidate = useFacilityRead(
    computed(() =>
        storageScope.value && candidateId.value ? JSON.stringify([storageScope.value, candidateId.value]) : ''
    ),
    (signal) =>
        source && storageScope.value
            ? source.node(storageScope.value, candidateId.value, signal)
            : Promise.resolve(undefined)
);
watch(
    [candidate.data, candidate.error, candidate.loading, facility.loading, facility.error],
    ([node, error, loading, facilityLoading, facilityError]) => {
        selected.value =
            node?.usable && !error && !loading && !facilityLoading && !facilityError
                ? {
                      facilityId: node.facilityId,
                      topologyId: node.topologyId,
                      nodeId: node.id,
                      path: [facility.data.value?.name, ...node.ancestors.map((ancestor) => ancestor.name), node.name]
                          .filter(Boolean)
                          .join(' / '),
                  }
                : undefined;
    },
    { flush: 'sync' }
);
watch(facilityId, () => {
    candidateId.value = '';
    selected.value = undefined;
    search.value = draft.value = '';
});
watch(
    [facilityId, search],
    () => {
        cursor.value = undefined;
        history.value = [];
    },
    { flush: 'sync' }
);
function next() {
    if (!positions.data.value?.nextCursor) return;
    history.value.push(cursor.value);
    cursor.value = positions.data.value.nextCursor;
}
function previous() {
    if (history.value.length) cursor.value = history.value.pop();
}
</script>

<template>
    <div class="space-y-3">
        <FacilityPicker
            v-model="facilityId"
            :scope="scope"
            context-key="inventory-receipt"
            :label="facility.data.value?.name"
        />
        <FacilityReadFeedback
            :error="facility.error.value"
            :loading="facility.loading.value"
            @retry="facility.refresh"
        />
        <template v-if="storageScope">
            <div class="flex gap-2">
                <Input
                    v-model="draft"
                    aria-label="搜索存储位置"
                    placeholder="搜索位置名称或编号"
                    @keydown.enter.prevent="search = draft.trim()"
                />
                <Button type="button" variant="outline" @click="search = draft.trim()">搜索</Button>
            </div>
            <FacilityReadFeedback
                :error="positions.error.value"
                :loading="positions.loading.value"
                @retry="positions.refresh"
            />
            <div class="max-h-48 space-y-1 overflow-y-auto rounded-md border p-1">
                <Button
                    v-for="item in items"
                    :key="item.id"
                    type="button"
                    variant="ghost"
                    class="h-auto min-h-9 w-full justify-start whitespace-normal text-left"
                    :class="{ 'bg-primary-soft text-primary': candidateId === item.id }"
                    @click="candidateId = item.id"
                >
                    {{ [item.name, item.code].filter(Boolean).join(' · ') }}
                </Button>
                <p v-if="!positions.loading.value && !items.length" class="p-3 text-sm text-muted-foreground">
                    本批暂无可用的空位置
                </p>
            </div>
            <FacilityReadFeedback
                :error="candidate.error.value"
                :loading="candidate.loading.value"
                @retry="candidate.refresh"
            />
            <p v-if="candidate.loading.value" role="status" class="text-sm text-muted-foreground">正在核对位置</p>
            <p
                v-else-if="candidate.data.value && !candidate.data.value.usable"
                role="status"
                class="text-sm text-muted-foreground"
            >
                该位置当前不可用，请重新选择。
            </p>
            <div class="flex justify-end gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    :disabled="positions.loading.value || !history.length"
                    @click="previous"
                >
                    上一批位置
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    :disabled="positions.loading.value || !positions.data.value?.nextCursor"
                    @click="next"
                >
                    下一批位置
                </Button>
            </div>
        </template>
    </div>
</template>
