<template>
    <Popover v-model:open="popoverOpen">
        <PopoverAnchor v-if="anchor !== undefined" :reference="anchor ?? undefined" class="hidden" />
        <PopoverTrigger v-else as-child>
            <Button
                ref="workspaceTrigger"
                variant="ghost"
                class="h-auto w-full justify-start gap-3 p-3 text-left"
                aria-label="切换组织或工作区"
            >
                <span
                    class="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-base text-primary-foreground"
                >
                    {{ workspace.current?.name.slice(0, 1) ?? '' }}
                </span>
                <span class="min-w-0 flex-1">
                    <span class="block truncate">{{ workspace.current?.name }}</span>
                    <span class="mt-1 block truncate text-xs text-muted-foreground">
                        {{ workspace.organization?.name }}
                    </span>
                </span>
                <ChevronDown class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Button>
        </PopoverTrigger>
        <PopoverContent
            align="start"
            :side-offset="6"
            :collision-padding="8"
            class="flex max-h-(--reka-popover-content-available-height) w-80 flex-col gap-0 overflow-hidden p-0"
            aria-label="切换组织或工作区"
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
                <Button variant="secondary" size="icon-sm" aria-label="工作区管理" title="工作区管理" use-tooltip>
                    <Folders aria-hidden="true" />
                </Button>
            </div>
            <div class="relative mx-2 mb-2 mt-1 shrink-0">
                <Search
                    class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                />
                <Input v-model="query" class="h-8 pl-9" placeholder="搜索组织或工作区" aria-label="搜索组织或工作区" />
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
                                    @click="selectWorkspace(item.id)"
                                >
                                    <UsersRound class="size-4 shrink-0" aria-hidden="true" />
                                    <span class="min-w-0 flex-1 truncate text-left">{{ item.name }}</span>
                                    <Check v-if="item.id === workspace.activeId" class="size-4" aria-hidden="true" />
                                </Button>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                    <p v-if="!groups.length" class="py-8 text-center text-sm text-muted-foreground">未找到工作区</p>
                </div>
            </ScrollArea>
            <div class="grid shrink-0 grid-cols-2 gap-1 border-t p-1">
                <Button variant="ghost" class="h-8 text-primary" @click="openForm('join')">
                    <Plus aria-hidden="true" />
                    加入工作区
                </Button>
                <Button variant="ghost" class="h-8 text-primary" @click="openForm('create')">
                    <Plus aria-hidden="true" />
                    新建工作区
                </Button>
            </div>
        </PopoverContent>
    </Popover>

    <Dialog v-model:open="formOpen">
        <DialogContent @close-auto-focus="restoreFocus">
            <DialogTitle>{{ mode === 'create' ? '新建工作区' : '加入工作区' }}</DialogTitle>
            <DialogDescription class="sr-only">
                {{ mode === 'create' ? '填写工作区名称与所属组织' : '输入工作区邀请码' }}
            </DialogDescription>
            <form class="space-y-4" @submit.prevent="submit">
                <template v-if="mode === 'create'">
                    <label class="block space-y-2">
                        <span>所属组织</span>
                        <SelectField
                            v-model="organizationId"
                            label="所属组织"
                            class="w-full"
                            :options="workspace.organizations.map((item) => ({ value: item.id, label: item.name }))"
                        />
                    </label>
                    <label class="block space-y-2">
                        <span>工作区名称</span>
                        <Input v-model="name" maxlength="40" required placeholder="例如：细胞成像课题组" />
                    </label>
                </template>
                <label v-else class="block space-y-2">
                    <span>邀请码</span>
                    <Input v-model="code" required maxlength="40" autocomplete="off" placeholder="输入邀请码" />
                </label>
                <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
                <div class="flex justify-end gap-2">
                    <Button type="button" variant="outline" @click="formOpen = false">取消</Button>
                    <Button type="submit" :disabled="workspace.busy">
                        {{ mode === 'create' ? '创建工作区' : '加入' }}
                    </Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue';
import { unrefElement, useElementSize } from '@vueuse/core';
import { Folders, Building2, Check, ChevronDown, Plus, Search, UsersRound } from '@lucide/vue';
import { useWorkspaceStore } from '../model/store';
import { SelectField } from '@/component/select-field';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ui/collapsible';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Popover, PopoverAnchor, PopoverContent, PopoverTitle, PopoverTrigger } from '@/ui/popover';
import { ScrollSurface as ScrollArea } from '@/component/scroll-surface';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ui/dialog';

// External anchors keep this panel independent from its caller's menu positioning root.
const props = defineProps<{ anchor?: HTMLElement | SVGElement | null }>();
const workspace = useWorkspaceStore();
const workspaceTrigger = useTemplateRef('workspaceTrigger');
const workspaceList = useTemplateRef('workspaceList');
const { height: listHeight } = useElementSize(workspaceList, { width: 0, height: 0 }, { box: 'border-box' });
const popoverOpen = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ 'close-auto-focus': [event: Event] }>();
const interactedOutside = ref(false);
const query = ref('');
const collapsed = ref<string[]>([]);
const formOpen = ref(false);
const mode = ref<'create' | 'join'>('create');
const name = ref('');
const code = ref('');
const error = ref('');
const organizationId = ref(workspace.organization?.id ?? '');
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
        .filter((group) => group.workspaces.length)
);

function isExpanded(id: string) {
    return !!query.value.trim() || !collapsed.value.includes(id);
}
function toggleGroup(id: string) {
    collapsed.value = collapsed.value.includes(id)
        ? collapsed.value.filter((item) => item !== id)
        : [...collapsed.value, id];
}
function selectWorkspace(id: string) {
    workspace.select(id);
    popoverOpen.value = false;
}
function openForm(value: 'create' | 'join') {
    mode.value = value;
    name.value = code.value = error.value = '';
    organizationId.value = workspace.organization?.id ?? '';
    popoverOpen.value = false;
    formOpen.value = true;
}
async function submit() {
    error.value =
        mode.value === 'create'
            ? await workspace.create(name.value, organizationId.value)
            : await workspace.join(code.value);
    if (!error.value) formOpen.value = false;
}
function onPopoverClose(event: Event) {
    if (formOpen.value) {
        event.preventDefault();
    } else if (props.anchor !== undefined && !interactedOutside.value) {
        emit('close-auto-focus', event);
    }
}
function restoreFocus(event: Event) {
    const trigger = unrefElement(workspaceTrigger);
    if (trigger) {
        event.preventDefault();
        trigger.focus();
    }
    emit('close-auto-focus', event);
}
watch([name, code, organizationId], () => {
    error.value = '';
});
watch(popoverOpen, (value) => {
    if (value) {
        query.value = '';
        interactedOutside.value = false;
    }
});
</script>
