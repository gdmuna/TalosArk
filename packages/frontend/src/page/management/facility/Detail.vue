<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Building2, RotateCw, Network, Folders } from '@lucide/vue';
import { useFacilityDataSource, useFacilityRead, assertFacilityPage } from '@/module/facility';
import { useWorkspaceStore } from '@/module/workspace';
import { useNavigationStore } from '@/platform/navigation';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/ui/dialog';
import { DataSyncNotice } from '@/component/data-sync';
import DetailPage from '../detail/DetailPage.vue';
import ManagementSection from '../component/ManagementSection.vue';
import FacilityFacts from './FacilityFacts.vue';
import FacilityFormDialog from './FacilityFormDialog.vue';
import WorkspaceAccess from './WorkspaceAccess.vue';
import Activity from './Activity.vue';
import StorageBrowser from '../../inventory/component/InventoryStorageBrowser.vue';
import { useManagementView } from '../useManagementView';
import { useFacilityContext, facilityPath, governancePath } from './context';

const route = useRoute(),
    router = useRouter(),
    navigation = useNavigationStore(),
    workspace = useWorkspaceStore(),
    source = useFacilityDataSource();
const { scope, organization, invalid, key: contextKey } = useFacilityContext();
const id = computed(() => (typeof route.params.facilityId === 'string' ? route.params.facilityId : ''));
const key = computed(() =>
    source && contextKey.value && id.value ? JSON.stringify([contextKey.value, id.value]) : ''
);
const { data, loading, busy, error, conflict, syncError, pendingSync, refresh, write } = useFacilityRead(
    key,
    (signal) => source?.detail(scope.value, id.value, signal) ?? Promise.resolve(undefined)
);
const editOpen = ref(false),
    stateTarget = ref<'active' | 'disabled' | 'archived'>();
