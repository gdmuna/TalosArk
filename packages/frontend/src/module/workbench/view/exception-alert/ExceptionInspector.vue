<script setup lang="ts">
import { ref } from 'vue';
import { Check, ExternalLink, EyeOff, TriangleAlert } from '@lucide/vue';
import { Button } from '@/ui/button';
import { ScrollSurface as ScrollArea } from '@/component/scroll-surface';
import { StateBadge } from '@/component/state-badge';
import { CopyableId } from '@/component/inspector';
import { useWorkspaceStore } from '@/module/workspace';
import { useWorkbenchStore } from '../../model/store';
import { formatDateTime } from '@/shared/util/date-time';
import { exceptionTone, stateTone, type ExceptionItem, type Resource } from '../../model/workbench';
import WorkbenchSyncNotice from '../../ui/WorkbenchSyncNotice.vue';

const props = defineProps<{ exception: ExceptionItem; resource?: Resource }>();
const emit = defineEmits<{ close: []; resource: [resource: Resource] }>();
const workspace = useWorkspaceStore();
const workbench = useWorkbenchStore();
const error = ref('');
async function handle(status: '已处理' | '已忽略') {
    error.value = (await workbench.updateException(props.exception.id, status)) ?? '';
}
</script>

<template>
    <div class="flex h-full min-h-0 flex-col bg-card">
        <header class="flex shrink-0 items-start gap-3 border-b p-5 pr-12">
            <div class="min-w-0 flex-1">
                <h2 class="text-base font-semibold">{{ exception.title }}</h2>
                <CopyableId class="mt-1" :value="exception.id" label="异常 ID" />
            </div>
        </header>
        <ScrollArea class="min-h-0 flex-1 [--edge-surface:var(--card)]">
            <div class="space-y-5 p-5">
                <WorkbenchSyncNotice />
                <div class="flex items-start gap-3">
                    <TriangleAlert
                        class="mt-0.5 size-6 shrink-0"
                        :style="{ color: `var(--${exceptionTone(exception)}-soft-foreground)` }"
                        aria-hidden="true"
                    />
                    <div>
                        <div class="mt-2 flex flex-wrap gap-2">
                            <StateBadge :tone="exceptionTone(exception)">{{ exception.severity }}</StateBadge>
                            <StateBadge :tone="stateTone(exception.status)">{{ exception.status }}</StateBadge>
                        </div>
                    </div>
                </div>
                <dl class="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-4">
                    <dt class="text-muted-foreground">类型</dt>
                    <dd>{{ exception.kind }}</dd>
                    <dt class="text-muted-foreground">发生时间</dt>
                    <dd class="tabular-nums">{{ formatDateTime(exception.createdAt) }}</dd>
                    <dt class="text-muted-foreground">工作区</dt>
                    <dd>{{ workspace.workspaces.find((item) => item.id === exception.workspaceId)?.name }}</dd>
                </dl>
                <section>
                    <h3 class="mb-3 font-semibold">异常信息</h3>
                    <p class="rounded-md bg-muted p-3 leading-6">{{ exception.description }}</p>
                </section>
                <section>
                    <h3 class="mb-3 font-semibold">建议操作</h3>
                    <p class="leading-6">{{ exception.suggestion }}</p>
                </section>
                <section v-if="resource">
                    <h3 class="font-semibold">{{ resource.name }}</h3>
                    <CopyableId class="mt-1" :value="resource.id" label="关联对象 ID" />
                </section>
                <Button variant="outline" :disabled="!resource" @click="resource && emit('resource', resource)">
                    <ExternalLink aria-hidden="true" />
                    查看关联资源
                </Button>
                <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
            </div>
        </ScrollArea>
        <footer class="flex shrink-0 justify-end gap-3 border-t p-5">
            <template v-if="exception.status === '未处理'">
                <Button variant="outline" :disabled="workbench.busy || workbench.syncPending" @click="handle('已忽略')">
                    <EyeOff aria-hidden="true" />
                    忽略
                </Button>
                <Button :disabled="workbench.busy || workbench.syncPending" @click="handle('已处理')">
                    <Check aria-hidden="true" />
                    标记已处理
                </Button>
            </template>
            <Button v-else variant="outline" @click="emit('close')">关闭</Button>
        </footer>
    </div>
</template>
