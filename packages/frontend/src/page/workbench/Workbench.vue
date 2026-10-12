<template>
    <RouterTabBar>
        <template v-if="route.path === workbenchPage.overview.path" #actions>
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
import { workbenchPage } from '@/module/workbench/navigation';

const route = useRoute();
const { setEntity } = useRouteTab();

setEntity(
    Object.values(workbenchPage).map((page) => ({
        id: page.id,
        value: { disabled: false, label: page.label, path: page.path },
    }))
);
</script>

<style scoped></style>
