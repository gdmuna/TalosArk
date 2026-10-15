import type { Component, ShallowUnwrapRef } from 'vue';
import type { useTableModel } from './model/useTableModel';

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
    fill?: boolean;
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
export type DataTableApi<T extends { id: string }> = ShallowUnwrapRef<
    ReturnType<typeof useTableModel<T>>['api']
>;
