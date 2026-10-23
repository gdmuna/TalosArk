<template>
    <Popover v-model:open="popoverOpen">
        <PopoverAnchor v-if="anchor !== undefined" :reference="anchor ?? undefined" class="hidden" />
        <PopoverTrigger v-else as-child>
            <Button
                ref="workspaceTrigger"
                variant="ghost"
                class="workspace-trigger h-auto w-full justify-start overflow-hidden text-left transition-[background-color,padding,gap] duration-(--sidebar-transition-duration,240ms) ease-standard"
                :class="compact ? 'gap-0 p-0' : 'gap-3 p-2'"
                :data-compact="compact"
                aria-label="切换组织或工作区"
                use-tooltip
                :tooltip-disabled="!compact || popoverOpen"
                tooltip="切换组织或工作区"
                tooltip-side="right"
                :tooltip-delay-duration="0"
            >
                <span
                    class="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-base text-primary-foreground"
                >
                    <UsersRound v-if="!workspace.current" class="size-5" aria-hidden="true" />
                    <template v-else>{{ workspace.current.name.slice(0, 1) }}</template>
                </span>
                <span
                    class="workspace-label min-w-0 flex-1 transition-opacity duration-(--sidebar-transition-duration,240ms) ease-standard"
                    :class="compact && 'opacity-0'"
                    :aria-hidden="compact"
                >
                    <span class="block truncate">{{ workspace.current?.name ?? '暂无工作区' }}</span>
                    <span class="mt-1 block truncate text-xs text-muted-foreground">
                        {{ workspace.organization?.name }}
                    </span>
                </span>
                <span
                    class="workspace-chevron shrink-0 overflow-hidden transition-[width,opacity] duration-(--sidebar-transition-duration,240ms) ease-standard"
                    :class="compact ? 'w-0 opacity-0' : 'w-4 opacity-100'"
                    aria-hidden="true"
                >
                    <ChevronDown class="size-4 text-muted-foreground" />
                </span>
            </Button>
        </PopoverTrigger>
        <PopoverContent
            align="start"
            :side-offset="6"
            :collision-padding="8"
            class="flex max-h-(--reka-popover-content-available-height) w-80 flex-col gap-0 overflow-hidden p-0"
            aria-label="切换组织或工作区"
            @open-auto-focus="focusSearch"
            @keydown="navigateOptions"
            @interact-outside="interactedOutside = true"
            @close-auto-focus="onPopoverClose"
        >
            <div class="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
                <PopoverTitle class="text-sm">切换组织或工作区</PopoverTitle>
                <!-- <span title="工作区管理（暂未开放）">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled
                        aria-label="工作区管理（暂未开放）"
                        title="工作区管理（暂未开放）"
                    >
                        <Folders class="size-4" aria-hidden="true" />
                    </Button>
                </span> -->
                <Button
                    variant="secondary"
                    size="icon-sm"
                    aria-label="工作区管理"
                    title="工作区管理"
                    use-tooltip
                    @click="openManagement"
                >
                    <Folders aria-hidden="true" />
                </Button>
            </div>
            <div class="relative mx-2 mb-2 mt-1 shrink-0">
                <Search
                    class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                />
                <Input
                    ref="searchInput"
                    v-model="query"
                    class="h-8 pl-9"
                    placeholder="搜索组织或工作区"
                    aria-label="搜索组织或工作区"
                />
            </div>
            <ScrollArea
                class="min-h-0 shrink [--edge-surface:var(--card)]"
                :style="{ height: `${Math.min(listHeight, 256)}px` }"
            >
                <div ref="workspaceList" class="px-2 pb-2">
                    <Collapsible
                        v-for="group in groups"
                        :key="group.id"
                        :open="isExpanded(group.id)"
                        class="mb-2 last:mb-0"
                        @update:open="toggleGroup(group.id)"
                    >
                        <CollapsibleTrigger as-child>
                            <Button
                                variant="ghost"
                                class="h-8 w-full justify-start gap-2 px-2"
                                :aria-expanded="isExpanded(group.id)"
                                :title="group.name"
                            >
                                <ChevronDown
                                    :class="[
                                        'size-3.5 transition-transform duration-150',
                                        !isExpanded(group.id) && '-rotate-90',
                                    ]"
                                    aria-hidden="true"
                                />
                                <Building2 class="size-4" aria-hidden="true" />
                                <span class="truncate">{{ group.name }}</span>
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div class="ml-5.5 space-y-0.5 pt-1">
                                <Button
                                    v-for="item in group.workspaces"
                                    :key="item.id"
                                    variant="ghost"
                                    class="h-8 w-full justify-start px-2 font-normal data-[selected=true]:bg-primary-soft data-[selected=true]:text-primary"
                                    :data-selected="item.id === workspace.activeId"
                                    :aria-pressed="item.id === workspace.activeId"
                                    :disabled="workspace.switching"
                                    data-workspace-option
                                    :title="item.name"
                                    @click="selectWorkspace(item.id)"
                                >
                                    <UsersRound class="size-4 shrink-0" aria-hidden="true" />
                                    <span class="min-w-0 flex-1 truncate text-left">{{ item.name }}</span>
                                    <Check v-if="item.id === workspace.activeId" class="size-4" aria-hidden="true" />
                                </Button>
                                <p v-if="!group.workspaces.length" class="px-2 py-2 text-sm text-muted-foreground">
                                    暂无可用工作区
                                </p>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                    <p v-if="!groups.length" role="status" class="py-8 text-center text-sm text-muted-foreground">
                        {{ workspace.organizations.length ? '没有匹配的组织或工作区' : '尚未加入组织' }}
                    </p>
                </div>
            </ScrollArea>
            <p v-if="workspace.error" role="alert" class="px-3 py-2 text-sm text-destructive">
                {{ workspace.error }}
            </p>
            <div class="flex shrink-0 flex-wrap gap-1 border-t p-1">
                <Button v-if="workspace.canJoin" variant="ghost" class="h-8 text-primary" @click="openForm('join')">
                    <Plus aria-hidden="true" />
                    加入工作区
                </Button>
                <Button
                    variant="ghost"
                    class="h-8 text-primary"
                    :disabled="!workspace.organizations.some((item) => item.canCreateWorkspace)"
                    @click="openForm('workspace')"
                >
                    <Plus aria-hidden="true" />
                    新建工作区
                </Button>
                <Button
                    v-if="workspace.canCreateOrganization"
                    variant="ghost"
                    class="h-8 text-primary"
                    @click="openForm('organization')"
                >
                    <Plus aria-hidden="true" />
                    新建组织
                </Button>
            </div>
        </PopoverContent>
    </Popover>

    <WorkspaceCreateDialog v-model:open="formOpen" :mode="mode" @close-auto-focus="restoreFocus" />
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue';
import { unrefElement, useElementSize } from '@vueuse/core';
import { Folders, Building2, Check, ChevronDown, Plus, Search, UsersRound } from '@lucide/vue';
import { useWorkspaceStore } from '../model/store';
import WorkspaceCreateDialog from './WorkspaceCreateDialog.vue';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ui/collapsible';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Popover, PopoverAnchor, PopoverContent, PopoverTitle, PopoverTrigger } from '@/ui/popover';
import { ScrollSurface as ScrollArea } from '@/component/scroll-surface';

