import type {
    ColumnSizingState,
    ColumnOrderState,
    ColumnVisibilityState,
    PaginationState,
    SortingState,
} from '@tanstack/vue-table';
import type { Component } from 'vue';

export type DataTableColumn<T> = {
    id: string;
    label: string;
    icon?: Component;
    value: (row: T) => string | number;
    filterValue?: (row: T) => string;
    sortable?: boolean;
    class?: string;
    size?: number;
    minSize?: number;
    maxSize?: number;
    align?: 'left' | 'right';
    wrap?: boolean;
};
export type DataTableAction<T> = {
    id: string;
    label: string;
    icon: Component;
    primary?: boolean;
    disabled?: (row: T) => boolean;
    run: (row: T) => void | Promise<void>;
};
// Only explicitly registered batch operations are offered for a selection.
export type DataTableBulkAction<T> = {
    id: string;
    label: string;
    icon: Component;
    disabled?: (rows: T[]) => boolean;
    disabledReason?: string;
    run: (rows: T[]) => void | Promise<void>;
};
export type DataTableFilter<T> = {
    id: string;
    label: string;
    options: { value: string; label: string; count?: number }[];
    mode: 'options' | 'text';
    value: (row: T) => string;
    matches?: (row: T, value: string) => boolean;
};
export type DataTableApi<T> = {
    rows: T[];
    filteredRows: T[];
    selectedRows: T[];
    query: string;
    filters: Record<string, string[]>;
    selected: string[];
    sorting: SortingState;
    pagination: PaginationState;
    paginationMode: 'offset' | 'cursor';
    cursor: { id: string; direction: 'after' | 'before' } | null;
    canPrevious: boolean;
    canNext: boolean;
    jumpToPage: (page: number) => boolean;
    previousPage: () => void;
    nextPage: () => void;
    setFilter: (id: string, value: string[]) => void;
    columnSizing: ColumnSizingState;
    columnOrder: ColumnOrderState;
    columnVisibility: ColumnVisibilityState;
    columnWrapping: Record<string, boolean>;
    resizeColumn: (id: string, size: number) => void;
    clearSelection: () => void;
    resetFilters: () => void;
};
