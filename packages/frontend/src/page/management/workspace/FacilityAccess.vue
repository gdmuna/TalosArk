<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useAccountStore } from '@/module/account';
import { useFacilityDataSource, useFacilityRead, type FacilityScope } from '@/module/facility';
import { Button } from '@/ui/button';
import FacilityInspector from '../facility/FacilityInspector.vue';
import Pagination from '../facility/Pagination.vue';
import ReadFeedback from '../facility/ReadFeedback.vue';
const props = defineProps<{ scope: FacilityScope & { workspaceId: string } }>();
const source = useFacilityDataSource(),
    account = useAccountStore();
const page = ref(1),
    previewId = ref<string | null>(null),
    previewOpen = ref(false);
const context = computed(() =>
    account.profile?.id && props.scope.organizationId && props.scope.workspaceId
        ? JSON.stringify([account.profile.id, props.scope])
        : ''
);
watch(
    context,
    () => {
        page.value = 1;
        previewId.value = null;
        previewOpen.value = false;
    },
    { flush: 'sync' }
);
const key = computed(() => (source && context.value ? JSON.stringify([context.value, page.value]) : ''));
const { data, loading, error, refresh } = useFacilityRead(
    key,
    (signal) =>
        source?.list(props.scope, { page: page.value, pageSize: 10, state: 'all' }, signal) ??
        Promise.resolve(undefined)
);
</script>
<template>
    <div class="space-y-4">
        <p class="text-sm text-muted-foreground">
            当前工作区上下文中可访问的设施。整处设施共享不授予其内部库存内容的访问权。
        </p>
        <ReadFeedback :error="error" :loading="loading" :stale="!!data" @retry="refresh" />
        <ul class="divide-y border-y">
            <li
                v-for="item in data?.items ?? []"
                :key="item.id"
                class="flex flex-wrap items-center justify-between gap-3 py-4"
            >
                <div class="min-w-0">
                    <p class="break-words font-medium">{{ item.name }}</p>
                    <p class="text-sm text-muted-foreground">
                        <template v-if="item.code">{{ item.code }} ·</template>
                        {{
                            item.managementWorkspaceId === scope.workspaceId ? '管理工作区设施' : '其他工作区管理的设施'
                        }}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    @click="
                        previewId = item.id;
                        previewOpen = true;
                    "
                >
                    预览设施
                </Button>
            </li>
        </ul>
        <p v-if="data && !data.total" class="text-sm text-muted-foreground">没有可访问的设施</p>
        <Pagination
            :page="page"
            :page-size="10"
            :total="data?.total"
            :loading="loading"
            :error="!!error"
            @page="page = $event"
        />
        <FacilityInspector
            :id="previewId"
            v-model:open="previewOpen"
            :scope="scope"
            :context-key="context"
            :show-detail="false"
        />
    </div>
</template>
