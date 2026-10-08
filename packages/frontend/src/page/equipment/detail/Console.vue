<script setup lang="ts">
import { Terminal, Play, ChevronDown, Power } from '@lucide/vue';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/ui/collapsible';
import ResourcePage from '../../resource/ResourcePage.vue';
import ResourceObjectHeader from '../../resource/ResourceObjectHeader.vue';
import ResourceSection from '../../resource/ResourceSection.vue';
import ResourceFactList from '../../resource/ResourceFactList.vue';
import ResourceTable from '../../resource/ResourceTable.vue';
import ResourceEmpty from '../../resource/ResourceEmpty.vue';
import { useResource } from '../../resource/useResource';
const { resource, resourceId, workspace } = useResource('设备');
</script>
<template>
    <ResourcePage label="设备操作台">
        <ResourceObjectHeader
            :id="resourceId"
            :title="`${resource?.name ?? '设备'} · 操作台`"
            :icon="Terminal"
            :back-to="`/main/equipment/detail/${encodeURIComponent(resourceId)}`"
            back-label="设备详情"
        />
        <ResourceEmpty v-if="!resource" text="当前工作区未找到该设备" />
        <template v-else>
            <ResourceSection title="操作上下文">
                <ResourceFactList
                    :fields="[
                        { label: '当前工作区', value: workspace.current?.name },
                        { label: '连接状态' },
                        { label: '设备状态' },
                        { label: '操作权限' },
                    ]"
                />
            </ResourceSection>
            <div class="grid min-w-0 gap-8 @3xl:grid-cols-2">
                <ResourceSection title="指令配置">
                    <div class="space-y-5">
                        <div class="space-y-2">
                            <Label for="equipment-command">指令</Label>
                            <select
                                id="equipment-command"
                                class="h-9 w-full rounded-md border bg-background px-3 text-sm text-muted-foreground disabled:opacity-50"
                                disabled
                            >
                                <option>设备指令能力未加载</option>
                            </select>
                        </div>
                        <div class="space-y-2">
                            <Label for="equipment-parameter">参数</Label>
                            <Input id="equipment-parameter" readonly placeholder="未加载" />
                        </div>
                        <Button disabled>
                            <Play aria-hidden="true" />
                            准备执行
                        </Button>
                    </div>
                </ResourceSection>
                <ResourceSection title="执行反馈"><ResourceEmpty text="尚无执行回执" /></ResourceSection>
            </div>
            <ResourceSection title="操作日志">
                <ResourceTable
                    :fields="[
                        ['time', '时间', 180],
                        ['command', '指令', 220],
                        ['operator', '操作人', 120],
                        ['result', '结果', 160],
                    ]"
                />
            </ResourceSection>
            <Collapsible class="border-t pt-4">
                <CollapsibleTrigger as-child>
                    <Button variant="ghost" class="px-0">
                        <ChevronDown aria-hidden="true" />
                        危险操作
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent class="pt-4">
                    <Button variant="destructive" disabled>
                        <Power aria-hidden="true" />
                        关闭设备
                    </Button>
                </CollapsibleContent>
            </Collapsible>
        </template>
    </ResourcePage>
</template>
