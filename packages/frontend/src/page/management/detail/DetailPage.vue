<script setup lang="ts">
import { computed, watchEffect, type Component } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft } from '@lucide/vue';
import { useNavigationStore } from '@/platform/navigation';
import { provideBreadcrumbs } from '@/component/breadcrumb';
import { CopyableId } from '@/component/inspector';
import { ScrollSurface } from '@/component/scroll-surface';
import { Button } from '@/ui/button';
import { StateBadge } from '@/component/state-badge';
import ManagementViewNav from '../component/ManagementViewNav.vue';
import type { ManagementView } from '../useManagementView';
import DetailPicker from './DetailPicker.vue';

const props = defineProps<{
    title: string;
    id: string;
    subtitle?: string;
    icon: Component;
    status?: string;
    listLabel: string;
    listPath: string;
    listTo?: string;
    views: readonly ManagementView[];
    options?: { id: string; name: string }[];
    search?: (
        query: string,
        page: number,
        signal: AbortSignal
    ) => Promise<{ items: { id: string; name: string }[]; total: number }>;
    loading?: boolean;
    error?: string;
}>();
const view = defineModel<string>({ required: true });
const emit = defineEmits<{ select: [id: string]; retry: [] }>();
const route = useRoute(),
    navigation = useNavigationStore();
const origin = computed(() => navigation.origin);
const listTo = computed(() => props.listTo ?? navigation.lastLocation(props.listPath));
watchEffect(() => navigation.setPageLabel(route.path, props.title));
provideBreadcrumbs(() => [
    { id: 'management', label: '管理中心', to: '/main/management' },
    { id: 'list', label: props.listLabel, to: listTo.value },
    {
        id: 'object',
        label: props.title,
        component: DetailPicker,
        props: {
            label: props.title,
            activeId: props.id,
            options: props.options ?? [],
            search: props.search,
            onSelect: (id: string) => emit('select', id),
        },
    },
    { id: 'view', label: props.views.find((item) => item.value === view.value)?.label ?? '概览' },
]);
</script>
<template>
    <div class="flex min-h-0 min-w-0 flex-1 flex-col" data-slot="management-detail-page">
        <header class="shrink-0 space-y-4 border-b px-4 pt-4 lg:px-6" data-slot="management-detail-header">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <Button variant="ghost" size="sm" class="-ml-2" @click="navigation.returnTo(origin, listTo)">
                    <ArrowLeft />
                    {{ origin?.label ?? listLabel }}
                </Button>
            </div>
            <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="flex min-w-0 flex-1 gap-4">
                    <div
                        class="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary"
                    >
                        <component :is="icon" class="size-6" />
                    </div>
                    <div class="min-w-0 space-y-2">
                        <div class="flex flex-wrap items-center gap-3">
                            <h1 class="break-words text-xl font-semibold">{{ title }}</h1>
                            <StateBadge v-if="status" tone="neutral">{{ status }}</StateBadge>
                        </div>
                        <CopyableId :value="id" label="对象 ID" />
                        <p v-if="subtitle" class="break-words text-sm text-muted-foreground">{{ subtitle }}</p>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-2"><slot name="actions" /></div>
            </div>
            <ManagementViewNav v-model="view" :items="views" :label="`${listLabel}详情视图`" />
        </header>
        <ScrollSurface class="min-h-0 flex-1" edge-effect="line">
            <main :aria-label="title" class="@container mx-auto w-full max-w-[1328px] space-y-6 p-4 lg:p-6">
                <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在加载详情</p>
                <div v-if="error" role="alert" class="flex flex-wrap items-center gap-3 text-sm text-destructive">
                    {{ error }}
                    <Button variant="outline" size="sm" @click="emit('retry')">重新加载</Button>
                </div>
                <slot />
            </main>
        </ScrollSurface>
    </div>
</template>
