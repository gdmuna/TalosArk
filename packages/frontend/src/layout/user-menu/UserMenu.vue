<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import { managementPath } from '@/router/management-navigation';
import { workbenchPage } from '@/module/workbench/navigation';
import { unrefElement } from '@vueuse/core';
import { Box, ChevronDown, ChevronRight, Info, ListTodo, LogOut, UserRound, UsersRound } from '@lucide/vue';
import { WorkspaceSwitcher } from '@/module/workspace/ui';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { useAccountStore } from '@/module/account';
import { useWorkspaceStore } from '@/module/workspace';
import { useAuthApi } from '@/module/auth';
import { version, license } from '../../../package.json';

const account = useAccountStore();
const workspace = useWorkspaceStore();
const router = useRouter();
const authApi = useAuthApi();
const trigger = useTemplateRef('trigger');
const aboutTitle = useTemplateRef('aboutTitle');
const menuOpen = ref(false);
const workspaceOpen = ref(false);
let skipMenuFocusRestore = false;
const aboutOpen = ref(false);
const returnFocus = shallowRef<HTMLElement | null>(null);
const initial = computed(() => account.profile?.displayName.slice(0, 1).toUpperCase() ?? '');
watch(menuOpen, (open) => {
    if (open) skipMenuFocusRestore = false;
});

function captureFocus() {
    const target = menuOpen.value ? unrefElement(trigger) : document.activeElement;
    returnFocus.value = target instanceof HTMLElement ? target : null;
}
function openSettings() {
    void router.push(`${managementPath}/account-setting`);
}
function openAbout() {
    captureFocus();
    aboutOpen.value = true;
}
function openWorkspace() {
    captureFocus();
    // Keep the focus handoff through menu exit, even if the new panel closes first.
    skipMenuFocusRestore = true;
    menuOpen.value = false;
    workspaceOpen.value = true;
}
function onMenuClose(event: Event) {
    if (skipMenuFocusRestore || aboutOpen.value || workspaceOpen.value) {
        event.preventDefault();
    }
    skipMenuFocusRestore = false;
}
function restoreFocus(event: Event) {
    event.preventDefault();
    if (returnFocus.value?.isConnected) returnFocus.value.focus();
}
function focusAbout(event: Event) {
    event.preventDefault();
    unrefElement(aboutTitle)?.focus();
}
function signOut() {
    void authApi.logout();
    void router.push('/auth/login');
}
defineExpose({ openSettings });
</script>

<template>
    <DropdownMenu v-model:open="menuOpen">
        <DropdownMenuTrigger as-child>
            <Button
                ref="trigger"
                variant="ghost"
                size="sm"
                class="h-9 max-w-48 gap-2 px-2 font-normal"
                aria-label="打开用户菜单"
                title="用户菜单"
            >
                <span
                    class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft font-medium text-primary-soft-foreground"
                    aria-hidden="true"
                >
                    {{ initial }}
                </span>
                <span class="min-w-0 truncate font-medium">{{ account.profile?.displayName }}</span>
                <ChevronDown class="size-3.5 text-muted-foreground" aria-hidden="true" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
            align="end"
            class="w-72"
            aria-label="用户菜单"
            :inert="!menuOpen"
            @close-auto-focus="onMenuClose"
        >
            <DropdownMenuLabel class="flex min-w-0 items-center gap-3 p-3">
                <span
                    class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-base text-primary-soft-foreground"
                    aria-hidden="true"
                >
                    {{ initial }}
                </span>
                <span class="min-w-0">
                    <span class="block truncate font-semibold">{{ account.profile?.displayName }}</span>
                    <span class="mt-1 block truncate text-xs font-normal text-muted-foreground">
                        {{ account.profile?.email }}
                    </span>
                </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
                class="min-h-12 gap-3 px-3"
                aria-label="切换组织或工作区"
                aria-haspopup="dialog"
                @select="openWorkspace"
            >
                <UsersRound aria-hidden="true" />
                <span class="min-w-0 flex-1">
                    <span class="block truncate">{{ workspace.current?.name ?? '暂无可用工作区' }}</span>
                    <span class="mt-0.5 block truncate text-xs text-muted-foreground">
                        {{ workspace.organization?.name }}
                    </span>
                </span>
                <ChevronRight class="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="min-h-9 gap-3 px-3" @select="openSettings">
                <UserRound aria-hidden="true" />
                账户设置
            </DropdownMenuItem>
            <DropdownMenuItem class="min-h-9 gap-3 px-3" @select="router.push(workbenchPage.task.path)">
                <ListTodo aria-hidden="true" />
                我的待办
            </DropdownMenuItem>
            <DropdownMenuItem class="min-h-9 gap-3 px-3" @select="openAbout">
                <Info aria-hidden="true" />
                关于璇玑云库
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" class="min-h-9 gap-3 px-3" @select="signOut">
                <LogOut aria-hidden="true" />
                退出登录
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>

    <WorkspaceSwitcher
        v-model:open="workspaceOpen"
        :anchor="unrefElement(trigger) ?? null"
        @close-auto-focus="restoreFocus"
        @manage="router.push(`${managementPath}/workspace`)"
    />

    <Dialog v-model:open="aboutOpen">
        <DialogContent class="sm:max-w-sm" @open-auto-focus="focusAbout" @close-auto-focus="restoreFocus">
            <div class="flex items-center gap-3">
                <Box class="size-8 text-primary" aria-hidden="true" />
                <div>
                    <DialogTitle ref="aboutTitle" tabindex="-1" class="outline-none">璇玑云库</DialogTitle>
                    <DialogDescription class="mt-1">TalosArk</DialogDescription>
                </div>
            </div>
            <dl class="space-y-3 border-t pt-4 text-sm">
                <div class="flex justify-between gap-4">
                    <dt class="text-muted-foreground">版本</dt>
                    <dd>{{ version }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                    <dt class="text-muted-foreground">许可证</dt>
                    <dd>{{ license }}</dd>
                </div>
            </dl>
        </DialogContent>
    </Dialog>
</template>