// External anchors keep this panel independent from its caller's menu positioning root.
const props = withDefaults(defineProps<{ anchor?: HTMLElement | SVGElement | null; compact?: boolean }>(), {
    compact: false,
});
const workspace = useWorkspaceStore();
const workspaceTrigger = useTemplateRef('workspaceTrigger');
const workspaceList = useTemplateRef('workspaceList');
const searchInput = useTemplateRef('searchInput');
const { height: listHeight } = useElementSize(workspaceList, { width: 0, height: 0 }, { box: 'border-box' });
const popoverOpen = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ 'close-auto-focus': [event: Event]; manage: [] }>();
const interactedOutside = ref(false);
const query = ref('');
const collapsed = ref<string[]>([]);
const formOpen = ref(false);
const mode = ref<'organization' | 'workspace' | 'join'>('workspace');
let generation = 0;
let skipPopoverFocusRestore = false;
const groups = computed(() =>
    workspace.organizations
        .map((organization) => ({
            ...organization,
            workspaces: workspace.workspaces.filter(
                (item) =>
                    item.organizationId === organization.id &&
                    `${organization.name} ${item.name}`.toLowerCase().includes(query.value.trim().toLowerCase())
            ),
        }))
        .filter(
            (group) => group.workspaces.length || group.name.toLowerCase().includes(query.value.trim().toLowerCase())
        )
);

function focusSearch(event: Event) {
    event.preventDefault();
    const input = searchInput.value?.$el;
    if (input instanceof HTMLInputElement) input.focus();
}
function navigateOptions(event: KeyboardEvent) {
    if (event.isComposing || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const target = event.target;
    const fromSearch = target === searchInput.value?.$el;
    if (fromSearch && (event.key === 'Home' || event.key === 'End')) return;
    const options = Array.from(
        workspaceList.value?.querySelectorAll<HTMLButtonElement>('button[data-workspace-option]:not([disabled])') ?? []
    );
    const index = options.findIndex((option) => option === target);
    if (!options.length || (!fromSearch && index < 0)) return;
    event.preventDefault();
    const next =
        event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? options.length - 1
              : event.key === 'ArrowDown'
                ? (index + 1) % options.length
                : index < 0
                  ? options.length - 1
                  : (index - 1 + options.length) % options.length;
    options[next]?.focus();
}

function isExpanded(id: string) {
    return !!query.value.trim() || !collapsed.value.includes(id);
}
function toggleGroup(id: string) {
    collapsed.value = collapsed.value.includes(id)
        ? collapsed.value.filter((item) => item !== id)
        : [...collapsed.value, id];
}
async function selectWorkspace(id: string) {
    if (workspace.switching) return;
    const current = generation;
    if ((await workspace.select(id)) === '' && current === generation) popoverOpen.value = false;
}
function openManagement() {
    popoverOpen.value = false;
    emit('manage');
}
function openForm(value: 'organization' | 'workspace' | 'join') {
    skipPopoverFocusRestore = true;
    mode.value = value;
    popoverOpen.value = false;
    formOpen.value = true;
}
function onPopoverClose(event: Event) {
    if (skipPopoverFocusRestore || formOpen.value) {
        event.preventDefault();
    } else if (props.anchor !== undefined && !interactedOutside.value) {
        emit('close-auto-focus', event);
    }
    skipPopoverFocusRestore = false;
}
function restoreFocus(event: Event) {
    const trigger = unrefElement(workspaceTrigger);
    if (trigger) {
        event.preventDefault();
        trigger.focus();
    }
    emit('close-auto-focus', event);
}
watch(popoverOpen, (value) => {
    if (value) {
        generation++;
        query.value = '';
        interactedOutside.value = false;
    }
});
</script>
