<template>
    <div class="flex flex-col min-h-0 min-w-0 bg-background border-l border-t rounded-tl-2xl shadow-sm">
        <div class="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4 lg:px-6">
            <div class="flex min-w-0 flex-1 items-center gap-4">
                <div class="flex shrink-0 items-center">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        use-tooltip
                        :title="sidebarExpanded ? '收起侧栏' : '展开侧栏'"
                        :aria-label="sidebarExpanded ? '收起侧栏' : '展开侧栏'"
                        :aria-expanded="sidebarExpanded"
                        aria-controls="application-sidebar"
                        @click="emit('toggle-sidebar')"
                    >
                        <MorphIcon
                            :icon="sidebarExpanded ? PanelLeftClose : PanelLeftOpen"
                            spring="snappy"
                            :stroke-width="lucideProps.strokeWidth"
                            class="size-5"
                            aria-hidden="true"
                        />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        use-tooltip
                        title="后退"
                        aria-label="后退"
                        :disabled="!navigation.canBack"
                        @click="navigation.back"
                    >
                        <ArrowLeft class="size-5" aria-hidden="true" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        use-tooltip
                        class="p-1"
                        title="前进"
                        aria-label="前进"
                        :disabled="!navigation.canForward"
                        @click="navigation.forward"
                    >
                        <ArrowRight class="size-5" aria-hidden="true" />
                    </Button>
                </div>
                <span class="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
                <BreadcrumbTrail :entries="breadcrumbs" />
            </div>
            <div class="flex shrink-0">
                <div class="flex *:size-9">
                    <Button variant="ghost" size="icon" disabled title="通知中心暂未开放" aria-label="通知中心暂未开放">
                        <span class="sr-only">通知中心暂未开放</span>
                        <Bell aria-hidden="true" class="size-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        use-tooltip
                        title="帮助"
                        @click="applicationSetting.show('help')"
                    >
                        <span class="sr-only">帮助</span>
                        <CircleQuestionMark aria-hidden="true" class="size-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        use-tooltip
                        title="应用设置"
                        @click="applicationSetting.show('general')"
                    >
                        <span class="sr-only">应用设置</span>
                        <Settings aria-hidden="true" class="size-5" />
                    </Button>
                </div>
                <UserMenu />
            </div>
        </div>
        <DataSyncStatus />
        <slot />
    </div>
</template>

<script setup lang="ts">
import { provideRouteTabContext, useRouteTab } from '@/component/route-tab';
import { BreadcrumbTrail, provideBreadcrumbContext } from '@/component/breadcrumb';
import { matchesRoutePath } from '@/shared/util';
import { useNavigationStore } from '@/platform/navigation';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { Button } from '@/ui/button';
import { UserMenu } from '@/layout/user-menu';
import { useApplicationSetting } from '../application-setting/context';
import DataSyncStatus from './DataSyncStatus.vue';

import { MorphIcon } from 'morphicons/vue';

import { PanelLeftClose, PanelLeftOpen } from 'lucide';
import { ArrowLeft, ArrowRight, Bell, CircleQuestionMark, Settings, useLucideProps } from '@lucide/vue';

const lucideProps = useLucideProps();

const props = defineProps<{
    sectionLabel: string;
    sectionPath: string;
    sidebarExpanded: boolean;
}>();

const emit = defineEmits<{ 'toggle-sidebar': [] }>();
const applicationSetting = useApplicationSetting();
provideRouteTabContext();
const { tabEntity } = useRouteTab();
const route = useRoute();
const activeTab = computed(() =>
    tabEntity.value.find((item) => matchesRoutePath(route.path, { type: 'prefix', value: item.value.path }))
);
const breadcrumbs = provideBreadcrumbContext(() => [
    { id: 'section', label: props.sectionLabel, to: props.sectionPath },
    { id: 'page', label: String(route.meta.pageLabel ?? activeTab.value?.value.label ?? props.sectionLabel) },
]);

const navigation = useNavigationStore();
</script>

<style scoped></style>
