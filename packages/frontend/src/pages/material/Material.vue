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
            path: '/main/material/overview',
        },
    },
    {
        id: 'list',
        value: {
            disabled: false,
            label: '材料列表',
            path: '/main/material/list',
        },
    },
    {
        id: 'culture',
        value: {
            disabled: false,
            label: '培养物',
            path: '/main/material/culture',
        },
    },
]);
</script>

<style scoped></style>
