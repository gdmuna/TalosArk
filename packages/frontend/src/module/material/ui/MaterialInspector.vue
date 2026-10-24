<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { Archive, ArchiveRestore, ArrowUpRight, Pencil } from '@lucide/vue';
import type { Material } from '@talos-ark/contracts/material';
import { useMaterialRead } from '../model/useMaterialRead';
import { useMaterialStore } from '../model/store';
import MaterialFacts from './MaterialFacts.vue';
import MaterialEditor from './MaterialEditor.vue';
import { SheetInspector, CopyableId } from '@/component/inspector';
import { StateBadge } from '@/component/state-badge';
import { ScrollArea } from '@/ui/scroll-area';
import { Button } from '@/ui/button';

const id = defineModel<string>('id', { default: '' });
const store = useMaterialStore();
const { data, loading, error, reload } = useMaterialRead(
    (context, signal) => (id.value ? context.source.get(context.scope, id.value, signal) : Promise.resolve(undefined)),
    [id]
);
const selected = computed(() => data.value?.material);
const open = computed({
    get: () => !!id.value,
    set: (value) => {
        if (!value) id.value = '';
    },
});
const editing = ref<Material>();
const editorOpen = ref(false);
watch(
    () => store.scope,
    () => {
        id.value = '';
    },
    { flush: 'sync' }
);
function edit() {
    editing.value = selected.value;
    editorOpen.value = !!editing.value;
}
</script>

<template>
    <SheetInspector v-model:open="open" :title="selected?.name ?? '材料预览'" description="材料基本事实">
        <ScrollArea class="min-h-0 flex-1">
            <div class="@container space-y-6 p-6 pr-10">
                <p v-if="loading && !selected" role="status" class="text-sm text-muted-foreground">正在加载材料</p>
                <div v-if="error" role="alert" class="space-y-3 text-sm">
                    <p class="text-destructive">{{ error }}</p>
                    <Button variant="outline" @click="reload">重新加载</Button>
                </div>
                <template v-if="selected">
                    <header class="space-y-2">
                        <h2 class="break-words text-lg font-semibold">{{ selected.name }}</h2>
                        <CopyableId :value="selected.id" label="材料 ID" />
                        <StateBadge :tone="selected.archivedAt ? 'neutral' : 'success'">
                            {{ selected.archivedAt ? '已归档' : '有效' }}
                        </StateBadge>
                    </header>
                    <MaterialFacts :material="selected" compact />
                    <div class="border-t pt-4 text-sm">
                        <span class="text-muted-foreground">登记实例</span>
                        <span class="ml-4 tabular-nums">{{ selected.instanceCount }}</span>
                    </div>
                </template>
            </div>
        </ScrollArea>
        <div v-if="selected" class="flex shrink-0 flex-wrap gap-2 border-t p-6">
            <Button class="flex-1" as-child>
                <RouterLink :to="`/main/material/detail/${selected.id}`">
                    <ArrowUpRight aria-hidden="true" />
                    完整详情
                </RouterLink>
            </Button>
            <Button
                variant="outline"
                :disabled="!data?.capabilities.update || !!selected.archivedAt || store.busy"
                @click="edit"
            >
                <Pencil aria-hidden="true" />
                编辑
            </Button>
            <Button
                variant="outline"
                :disabled="
                    !data?.capabilities.archive || store.busy || (!!selected.archivedAt && !!selected.type.archivedAt)
                "
                @click="store.archive(selected)"
            >
                <component :is="selected.archivedAt ? ArchiveRestore : Archive" aria-hidden="true" />
                {{ selected.archivedAt ? '恢复' : '归档' }}
            </Button>
        </div>
    </SheetInspector>
    <MaterialEditor v-model:open="editorOpen" :material="editing" />
</template>
