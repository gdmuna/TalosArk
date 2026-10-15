<script setup lang="ts" generic="T extends { id: string }">
import { computed, ref, useTemplateRef, type CSSProperties } from 'vue';
import { useElementSize } from '@vueuse/core';
import {
    ArrowDown,
    ArrowUp,
    EyeOff,
    WrapText,
    ListFilter,
    Check,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Info,
    SearchX,
    Search,
    X,
    EllipsisVertical,
    RotateCcw,
    SlidersHorizontal,
} from '@lucide/vue';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';
import { Button } from '@/ui/button';
import { ButtonGroup } from '@/ui/button-group';
import { Checkbox } from '@/ui/checkbox';
import { Input } from '@/ui/input';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/ui/empty';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
} from '@/ui/dropdown-menu';
import { SelectField } from '@/component/select-field';
import { ScrollArea } from '@/ui/scroll-area';
import { EdgeBoundary } from '@/component/scroll-surface';
import TableViewHelp from './control/TableViewHelp.vue';
import DataTableFilters from './control/DataTableFilterMenu.vue';
import DataTableSorting from './control/DataTableSorting.vue';
import DataTableVisibility from './control/DataTableVisibility.vue';
import DataTableFilterOptions from './control/DataTableFilterInput.vue';
import DataTableBulkActions from './control/DataTableBulkActionMenu.vue';
import { useDragReorder } from './interaction/useDragReorder';
import { useTableLayout } from './layout/useTableLayout';
import { measureGridInsets } from './layout/geometry';
import { useColumnResize } from './interaction/useColumnResize';
import RecordPreview from './RecordPreview.vue';
import { useTableModel } from './model/useTableModel';
import type { SortingState } from '@tanstack/vue-table';
import type { DataTableAction, DataTableBulkAction, DataTableColumn, DataTableFilter } from './type';

const props = withDefaults(
    defineProps<{
        data: T[];
        columns: DataTableColumn<T>[];
        filterFields?: DataTableFilter<T>[];
        searchText?: (row: T) => string;
        searchLabel?: string;
        emptyText?: string;
        selectable?: (row: T) => boolean;
        activeId?: string | null;
        initialSorting?: SortingState;
        tableClass?: string;
        actions?: DataTableAction<T>[];
        bulkActions?: DataTableBulkAction<T>[];
        busy?: boolean;
        minRows?: number;
        minHeight?: number;
        maxHeight?: number | string;
        preview?: (row: T) => void;
    }>(),
    {
        filterFields: () => [],
        searchLabel: '搜索',
        emptyText: '没有符合条件的数据',
        initialSorting: () => [],
        tableClass: '',
        actions: () => [],
        bulkActions: () => [],
        minRows: 3,
    }
);

