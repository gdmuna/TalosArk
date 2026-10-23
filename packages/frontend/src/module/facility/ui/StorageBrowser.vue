<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Network, Box, MapPin, List, Grid2X2, Plus, Pencil, ArrowUp, Search, RotateCw } from '@lucide/vue';
import { useFacilityDataSource, useFacilityRead } from '../model/read';
import { useStorageNodePages } from '../model/useStorageNodePages';
import type { FacilityDetail, StorageNode, StorageNodeDetail } from '../data/source';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { ScrollSurface } from '@/component/scroll-surface';
import { StateBadge } from '@/component/state-badge';
import { CopyableId } from '@/component/inspector';
import StorageBranch from './StorageBranch.vue';
import StorageCommand from './StorageCommand.vue';
import ReadFeedback from './ReadFeedback.vue';
import { Field, FieldLabel } from '@/ui/field';

const searchId = useId();

const props = defineProps<{
    facility: FacilityDetail;
    contextKey: string;
    workspaceId?: string;
    selectable?: boolean;
}>();
const emit = defineEmits<{
    changed: [];
    relocated: [facilityId: string, nodeId: string];
    'select-position': [node: StorageNodeDetail | undefined];
}>();
const route = useRoute(),
    router = useRouter(),
    source = useFacilityDataSource();
const epoch = ref(0);
const scope = computed(() => ({
    organizationId: props.facility.organizationId,
    facilityId: props.facility.id,
    topologyId: props.facility.topology?.id ?? '',
    workspaceId: props.workspaceId,
}));
const context = computed(() =>
    props.contextKey && props.facility.topology
        ? JSON.stringify([props.contextKey, scope.value, epoch.value, props.facility.topology.revision])
        : ''
);
const selected = computed(() => (typeof route.query.node === 'string' ? route.query.node : ''));
const nodeKey = computed(() =>
    source && context.value && selected.value ? JSON.stringify([context.value, selected.value]) : ''
);
const node = useFacilityRead(
    nodeKey,
    (signal) => source?.node(scope.value, selected.value, signal) ?? Promise.resolve(undefined)
);
watch(
    node.data,
    (value) => {
        if (!value?.usable) emit('select-position', undefined);
    },
    { flush: 'sync' }
);
const parentKey = computed(() =>
    source && context.value && node.data.value?.kind === 'POSITION' && node.data.value.parentId
        ? JSON.stringify([context.value, node.data.value.parentId])
        : ''
);
const parentRead = useFacilityRead(parentKey, (signal) => {
    const id = node.data.value?.parentId;
    return source && id ? source.node(scope.value, id, signal) : Promise.resolve(undefined);
});
const parentId = computed(() =>
    node.data.value?.kind === 'POSITION' ? node.data.value.parentId : (node.data.value?.id ?? null)
);
const draft = ref(''),
    query = ref(''),
    mode = ref<'list' | 'grid' | 'positions'>('list');
