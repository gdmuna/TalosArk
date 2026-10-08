<template>
    <RouterTabBar>
        <template v-if="route.path === '/main/workbench/overview'" #actions>
            <DropdownMenu>
                <DropdownMenuTrigger as-child>
                    <Button type="button" class="h-10 gap-3 px-4 text-base shadow-none">
                        新建
                        <Plus aria-hidden="true" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-44">
                    <DropdownMenuLabel>新建</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>
                        <FlaskConical aria-hidden="true" />
                        新建材料
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                        <Wrench aria-hidden="true" />
                        新建设备
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                        <ListTodo aria-hidden="true" />
                        新建任务
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </template>
    </RouterTabBar>
    <ScrollArea type="auto" class="min-h-0 flex-1 scroll-smooth">
        <RouterView />
    </ScrollArea>
</template>

<script setup lang="ts">
import { RouterTabBar, useRouteTab } from '@/component/route-tab';
import { Button } from '@/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { ScrollSurface as ScrollArea } from '@/component/scroll-surface';
import { ChevronDown, FlaskConical, ListTodo, Plus, Wrench } from '@lucide/vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const { setEntity } = useRouteTab();

setEntity([
    {
        id: 'overview',
        value: {
            disabled: false,
            label: '概览',
            path: '/main/workbench/overview',
        },
    },
    {
        id: 'my-tasks',
        value: {
            disabled: false,
            label: '我的待办',
            path: '/main/workbench/my-task',
        },
    },
    {
        id: 'pending-approvals',
        value: {
            disabled: false,
            label: '待审批',
            path: '/main/workbench/pending-approval',
        },
    },
    {
        id: 'exceptions-alerts',
        value: {
            disabled: false,
            label: '异常与提醒',
            path: '/main/workbench/exception-alert',
        },
    },
]);
</script>

<style scoped></style>
