<script setup lang="ts">
import { computed } from 'vue';
import { Share2, ArrowUpRight, RotateCw } from '@lucide/vue';
import { useSharingPolicyDataSource, useResourceAccessRead, assertAccessScope } from '@/module/resource-access';
import { HttpError } from '@/platform/http';
import { Button } from '@/ui/button';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/ui/table';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/ui/empty';
import ManagementPage from './component/ManagementPage.vue';
import ManagementSection from './component/ManagementSection.vue';
import FactList from './detail/FactList.vue';
import AccessScopeField from './resource-grant/AccessScopeField.vue';
import ReadFeedback from './resource-grant/ReadFeedback.vue';
import { useAccessContext, resourceGrantPath } from './resource-grant/context';
import { accessDate } from './resource-grant/presentation';

const source = useSharingPolicyDataSource();
const { scope, key: contextKey, invalid, organization, organizationId, organizationOptions } = useAccessContext();
const key = computed(() => (source && contextKey.value ? contextKey.value : ''));
const { data, loading, error, refresh } = useResourceAccessRead(key, async (signal) => {
    if (!source) return;
    const organizationId = scope.value.organizationId;
    const next = await source.read(organizationId, signal);
    assertAccessScope({ organizationId }, next.organizationId);
    if (!Number.isFinite(Date.parse(next.updatedAt))) throw new HttpError('共享策略更新时间无效', 'protocol');
    return next;
});
</script>

<template>
    <ManagementPage title="共享策略" layout="wide" :context="organization?.name ?? '组织不可用'">
        <template #actions>
            <AccessScopeField v-model="organizationId" :options="organizationOptions" label="组织" />
            <Button v-if="source" variant="outline" :disabled="loading || !key" @click="refresh">
                <RotateCw aria-hidden="true" />
                刷新
            </Button>
        </template>
        <p v-if="invalid" role="alert" class="text-sm text-destructive">{{ invalid }}</p>
        <Empty v-else-if="!source" class="min-h-72 border-0">
            <EmptyHeader>
                <EmptyMedia variant="icon"><Share2 aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>共享策略暂不可用</EmptyTitle>
                <EmptyDescription>组织共享策略服务尚未开放，现有资源权限不会因此改变。</EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" as-child>
                <RouterLink :to="{ path: resourceGrantPath, query: { organization: scope.organizationId } }">
                    <ArrowUpRight aria-hidden="true" />
                    查看资源授权
                </RouterLink>
            </Button>
        </Empty>
        <template v-else>
            <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在读取共享策略</p>
            <ReadFeedback :error="error" :loading="loading" :stale="!!data" @retry="refresh" />
            <template v-if="data">
                <ManagementSection title="共享范围">
                    <FactList
                        :fields="[
                            { label: '适用范围', value: data.scopeLabel },
                            { label: '最近更新', value: accessDate(data.updatedAt) },
                            { label: '更新人', value: data.updatedBy ?? '未提供' },
                        ]"
                    />
                </ManagementSection>
                <ManagementSection title="资源共享规则">
                    <div class="overflow-x-auto rounded-md border bg-card">
                        <Table class="min-w-200">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>资源类型</TableHead>
                                    <TableHead>默认查看权限</TableHead>
                                    <TableHead>默认操作权限</TableHead>
                                    <TableHead>共享申请方式</TableHead>
                                    <TableHead>适用范围</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="rule in data.rules" :key="rule.resourceType.value">
                                    <TableCell class="max-w-64 whitespace-normal break-words font-medium">
                                        {{ rule.resourceType.label }}
                                    </TableCell>
                                    <TableCell class="max-w-64 whitespace-normal break-words">
                                        {{ rule.read ?? '未提供' }}
                                    </TableCell>
                                    <TableCell class="max-w-64 whitespace-normal break-words">
                                        {{ rule.operate ?? '未提供' }}
                                    </TableCell>
                                    <TableCell class="max-w-64 whitespace-normal break-words">
                                        {{ rule.request ?? '未提供' }}
                                    </TableCell>
                                    <TableCell class="max-w-64 whitespace-normal break-words">
                                        {{ rule.scope ?? '未提供' }}
                                    </TableCell>
                                </TableRow>
                                <TableRow v-if="!data.rules.length">
                                    <TableCell :colspan="5" class="h-32 text-center text-muted-foreground">
                                        没有可展示的资源共享规则
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </ManagementSection>
                <div class="grid min-w-0 items-start gap-6 @min-[1000px]:grid-cols-2">
                    <ManagementSection title="授权默认值">
                        <FactList
                            :fields="[
                                { label: '默认有效期', value: data.defaults.validity ?? '未提供' },
                                { label: '到期提醒', value: data.defaults.reminder ?? '未提供' },
                            ]"
                        />
                    </ManagementSection>
                    <ManagementSection v-if="data.settings.length" title="其他设置">
                        <FactList :fields="data.settings.map((item) => ({ ...item, value: item.value ?? '未提供' }))" />
                    </ManagementSection>
                </div>
                <ManagementSection v-if="data.effect" title="适用说明">
                    <p class="whitespace-pre-wrap break-words text-sm leading-6">{{ data.effect }}</p>
                </ManagementSection>
            </template>
        </template>
    </ManagementPage>
</template>
