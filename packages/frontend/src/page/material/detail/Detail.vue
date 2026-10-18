<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Material } from '@talos-ark/contracts/material';
import { useRoute } from 'vue-router';
import { Archive, ArchiveRestore, FlaskConical, Pencil, Boxes, Clock, Tag } from '@lucide/vue';
import { useMaterialRead, useMaterialStore, MaterialFacts, MaterialEditor } from '@/module/material';
import { useNavigationStore } from '@/platform/navigation';
import { useWorkspaceStore } from '@/module/workspace';
import { provideBreadcrumbs } from '@/component/breadcrumb';
import { Button } from '@/ui/button';
import ResourceDetailPage from '../../resource/ResourceDetailPage.vue';
import ResourceObjectHeader from '../../resource/ResourceObjectHeader.vue';
import ResourceViewNav from '../../resource/ResourceViewNav.vue';
import ResourceSection from '../../resource/ResourceSection.vue';
import ResourceEmpty from '../../resource/ResourceEmpty.vue';
import ResourceFile from '../../resource/ResourceFile.vue';
import { useResourceView } from '../../resource/useResourceView';

const route = useRoute(),
    store = useMaterialStore(),
    navigation = useNavigationStore();
const workspace = useWorkspaceStore();
const id = computed(() => String(route.params.resourceId));
const { data, loading, error, reload } = useMaterialRead(
    (context, signal) => context.source.get(context.scope, id.value, signal),
    [id]
);
const material = computed(() => data.value?.material);
const editorOpen = ref(false);
const editing = ref<Material>();
function edit() {
    editing.value = material.value;
    editorOpen.value = !!editing.value;
}
watch(data, (value) => {
    if (value) store.capabilities = value.capabilities;
});
const returnTo = computed(() => navigation.lastLocation('/main/material/list'));
provideBreadcrumbs(() => [
    { id: 'material-list', label: '材料列表', to: returnTo.value },
    { id: 'material', label: material.value?.name ?? '材料详情' },
]);
const tabs = [
    { id: 'overview', label: '概览' },
    { id: 'instance', label: '实例与库存' },
    { id: 'file', label: '文件' },
    { id: 'activity', label: '动态' },
];
const { view, select } = useResourceView(tabs.map((item) => item.id));
</script>
<template>
    <ResourceDetailPage label="材料详情">
        <template #header>
            <ResourceObjectHeader
                :id="id"
                :title="material?.name ?? '材料详情'"
                :icon="FlaskConical"
                :status="material ? (material.archivedAt ? '已归档' : '有效') : undefined"
                :back-to="returnTo"
                back-label="材料列表"
            >
                <Button
                    variant="outline"
                    :disabled="!data?.capabilities.update || !material || !!material.archivedAt || store.busy"
                    @click="edit"
                >
                    <Pencil />
                    编辑材料
                </Button>
                <Button
                    variant="outline"
                    :disabled="
                        !data?.capabilities.archive ||
                        !material ||
                        store.busy ||
                        (!!material?.archivedAt && !!material?.type.archivedAt)
                    "
                    @click="material && store.archive(material)"
                >
                    <component :is="material?.archivedAt ? ArchiveRestore : Archive" />
                    {{ material?.archivedAt ? '恢复材料' : '归档材料' }}
                </Button>
            </ResourceObjectHeader>
            <ResourceViewNav v-if="material" :items="tabs" :active="view" label="材料详情视图" @select="select" />
        </template>
        <div v-if="error" role="alert" class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
            <p class="text-sm text-destructive">{{ error }}</p>
            <Button variant="outline" @click="reload">重新加载</Button>
        </div>
        <ResourceEmpty v-else-if="loading" text="正在加载材料" />
        <ResourceEmpty v-else-if="!material" text="当前工作区没有可访问的材料" />
        <template v-else>
            <p v-if="store.error" role="alert" class="text-sm text-destructive">{{ store.error }}</p>
            <div
                v-if="view === 'overview'"
                class="grid min-w-0 gap-8 @min-[1000px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
            >
                <MaterialFacts :material="material" />
                <aside class="min-w-0 space-y-7">
                    <ResourceSection title="登记实例">
                        <div class="flex items-center gap-4 py-2">
                            <Boxes class="size-6 text-primary" />
                            <span class="text-3xl font-semibold tabular-nums">{{ material.instanceCount }}</span>
                        </div>
                        <Button variant="outline" class="w-full" @click="select('instance')">查看实例与库存</Button>
                    </ResourceSection>
                    <ResourceSection title="所属工作区">
                        <p class="text-sm">{{ workspace.current?.name }}</p>
                    </ResourceSection>
                    <ResourceSection title="相关信息">
                        <div class="divide-y">
                            <Button
                                variant="ghost"
                                class="h-12 w-full justify-start rounded-none px-0"
                                @click="select('file')"
                            >
                                <Tag />
                                材料附件
                            </Button>
                            <Button
                                variant="ghost"
                                class="h-12 w-full justify-start rounded-none px-0"
                                @click="select('activity')"
                            >
                                <Clock />
                                材料动态
                            </Button>
                        </div>
                    </ResourceSection>
                </aside>
            </div>
            <ResourceSection v-else-if="view === 'instance'" title="实例与库存">
                <p class="text-sm">已登记 {{ material.instanceCount }} 个实体实例。</p>
                <ResourceEmpty text="实例登记和库存查询尚未接入" />
            </ResourceSection>
            <ResourceFile v-else-if="view === 'file'" />
            <ResourceSection v-else title="材料动态"><ResourceEmpty text="动态查询尚未接入" /></ResourceSection>
        </template>
        <MaterialEditor v-model:open="editorOpen" :material="editing" />
    </ResourceDetailPage>
</template>
