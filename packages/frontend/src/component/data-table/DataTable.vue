<script setup lang="ts" generic="T extends { id: string }">
import { computed, ref, watch, useTemplateRef, type CSSProperties } from 'vue';
import {
    columnFilteringFeature,
    globalFilteringFeature,
    rowSortingFeature,
    rowPaginationFeature,
    rowSelectionFeature,
    columnVisibilityFeature,
    columnSizingFeature,
    columnResizingFeature,
    columnOrderingFeature,
    createFilteredRowModel,
    createSortedRowModel,
    createPaginatedRowModel,
    filterFn_includesString,
    filterFn_equalsString,
    sortFn_basic,
    tableFeatures,
    useTable,
    type ColumnDef,
    type SortingState,
    type PaginationState,
    type RowSelectionState,
    type ColumnSizingState,
    type ColumnOrderState,
    type ColumnVisibilityState,
} from '@tanstack/vue-table';
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
import { useColumnResize } from './interaction/useColumnResize';
import RecordPreview from './RecordPreview.vue';
import { resolveFilterFields } from './model/filter-field';
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
const sorting = ref<SortingState>(props.initialSorting);
const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: 10 });
const cursor = ref<{ id: string; direction: 'after' | 'before' } | null>(null);
const pageInput = ref('1');
const pageError = ref('');
const columnSizing = ref<ColumnSizingState>({});
const columnOrder = ref<ColumnOrderState>(props.columns.map((column) => column.id));
const columnVisibility = ref<ColumnVisibilityState>({});
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
const columnWrapping = ref<Record<string, boolean>>(
    Object.fromEntries(props.columns.map((column) => [column.id, column.wrap ?? true]))
);
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
const primaryActions = computed(() => props.actions.filter((action) => action.primary));
const resolvedFilterFields = computed(() => resolveFilterFields(props.columns, props.filterFields));
const filterById = computed(() => new Map(resolvedFilterFields.value.map((field) => [field.id, field])));
const features = tableFeatures({
    columnFilteringFeature,
    globalFilteringFeature,
    filteredRowModel: createFilteredRowModel(),
    filterFns: { includesString: filterFn_includesString, equalsString: filterFn_equalsString },
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: { basic: sortFn_basic },
    rowPaginationFeature,
    paginatedRowModel: createPaginatedRowModel(),
    rowSelectionFeature,
    columnVisibilityFeature,
    columnSizingFeature,
    columnResizingFeature,
    columnOrderingFeature,
});
const columnWidths = computed(() =>
    Object.fromEntries(
        props.columns.map((column) => [
            column.id,
            Math.min(
                column.maxSize ?? 600,
                Math.max(column.minSize ?? 100, columnSizing.value[column.id] ?? column.size ?? 160)
            ),
        ])
    )
);
const contentWidth = computed(
    () =>
        (props.selectable ? 44 : 0) +
        (props.actions.length ? 144 : 0) +
        props.columns.reduce(
            (sum, column) =>
                sum + (columnVisibility.value[column.id] === false ? 0 : (columnWidths.value[column.id] ?? 0)),
            0
        )
);
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
const definitions = computed<ColumnDef<typeof features, T>[]>(() => [
    ...(props.selectable
        ? [
              {
                  id: '__select',
                  size: 44,
                  minSize: 44,
                  maxSize: 44,
                  enableResizing: false,
                  enableSorting: false,
                  enableGlobalFilter: false,
              },
          ]
        : []),
    ...props.columns.map((column) => ({
        id: column.id,
        accessorFn: column.value,
        enableSorting: column.sortable !== false,
        enableGlobalFilter: false,
        sortFn: 'basic' as const,
        size: column.size ?? 160,
        minSize: column.minSize ?? 100,
        maxSize: column.maxSize ?? 600,
    })),
    ...(props.actions.length
        ? [
              {
                  id: '__actions',
                  size: 144,
                  minSize: 144,
                  maxSize: 144,
                  enableSorting: false,
                  enableGlobalFilter: false,
                  enableResizing: false,
                  enableHiding: false,
              },
          ]
        : []),
    ...resolvedFilterFields.value.map<ColumnDef<typeof features, T>>((filter) => ({
        id: `filter:${filter.id}`,
        accessorFn: filter.value,
        filterFn: (row, _columnId, values: string[]) =>
            values.some((value) =>
                filter.matches ? filter.matches(row.original, value) : filter.value(row.original) === value
            ),
        enableSorting: false,
        enableGlobalFilter: false,
    })),
    {
        id: '__search',
        accessorFn: (row: T) => props.searchText?.(row) ?? props.columns.map((column) => column.value(row)).join(' '),
        enableGlobalFilter: true,
        enableSorting: false,
    },
]);
const rowSelection = computed<RowSelectionState>(() => Object.fromEntries(selected.value.map((id) => [id, true])));
const columnFilters = computed(() =>
    resolvedFilterFields.value.flatMap((field) => {
        const value = filters.value[field.id];
        return value?.length ? [{ id: `filter:${field.id}`, value }] : [];
    })
);
const state = computed(() => ({
    sorting: sorting.value,
    pagination: pagination.value,
    rowSelection: rowSelection.value,
    globalFilter: query.value.trim(),
    columnFilters: columnFilters.value,
    columnSizing: columnSizing.value,
    columnOrder: ['__select', ...columnOrder.value, '__actions'],
    columnVisibility: {
        ...columnVisibility.value,
        __actions: true,
        ...Object.fromEntries([
            ...resolvedFilterFields.value.map((field) => [`filter:${field.id}`, false]),
            ['__search', false],
        ]),
    },
}));
const table = useTable<typeof features, T>({
    features,
    data: computed(() => props.data),
    columns: definitions,
    state,
    autoResetPageIndex: false,
    sortDescFirst: false,
    getRowId: (row: T) => row.id,
    globalFilterFn: 'includesString',
    enableRowSelection: (row) => !!props.selectable?.(row.original),
    columnResizeMode: 'onChange',
    onColumnSizingChange: (next) => {
        columnSizing.value = typeof next === 'function' ? next(columnSizing.value) : next;
    },
    onColumnOrderChange: (next) => {
        columnOrder.value = typeof next === 'function' ? next(columnOrder.value) : next;
    },
    onColumnVisibilityChange: (next) => {
        columnVisibility.value = typeof next === 'function' ? next(columnVisibility.value) : next;
    },
    onSortingChange: (next) => {
        sorting.value = typeof next === 'function' ? next(sorting.value) : next;
    },
    onPaginationChange: (next) => {
        pagination.value = typeof next === 'function' ? next(pagination.value) : next;
    },
    onRowSelectionChange: (next) => {
        const value = typeof next === 'function' ? next(rowSelection.value) : next;
        selected.value = Object.keys(value).filter((id) => value[id]);
    },
});
const visibleColumns = computed(() => table.getVisibleLeafColumns());
const columnById = computed(() => new Map(props.columns.map((column) => [column.id, column])));
const sortableColumns = computed(() => props.columns.filter((column) => column.sortable !== false));
const widths = computed(() => Object.fromEntries(visibleColumns.value.map((column) => [column.id, column.getSize()])));
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
function canHideColumn(id: string) {
    return (
        columnById.value.has(id) &&
        (props.actions.length > 0 ||
            visibleColumns.value.filter((column) => columnById.value.has(column.id)).length > 1)
    );
}
function resizeColumn(id: string, size: number) {
    const column = table.getColumn(id);
    if (!column?.getCanResize()) return;
    table.setColumnSizing((current) => ({
        ...current,
        [id]: Math.min(column.columnDef.maxSize ?? 600, Math.max(column.columnDef.minSize ?? 100, size)),
    }));
}
const pageCount = computed(() => Math.max(1, table.getPageCount()));
const paginationMode = computed(() => (pageCount.value > 1000 ? 'cursor' : 'offset'));
const orderedRows = computed(() => table.getSortedRowModel().rows);
// In-memory keyset navigation; a remote source must supply its own opaque cursors.
const cursorWindow = computed(() => {
    const items = orderedRows.value;
    const anchor = cursor.value ? items.findIndex((row) => row.id === cursor.value?.id) : -1;
    const start =
        anchor < 0
            ? 0
            : cursor.value?.direction === 'after'
              ? anchor + 1
              : Math.max(0, anchor - pagination.value.pageSize);
    const end = cursor.value?.direction === 'before' && anchor >= 0 ? anchor : start + pagination.value.pageSize;
    return { start, rows: items.slice(start, end) };
});
const pageRows = computed(() =>
    paginationMode.value === 'cursor' ? cursorWindow.value.rows : table.getRowModel().rows
);
const rows = computed(() => pageRows.value.map((row) => row.original));
const filteredRows = computed(() => table.getFilteredRowModel().rows.map((row) => row.original));
const selectedRows = computed(() => table.getFilteredSelectedRowModel().rows.map((row) => row.original));
const canPrevious = computed(() =>
    paginationMode.value === 'cursor' ? cursorWindow.value.start > 0 : table.getCanPreviousPage()
);
const canNext = computed(() =>
    paginationMode.value === 'cursor'
        ? cursorWindow.value.start + pageRows.value.length < orderedRows.value.length
        : table.getCanNextPage()
);
const selectableRows = computed(() => pageRows.value.filter((row) => row.getCanSelect()));
const pageSelection = computed(() => {
    const count = selectableRows.value.filter((row) => row.getIsSelected()).length;
    return count && count === selectableRows.value.length ? true : count ? ('indeterminate' as const) : false;
});
const pageSize = computed({
    get: () => String(pagination.value.pageSize),
    set: (value: string) => table.setPageSize(Number(value)),
});
function previousPage() {
    const first = pageRows.value[0];
    if (!canPrevious.value || !first) return;
    if (paginationMode.value === 'cursor') cursor.value = { id: first.id, direction: 'before' };
    else table.previousPage();
}
function nextPage() {
    const last = pageRows.value.at(-1);
    if (!canNext.value || !last) return;
    if (paginationMode.value === 'cursor') cursor.value = { id: last.id, direction: 'after' };
    else table.nextPage();
}
function jumpToPage(page: number) {
    if (paginationMode.value !== 'offset') return false;
    if (!Number.isInteger(page) || page < 1 || page > Math.min(1000, pageCount.value)) {
        pageError.value = `请输入 1 到 ${Math.min(1000, pageCount.value)} 之间的整数页码`;
        pageInput.value = String(pagination.value.pageIndex + 1);
        return false;
    }
    pageError.value = '';
    table.setPageIndex(page - 1);
    pageInput.value = String(page);
    return true;
}
function selectPage(value: boolean) {
    const ids = new Set(selected.value);
    for (const row of selectableRows.value) {
        if (value) ids.add(row.id);
        else ids.delete(row.id);
    }
    selected.value = [...ids];
}
const { resizing, startResize } = useColumnResize({
    frame,
    canStart: () => headerPhase.value === 'idle',
    getSize: (id) => widths.value[id] ?? 160,
    resize: resizeColumn,
});
function setFilter(id: string, value: string[]) {
    filters.value = { ...filters.value, [id]: value };
}
function resetFilters() {
    filters.value = {};
    query.value = '';
}
function clearSelection() {
    selected.value = [];
}
function resetPagination() {
    table.setPageIndex(0);
    cursor.value = null;
    pageInput.value = '1';
    pageError.value = '';
}
watch([query, filters, sorting], resetPagination, { deep: true });
watch([() => pagination.value.pageSize, () => props.data, paginationMode], resetPagination);
watch(
    () => pagination.value.pageIndex,
    (index) => {
        pageInput.value = String(index + 1);
        pageError.value = '';
    }
);
watch(filteredRows, (items) => {
    const valid = new Set(items.filter((item) => props.selectable?.(item)).map((item) => item.id));
    const next = selected.value.filter((id) => valid.has(id));
    if (next.length !== selected.value.length) selected.value = next;
    if (pagination.value.pageIndex >= pageCount.value) table.setPageIndex(pageCount.value - 1);
});
defineExpose({
    table,
    rows,
    filteredRows,
    selectedRows,
    query,
    filters,
    selected,
    sorting,
    pagination,
    paginationMode,
    cursor,
    canPrevious,
    canNext,
    jumpToPage,
    previousPage,
    nextPage,
    setFilter,
    clearSelection,
    resetFilters,
    columnSizing,
    columnOrder,
    columnVisibility,
    columnWrapping,
    resizeColumn,
});
</script>

