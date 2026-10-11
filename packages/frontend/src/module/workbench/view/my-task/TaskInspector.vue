<template>
    <div class="flex min-h-0 flex-col">
        <header class="flex shrink-0 items-start gap-3 border-b pb-5">
            <div
                class="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground"
            >
                <ClipboardCheck class="size-6" aria-hidden="true" />
            </div>
            <div class="min-w-0 flex-1">
                <h2 class="text-base font-semibold leading-6">{{ task.title }}</h2>
                <CopyableId class="mt-1" :value="task.id" label="任务 ID" />
                <StateBadge
                    class="mt-2"
                    :tone="task.status === '已完成' ? 'success' : overdue ? 'destructive' : 'warning'"
                >
                    {{ task.status === '已完成' ? '已完成' : overdue ? '已逾期' : '待处理' }}
                </StateBadge>
            </div>
        </header>
        <ScrollArea class="min-h-0 flex-1 [--edge-surface:var(--card)]">
            <div class="space-y-5 py-5 pr-2">
                <dl class="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-4">
                    <dt class="text-muted-foreground">申请人</dt>
                    <dd>{{ task.applicant }}</dd>
                    <dt class="text-muted-foreground">申请时间</dt>
                    <dd class="tabular-nums">{{ formatDateTime(task.createdAt) }}</dd>
                    <dt class="text-muted-foreground">截止时间</dt>
                    <dd :class="['tabular-nums', overdue && 'text-destructive']">{{ formatDateTime(task.dueAt) }}</dd>
                    <dt class="text-muted-foreground">类型</dt>
                    <dd>{{ task.kind }}</dd>
                    <dt class="text-muted-foreground">工作区</dt>
                    <dd>{{ workspace.workspaces.find((item) => item.id === task.workspaceId)?.name }}</dd>
                </dl>
                <section v-if="resource" class="border-t pt-5">
                    <h3 class="mb-3 font-semibold">关联对象</h3>
                    <div class="rounded-md border p-3">
                        <Button
                            variant="ghost"
                            class="h-auto w-full justify-start gap-3 p-0 text-left hover:bg-transparent"
                            @click="$emit('resource', resource)"
                        >
                            <FlaskConical
                                v-if="resource.kind === '材料定义' || resource.kind === '库存实例'"
                                class="size-5 text-primary"
                                aria-hidden="true"
                            />
                            <Monitor v-else class="size-5 text-primary" aria-hidden="true" />
                            <span class="min-w-0 flex-1">
                                <span class="block truncate">{{ resource.name }}</span>
                                <span class="mt-1 block text-xs text-muted-foreground">{{ resource.kind }}</span>
                            </span>
                            <ChevronRight aria-hidden="true" />
                        </Button>
                        <CopyableId class="mt-2" :value="resource.id" label="关联对象 ID" />
                    </div>
                </section>
                <section>
                    <h3 class="mb-2 font-semibold">申请说明</h3>
                    <p class="rounded-md bg-muted p-3 leading-6">
                        {{ task.subtitle }}。请核对关联对象与申请信息后完成处理。
                    </p>
                </section>
                <section>
                    <h3 class="mb-3 font-semibold">处理信息</h3>
                    <dl class="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-3">
                        <dt class="text-muted-foreground">负责人</dt>
                        <dd>王教授</dd>
                        <dt class="text-muted-foreground">任务状态</dt>
                        <dd>{{ task.status }}</dd>
                    </dl>
                </section>
            </div>
        </ScrollArea>
        <footer class="flex shrink-0 gap-3 border-t pt-4">
            <Button
                variant="outline"
                class="flex-1"
                :disabled="!resource"
                @click="resource && $emit('resource', resource)"
            >
                查看资源
            </Button>
            <Button
                v-if="task.kind === '审批'"
                class="flex-1"
                :disabled="busy"
                @click="$emit('approval', task.approvalId)"
            >
                <ClipboardCheck aria-hidden="true" />
                前往审批
            </Button>
            <Button
                v-else
                class="flex-1"
                :disabled="task.status === '已完成' || busy"
                @click="$emit('complete', task.id)"
            >
                <Check aria-hidden="true" />
                完成任务
            </Button>
        </footer>
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { Check, ChevronRight, ClipboardCheck, FlaskConical, Monitor } from '@lucide/vue';
import { useWorkspaceStore } from '@/module/workspace';
import { Button } from '@/ui/button';
import { ScrollSurface as ScrollArea } from '@/component/scroll-surface';
import { formatDateTime } from '@/shared/util/date-time';
import { type Resource, type Task } from '../../model/workbench';
import { useWorkbenchStore } from '../../model/store';
import { StateBadge } from '@/component/state-badge';
import { CopyableId } from '@/component/inspector';
const props = defineProps<{ task: Task; resource?: Resource; busy?: boolean }>();
defineEmits<{ complete: [id: string]; resource: [resource: Resource]; approval: [id?: string] }>();
const workspace = useWorkspaceStore();
const workbench = useWorkbenchStore();
const overdue = computed(() => workbench.overdue(props.task));
</script>
