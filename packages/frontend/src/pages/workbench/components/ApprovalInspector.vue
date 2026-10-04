<script setup lang="ts">
import { ref } from 'vue';
import { Check, ExternalLink, TriangleAlert, Undo2 } from '@lucide/vue';
import { Button } from '@/ui/button';
import { ScrollSurface as ScrollArea } from '@/modules/scroll-surface';
import StateBadge from '@/modules/state-badge/StateBadge.vue';
import CopyableId from '@/modules/inspector/CopyableId.vue';
import { useWorkspaceStore, useWorkbenchStore } from '@/shared/stores';
import { formatDateTime } from '@/shared/utils/date-time';
import { stateTone, type Approval, type Resource } from '@/shared/models/workbench';

const props = defineProps<{ approval: Approval; resource?: Resource }>();
const emit = defineEmits<{ close: []; resource: [resource: Resource] }>();
const workspace = useWorkspaceStore();
const workbench = useWorkbenchStore();
const reviewNote = ref('');
const error = ref('');
async function decide(status: '已批准' | '已退回') {
    error.value = await workbench.decideApprovals([props.approval.id], status, reviewNote.value);
}
</script>

<template>
    <div class="flex h-full min-h-0 flex-col bg-card">
        <header class="flex shrink-0 items-start gap-3 border-b p-5 pr-12">
            <div class="min-w-0 flex-1">
                <h2 class="text-base font-semibold">{{ approval.kind }}</h2>
                <CopyableId class="mt-1" :value="approval.id" label="申请 ID" />
                <div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <StateBadge :tone="stateTone(approval.status)">{{ approval.status }}</StateBadge>
                </div>
            </div>
        </header>
        <ScrollArea class="min-h-0 flex-1 [--edge-surface:var(--card)]">
            <div class="space-y-5 p-5">
                <dl class="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-4">
                    <dt class="text-muted-foreground">申请人</dt>
                    <dd>{{ approval.applicant }}</dd>
                    <dt class="text-muted-foreground">工作区</dt>
                    <dd>{{ workspace.workspaces.find((item) => item.id === approval.workspaceId)?.name }}</dd>
                    <dt class="text-muted-foreground">申请类型</dt>
                    <dd>{{ approval.kind }}</dd>
                    <dt class="text-muted-foreground">申请对象</dt>
                    <dd>
                        {{ resource?.name }}
                        <CopyableId v-if="resource" class="mt-1" :value="resource.id" label="关联对象 ID" />
                    </dd>
                    <dt class="text-muted-foreground">申请数量</dt>
                    <dd class="tabular-nums">{{ approval.quantity }} {{ approval.unit }}</dd>
                    <dt class="text-muted-foreground">申请时间</dt>
                    <dd class="tabular-nums">{{ formatDateTime(approval.createdAt) }}</dd>
                </dl>
                <section
                    v-if="approval.kind === '领用申请' || approval.kind === '库存转移'"
                    :class="[
                        'rounded-md p-3',
                        approval.quantity > approval.available
                            ? 'bg-destructive-soft text-destructive-soft-foreground'
                            : 'bg-caution-soft text-caution-soft-foreground',
                    ]"
                >
                    <h3 class="flex items-start gap-2 font-semibold">
                        <TriangleAlert class="size-5 shrink-0" aria-hidden="true" />
                        当前可用库存：{{ approval.available }} {{ approval.unit }}
                    </h3>
                    <p class="mt-2 text-sm">
                        {{
                            approval.quantity > approval.available
                                ? '可用数量不足，暂不能批准该申请。'
                                : `批准后剩余 ${approval.available - approval.quantity} ${approval.unit}`
                        }}
                    </p>
                </section>
                <section>
                    <h3 class="mb-3 font-semibold">申请说明</h3>
                    <p class="rounded-md bg-muted p-3 leading-6">{{ approval.note }}</p>
                </section>
                <Button variant="outline" :disabled="!resource" @click="resource && emit('resource', resource)">
                    <ExternalLink aria-hidden="true" />
                    查看关联资源
                </Button>
                <section v-if="approval.status === '待审批'">
                    <label for="approval-note" class="mb-3 block font-semibold">
                        审批意见
                        <span class="ml-2 text-xs font-normal text-muted-foreground">退回时必填</span>
                    </label>
                    <textarea
                        id="approval-note"
                        v-model="reviewNote"
                        rows="4"
                        maxlength="200"
                        class="w-full resize-none rounded-md border border-input bg-card p-3"
                        placeholder="填写审批意见"
                        :aria-invalid="!!error"
                        :aria-describedby="error ? 'approval-error' : undefined"
                    />
                    <p class="mt-1 text-right text-xs tabular-nums text-muted-foreground">
                        {{ reviewNote.length }} / 200
                    </p>
                    <p v-if="error" id="approval-error" role="alert" class="mt-2 text-sm text-destructive">
                        {{ error }}
                    </p>
                </section>
                <section v-else>
                    <h3 class="mb-3 font-semibold">审批意见</h3>
                    <p class="rounded-md bg-muted p-3 leading-6">{{ approval.reviewNote || '无附加意见' }}</p>
                </section>
            </div>
        </ScrollArea>
        <footer class="flex shrink-0 justify-end gap-3 border-t p-5">
            <template v-if="approval.status === '待审批'">
                <Button variant="outline" :disabled="workbench.busy" @click="decide('已退回')">
                    <Undo2 aria-hidden="true" />
                    退回
                </Button>
                <Button :disabled="approval.quantity > approval.available || workbench.busy" @click="decide('已批准')">
                    <Check aria-hidden="true" />
                    批准
                </Button>
            </template>
            <Button v-else variant="outline" @click="emit('close')">关闭</Button>
        </footer>
    </div>
</template>