const query = defineModel<string>('query', { default: '' });
const filters = defineModel<Record<string, string[]>>('filters', { default: () => ({}) });
const selected = defineModel<string[]>('selected', { default: () => [] });
const root = useTemplateRef<HTMLElement>('root');
const { width: availableWidth } = useElementSize(root);
const model = useTableModel(props, { query, filters, selected }, availableWidth);
const {
    api,
    pageInput,
    pageError,
    pageCount,
    pageRows,
    pageSize,
    pageSelection,
    selectPage,
    resolvedFilterFields,
    filterById,
    primaryActions,
    sortableColumns,
    visibleColumns,
    columnById,
    widths,
    contentWidth,
    canHideColumn,
    setColumnVisibility,
    showAllColumns,
    selectableRows,
} = model;
const {
    filteredRows,
    selectedRows,
    sorting,
    paginationMode,
    canPrevious,
    canNext,
    jumpToPage,
    previousPage,
    nextPage,
    setFilter,
    clearSelection,
    columnOrder,
    columnVisibility,
    columnWrapping,
    resizeColumn,
} = api;
const previewId = ref<string | null>(null);
const previewRow = computed(() => props.data.find((row) => row.id === previewId.value));
const previewOpen = computed({
    get: () => !!previewRow.value,
    set: (value) => {
        if (!value) previewId.value = null;
    },
});
function showPreview(row: T) {
    if (props.preview) props.preview(row);
    else previewId.value = row.id;
}
function previewCell(event: MouseEvent, row: T) {
    if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea, [role="button"]'))
        return;
    showPreview(row);
}
const headerReorder = useDragReorder(
    'x',
    () => columnOrder.value,
    (ids) => (columnOrder.value = ids),
    {
        root: () => frame.value?.querySelector<HTMLElement>('thead tr'),
        container: () => horizontalViewport.value,
        destinationHost: () => headerOverlay.value,
        destinationInsets: measureGridInsets,
        destinationClip: () => {
            const viewport = horizontalViewport.value?.getBoundingClientRect();
            const actions = frame.value?.querySelector('thead [data-pinned="end"]')?.getBoundingClientRect();
            if (!viewport || !actions) return;
            return {
                x: viewport.x,
                y: viewport.y,
                width: Math.max(0, actions.x - viewport.x),
                height: viewport.height,
            };
        },
        elements: columnMotionElements,
        sourceContent: (source) => [...source.children].filter((element) => element instanceof HTMLElement),
        keepSourceVisible: true,
    }
);
const { dragging: headerDragging, phase: headerPhase } = headerReorder;
const horizontalViewport = useTemplateRef<HTMLElement>('horizontalViewport');
const frame = useTemplateRef<HTMLElement>('frame');
const headerOverlay = useTemplateRef<HTMLElement>('headerOverlay');
const headerViewport = useTemplateRef<HTMLElement>('headerViewport');
const footer = useTemplateRef<HTMLElement>('footer');
const recordBody = useTemplateRef<InstanceType<typeof TableBody>>('recordBody');
const verticalViewport = useTemplateRef<InstanceType<typeof ScrollArea>>('verticalViewport');
function columnMotionElements(root: HTMLElement) {
    const groups = new Map(
        [...root.querySelectorAll<HTMLElement>('[data-reorder-id]')].map((element) => [
            element.dataset.reorderId as string,
            [element],
        ])
    );
    for (const row of frame.value?.querySelectorAll<HTMLElement>('tbody tr') ?? []) {
        for (const cell of row.querySelectorAll<HTMLElement>('[data-column]')) {
            groups.get(cell.dataset.column as string)?.push(cell);
        }
    }
    return groups;
}
const { frameStyle, stickyRight, verticalStyle, emptyHeight } = useTableLayout(
    frame,
    horizontalViewport,
    contentWidth,
    props,
    {
        header: headerViewport,
        footer,
        records: computed(() => recordBody.value?.$el as HTMLElement | undefined),
        viewport: computed(() => verticalViewport.value?.viewportElement),
    }
);
const actionsOverlap = computed(() => !!props.actions.length && stickyRight.value > 1);
const actionsFadeStyle: CSSProperties = { right: 'calc(100%)' };
const resizeHandleLimit = computed(() => contentWidth.value - stickyRight.value - (widths.value.__actions ?? 0));
function cellStyle(id: string, header = false): CSSProperties {
    return {
        ...(id === '__actions'
            ? ({
                  position: 'sticky',
                  right: header ? '0px' : 'var(--data-table-sticky-right)',
                  zIndex: header ? 15 : 5,
              } as const)
            : {}),
    };
}
const { resizing, startResize } = useColumnResize({
    frame,
    canStart: () => headerPhase.value === 'idle',
    getSize: (id) => widths.value[id] ?? 160,
    resize: resizeColumn,
});
defineExpose(api);
</script>

