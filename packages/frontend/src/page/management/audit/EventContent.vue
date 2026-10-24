<script setup lang="ts">
import type { AuditEvent } from '@/module/audit';
import { CopyableId } from '@/component/inspector';
import ManagementSection from '../component/ManagementSection.vue';
import FactList from '../detail/FactList.vue';

defineProps<{ event: AuditEvent }>();
const date = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false });
</script>

<template>
    <div class="@container/audit space-y-6">
        <div class="grid min-w-0 items-start gap-6 @min-[880px]/audit:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <ManagementSection title="基本信息">
                <FactList
                    :fields="[
                        { label: '发生时间', value: date(event.occurredAt) },
                        { label: '操作者', value: event.actor?.name ?? '操作者信息不可用' },
                        { label: '动作', value: event.actionLabel },
                        { label: '动作标识', value: event.action },
                        { label: '所属组织', value: event.organization.name },
                        { label: '工作区', value: event.workspace?.name ?? '组织级事件' },
                    ]"
                />
                <div class="space-y-3 border-t pt-4">
                    <CopyableId :value="event.id" label="事件 ID" />
                    <CopyableId v-if="event.requestId" :value="event.requestId" label="请求 ID" />
                </div>
            </ManagementSection>
            <ManagementSection title="关联资源">
                <ul v-if="event.resources.length" class="divide-y">
                    <li
                        v-for="resource in event.resources"
                        :key="resource.resourceId"
                        class="space-y-2 py-3 first:pt-0"
                    >
                        <p class="break-words text-sm font-medium">{{ resource.labelSnapshot }}</p>
                        <CopyableId :value="resource.resourceId" label="资源 ID" />
                    </li>
                </ul>
                <p v-else class="text-sm text-muted-foreground">此事件没有关联资源</p>
            </ManagementSection>
        </div>
        <ManagementSection v-if="event.description" title="事件描述">
            <p class="whitespace-pre-wrap break-words text-sm leading-6">{{ event.description }}</p>
        </ManagementSection>
        <ManagementSection v-if="event.facts.length" title="事件内容">
            <FactList :fields="event.facts" />
        </ManagementSection>
    </div>
</template>
