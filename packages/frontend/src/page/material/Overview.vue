<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Archive, ArrowRight, FlaskConical, PackageCheck, Plus, Package } from '@lucide/vue';
import {
    useMaterialRead,
    useMaterialStore,
    materialBranches,
    branchPresentation,
    materialDate,
    MaterialInspector,
} from '@/module/material';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';
import { Button } from '@/ui/button';
import ResourceSection from '../resource/ResourceSection.vue';

const router = useRouter(),
    store = useMaterialStore();
const selectedId = ref('');
const { data, loading, error, reload } = useMaterialRead((context, signal) =>
    context.source.overview(context.scope, signal)
);
watch(data, (value) => {
    if (value) store.capabilities = value.capabilities;
});
const distribution = computed(() =>
    materialBranches.map((branch) => ({
        ...branch,
        count: data.value?.branches.find((item) => item.branch === branch.id)?.count ?? 0,
    }))
);
const cards = computed(() => [
    {
        label: '材料总数',
        value: data.value?.total,
        icon: FlaskConical,
        tone: 'bg-primary-soft text-primary-soft-foreground',
        state: 'all',
    },
    {
        label: '有效材料',
        value: data.value?.active,
        icon: PackageCheck,
        tone: 'bg-success-soft text-success-soft-foreground',
        state: 'active',
    },
    {
        label: '已归档',
        value: data.value?.archived,
        icon: Archive,
        tone: 'bg-muted text-muted-foreground',
        state: 'archived',
    },
]);
function list(branch?: string) {
    void router.push({ path: '/main/material/list', query: branch ? { branch } : {} });
}
</script>
<template>
    <main aria-label="材料概览" class="w-full min-w-0 px-4 pb-6 lg:px-6">
        <div class="@container mx-auto w-full max-w-[1200px] space-y-7" :aria-busy="loading">
            <div
                v-if="error"
                role="alert"
                class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4"
            >
                <p class="text-sm text-destructive">{{ error }}</p>
                <Button variant="outline" @click="reload">重新加载</Button>
            </div>
            <div class="flex flex-wrap gap-4">
                <button
                    v-for="card in cards"
                    :key="card.label"
                    class="flex w-64 max-w-full items-center gap-3 rounded-lg border bg-card p-4 text-left shadow-xs transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none"
                    :disabled="!data"
                    :aria-label="`查看${card.label}`"
                    @click="router.push({ path: '/main/material/list', query: { state: card.state } })"
                >
                    <div class="flex size-10 shrink-0 items-center justify-center rounded-md" :class="card.tone">
                        <component :is="card.icon" class="size-5" aria-hidden="true" />
                    </div>
                    <div>
                        <p class="text-sm text-muted-foreground">{{ card.label }}</p>
                        <p class="mt-1 text-2xl font-semibold tabular-nums">{{ card.value ?? '—' }}</p>
                    </div>
                </button>
            </div>
            <div class="grid min-w-0 gap-8 @min-[1000px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div class="min-w-0 space-y-7">
                    <ResourceSection title="最近更新的材料">
                        <template #actions>
                            <Button variant="ghost" size="sm" @click="list()">
                                查看全部
                                <ArrowRight />
                            </Button>
                        </template>
                        <Table container-class="scroll-smooth">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>材料</TableHead>
                                    <TableHead>分类</TableHead>
                                    <TableHead>更新时间</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="item in data?.recent ?? []" :key="item.id">
                                    <TableCell>
                                        <button
                                            class="group flex min-w-44 items-center gap-3 text-left"
                                            :aria-label="`预览${item.name}`"
                                            @click="selectedId = item.id"
                                        >
                                            <component
                                                :is="branchPresentation(item.branch).icon"
                                                class="size-5 shrink-0 text-primary"
                                            />
                                            <span class="min-w-0">
                                                <span
                                                    class="block break-words font-medium group-hover:underline group-focus-visible:underline"
                                                >
                                                    {{ item.name }}
                                                </span>
                                                <span class="mt-1 block text-xs text-muted-foreground">
                                                    {{ item.code }}
                                                </span>
                                            </span>
                                        </button>
                                    </TableCell>
                                    <TableCell>{{ item.type.name }}</TableCell>
                                    <TableCell class="whitespace-nowrap text-xs text-muted-foreground">
                                        {{ materialDate(item.updatedAt) }}
                                    </TableCell>
                                </TableRow>
                                <TableRow v-if="!data?.recent.length">
                                    <TableCell :colspan="3" class="h-40 text-center text-muted-foreground">
                                        {{ loading ? '正在加载材料' : error ? '材料加载失败' : '尚未登记材料' }}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </ResourceSection>
                    <ResourceSection title="待检验材料">
                        <p class="py-8 text-sm text-muted-foreground">检验业务尚未接入。</p>
                    </ResourceSection>
                </div>
                <aside class="min-w-0 space-y-7">
                    <ResourceSection title="业务分支分布">
                        <div class="space-y-5 py-2">
                            <button
                                v-for="branch in distribution"
                                :key="branch.id"
                                class="group grid w-full grid-cols-[6rem_minmax(0,1fr)_3rem] items-center gap-3 text-left"
                                @click="list(branch.id)"
                            >
                                <span class="flex items-center gap-2 text-sm group-hover:underline">
                                    <span class="size-2 rounded-full" :style="{ backgroundColor: branch.color }" />
                                    {{ branch.label }}
                                </span>
                                <span class="h-2.5 overflow-hidden rounded-sm bg-muted">
                                    <span
                                        class="block h-full rounded-sm"
                                        :style="{
                                            width: `${data?.active ? (branch.count / data.active) * 100 : 0}%`,
                                            backgroundColor: branch.color,
                                        }"
                                    />
                                </span>
                                <span class="text-right text-sm tabular-nums">{{ data ? branch.count : '—' }}</span>
                            </button>
                        </div>
                    </ResourceSection>
                    <ResourceSection title="常用操作">
                        <div class="divide-y">
                            <Button
                                variant="ghost"
                                class="h-12 w-full justify-between rounded-none px-0"
                                @click="list()"
                            >
                                <span class="flex items-center gap-3">
                                    <FlaskConical />
                                    浏览全部材料
                                </span>
                                <ArrowRight />
                            </Button>
                            <Button
                                variant="ghost"
                                class="h-12 w-full justify-between rounded-none px-0"
                                @click="list('consumable')"
                            >
                                <span class="flex items-center gap-3">
                                    <Package />
                                    查看耗材
                                </span>
                                <ArrowRight />
                            </Button>
                            <Button
                                variant="ghost"
                                class="h-12 w-full justify-between rounded-none px-0"
                                :disabled="!data?.capabilities.create"
                                @click="router.push('/main/material/list?create=1')"
                            >
                                <span class="flex items-center gap-3">
                                    <Plus />
                                    新建材料
                                </span>
                                <ArrowRight />
                            </Button>
                        </div>
                    </ResourceSection>
                </aside>
            </div>
        </div>
        <MaterialInspector v-model:id="selectedId" />
    </main>
</template>