<template>
    <div
        ref="root"
        class="flex w-full min-h-0 min-w-0 flex-col gap-3"
        data-slot="data-table"
        :data-pagination-mode="paginationMode"
    >
        <div class="@container/table-toolbar max-w-full shrink-0" :style="{ width: contentWidth + 2 + 'px' }">
            <div
                class="flex flex-wrap items-center gap-3 @min-[600px]/table-toolbar:flex-nowrap"
                data-slot="data-table-toolbar"
            >
                <div class="relative min-w-0 flex-1 basis-full @min-[600px]/table-toolbar:basis-0">
                    <div class="overflow-x-auto scroll-smooth [scrollbar-width:none] motion-reduce:scroll-auto">
                        <div class="flex w-max min-w-full items-center gap-3">
                            <slot name="filters-before" />
                            <DataTableFilters v-model="filters" :fields="resolvedFilterFields" />
                            <DataTableSorting v-model="sorting" :columns="sortableColumns" />
                            <DataTableVisibility
                                v-if="!actions.length"
                                v-model:order="columnOrder"
                                :visibility="columnVisibility"
                                :columns="columns"
                                :can-hide="canHideColumn"
                                @toggle="setColumnVisibility($event, columnVisibility[$event] === false)"
                                @show-all="showAllColumns"
                            />
                            <DataTableBulkActions
                                v-if="bulkActions.length"
                                :rows="selectedRows"
                                :actions="bulkActions"
                                :busy="busy"
                                @clear="clearSelection"
                            />
                        </div>
                    </div>
                </div>
                <div class="relative w-full min-w-0 shrink-0 @min-[600px]/table-toolbar:w-64">
                    <Search
                        class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <Input
                        v-model="query"
                        class="h-8 bg-card pl-9 pr-8"
                        :placeholder="searchLabel"
                        :aria-label="searchLabel"
                    />
                    <Button
                        v-if="query"
                        variant="ghost"
                        size="icon-sm"
                        class="absolute right-0.5 top-1/2 size-7 -translate-y-1/2 text-muted-foreground"
                        use-tooltip
                        title="清除搜索"
                        aria-label="清除搜索"
                        @click="query = ''"
                    >
                        <X class="size-3.5" aria-hidden="true" />
                    </Button>
                </div>
            </div>
        </div>
        <p
            v-if="paginationMode === 'cursor'"
            role="status"
            class="flex shrink-0 items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
        >
            <Info class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            结果超过 1000 页，已切换为连续浏览。请使用上一页、下一页，或缩小筛选范围后按页码跳转。
        </p>
        <div
            ref="frame"
            class="@container/table-frame flex min-h-0 max-w-full flex-col overflow-hidden rounded-lg border bg-card"
            :style="frameStyle"
            data-slot="data-table-frame"
        >
            <div
                ref="horizontalViewport"
                tabindex="0"
                role="region"
                aria-label="横向滚动表格"
                class="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden scroll-smooth outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:scroll-auto"
                data-slot="data-table-body"
            >
                <div
                    role="table"
                    :aria-label="`${columns[0]?.label ?? '数据'}表`"
                    :aria-colcount="visibleColumns.length"
                    :aria-rowcount="Math.max(1, pageRows.length) + 1"
                    class="flex min-h-0 shrink-0 flex-col"
                    :style="verticalStyle"
                >
                    <div ref="headerViewport" class="shrink-0" data-slot="data-table-header">
                        <Table
                            role="presentation"
                            :class="['table-fixed border-separate border-spacing-0', tableClass]"
                            container-class="overflow-clip isolate"
                            :style="{ width: contentWidth + 'px' }"
                        >
                            <colgroup>
                                <col
                                    v-for="column in visibleColumns"
                                    :key="column.id"
                                    :style="{ width: widths[column.id] + 'px' }"
                                />
                            </colgroup>
                            <TableHeader role="rowgroup" class="relative z-10 bg-card">
                                <TableRow
                                    role="row"
                                    aria-rowindex="1"
                                    class="hover:bg-transparent"
                                    :data-reorder-phase="headerPhase"
                                >
                                    <TableHead
                                        v-for="(column, columnIndex) in visibleColumns"
                                        :key="column.id"
                                        role="columnheader"
                                        :aria-colindex="columnIndex + 1"
                                        :data-column="column.id"
                                        :data-reorder-id="columnById.has(column.id) ? column.id : undefined"
                                        :data-reorder-source="headerDragging === column.id ? '' : undefined"
                                        :data-pinned="column.id === '__actions' ? 'end' : undefined"
                                        :aria-label="column.id === '__actions' ? '操作' : undefined"
                                        :style="cellStyle(column.id, true)"
                                        :class="[
                                            'data-table-cell relative border-r border-b border-transparent bg-card p-0 last:border-r-0',
                                            column.id === '__select' && 'text-center',
                                            column.id === '__actions' && 'data-table-actions',
                                            columnById.get(column.id)?.align === 'right' ? 'text-right' : 'text-left',
                                        ]"
                                        :aria-sort="
                                            column.getIsSorted() === 'asc'
                                                ? 'ascending'
                                                : column.getIsSorted() === 'desc'
                                                  ? 'descending'
                                                  : 'none'
                                        "
                                    >
                                        <EdgeBoundary
                                            v-if="column.id === '__actions'"
                                            side="right"
                                            :active="actionsOverlap"
                                            :style="actionsFadeStyle"
                                        />
                                        <Checkbox
                                            v-if="column.id === '__select'"
                                            class="mx-auto static after:inset-0"
                                            aria-label="选择本页全部可选项"
                                            :disabled="!selectableRows.length"
                                            :model-value="pageSelection"
                                            @update:model-value="selectPage($event === true)"
                                        />
                                        <div
                                            v-else-if="column.id === '__actions'"
                                            class="flex h-10 items-center justify-start p-2.5"
                                        >
                                            <DataTableVisibility
                                                v-model:order="columnOrder"
                                                :visibility="columnVisibility"
                                                :columns="columns"
                                                :can-hide="canHideColumn"
                                                @toggle="
                                                    setColumnVisibility($event, columnVisibility[$event] === false)
                                                "
                                                @show-all="showAllColumns"
                                            />
                                        </div>
                                        <div v-else class="min-w-0">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger as-child>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        class="h-10 w-full min-w-0 justify-start gap-2 rounded-none px-2.5 font-medium hover:bg-accent"
                                                        :aria-label="`${columnById.get(column.id)?.label ?? '操作'}列菜单`"
                                                        :title="`${columnById.get(column.id)?.label ?? '操作'}列菜单`"
                                                        draggable="true"
                                                        @dragstart="headerReorder.start($event, column.id)"
                                                        @dragend="headerReorder.end"
                                                    >
                                                        <component
                                                            :is="columnById.get(column.id)?.icon ?? SlidersHorizontal"
                                                            class="size-4 shrink-0"
                                                            aria-hidden="true"
                                                        />
                                                        <span class="truncate">
                                                            {{ columnById.get(column.id)?.label ?? '操作' }}
                                                        </span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" class="w-56">
                                                    <DropdownMenuLabel class="flex items-center gap-1">
                                                        {{ columnById.get(column.id)?.label ?? '操作' }}
                                                        <TableViewHelp />
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <template v-if="column.getCanSort()">
                                                        <DropdownMenuItem
                                                            @select="sorting = [{ id: column.id, desc: false }]"
                                                        >
                                                            <ArrowUp aria-hidden="true" />
                                                            升序
                                                            <Check
                                                                v-if="column.getIsSorted() === 'asc'"
                                                                class="ml-auto size-3.5"
                                                                aria-hidden="true"
                                                            />
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            @select="sorting = [{ id: column.id, desc: true }]"
                                                        >
                                                            <ArrowDown aria-hidden="true" />
                                                            降序
                                                            <Check
                                                                v-if="column.getIsSorted() === 'desc'"
                                                                class="ml-auto size-3.5"
                                                                aria-hidden="true"
                                                            />
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            :disabled="!column.getIsSorted()"
                                                            @select="sorting = []"
                                                        >
                                                            <RotateCcw aria-hidden="true" />
                                                            清除排序
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                    </template>
                                                    <DropdownMenuSub v-if="filterById.has(column.id)">
                                                        <DropdownMenuSubTrigger>
                                                            <ListFilter aria-hidden="true" />
                                                            筛选
                                                            <span
                                                                v-if="filters[column.id]?.length"
                                                                class="ml-auto text-xs text-muted-foreground"
                                                            >
                                                                {{ filters[column.id]?.length }} 项
                                                            </span>
                                                        </DropdownMenuSubTrigger>
                                                        <DropdownMenuSubContent class="max-h-80 w-60 overflow-y-auto">
                                                            <DataTableFilterOptions
                                                                :label="filterById.get(column.id)!.label"
                                                                :options="filterById.get(column.id)!.options"
                                                                :mode="filterById.get(column.id)!.mode"
                                                                :model-value="filters[column.id] ?? []"
                                                                @update:model-value="setFilter(column.id, $event)"
                                                            />
                                                        </DropdownMenuSubContent>
                                                    </DropdownMenuSub>
                                                    <DropdownMenuItem
                                                        v-if="columnById.has(column.id)"
                                                        @select.prevent="
                                                            columnWrapping[column.id] = !columnWrapping[column.id]
                                                        "
                                                    >
                                                        <WrapText aria-hidden="true" />
                                                        {{
                                                            columnWrapping[column.id] ? '取消自动换行' : '启用自动换行'
                                                        }}
                                                        <Check
                                                            v-if="columnWrapping[column.id]"
                                                            class="ml-auto size-3.5"
                                                            aria-hidden="true"
                                                        />
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem @select="column.resetSize()">
                                                        <RotateCcw aria-hidden="true" />
                                                        重置列宽
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        :disabled="!canHideColumn(column.id)"
                                                        @select="setColumnVisibility(column.id, false)"
                                                    >
                                                        <EyeOff aria-hidden="true" />
                                                        隐藏列
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <div
                                            v-if="column.getCanResize()"
                                            v-show="
                                                resizing === column.id ||
                                                column.getStart() + column.getSize() - 1 <= resizeHandleLimit
                                            "
                                            role="separator"
                                            aria-orientation="vertical"
                                            :aria-label="`调整${columnById.get(column.id)?.label ?? '操作'}列宽`"
                                            :aria-valuenow="Math.round(widths[column.id] ?? 0)"
                                            :aria-valuemin="column.columnDef.minSize"
                                            :aria-valuemax="column.columnDef.maxSize"
                                            :class="[
                                                'absolute right-0 top-0 z-30 h-full w-1.5 translate-x-1/2 cursor-col-resize touch-none select-none hover:bg-primary/40',
                                                resizing === column.id && 'bg-primary/40',
                                            ]"
                                            :data-resizing="resizing === column.id ? 'true' : undefined"
                                            @pointerdown.stop.prevent="startResize($event, column.id)"
                                            @dblclick="column.resetSize()"
                                        />
                                    </TableHead>
                                </TableRow>
                                <tr
                                    aria-hidden="true"
                                    inert
                                    class="pointer-events-none absolute inset-0 -z-1"
                                    style="border: 0"
                                >
                                    <td
                                        ref="headerOverlay"
                                        data-slot="table-header-overlay"
                                        :colspan="visibleColumns.length"
                                        class="relative block h-full w-full p-0"
                                    />
                                </tr>
                            </TableHeader>
                        </Table>
                    </div>
                    <ScrollArea ref="verticalViewport" class="data-table-vertical min-h-0 flex-1" type="auto">
                        <Table
                            role="presentation"
                            :class="['table-fixed border-separate border-spacing-0', tableClass]"
                            container-class="overflow-clip isolate"
                        >
                            <colgroup>
                                <col
                                    v-for="column in visibleColumns"
                                    :key="column.id"
                                    :style="{ width: widths[column.id] + 'px' }"
                                />
                            </colgroup>
                            <TableBody ref="recordBody" role="rowgroup">
                                <TableRow
                                    v-for="(row, rowIndex) in pageRows"
                                    :key="row.id"
                                    role="row"
                                    data-record-row
                                    :aria-rowindex="rowIndex + 2"
                                    :data-state="row.getIsSelected() || activeId === row.id ? 'selected' : undefined"
                                    class="bg-card hover:bg-card data-[state=selected]:bg-card"
                                >
                                    <TableCell
                                        v-for="(column, columnIndex) in visibleColumns"
                                        :key="column.id"
                                        role="cell"
                                        :aria-colindex="columnIndex + 1"
                                        :data-column="column.id"
                                        :data-pinned="column.id === '__actions' ? 'end' : undefined"
                                        :style="cellStyle(column.id)"
                                        :class="[
                                            'data-table-cell relative z-1 border-r border-b border-transparent bg-card px-2.5 py-3 last:border-r-0',
                                            column.id === '__select' && 'p-0 text-center',
                                            column.id === '__actions' && 'data-table-actions overflow-visible',
                                            columnById.get(column.id)?.align === 'right' ? 'text-right' : 'text-left',
                                            columnById.get(column.id)?.class,
                                            columnWrapping[column.id]
                                                ? 'whitespace-normal break-words'
                                                : 'whitespace-nowrap',
                                        ]"
                                        :data-wrap="columnWrapping[column.id] ? 'true' : 'false'"
                                        @click="column.id === columns[0]?.id && previewCell($event, row.original)"
                                    >
                                        <EdgeBoundary
                                            v-if="column.id === '__actions'"
                                            side="right"
                                            :active="actionsOverlap"
                                            :style="actionsFadeStyle"
                                        />
                                        <Checkbox
                                            v-if="column.id === '__select'"
                                            class="mx-auto static after:inset-0"
                                            :aria-label="`选择${columns[0]?.value(row.original) ?? '记录'}`"
                                            :disabled="!row.getCanSelect()"
                                            :model-value="row.getIsSelected()"
                                            @update:model-value="row.toggleSelected($event === true)"
                                        />
                                        <div
                                            v-else-if="column.id === '__actions'"
                                            class="flex items-center justify-start gap-1.5"
                                        >
                                            <Button
                                                v-for="action in primaryActions"
                                                :key="action.id"
                                                variant="default"
                                                size="sm"
                                                :disabled="busy || action.disabled?.(row.original)"
                                                :aria-label="`${action.label}：${columns[0]?.value(row.original)}`"
                                                :title="action.label"
                                                @click="action.run(row.original)"
                                            >
                                                {{ action.label }}
                                            </Button>
                                            <DropdownMenu v-if="actions.length">
                                                <DropdownMenuTrigger as-child>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        use-tooltip
                                                        :aria-label="`更多操作：${columns[0]?.value(row.original)}`"
                                                        title="更多操作"
                                                    >
                                                        <EllipsisVertical aria-hidden="true" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" class="w-48">
                                                    <DropdownMenuLabel>记录操作</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        v-for="action in actions"
                                                        :key="action.id"
                                                        :disabled="busy || action.disabled?.(row.original)"
                                                        @select="action.run(row.original)"
                                                    >
                                                        <component :is="action.icon" aria-hidden="true" />
                                                        {{ action.label }}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <div v-else class="min-w-0 overflow-hidden">
                                            <slot
                                                :name="`cell-${column.id}`"
                                                :row="row.original"
                                                :value="row.getValue(column.id)"
                                                :preview="() => showPreview(row.original)"
                                            >
                                                <button
                                                    v-if="column.id === columns[0]?.id"
                                                    type="button"
                                                    class="group w-full text-left after:absolute after:inset-0"
                                                    :aria-label="`预览${row.getValue(column.id)}`"
                                                    @click="showPreview(row.original)"
                                                >
                                                    <span class="group-hover:underline group-focus-visible:underline">
                                                        {{ row.getValue(column.id) }}
                                                    </span>
                                                </button>
                                                <template v-else>{{ row.getValue(column.id) }}</template>
                                            </slot>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                <TableRow v-if="!pageRows.length" role="row" aria-rowindex="2">
                                    <TableCell
                                        role="cell"
                                        :colspan="visibleColumns.length"
                                        :aria-colspan="visibleColumns.length"
                                        class="p-0"
                                    >
                                        <Empty class="border-0 py-6" :style="{ height: emptyHeight + 'px' }">
                                            <EmptyHeader>
                                                <EmptyMedia variant="icon"><SearchX aria-hidden="true" /></EmptyMedia>
                                                <EmptyTitle class="text-sm font-medium">{{ emptyText }}</EmptyTitle>
                                            </EmptyHeader>
                                        </Empty>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            </div>
            <footer
                ref="footer"
                class="relative -mt-px shrink-0 border-t px-4 py-3 text-sm"
                data-slot="data-table-footer"
            >
                <p v-if="pageError" role="alert" class="mb-3 text-destructive">{{ pageError }}</p>
                <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                    <div
                        class="flex flex-1 basis-52 flex-col items-start justify-between gap-2 whitespace-nowrap @min-[360px]/table-frame:flex-row @min-[360px]/table-frame:items-center"
                    >
                        <span class="text-muted-foreground">共 {{ filteredRows.length }} 项</span>
                        <div class="flex items-center gap-2 [&_[data-slot=select-trigger]]:min-w-18">
                            <span class="text-muted-foreground">每页</span>
                            <SelectField
                                v-model="pageSize"
                                label="每页条数"
                                hide-title
                                class="h-8 min-w-18"
                                :options="
                                    [5, 10, 20, 50, 100].map((size) => ({ value: String(size), label: `${size} 条` }))
                                "
                            />
                        </div>
                    </div>
                    <div
                        class="ml-auto flex max-w-full flex-col items-end gap-2 @min-[360px]/table-frame:flex-row @min-[360px]/table-frame:items-center"
                    >
                        <div
                            v-if="paginationMode === 'offset'"
                            class="grid max-w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2 whitespace-nowrap tabular-nums @min-[360px]/table-frame:flex"
                        >
                            <span>第</span>
                            <Input
                                v-model="pageInput"
                                type="text"
                                inputmode="numeric"
                                pattern="[0-9]*"
                                class="h-8 w-10 justify-self-end text-center @min-[360px]/table-frame:w-14"
                                aria-label="跳转页码"
                                :aria-invalid="!!pageError"
                                @keydown.enter="jumpToPage(Number(pageInput))"
                                @blur="jumpToPage(Number(pageInput))"
                            />
                            <span class="col-span-2 text-right" aria-live="polite">页，共 {{ pageCount }} 页</span>
                        </div>
                        <ButtonGroup class="[&>button]:size-7 @min-[360px]/table-frame:[&>button]:size-8">
                            <Button
                                v-if="paginationMode === 'offset'"
                                variant="outline"
                                size="icon-sm"
                                aria-label="第一页"
                                use-tooltip
                                title="第一页"
                                :disabled="!canPrevious"
                                @click="jumpToPage(1)"
                            >
                                <ChevronsLeft aria-hidden="true" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon-sm"
                                aria-label="上一页"
                                use-tooltip
                                title="上一页"
                                :disabled="!canPrevious"
                                @click="previousPage"
                            >
                                <ChevronLeft aria-hidden="true" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon-sm"
                                aria-label="下一页"
                                use-tooltip
                                title="下一页"
                                :disabled="!canNext"
                                @click="nextPage"
                            >
                                <ChevronRight aria-hidden="true" />
                            </Button>
                            <Button
                                v-if="paginationMode === 'offset'"
                                variant="outline"
                                size="icon-sm"
                                aria-label="最后一页"
                                use-tooltip
                                title="最后一页"
                                :disabled="!canNext"
                                @click="jumpToPage(pageCount)"
                            >
                                <ChevronsRight aria-hidden="true" />
                            </Button>
                        </ButtonGroup>
                    </div>
                </div>
            </footer>
        </div>
        <RecordPreview v-model:open="previewOpen" :row="previewRow" :columns="columns" />
    </div>
</template>

<style scoped>
.data-table-cell::before {
    content: '';
    position: absolute;
    /* Coincident perimeters share one pixel; transparent borders retain the original layout. */
    inset: -1px;
    z-index: 2;
    border: 1px solid var(--border);
    pointer-events: none;
}
th[data-reorder-source] {
    z-index: 0;
    background: transparent;
}
.data-table-actions {
    --edge-surface: var(--card);
}
.data-table-vertical :deep([data-slot='scroll-area-scrollbar'][data-orientation='vertical']) {
    right: var(--data-table-sticky-right) !important;
}
</style>
