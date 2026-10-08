import type { Component } from 'vue';
import type { DataTableColumn } from '@/component/data-table';

// View rows are local presentation data, not an API response contract.
export type ManagementRow = { id: string; [field: string]: string | number };

export function column(
    id: string,
    label: string,
    size: number,
    icon?: Component
): DataTableColumn<ManagementRow> {
    return { id, label, size, icon, value: (row) => row[id] ?? '—' };
}
