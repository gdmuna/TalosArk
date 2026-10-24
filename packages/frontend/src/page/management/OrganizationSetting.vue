<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { ArrowRight, RotateCw, UsersRound } from '@lucide/vue';
import { Button } from '@/ui/button';
import { CopyableId } from '@/component/inspector';
import { SelectField } from '@/component/select-field';
import { formatDateTime } from '@/shared/util/date-time';
import { managementPath } from '@/router/management-navigation';
import ManagementPage from './component/ManagementPage.vue';
import ManagementSection from './component/ManagementSection.vue';
import ManagementEmpty from './component/ManagementEmpty.vue';
import OrganizationIdentity from './organization/OrganizationIdentity.vue';
import { useOrganizationContext } from './organization/context';

const { source, organization, organizationId, options, key, profile } = useOrganizationContext();
const { data, error, loading, refresh } = profile;
</script>

<template>
    <ManagementPage title="组织设置" :context="data?.name ?? organization?.name ?? '组织不可用'">
        <template #actions>
            <div class="w-60 max-w-full [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-value]]:min-w-0">
                <SelectField v-model="organizationId" label="当前管理组织" :options="options" />
            </div>
            <Button v-if="source" variant="outline" :disabled="loading || !key" @click="refresh">
                <RotateCw aria-hidden="true" />
                刷新
            </Button>
        </template>
        <ManagementEmpty v-if="!organization" text="组织不存在或不在当前可访问范围内" />
        <template v-else>
            <OrganizationIdentity :id="organization.id" :name="organization.name" :profile="data" />
            <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在加载组织资料</p>
            <div v-if="error" role="alert" class="flex flex-wrap items-center gap-2 text-sm text-destructive">
                <span>{{ error }}{{ data ? '，当前保留上次读取结果。' : '' }}</span>
                <Button variant="outline" size="sm" :disabled="loading" @click="refresh">重新加载</Button>
            </div>
            <div
                class="grid min-w-0 gap-8 @min-[1000px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
                data-slot="organization-setting-columns"
            >
                <div class="min-w-0 space-y-8">
                    <ManagementSection title="基本信息">
                        <dl class="grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] gap-x-4 gap-y-5 text-sm">
                            <dt class="text-muted-foreground">组织名称</dt>
                            <dd class="min-w-0 break-words">{{ data?.name ?? organization.name }}</dd>
                            <dt class="text-muted-foreground">组织标识</dt>
                            <dd class="min-w-0"><CopyableId :value="organization.id" label="组织 ID" /></dd>
                            <template v-if="data">
                                <dt class="text-muted-foreground">所有者账户</dt>
                                <dd class="min-w-0"><CopyableId :value="data.ownerUserId" label="所有者账户 ID" /></dd>
                            </template>
                        </dl>
                        <p class="text-sm text-muted-foreground">组织资料编辑暂未开放</p>
                    </ManagementSection>
                    <ManagementSection title="成员加入">
                        <div class="flex flex-wrap items-start justify-between gap-4">
                            <div class="min-w-0 space-y-2 text-sm">
                                <p class="font-medium">邮箱邀请</p>
                                <p class="text-muted-foreground">仅支持邀请已有账户加入</p>
                            </div>
                            <Button variant="outline" as-child>
                                <RouterLink
                                    :to="{
                                        path: `${managementPath}/member`,
                                        query: { organization: organizationId, tab: 'invitations' },
                                    }"
                                >
                                    <UsersRound aria-hidden="true" />
                                    管理邀请
                                    <ArrowRight aria-hidden="true" />
                                </RouterLink>
                            </Button>
                        </div>
                    </ManagementSection>
                </div>
                <aside class="min-w-0" aria-label="组织记录">
                    <ManagementSection title="组织记录">
                        <ManagementEmpty v-if="!source" text="完整组织资料服务尚未开放" compact />
                        <dl v-if="data" class="space-y-4 text-sm">
                            <div class="space-y-1">
                                <dt class="text-muted-foreground">创建时间</dt>
                                <dd>{{ formatDateTime(Date.parse(data.createdAt)) }}</dd>
                            </div>
                            <div class="space-y-1">
                                <dt class="text-muted-foreground">更新时间</dt>
                                <dd>{{ formatDateTime(Date.parse(data.updatedAt)) }}</dd>
                            </div>
                            <div v-if="data.archivedAt" class="space-y-1">
                                <dt class="text-muted-foreground">归档时间</dt>
                                <dd>{{ formatDateTime(Date.parse(data.archivedAt)) }}</dd>
                            </div>
                        </dl>
                    </ManagementSection>
                </aside>
            </div>
        </template>
    </ManagementPage>
</template>
