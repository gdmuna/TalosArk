<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ChevronRight, Box, MapPin } from '@lucide/vue';
import { useFacilityDataSource } from '../model/read';
import { useStorageNodePages } from '../model/useStorageNodePages';
import { assertStorageNode } from '../data/validation';
import type { StorageScope } from '../data/source';
import { HttpError } from '@/platform/http';
import { Button } from '@/ui/button';
import ReadFeedback from './ReadFeedback.vue';
const props = defineProps<{
    scope: StorageScope;
    parentId: string | null;
    contextKey: string;
    selected: string;
    ancestors: string[];
    lineage?: string[];
}>();
defineEmits<{ select: [id: string] }>();
const source = useFacilityDataSource();
const expanded = ref<string[]>([]),
    collapsed = ref<string[]>([]);
const key = computed(() =>
    source && props.contextKey ? JSON.stringify([props.contextKey, props.scope, props.parentId]) : ''
);
watch(
    key,
    () => {
        expanded.value = [];
        collapsed.value = [];
    },
    { flush: 'sync' }
);
const { data, loading, error, reload, more } = useStorageNodePages(key, async (cursor, signal) => {
    if (!source) return;
    const scope = props.scope,
        parentId = props.parentId;
    const result = await source.children(scope, { parentId, cursor, limit: 50, state: 'all' }, signal);
    result.items.forEach((item) => {
        assertStorageNode(scope, item);
        if (item.parentId !== parentId || item.id === parentId || props.lineage?.includes(item.id))
            throw new HttpError('节点父子关系无效', 'protocol');
    });
    if (result.nextCursor && !result.items.length) throw new HttpError('节点分页已失效，请重新加载', 'protocol');
    return result;
});
function isExpanded(id: string) {
    return !collapsed.value.includes(id) && (expanded.value.includes(id) || props.ancestors.includes(id));
}
function toggle(id: string) {
    if (isExpanded(id)) {
        collapsed.value = [...collapsed.value, id];
        expanded.value = expanded.value.filter((item) => item !== id);
    } else {
        collapsed.value = collapsed.value.filter((item) => item !== id);
        expanded.value = [...expanded.value, id];
    }
}
</script>
<template>
    <div class="min-w-0 space-y-2">
        <ReadFeedback :error="error" :loading="loading" :stale="!!data" @retry="reload" />
        <p v-if="loading" role="status" class="px-2 text-xs text-muted-foreground">正在读取节点</p>
        <p v-else-if="data && !data.items.length" class="px-2 py-3 text-sm text-muted-foreground">没有子节点</p>
        <ul v-if="data" class="min-w-0 space-y-1">
            <li v-for="node in data.items" :key="node.id" class="min-w-0">
                <div
                    class="flex min-w-0 items-center rounded-sm"
                    :class="selected === node.id ? 'bg-primary-soft text-primary' : 'hover:bg-muted/60'"
                >
                    <Button
                        v-if="node.hasChildren"
                        variant="ghost"
                        size="icon-sm"
                        class="size-7 shrink-0"
                        use-tooltip
                        :tooltip="`${isExpanded(node.id) ? '收起' : '展开'}${node.name}`"
                        :aria-expanded="isExpanded(node.id)"
                        @click="toggle(node.id)"
                    >
                        <ChevronRight
                            class="size-3.5 transition-transform"
                            :class="{ 'rotate-90': isExpanded(node.id) }"
                            aria-hidden="true"
                        />
                    </Button>
                    <span v-else class="w-7 shrink-0" aria-hidden="true" />
                    <button
                        class="flex min-w-0 flex-1 items-start gap-2 py-2 pr-2 text-left text-sm"
                        :aria-current="selected === node.id ? 'true' : undefined"
                        @click="$emit('select', node.id)"
                    >
                        <component
                            :is="node.kind === 'POSITION' ? MapPin : Box"
                            class="mt-0.5 size-4 shrink-0"
                            aria-hidden="true"
                        />
                        <span class="min-w-0">
                            <span class="block break-words">{{ node.name }}</span>
                            <span
                                v-if="node.code || node.archivedAt || node.disabledAt"
                                class="block break-all text-xs text-muted-foreground"
                            >
                                {{
                                    [node.code, node.archivedAt ? '已归档' : node.disabledAt ? '已停用' : '']
                                        .filter(Boolean)
                                        .join(' · ')
                                }}
                            </span>
                        </span>
                    </button>
                </div>
                <StorageBranch
                    v-if="isExpanded(node.id)"
                    class="ml-3 border-l pl-2"
                    :scope="scope"
                    :parent-id="node.id"
                    :context-key="contextKey"
                    :selected="selected"
                    :ancestors="ancestors"
                    :lineage="[...(lineage ?? []), node.id]"
                    @select="$emit('select', $event)"
                />
            </li>
        </ul>
        <Button v-if="data?.nextCursor" variant="ghost" size="sm" :disabled="loading || !!error" @click="more">
            加载更多节点
        </Button>
    </div>
</template>
