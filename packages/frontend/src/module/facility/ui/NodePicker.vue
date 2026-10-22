<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Search } from '@lucide/vue';
import { useFacilityDataSource, useFacilityRead } from '../model/read';
import type { StorageScope, StorageNode } from '../data/source';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { HttpError } from '@/platform/http';
import ReadFeedback from './ReadFeedback.vue';
import { FieldLegend, FieldSet } from '@/ui/field';

const props = defineProps<{
    scope: StorageScope;
    contextKey: string;
    parentId?: string | null;
    exclude?: string;
    label: string;
    rootLabel: string;
}>();
const model = defineModel<string | null>({ required: true });
const source = useFacilityDataSource();
const draft = ref(''),
    query = ref(''),
    cursor = ref<string>();
const rows = ref<StorageNode[]>([]);
let revision: number | undefined;
const context = computed(() => JSON.stringify([props.contextKey, props.scope, props.parentId, query.value]));
watch(
    context,
    () => {
        cursor.value = undefined;
        rows.value = [];
        revision = undefined;
    },
    { flush: 'sync' }
);
const key = computed(() => (source && props.contextKey && props.scope.topologyId ? context.value : ''));
const { data, loading, error, refresh } = useFacilityRead(key, async (signal) => {
    if (!source) return;
    const requestedCursor = cursor.value;
    const result = await source.children(
        props.scope,
        {
            parentId: props.parentId ?? null,
            mode: props.parentId === undefined ? 'search' : 'children',
            q: query.value,
            state: 'active',
            cursor: requestedCursor,
            limit: 50,
        },
        signal
    );
    if (requestedCursor && (revision !== result.revision || result.nextCursor === requestedCursor))
        throw new HttpError('布局已改变，请重新加载', 'protocol');
    return result;
});
watch(data, (value) => {
    if (!value) {
        rows.value = [];
        revision = undefined;
        cursor.value = undefined;
        return;
    }
    rows.value = cursor.value
        ? [...rows.value, ...value.items.filter((item) => !rows.value.some((row) => row.id === item.id))]
        : value.items;
    revision = value.revision;
});
const choices = computed(() =>
    rows.value.filter(
        (item) =>
            item.id !== props.exclude &&
            (props.parentId !== undefined || item.kind === 'CONTAINER') &&
            !item.archivedAt &&
            !item.disabledAt
    )
);
function reload() {
    cursor.value = undefined;
    rows.value = [];
    revision = undefined;
    void refresh();
}
function more() {
    cursor.value = data.value?.nextCursor ?? undefined;
    void refresh();
}
</script>
<template>
    <FieldSet>
        <FieldLegend class="mb-2 font-medium">{{ label }}</FieldLegend>
        <div class="flex gap-2">
            <Input
                v-model="draft"
                aria-label="搜索节点"
                placeholder="搜索节点名称或编号"
                maxlength="160"
                @keydown.enter.prevent="query = draft.trim()"
            />
            <Button
                type="button"
                variant="outline"
                size="icon-sm"
                use-tooltip
                title="搜索节点"
                @click="query = draft.trim()"
            >
                <Search aria-hidden="true" />
            </Button>
        </div>
        <ReadFeedback :error="error" :loading="loading" @retry="reload" />
        <div class="max-h-48 space-y-1 overflow-y-auto rounded-md border p-1">
            <Button
                type="button"
                variant="ghost"
                class="w-full justify-start"
                :class="{ 'bg-primary-soft text-primary': model === null }"
                @click="model = null"
            >
                {{ rootLabel }}
            </Button>
            <Button
                v-for="item in choices"
                :key="item.id"
                type="button"
                variant="ghost"
                class="h-auto min-h-9 w-full justify-start whitespace-normal text-left"
                :class="{ 'bg-primary-soft text-primary': model === item.id }"
                @click="model = item.id"
            >
                {{ item.name }} · {{ item.code }}
            </Button>
            <Button v-if="data?.nextCursor" type="button" variant="link" :disabled="loading || !!error" @click="more">
                加载更多节点
            </Button>
        </div>
        <p class="break-all text-xs text-muted-foreground">
            {{ model ? `已选择：${choices.find((item) => item.id === model)?.name ?? model}` : rootLabel }}
        </p>
    </FieldSet>
</template>