watch(
    key,
    () => {
        editOpen.value = false;
        stateTarget.value = undefined;
    },
    { flush: 'sync' }
);
const views = [
    { value: 'overview', label: '概览' },
    { value: 'topology', label: '存储结构' },
    { value: 'workspace', label: '工作区关系' },
    { value: 'activity', label: '活动' },
];
const view = useManagementView(views);
const managementWorkspace = computed(() =>
    workspace.workspaces.find((item) => item.id === data.value?.managementWorkspaceId)
);
const disabled = computed(() => busy.value || loading.value || conflict.value || pendingSync.value);
const status = computed(() =>
    data.value ? (data.value.archivedAt ? '已归档' : data.value.disabledAt ? '已停用' : '正常') : undefined
);
const list = computed(() => {
    const last = navigation.lastLocation(facilityPath);
    return router.resolve(last).query.organization === scope.value.organizationId
        ? last
        : router.resolve({ path: facilityPath, query: { organization: scope.value.organizationId } }).fullPath;
});
async function search(query: string, page: number, signal: AbortSignal) {
    if (!source || !contextKey.value) return { items: [], total: 0 };
    const requestedScope = scope.value,
        request = { q: query, page, pageSize: 20, state: 'all' as const };
    const result = await source.list(requestedScope, request, signal);
    assertFacilityPage(requestedScope, request, result);
    return { items: result.items.map((item) => ({ id: item.id, name: item.name })), total: result.total };
}
function select(next: string) {
    stateTarget.value = undefined;
    void navigation.pushPreservingOrigin({
        path: `${facilityPath}/${encodeURIComponent(next)}`,
        query: { organization: scope.value.organizationId, view: route.query.view },
    });
}
async function changeState() {
    if (!source || !data.value || !stateTarget.value || !data.value.capabilities.govern) return;
    const facility = data.value,
        selectedScope = scope.value,
        state = stateTarget.value;
    if (
        await write((signal) =>
            source.state(selectedScope, facility.id, { expectedRevision: facility.revision, state }, signal)
        )
    )
        stateTarget.value = undefined;
}
</script>
<template>
    <DetailPage
        :id="id"
        :key="contextKey"
        v-model="view"
        :title="data?.name ?? '设施详情'"
        :icon="Building2"
        :subtitle="[data?.code, organization?.name].filter(Boolean).join(' · ')"
        :status="status"
        list-label="设施"
        :list-path="facilityPath"
        :list-to="list"
        :views="views"
        :search="search"
        :loading="loading"
        :error="invalid || error"
        @retry="refresh"
        @select="select"
    >
        <template #actions>
            <Button
                v-if="data?.capabilities.govern && !data.archivedAt"
                variant="outline"
                :disabled="disabled"
                @click="editOpen = true"
            >
                编辑设施
            </Button>
            <Button
                v-if="data?.capabilities.govern"
                variant="outline"
                :disabled="disabled"
                @click="stateTarget = data.archivedAt || data.disabledAt ? 'active' : 'disabled'"
            >
                {{ data.archivedAt ? '恢复' : data.disabledAt ? '启用' : '停用' }}
            </Button>
            <Button
                v-if="data?.capabilities.govern && !data.archivedAt"
                variant="outline"
                :disabled="disabled"
                @click="stateTarget = 'archived'"
            >
                归档
            </Button>
            <Button v-if="source" variant="outline" :disabled="busy || loading || !key" @click="refresh">
                <RotateCw aria-hidden="true" />
                刷新
            </Button>
            <Button v-if="data" variant="outline" as-child>
                <RouterLink
                    :to="{ path: governancePath, query: { organization: scope.organizationId, facility: data.id } }"
                >
                    <Network aria-hidden="true" />
                    设施治理
                </RouterLink>
            </Button>
        </template>
        <DataSyncNotice
            scope="设施"
            :error="syncError"
            :pending="pendingSync"
            :busy="busy || loading"
            @retry="refresh"
        />
        <p v-if="data && error" class="text-sm text-muted-foreground">当前显示上次读取结果</p>
        <template v-if="data">
            <template v-if="view === 'overview'">
                <dl class="grid gap-5 border-b pb-6 @min-[640px]:grid-cols-3">
                    <div>
                        <dt class="text-sm text-muted-foreground">存储布局</dt>
                        <dd class="mt-2 font-medium">{{ data.topology?.name ?? '不可用' }}</dd>
                    </div>
                    <div>
                        <dt class="text-sm text-muted-foreground">存储节点</dt>
                        <dd class="mt-2 text-xl font-semibold tabular-nums">{{ data.nodeCount }}</dd>
                    </div>
                    <div>
                        <dt class="text-sm text-muted-foreground">管理工作区</dt>
                        <dd class="mt-2 break-words font-medium">
                            {{ managementWorkspace?.name ?? data.managementWorkspaceId }}
                        </dd>
                    </div>
                </dl>
                <div class="grid min-w-0 gap-8 @min-[960px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    <ManagementSection title="基本资料">
                        <FacilityFacts :data="data" :organization-name="organization?.name" />
                    </ManagementSection>
                    <div class="space-y-8">
                        <ManagementSection title="管理工作区">
                            <Button
                                v-if="managementWorkspace"
                                variant="link"
                                class="h-auto max-w-full whitespace-normal p-0"
                                as-child
                            >
                                <RouterLink
                                    :to="{
                                        path: `/main/management/workspace/${data.managementWorkspaceId}`,
                                        query: { organization: scope.organizationId },
                                    }"
                                >
                                    <Folders class="shrink-0" />
                                    {{ managementWorkspace.name }}
                                </RouterLink>
                            </Button>
                            <p v-else class="break-all text-sm">{{ data.managementWorkspaceId }}</p>
                        </ManagementSection>
                        <ManagementSection title="存储结构">
                            <p class="text-sm text-muted-foreground">
                                {{ data.topology ? `${data.nodeCount} 个已登记节点` : '布局暂不可用' }}
                            </p>
                            <Button variant="outline" @click="view = 'topology'">浏览结构</Button>
                        </ManagementSection>
                        <ManagementSection title="管理与共享">
                            <p class="text-sm text-muted-foreground">
                                {{
                                    data.workspaceAccess === null
                                        ? '完整关系仅向治理上下文开放'
                                        : `${data.workspaceAccess.length} 个额外共享工作区`
                                }}
                            </p>
                            <Button variant="link" class="px-0" @click="view = 'workspace'">查看工作区关系</Button>
                        </ManagementSection>
                    </div>
                </div>
            </template>
            <StorageBrowser
                v-else-if="view === 'topology'"
                :facility="data"
                :context-key="key"
                @changed="refresh"
                @relocated="
                    (facility, node) =>
                        router.push({
                            path: `${facilityPath}/${facility}`,
                            query: { organization: scope.organizationId, view: 'topology', node },
                        })
                "
            />
            <ManagementSection v-else-if="view === 'workspace'" title="工作区使用与管理关系">
                <WorkspaceAccess :key="key" :facility="data" :scope="scope" :context-key="key" @changed="refresh" />
            </ManagementSection>
            <ManagementSection v-else title="近期活动">
                <Activity :organization-id="scope.organizationId" :resource-id="data.resourceId" :context-key="key" />
            </ManagementSection>
        </template>
    </DetailPage>
    <FacilityFormDialog v-model:open="editOpen" :scope="scope" :facility="data" @saved="refresh" />
    <Dialog :open="!!stateTarget" @update:open="!$event && (stateTarget = undefined)">
        <DialogContent>
            <DialogTitle>
                确认{{ stateTarget === 'archived' ? '归档' : stateTarget === 'disabled' ? '停用' : '恢复启用' }}设施？
            </DialogTitle>
            <DialogDescription>停用会禁止新增存放；归档要求先处理存量和活动子节点，不会删除历史。</DialogDescription>
            <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
            <Button v-if="conflict" variant="outline" @click="refresh">重新加载</Button>
            <div class="flex justify-end gap-2">
                <Button variant="outline" :disabled="busy" @click="stateTarget = undefined">取消</Button>
                <Button :disabled="disabled" @click="changeState">确认</Button>
            </div>
        </DialogContent>
    </Dialog>
</template>
