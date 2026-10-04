<template>
    <div class="flex flex-col min-h-0 min-w-0 bg-background border-l border-t rounded-tl-2xl">
        <div class="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4 lg:px-6">
            <div class="flex min-w-0 items-center gap-4">
                <div class="flex shrink-0 items-center">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        use-tooltip
                        :title="open ? '收起侧栏' : '展开侧栏'"
                        :aria-label="open ? '收起侧栏' : '展开侧栏'"
                        :aria-expanded="open"
                        @click="toggleSidebar"
                    >
                        <component
                            :is="open ? PanelLeftClose : PanelLeftOpen"
                            class="size-5"
                            stroke-width="1.5"
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
                        <ArrowLeft class="size-5" stroke-width="1.5" aria-hidden="true" />
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
                        <ArrowRight class="size-5" stroke-width="1.5" aria-hidden="true" />
                    </Button>
                </div>
                <span class="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
                <nav aria-label="当前位置" class="flex min-w-0 items-center gap-3 text-base font-medium">
                    <RouterLink :to="sectionPath" class="shrink-0 text-muted-foreground hover:text-foreground">
                        {{ sectionLabel }}
                    </RouterLink>
                    <span class="text-muted-foreground" aria-hidden="true">/</span>
                    <span class="truncate text-primary" aria-current="page">{{ activeTab?.value.label }}</span>
                </nav>
            </div>
            <div class="flex min-w-0">
                <div class="flex *:size-9">
                    <Button variant="ghost" size="icon" use-tooltip title="通知">
                        <span class="sr-only">通知</span>
                        <Bell aria-hidden="true" class="size-5" stroke-width="1.5" />
                    </Button>
                    <Button variant="ghost" size="icon" use-tooltip title="帮助">
                        <span class="sr-only">帮助</span>
                        <CircleQuestionMark aria-hidden="true" class="size-5" stroke-width="1.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        use-tooltip
                        title="账户设置"
                        @click="accountMenu?.openSettings()"
                    >
                        <span class="sr-only">账户设置</span>
                        <Settings aria-hidden="true" class="size-5" stroke-width="1.5" />
                    </Button>
                </div>
                <UserMenu ref="accountMenu" />
            </div>
        </div>
        <slot />
    </div>
</template>

<script setup lang="ts">
import { provideRouteTabContext, useRouteTab } from '@/modules/routerTab';
import { matchesRoutePath } from '@/shared/utils';
import { useNavigationStore } from '@/shared/stores';
import { computed, useTemplateRef } from 'vue';
import { useRoute } from 'vue-router';

import { Button } from '@/ui/button';
import UserMenu from '@/modules/user-menu/UserMenu.vue';
import { useSidebar } from '@/ui/sidebar';

import { ArrowLeft, ArrowRight, Bell, CircleQuestionMark, Settings, PanelLeftClose, PanelLeftOpen } from '@lucide/vue';

defineProps<{
    sectionLabel: string;
    sectionPath: string;
}>();

const { open, toggleSidebar } = useSidebar();
const accountMenu = useTemplateRef('accountMenu');
provideRouteTabContext();
const { tabEntity } = useRouteTab();
const route = useRoute();
const activeTab = computed(() =>
    tabEntity.value.find((item) => matchesRoutePath(route.path, { type: 'prefix', value: item.value.path }))
);

const navigation = useNavigationStore();
</script>

<style scoped></style>