watch(
    () => props.contextKey,
    () => {
        draft.value = query.value = '';
        mode.value = 'list';
    },
    { flush: 'sync' }
);
const contentContext = computed(() =>
    source && context.value && (!selected.value || node.data.value)
        ? JSON.stringify([context.value, parentId.value, mode.value, query.value])
        : ''
);
const listing = useStorageNodePages(contentContext, async (cursor, signal) => {
    if (!source) return;
    return source.children(
        scope.value,
        {
            parentId: query.value ? null : parentId.value,
            q: query.value,
            mode: mode.value === 'positions' ? 'positions' : query.value ? 'search' : 'children',
            state: 'all',
            limit: 100,
            cursor,
        },
        signal
    );
});
const parent = computed(() => (node.data.value?.kind === 'CONTAINER' ? node.data.value : parentRead.data.value));
const gridAllowed = computed(
    () =>
        !!parent.value?.rowCount &&
        !!parent.value.columnCount &&
        parent.value.rowCount * parent.value.columnCount <= 10000
);
const showGrid = computed(() => mode.value === 'grid' && gridAllowed.value && !query.value);
const gridNodes = computed(
    () => listing.data.value?.items.filter((item) => item.rowIndex !== null && item.columnIndex !== null) ?? []
);
const gridElement = ref<HTMLElement>();
const gridFocus = ref('');
let pendingGridFocus = '';
watch(gridNodes, async (items) => {
    if (!items.some((item) => item.id === gridFocus.value)) gridFocus.value = items[0]?.id ?? '';
    if (!pendingGridFocus || !items.some((item) => item.id === pendingGridFocus)) return;
    gridFocus.value = pendingGridFocus;
    pendingGridFocus = '';
    await nextTick();
    gridElement.value
        ?.querySelector<HTMLButtonElement>(`[data-position-id="${gridFocus.value}"]`)
        ?.focus({ preventScroll: true });
});
async function navigateGrid(event: KeyboardEvent, item: StorageNode) {
    if (event.key === 'Escape') {
        event.preventDefault();
        select(parentId.value);
        return;
    }
    const directions: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    const row = item.rowIndex,
        column = item.columnIndex;
    if (!direction || row === null || column === null) return;
    event.preventDefault();
    const [dx, dy] = direction;
    let target: StorageNode | undefined;
    let distance = Infinity;
    for (const node of gridNodes.value) {
        if (node.rowIndex === null || node.columnIndex === null) continue;
        if (dx ? node.rowIndex !== row : node.columnIndex !== column) continue;
        const delta = dx ? (node.columnIndex - column) * dx : (node.rowIndex - row) * dy;
        if (delta > 0 && delta < distance) {
            target = node;
            distance = delta;
        }
    }
    if (!target) return;
    gridFocus.value = target.id;
    await nextTick();
    const button = gridElement.value?.querySelector<HTMLButtonElement>(`[data-position-id="${target.id}"]`);
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
}
function selectGrid(item: StorageNode, event: MouseEvent) {
    if (event.detail === 0) pendingGridFocus = item.id;
    select(item.id);
}
const listNodes = computed(() =>
    showGrid.value
        ? (listing.data.value?.items.filter((item) => item.rowIndex === null || item.columnIndex === null) ?? [])
        : (listing.data.value?.items ?? [])
);
const ancestors = computed(() => node.data.value?.ancestors.map((item) => item.id) ?? []);
const commandMode = ref<'create' | 'edit' | 'grid' | 'move' | 'reorder' | 'state'>('create');
const commandState = ref<'active' | 'disabled' | 'archived'>('active');
const commandNode = ref<StorageNodeDetail>();
const commandOpen = ref(false);
watch(
    context,
    () => {
        commandOpen.value = false;
    },
    { flush: 'sync' }
);
function select(id: string | null) {
    query.value = draft.value = '';
    void router.replace({ query: { ...route.query, node: id ?? undefined, topology: undefined }, hash: route.hash });
}
function command(mode: typeof commandMode.value, state?: typeof commandState.value) {
    commandMode.value = mode;
    commandNode.value = mode === 'create' || mode === 'grid' ? parent.value : node.data.value;
    if (state) commandState.value = state;
    commandOpen.value = true;
}
function changed(id?: string, facilityId?: string) {
    emit('changed');
    epoch.value++;
    if (facilityId && facilityId !== props.facility.id) {
        emit('relocated', facilityId, id ?? '');
    } else if (id) select(id);
}
function reload() {
    epoch.value++;
    emit('changed');
}
const unavailable: Record<string, string> = {
    archived: '已归档',
    disabled: '已停用',
    occupied: '已占用',
    'not-position': '容器不是最终位置',
    'no-use-permission': '无使用权限',
};
</script>
<template>
    <div class="@container/storage space-y-5" data-slot="storage-browser">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex min-w-0 items-start gap-3">
                <Network class="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div class="min-w-0">
                    <h2 class="break-words text-base font-semibold">{{ facility.name }}</h2>
                    <p class="mt-1 break-words text-xs text-muted-foreground">
                        {{ [facility.code, facility.topology?.name ?? '存储布局不可用'].filter(Boolean).join(' · ') }}
                    </p>
                </div>
            </div>
            <Button variant="outline" size="sm" @click="reload">
                <RotateCw aria-hidden="true" />
                刷新布局
            </Button>
        </div>
        <p v-if="!facility.topology" class="py-8 text-sm text-muted-foreground">该设施没有可访问的活动布局。</p>
        <div
            v-else
            class="grid min-w-0 gap-6 @min-[800px]/storage:grid-cols-[220px_minmax(0,1fr)] @min-[1000px]/storage:grid-cols-[220px_minmax(0,1fr)_260px]"
        >
            <aside
                class="min-w-0 space-y-3 border-b pb-4 @min-[800px]/storage:border-r @min-[800px]/storage:border-b-0 @min-[800px]/storage:pr-4"
                aria-label="设施结构"
            >
                <h2 class="text-sm font-semibold">存储结构</h2>
                <Button
                    variant="ghost"
                    class="h-auto min-h-9 w-full justify-start whitespace-normal text-left"
                    :class="{ 'bg-primary-soft text-primary': !selected }"
                    @click="select(null)"
                >
                    {{ facility.name }}
                </Button>
                <ScrollSurface class="max-h-[640px] min-w-0" edge-effect="line">
                    <StorageBranch
                        :key="context"
                        :scope="scope"
                        :parent-id="null"
                        :context-key="context"
                        :selected="selected"
                        :ancestors="ancestors"
                        @select="select"
                    />
                </ScrollSurface>
            </aside>
            <section class="min-w-0 space-y-4" aria-label="存储节点与位置">
                <nav aria-label="存储路径" class="flex flex-wrap items-center gap-1 text-sm">
                    <Button variant="link" size="sm" class="px-0" @click="select(null)">{{ facility.name }}</Button>
                    <template v-for="ancestor in node.data.value?.ancestors ?? []" :key="ancestor.id">
                        <span class="text-muted-foreground">/</span>
                        <Button
                            variant="link"
                            size="sm"
                            class="h-auto max-w-40 whitespace-normal px-1 text-left"
                            @click="select(ancestor.id)"
                        >
                            {{ ancestor.name }}
                        </Button>
                    </template>
                    <template v-if="node.data.value">
                        <span class="text-muted-foreground">/</span>
                        <span class="break-words font-medium">{{ node.data.value.name }}</span>
                    </template>
                </nav>
                <ReadFeedback
                    :error="node.error.value"
                    :loading="node.loading.value"
                    :stale="!!node.data.value"
                    @retry="node.refresh"
                />
                <ReadFeedback
                    :error="parentRead.error.value"
                    :loading="parentRead.loading.value"
                    @retry="parentRead.refresh"
                />
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <Button
                        v-if="selected && node.data.value"
                        variant="outline"
                        size="sm"
                        @click="select(node.data.value.parentId)"
                    >
                        <ArrowUp aria-hidden="true" />
                        上一级
                    </Button>
                    <div class="flex gap-1" role="group" aria-label="存储视图">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            use-tooltip
                            title="列表视图"
                            :aria-pressed="mode === 'list'"
                            :class="{ 'bg-muted': mode === 'list' }"
                            @click="mode = 'list'"
                        >
                            <List aria-hidden="true" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            use-tooltip
                            title="网格视图"
                            :aria-pressed="mode === 'grid'"
                            :class="{ 'bg-muted': mode === 'grid' }"
                            @click="mode = 'grid'"
                        >
                            <Grid2X2 aria-hidden="true" />
                        </Button>
                        <Button
                            v-if="facility.capabilities.use"
                            variant="ghost"
                            size="sm"
                            :aria-pressed="mode === 'positions'"
                            :class="{ 'bg-muted': mode === 'positions' }"
                            @click="mode = 'positions'"
                        >
                            <MapPin aria-hidden="true" />
                            可用位置
                        </Button>
                    </div>
                    <Button
                        v-if="facility.capabilities.manage && !facility.archivedAt && (!selected || parent)"
                        size="sm"
                        :disabled="
                            node.loading.value ||
                            !!node.error.value ||
                            parentRead.loading.value ||
                            !!parentRead.error.value ||
                            !!parent?.archivedAt
                        "
                        @click="command('create')"
                    >
                        <Plus aria-hidden="true" />
                        新增{{ selected ? '子节点' : '根节点' }}
                    </Button>
                </div>
                <form class="flex gap-2" @submit.prevent="query = draft.trim()">
                    <Field class="min-w-0 flex-1">
                        <FieldLabel :for="searchId" class="sr-only">搜索存储节点</FieldLabel>
                        <Input
                            :id="searchId"
                            v-model="draft"
                            maxlength="160"
                            aria-label="搜索存储节点"
                            placeholder="搜索节点名称或编号"
                        />
                    </Field>
                    <Button variant="outline" size="icon-sm" use-tooltip title="搜索存储节点">
                        <Search aria-hidden="true" />
                    </Button>
                </form>
                <ReadFeedback
                    :error="listing.error.value"
                    :loading="listing.loading.value"
                    :stale="!!listing.data.value"
                    @retry="reload"
                />
                <p v-if="listing.loading.value" role="status" class="text-sm text-muted-foreground">正在读取节点</p>
                <p v-if="mode === 'grid' && !gridAllowed" class="text-sm text-muted-foreground">
                    选择具有网格规格的容器预览孔位。大型网格使用列表浏览。
                </p>
                <div
                    v-if="showGrid"
                    ref="gridElement"
                    class="max-h-[560px] overflow-auto scroll-smooth rounded-md border p-3"
                    aria-label="存储位置网格"
                >
                    <div
                        class="grid w-max gap-2"
                        :style="{
                            gridTemplateColumns: `24px repeat(${parent?.columnCount}, 48px)`,
                            gridTemplateRows: `24px repeat(${parent?.rowCount}, 48px)`,
                        }"
                    >
                        <span
                            v-for="column in parent?.columnCount ?? 0"
                            :key="`column-${column}`"
                            class="text-center text-xs tabular-nums text-muted-foreground"
                            :style="{ gridRow: 1, gridColumn: column + 1 }"
                            aria-hidden="true"
                        >
                            {{ column }}
                        </span>
                        <span
                            v-for="row in parent?.rowCount ?? 0"
                            :key="`row-${row}`"
                            class="flex items-center text-xs tabular-nums text-muted-foreground"
                            :style="{ gridRow: row + 1, gridColumn: 1 }"
                            aria-hidden="true"
                        >
                            {{ row }}
                        </span>
                        <Button
                            v-for="item in gridNodes"
                            :key="item.id"
                            variant="outline"
                            class="relative size-12 min-w-0 px-1 text-xs"
                            :class="{
                                'border-primary bg-primary-soft text-primary': selected === item.id,
                                'bg-muted text-muted-foreground': !item.usable,
                            }"
                            :style="{
                                gridRow: item.rowIndex === null ? undefined : item.rowIndex + 1,
                                gridColumn: item.columnIndex === null ? undefined : item.columnIndex + 1,
                            }"
                            :data-position-id="item.id"
                            :tabindex="gridFocus === item.id ? 0 : -1"
                            :aria-pressed="selected === item.id"
                            :aria-label="`${item.name}，${item.rowIndex} 行 ${item.columnIndex} 列，${item.occupied ? '已占用' : item.usable ? '可用' : (unavailable[item.unavailableReason ?? ''] ?? '容器')}`"
                            use-tooltip
                            :tooltip="`${item.name} · ${item.rowIndex} 行 ${item.columnIndex} 列 · ${item.occupied ? '已占用' : item.usable ? '可用' : (unavailable[item.unavailableReason ?? ''] ?? '容器')}`"
                            @focus="gridFocus = item.id"
                            @keydown="navigateGrid($event, item)"
                            @click="selectGrid(item, $event)"
                        >
                            <span v-if="item.occupied" class="absolute right-0.5 top-0.5" aria-hidden="true">
                                <MapPin class="size-2.5" />
                            </span>
                            <span class="truncate">{{ item.code ?? item.name }}</span>
                        </Button>
                    </div>
                </div>
                <ul
                    v-if="showGrid"
                    class="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"
                    aria-label="孔位状态图例"
                >
                    <li class="flex items-center gap-2">
                        <span class="size-3 rounded-sm border bg-card" />
                        可用
                    </li>
                    <li class="flex items-center gap-2">
                        <MapPin class="size-3" aria-hidden="true" />
                        已占用
                    </li>
                    <li class="flex items-center gap-2">
                        <span class="size-3 rounded-sm border bg-muted" />
                        不可用
                    </li>
                    <li class="flex items-center gap-2">
                        <span class="size-3 rounded-sm border border-primary bg-primary-soft" />
                        已选
                    </li>
                </ul>
                <ul v-if="!showGrid || listNodes.length" class="divide-y border-y">
                    <li v-for="item in listNodes" :key="item.id">
                        <button
                            class="flex w-full items-center justify-between gap-3 py-3 text-left"
                            @click="select(item.id)"
                        >
                            <span class="flex min-w-0 items-start gap-2">
                                <component
                                    :is="item.kind === 'POSITION' ? MapPin : Box"
                                    class="mt-0.5 size-4 shrink-0 text-primary"
                                    aria-hidden="true"
                                />
                                <span class="min-w-0">
                                    <span class="block break-words text-sm font-medium">{{ item.name }}</span>
                                    <span v-if="item.code" class="block break-all text-xs text-muted-foreground">
                                        {{ item.code }}
                                    </span>
                                </span>
                            </span>
                            <StateBadge
                                :tone="
                                    item.archivedAt
                                        ? 'neutral'
                                        : item.disabledAt
                                          ? 'warning'
                                          : item.occupied
                                            ? 'primary'
                                            : 'neutral'
                                "
                            >
                                {{
                                    item.archivedAt
                                        ? '已归档'
                                        : item.disabledAt
                                          ? '已停用'
                                          : item.occupied
                                            ? '已占用'
                                            : item.kind === 'POSITION'
                                              ? '未占用'
                                              : '容器'
                                }}
                            </StateBadge>
                        </button>
                    </li>
                </ul>
                <p
                    v-if="listing.data.value && !listing.data.value.items.length"
                    class="py-8 text-center text-sm text-muted-foreground"
                >
                    {{ mode === 'positions' ? '没有可选的可用位置' : '没有匹配节点' }}
                </p>
                <Button
                    v-if="listing.data.value?.nextCursor"
                    variant="outline"
                    :disabled="listing.loading.value || !!listing.error.value"
                    @click="listing.more"
                >
                    加载更多节点
                </Button>
            </section>
            <aside
                class="min-w-0 space-y-4 border-t pt-4 @min-[800px]/storage:col-span-2 @min-[1000px]/storage:col-span-1 @min-[1000px]/storage:border-t-0 @min-[1000px]/storage:border-l @min-[1000px]/storage:pt-0 @min-[1000px]/storage:pl-4"
                aria-label="存储节点详情"
            >
                <h2 class="text-sm font-semibold">节点信息</h2>
                <p v-if="!selected" class="text-sm text-muted-foreground">选择节点查看位置与层级。</p>
                <template v-if="node.data.value">
                    <h3 class="break-words font-semibold">{{ node.data.value.name }}</h3>
                    <CopyableId :value="node.data.value.id" label="节点 ID" />
                    <dl class="space-y-3 text-sm">
                        <div class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">编号</dt>
                            <dd class="break-all">{{ node.data.value.code ?? '未填写' }}</dd>
                        </div>
                        <div class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">类型</dt>
                            <dd>{{ node.data.value.kind === 'POSITION' ? '物理位置' : '容器' }}</dd>
                        </div>
                        <div v-if="node.data.value.rowIndex" class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">坐标</dt>
                            <dd>{{ node.data.value.rowIndex }} 行 / {{ node.data.value.columnIndex }} 列</dd>
                        </div>
                        <div v-if="node.data.value.rowCount" class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">网格规格</dt>
                            <dd>{{ node.data.value.rowCount }} × {{ node.data.value.columnCount }}</dd>
                        </div>
                        <div class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">状态</dt>
                            <dd>
                                {{
                                    node.data.value.archivedAt
                                        ? '已归档'
                                        : node.data.value.disabledAt
                                          ? '已停用'
                                          : '正常'
                                }}
                            </dd>
                        </div>
                        <div v-if="node.data.value.kind === 'POSITION'" class="flex justify-between gap-3">
                            <dt class="text-muted-foreground">可用性</dt>
                            <dd>
                                {{
                                    node.data.value.usable
                                        ? '可用'
                                        : (unavailable[node.data.value.unavailableReason ?? ''] ?? '不可用')
                                }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-muted-foreground">说明</dt>
                            <dd class="mt-1 whitespace-pre-wrap break-words">
                                {{ node.data.value.description ?? '—' }}
                            </dd>
                        </div>
                    </dl>
                    <slot
                        v-if="!node.loading.value && !node.error.value"
                        name="node-content"
                        :node="node.data.value"
                        :scope="scope"
                    />
                    <div
                        v-if="node.data.value.capabilities.manage && !facility.archivedAt"
                        class="flex flex-wrap gap-2 border-t pt-4"
                    >
                        <Button
                            v-if="!node.data.value.archivedAt"
                            variant="outline"
                            size="sm"
                            :disabled="node.loading.value || !!node.error.value"
                            @click="command('edit')"
                        >
                            <Pencil aria-hidden="true" />
                            编辑
                        </Button>
                        <Button
                            v-if="parent?.rowCount && parent.columnCount && !parent.archivedAt"
                            variant="outline"
                            size="sm"
                            :disabled="node.loading.value || !!node.error.value || !!parentRead.error.value"
                            @click="command('grid')"
                        >
                            生成孔位
                        </Button>
                        <Button
                            v-if="!node.data.value.archivedAt"
                            variant="outline"
                            size="sm"
                            :disabled="node.loading.value || !!node.error.value"
                            @click="command('move')"
                        >
                            移动空子树
                        </Button>
                        <slot
                            v-if="!node.loading.value && !node.error.value"
                            name="node-action"
                            :node="node.data.value"
                            :scope="scope"
                        />
                        <Button
                            v-if="!node.data.value.archivedAt"
                            variant="outline"
                            size="sm"
                            :disabled="node.loading.value || !!node.error.value"
                            @click="command('reorder')"
                        >
                            调整顺序
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            :disabled="node.loading.value || !!node.error.value"
                            @click="
                                command(
                                    'state',
                                    node.data.value.archivedAt || node.data.value.disabledAt ? 'active' : 'disabled'
                                )
                            "
                        >
                            {{ node.data.value.archivedAt || node.data.value.disabledAt ? '恢复启用' : '停用' }}
                        </Button>
                        <Button
                            v-if="!node.data.value.archivedAt"
                            variant="outline"
                            size="sm"
                            :disabled="node.loading.value || !!node.error.value"
                            @click="command('state', 'archived')"
                        >
                            归档
                        </Button>
                    </div>
                    <Button
                        v-if="selectable && node.data.value.kind === 'POSITION'"
                        class="w-full"
                        :disabled="!node.data.value.usable || !!node.error.value"
                        @click="emit('select-position', node.data.value)"
                    >
                        选用此位置
                    </Button>
                </template>
            </aside>
        </div>
        <StorageCommand
            v-model:open="commandOpen"
            :scope="scope"
            :context-key="context"
            :node="commandNode"
            :mode="commandMode"
            :state="commandState"
            @changed="changed"
        />
    </div>
</template>
