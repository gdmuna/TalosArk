<script setup lang="ts">
import { useRoute } from 'vue-router';
import { ClipboardList, Folders, UsersRound, ShieldCheck, Box } from '@lucide/vue';
import { provideBreadcrumbContext, BreadcrumbTrail } from '@/component/breadcrumb';
import { Button } from '@/ui/button';
import { TooltipProvider } from '@/ui/tooltip';
import { mode, lastRead } from './.r04-preview';
const route = useRoute();
const entries = provideBreadcrumbContext(() => [
    { id: 'management', label: '管理中心' },
    { id: 'audit', label: '审计日志' },
]);
</script>
<template>
    <TooltipProvider>
        <div class="flex h-svh min-w-0 flex-col bg-background">
            <div
                style="
                    height: 36px;
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 0 16px;
                    border-bottom: 1px solid var(--border);
                    font-size: 12px;
                "
            >
                <strong>R04-A1 隔离验收 · 非真实审计记录</strong>
                <Button
                    v-for="item in [
                        { id: 'normal', label: '正常' },
                        { id: 'empty', label: '空结果' },
                        { id: 'denied', label: '403' },
                        { id: 'unavailable', label: '503' },
                        { id: 'invalid', label: '失效游标' },
                        { id: 'wrong-scope', label: '错域响应' },
                    ]"
                    :key="item.id"
                    variant="ghost"
                    size="sm"
                    :aria-pressed="mode === item.id"
                    @click="mode = item.id"
                >
                    {{ item.label }}
                </Button>
            </div>
            <div class="flex min-h-0 min-w-0 flex-1">
                <aside
                    style="
                        width: 240px;
                        flex-shrink: 0;
                        border-right: 1px solid var(--border);
                        padding: 20px 12px;
                        background: var(--muted);
                    "
                    class="space-y-6"
                >
                    <div class="flex items-center gap-2 px-2 font-semibold">
                        <Box class="text-primary" />
                        璇玑云库
                    </div>
                    <div class="px-2 text-sm">隔离验收组织</div>
                    <nav class="space-y-1 text-sm">
                        <div class="flex items-center gap-3 rounded-md p-2">
                            <Folders class="size-4" />
                            工作区
                        </div>
                        <div class="flex items-center gap-3 rounded-md p-2">
                            <UsersRound class="size-4" />
                            成员
                        </div>
                        <div class="flex items-center gap-3 rounded-md p-2">
                            <ShieldCheck class="size-4" />
                            角色与权限
                        </div>
                        <div class="flex items-center gap-3 rounded-md bg-primary-soft p-2 text-primary">
                            <ClipboardList class="size-4" />
                            审计日志
                        </div>
                    </nav>
                </aside>
                <div class="flex min-h-0 min-w-0 flex-1 flex-col">
                    <header
                        style="height: 56px; flex-shrink: 0; border-bottom: 1px solid var(--border); padding: 16px 24px"
                    >
                        <BreadcrumbTrail :entries="entries" />
                    </header>
                    <RouterView />
                </div>
            </div>
            <output
                style="
                    height: 28px;
                    flex-shrink: 0;
                    overflow: hidden;
                    white-space: nowrap;
                    border-top: 1px solid var(--border);
                    font-size: 11px;
                "
                aria-label="隔离查询记录"
            >
                {{ route.fullPath }} · {{ lastRead }}
            </output>
        </div>
    </TooltipProvider>
</template>
