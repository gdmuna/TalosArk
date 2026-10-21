import { computed, ref, watch, type Ref } from 'vue';
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
import { resolveFilterFields } from './filter-field';
import type { DataTableColumn, DataTableFilter, DataTableAction } from '../type';

export function useTableModel<T extends { id: string }>(
    props: {
        data: T[];
        columns: DataTableColumn<T>[];
        filterFields: DataTableFilter<T>[];
        actions: DataTableAction<T>[];
        initialSorting: SortingState;
        searchText?: (row: T) => string;
        selectable?: (row: T) => boolean;
        serverTotal?: number;
        busy?: boolean;
        filtering?: boolean;
    },
    models: {
        query: Ref<string>;
        filters: Ref<Record<string, string[]>>;
        selected: Ref<string[]>;
        sorting?: Ref<SortingState>;
        pagination?: Ref<PaginationState>;
    },
    availableWidth?: Ref<number>
) {
    const { query, filters, selected } = models;
    const sorting = models.sorting ?? ref<SortingState>(props.initialSorting);
    const pagination = models.pagination ?? ref<PaginationState>({ pageIndex: 0, pageSize: 10 });
    const cursor = ref<{ id: string; direction: 'after' | 'before' } | null>(null);
    const pageInput = ref('1');
    const pageError = ref('');
    const columnSizing = ref<ColumnSizingState>({});
    const columnOrder = ref<ColumnOrderState>(props.columns.map((column) => column.id));
    const columnVisibility = ref<ColumnVisibilityState>({});
    const columnWrapping = ref<Record<string, boolean>>(
        Object.fromEntries(props.columns.map((column) => [column.id, column.wrap ?? true]))
    );
    const normalizedColumns = computed(() =>
        props.columns.map((column) => ({
            ...column,
            size: column.size ?? 160,
            minSize: column.minSize ?? 100,
            maxSize: column.maxSize ?? 600,
        }))
    );
    const columnById = computed(
        () => new Map(normalizedColumns.value.map((column) => [column.id, column]))
    );
    function constrainSize(column: { minSize: number; maxSize: number }, size: number) {
        return Math.min(column.maxSize, Math.max(column.minSize, size));
    }
    const effectiveSizing = computed(() => {
        const visible = normalizedColumns.value.filter(
            (column) => columnVisibility.value[column.id] !== false
        );
        const fill = visible.find((column) => column.fill);
        // Automatic layout never becomes a saved user width; manual sizing always wins.
        if (!fill || columnSizing.value[fill.id] !== undefined || !availableWidth?.value)
            return columnSizing.value;
        const fixedWidth = visible.reduce(
            (sum, column) =>
                sum +
                (column.id === fill.id
                    ? 0
                    : constrainSize(column, columnSizing.value[column.id] ?? column.size)),
            (props.selectable ? 44 : 0) + (props.actions.length ? 144 : 0)
        );
        return {
            ...columnSizing.value,
            [fill.id]: constrainSize(
                fill,
                Math.max(fill.size, Math.floor(availableWidth.value) - 2 - fixedWidth)
            ),
        };
    });
    function normalizeSizing(value: ColumnSizingState) {
        return Object.fromEntries(
            Object.entries(value).flatMap(([id, size]) => {
                const column = columnById.value.get(id);
                return column ? [[id, constrainSize(column, size)]] : [];
            })
        );
    }
    function normalizeOrder(value: ColumnOrderState) {
        const known = [...columnById.value.keys()];
        return [...new Set([...value.filter((id) => columnById.value.has(id)), ...known])];
    }
    function canHideColumn(id: string) {
        return (
            columnById.value.has(id) &&
            (columnVisibility.value[id] === false ||
                props.actions.length > 0 ||
                props.columns.filter((column) => columnVisibility.value[column.id] !== false)
                    .length > 1)
        );
    }
    function normalizeVisibility(value: ColumnVisibilityState) {
        const next = Object.fromEntries(
            Object.entries(value).filter(([id]) => columnById.value.has(id))
        );
        if (
            !props.actions.length &&
            props.columns.length &&
            props.columns.every((column) => next[column.id] === false)
        ) {
            const keep =
                props.columns.find((column) => columnVisibility.value[column.id] !== false) ??
                props.columns[0];
            if (keep) next[keep.id] = true;
        }
        return next;
    }
    function setColumnVisibility(id: string, visible: boolean) {
        if (!columnById.value.has(id) || (!visible && !canHideColumn(id))) return;
        columnVisibility.value = normalizeVisibility({ ...columnVisibility.value, [id]: visible });
    }
    function showAllColumns() {
        columnVisibility.value = {};
    }
    function resizeColumn(id: string, size: number) {
        const column = columnById.value.get(id);
        if (!column || !table.getColumn(id)?.getCanResize()) return;
        const fill = normalizedColumns.value.find(
            (item) => item.fill && columnVisibility.value[item.id] !== false
        );
        const frozenFill =
            fill && columnSizing.value[fill.id] === undefined
                ? { [fill.id]: table.getColumn(fill.id)?.getSize() ?? fill.size }
                : {};
        // Keep the drag edge attached to the pointer even when fill precedes the resized column.
        table.setColumnSizing((current) => ({
            ...frozenFill,
            ...current,
            [id]: constrainSize(column, size),
        }));
    }
    // Guard both TanStack updates and the existing mutable exposed state.
    watch(
        [columnVisibility, () => props.actions.length],
        ([value]) => {
            const next = normalizeVisibility(value);
            if (
                Object.keys(value).length !== Object.keys(next).length ||
                Object.keys(next).some((id) => value[id] !== next[id])
            )
                columnVisibility.value = next;
        },
        { deep: true }
    );
    watch(
        columnOrder,
        (value) => {
            const next = normalizeOrder(value);
            if (value.length !== next.length || value.some((id, index) => id !== next[index]))
                columnOrder.value = next;
        },
        { deep: true }
    );
    watch(
        [
            columnSizing,
            () => props.columns.map(({ id, minSize, maxSize }) => [id, minSize, maxSize]),
        ],
        ([value]) => {
            const next = normalizeSizing(value);
            if (
                Object.keys(value).length !== Object.keys(next).length ||
                Object.keys(next).some((id) => !Object.is(value[id], next[id]))
            )
                columnSizing.value = next;
        },
        { deep: true }
    );
    const primaryActions = computed(() => props.actions.filter((action) => action.primary));
    const resolvedFilterFields = computed(() =>
        props.filtering === false
            ? []
            : resolveFilterFields(
                  props.serverTotal === undefined
                      ? props.columns
                      : props.columns.filter((column) =>
                            props.filterFields.some((field) => field.id === column.id)
                        ),
                  props.filterFields
              )
    );
    const filterById = computed(
        () => new Map(resolvedFilterFields.value.map((field) => [field.id, field]))
    );
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
        ...normalizedColumns.value.map((column) => ({
            id: column.id,
            accessorFn: column.value,
            enableSorting: column.sortable !== false,
            enableGlobalFilter: false,
            sortFn: 'basic' as const,
            size: column.size,
            minSize: column.minSize,
            maxSize: column.maxSize,
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
                    filter.matches
                        ? filter.matches(row.original, value)
                        : filter.value(row.original) === value
                ),
            enableSorting: false,
            enableGlobalFilter: false,
        })),
        {
            id: '__search',
            accessorFn: (row: T) =>
                props.searchText?.(row) ??
                props.columns.map((column) => column.value(row)).join(' '),
            enableGlobalFilter: true,
            enableSorting: false,
        },
    ]);
    const rowSelection = computed<RowSelectionState>(() =>
        Object.fromEntries(selected.value.map((id) => [id, true]))
    );
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
        columnSizing: effectiveSizing.value,
        columnOrder: ['__select', ...columnOrder.value, '__actions'],
        columnVisibility: {
            ...columnVisibility.value,
            __select: true,
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
        get manualFiltering() {
            return props.serverTotal !== undefined;
        },
        get manualSorting() {
            return props.serverTotal !== undefined;
        },
        get manualPagination() {
            return props.serverTotal !== undefined;
        },
        get rowCount() {
            return props.serverTotal;
        },
        sortDescFirst: false,
        getRowId: (row: T) => row.id,
        globalFilterFn: 'includesString',
        enableRowSelection: (row) => !!props.selectable?.(row.original),
        columnResizeMode: 'onChange',
        onColumnSizingChange: (next) => {
            columnSizing.value = normalizeSizing(
                typeof next === 'function' ? next(columnSizing.value) : next
            );
        },
        onColumnOrderChange: (next) => {
            columnOrder.value = normalizeOrder(
                typeof next === 'function' ? next(columnOrder.value) : next
            );
        },
        onColumnVisibilityChange: (next) => {
            columnVisibility.value = normalizeVisibility(
                typeof next === 'function' ? next(columnVisibility.value) : next
            );
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
    const sortableColumns = computed(() =>
        props.columns.filter((column) => column.sortable !== false)
    );
    const widths = computed(() =>
        Object.fromEntries(visibleColumns.value.map((column) => [column.id, column.getSize()]))
    );
    const contentWidth = computed(() =>
        Object.values(widths.value).reduce((sum, width) => sum + width, 0)
    );
    const pageCount = computed(() => Math.max(1, table.getPageCount()));
    const paginationMode = computed(() =>
        props.serverTotal === undefined && pageCount.value > 1000 ? 'cursor' : 'offset'
    );
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
        const end =
            cursor.value?.direction === 'before' && anchor >= 0
                ? anchor
                : start + pagination.value.pageSize;
        return { start, rows: items.slice(start, end) };
    });
    const pageRows = computed(() =>
        paginationMode.value === 'cursor' ? cursorWindow.value.rows : table.getRowModel().rows
    );
    const rows = computed(() => pageRows.value.map((row) => row.original));
    const filteredRows = computed(() =>
        table.getFilteredRowModel().rows.map((row) => row.original)
    );
    const selectedRows = computed(() =>
        table.getFilteredSelectedRowModel().rows.map((row) => row.original)
    );
    const canPrevious = computed(() =>
        paginationMode.value === 'cursor'
            ? cursorWindow.value.start > 0
            : table.getCanPreviousPage()
    );
    const canNext = computed(() =>
        paginationMode.value === 'cursor'
            ? cursorWindow.value.start + pageRows.value.length < orderedRows.value.length
            : table.getCanNextPage()
    );
    const selectableRows = computed(() => pageRows.value.filter((row) => row.getCanSelect()));
    const pageSelection = computed(() => {
        const count = selectableRows.value.filter((row) => row.getIsSelected()).length;
        return count && count === selectableRows.value.length
            ? true
            : count
              ? ('indeterminate' as const)
              : false;
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
        if (!Number.isInteger(page) || page < 1 || page > pageCount.value) {
            pageError.value = `请输入 1 到 ${pageCount.value} 之间的整数页码`;
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
    watch(() => pagination.value.pageSize, resetPagination);
    watch([() => props.data, paginationMode], () => {
        if (props.serverTotal === undefined) resetPagination();
    });
    watch(
        () => pagination.value.pageIndex,
        (index) => {
            pageInput.value = String(index + 1);
            pageError.value = '';
        }
    );
    watch([filteredRows, () => props.busy], ([items]) => {
        const valid = new Set(
            items.filter((item) => props.selectable?.(item)).map((item) => item.id)
        );
        const next = selected.value.filter((id) => valid.has(id));
        if (next.length !== selected.value.length) selected.value = next;
        // Remote loading may temporarily clear rows and total; recheck when it finishes.
        if (props.serverTotal !== undefined && props.busy) return;
        if (pagination.value.pageIndex >= pageCount.value) table.setPageIndex(pageCount.value - 1);
    });
    const api = {
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
    };
    return {
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
    };
}