<template>
    <div class="flex min-h-0 min-w-0 flex-col gap-3" data-slot="data-table" :data-pagination-mode="paginationMode">
        <div
            class="flex h-9 shrink-0 items-center gap-3"
            :style="{ maxWidth: Math.max(640, contentWidth + 2) + 'px' }"
            data-slot="data-table-toolbar"
        >
            <div class="relative min-w-0 flex-1">
                <div class="overflow-x-auto scroll-smooth [scrollbar-width:none] motion-reduce:scroll-auto">
                    <div class="flex w-max min-w-full items-center gap-3">
                        <slot name="filters-before" />
                        <DataTableFilters v-model="filters" :fields="resolvedFilterFields" />
                        <DataTableSorting v-model="sorting" :columns="sortableColumns" />
                        <DataTableVisibility
                            v-if="!actions.length"
                            v-model:order="columnOrder"
                            v-model:visibility="columnVisibility"
                            :columns="columns"
                            :has-actions="!!actions.length"
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
            <div class="relative w-40 shrink-0 lg:w-64">
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
            class="flex min-h-0 max-w-full flex-col overflow-hidden rounded-lg border bg-card"
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
                                                v-model:visibility="columnVisibility"
                                                :columns="columns"
                                                :has-actions="true"
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
                                                        @select="column.toggleVisibility(false)"
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
                class="relative -mt-px flex shrink-0 flex-wrap items-center justify-between gap-6 border-t px-4 py-3 text-sm"
            >
                <span class="text-muted-foreground whitespace-nowrap">共 {{ filteredRows.length }} 项</span>
                <div class="flex flex-wrap items-center gap-2">
                    <div v-if="pageError" role="alert" class="flex items-center">
                        <span class="text-destructive">{{ pageError }}</span>
                        <div class="mx-2 h-8 w-px bg-border" />
                    </div>
                    <span class="text-muted-foreground">每页</span>
                    <SelectField
                        v-model="pageSize"
                        label="每页条数"
                        hide-title
                        class="h-8 min-w-18"
                        :options="[5, 10, 20, 50, 100].map((size) => ({ value: String(size), label: `${size} 条` }))"
                    />
                    <div
                        v-if="paginationMode === 'offset'"
                        class="flex items-center gap-2 whitespace-nowrap tabular-nums"
                    >
                        <span>第</span>
                        <Input
                            v-model="pageInput"
                            type="text"
                            inputmode="numeric"
                            pattern="[0-9]*"
                            class="h-8 w-14 text-center"
                            aria-label="跳转页码"
                            :aria-invalid="!!pageError"
                            @keydown.enter="jumpToPage(Number(pageInput))"
                            @blur="jumpToPage(Number(pageInput))"
                        />
                        <span aria-live="polite">页，共 {{ pageCount }} 页</span>
                    </div>
                    <ButtonGroup>
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
