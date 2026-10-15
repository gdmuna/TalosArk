<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight, Boxes, ClipboardCheck, FilePlus2, FlaskConical, Package, Plus } from '@lucide/vue';
import { Button } from '@/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';
import ResourceSection from '../resource/ResourceSection.vue';
import { useMaterialSummary } from './useMaterialSummary';

const router = useRouter();
const { materials, instancesByMaterial, distribution, unclassified } = useMaterialSummary();
const linkedInstanceCount = computed(() =>
    materials.value.reduce((count, item) => count + (instancesByMaterial.value.get(item.id)?.length ?? 0), 0)
);
const typeCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const item of materials.value) {
        if (item.material) counts.set(item.material.type, (counts.get(item.material.type) ?? 0) + 1);
    }
    return [...counts].map(([label, count]) => ({ label, count }));
});
const quickActions = [
    { label: '新建材料', icon: Plus },
    { label: '登记批次', icon: FilePlus2 },
    { label: '录入库存实例', icon: Boxes },
    { label: '查看耗材台账', icon: Package, path: '/main/material/list?branch=consumable' },
    { label: '登记检验', icon: ClipboardCheck },
];
function openList(branch?: string) {
    return router.push({ path: '/main/material/list', query: branch ? { branch } : {} });
}
</script>

<template>
    <main aria-label="材料概览" class="w-full min-w-0 px-4 pb-6 lg:px-6">
        <div class="@container mx-auto w-full max-w-[1200px] space-y-7">
            <div class="flex flex-wrap gap-4">
                <div
                    class="flex max-w-[340px] flex-1 basis-[220px] items-center gap-4 rounded-md border bg-card p-5 shadow-sm"
                >
                    <div
                        class="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground"
                    >
                        <FlaskConical class="size-6" aria-hidden="true" />
                    </div>
                    <div>
                        <p class="text-sm text-muted-foreground">材料总数</p>
                        <p class="mt-1 text-2xl font-semibold tabular-nums">{{ materials.length }}</p>
                    </div>
                </div>
                <div
                    class="flex max-w-[340px] flex-1 basis-[220px] items-center gap-4 rounded-md border bg-card p-5 shadow-sm"
                >
                    <div
                        class="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                    >
                        <Boxes class="size-6" aria-hidden="true" />
                    </div>
                    <div>
                        <p class="text-sm text-muted-foreground">关联库存实例</p>
                        <p class="mt-1 text-2xl font-semibold tabular-nums">{{ linkedInstanceCount }}</p>
                    </div>
                </div>
                <div
                    class="flex max-w-[340px] flex-1 basis-[220px] items-center gap-4 rounded-md border bg-card p-5 shadow-sm"
                >
                    <div
                        class="flex size-11 shrink-0 items-center justify-center rounded-md bg-caution-soft text-caution-soft-foreground"
                    >
                        <ClipboardCheck class="size-6" aria-hidden="true" />
                    </div>
                    <div>
                        <p class="text-sm text-muted-foreground">待检验材料</p>
                        <p class="mt-1 text-2xl font-semibold" aria-label="检验统计未加载">—</p>
                    </div>
                </div>
            </div>

            <div class="grid min-w-0 gap-x-8 gap-y-8 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <ResourceSection title="最近材料变更">
                    <template #actions>
                        <Button variant="ghost" size="sm" @click="openList()">
                            查看材料
                            <ArrowRight aria-hidden="true" />
                        </Button>
                    </template>
                    <Table class="min-w-[590px]" container-class="scroll-smooth">
                        <TableHeader>
                            <TableRow class="hover:bg-transparent">
                                <TableHead>时间</TableHead>
                                <TableHead>变更类型</TableHead>
                                <TableHead>名称</TableHead>
                                <TableHead>ID</TableHead>
                                <TableHead>操作人</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow class="hover:bg-transparent">
                                <TableCell :colspan="5" class="h-56 text-center text-muted-foreground">
                                    材料变更记录未加载
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </ResourceSection>

                <ResourceSection title="材料分支分布">
                    <template #actions>
                        <Button variant="ghost" size="sm" @click="openList()">
                            查看全部
                            <ArrowRight aria-hidden="true" />
                        </Button>
                    </template>
                    <div class="space-y-5 py-2">
                        <button
                            v-for="branch in distribution"
                            :key="branch.id"
                            class="group grid w-full grid-cols-[7rem_minmax(0,1fr)_4.5rem] items-center gap-3 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-ring"
                            :aria-label="`查看${branch.label}，${branch.count} 项`"
                            @click="openList(branch.id)"
                        >
                            <span class="flex items-center gap-2 text-sm font-medium group-hover:underline">
                                <span class="size-2 shrink-0 rounded-full" :style="{ backgroundColor: branch.color }" />
                                {{ branch.label }}
                            </span>
                            <span class="h-2.5 overflow-hidden rounded-sm bg-muted" aria-hidden="true">
                                <span
                                    class="block h-full rounded-sm"
                                    :style="{
                                        width: `${materials.length ? (branch.count / materials.length) * 100 : 0}%`,
                                        backgroundColor: branch.color,
                                    }"
                                />
                            </span>
                            <span class="text-right text-sm tabular-nums">
                                {{ branch.count }}
                                <span class="ml-1 text-xs text-muted-foreground">
                                    {{ materials.length ? Math.round((branch.count / materials.length) * 100) : 0 }}%
                                </span>
                            </span>
                        </button>
                        <p v-if="unclassified" class="text-sm text-muted-foreground">未分类 {{ unclassified }} 项</p>
                    </div>
                    <div class="border-t pt-3">
                        <p class="mb-3 text-xs text-muted-foreground">材料类型</p>
                        <div class="flex flex-wrap gap-x-5 gap-y-3">
                            <span v-for="type in typeCounts" :key="type.label" class="text-sm">
                                {{ type.label }}
                                <span class="ml-2 text-muted-foreground tabular-nums">{{ type.count }}</span>
                            </span>
                        </div>
                    </div>
                </ResourceSection>

                <ResourceSection title="待检验材料">
                    <Table class="min-w-[650px]" container-class="scroll-smooth">
                        <TableHeader>
                            <TableRow class="hover:bg-transparent">
                                <TableHead>名称</TableHead>
                                <TableHead>类型</TableHead>
                                <TableHead>ID</TableHead>
                                <TableHead>关联批次 / 实例</TableHead>
                                <TableHead>提交时间</TableHead>
                                <TableHead>状态</TableHead>
                                <TableHead>操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow class="hover:bg-transparent">
                                <TableCell :colspan="7" class="h-56 text-center text-muted-foreground">
                                    材料检验记录未加载
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </ResourceSection>

                <ResourceSection title="快捷操作">
                    <div class="divide-y">
                        <Button
                            v-for="action in quickActions"
                            :key="action.label"
                            variant="ghost"
                            class="h-13 w-full justify-start rounded-none px-2"
                            :disabled="!action.path"
                            @click="action.path && router.push(action.path)"
                        >
                            <component :is="action.icon" class="size-5 shrink-0" aria-hidden="true" />
                            <span>{{ action.label }}</span>
                            <ArrowRight class="ml-auto" aria-hidden="true" />
                        </Button>
                    </div>
                </ResourceSection>
            </div>
        </div>
    </main>
</template>
