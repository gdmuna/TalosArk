<template>
    <RouterTabBar />
    <ScrollArea type="auto" class="min-h-0 flex-1 scroll-smooth">
        <RouterView />
    </ScrollArea>
</template>

<script setup lang="ts">
import { RouterTabBar, useRouteTab } from '@/modules/routerTab';
import { ScrollSurface as ScrollArea } from '@/modules/scroll-surface';

const { setEntity } = useRouteTab();

setEntity([
    {
        id: 'overview',
        value: {
            disabled: false,
            label: '概览',
            path: '/main/equipment/overview',
        },
    },
    {
        id: 'list',
        value: {
            disabled: false,
            label: '设备列表',
            path: '/main/equipment/list',
        },
    },
]);
</script>

<style scoped></style>
