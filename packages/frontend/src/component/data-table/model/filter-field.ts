import type { DataTableColumn, DataTableFilter } from '../type';

export function resolveFilterFields<T>(
    columns: DataTableColumn<T>[],
    fields: DataTableFilter<T>[]
) {
    return columns.map((column) => {
        const configured = fields.find((field) => field.id === column.id);
        const value = (row: T) => column.filterValue?.(row) ?? String(column.value(row));
        return {
            ...(configured ?? {
                id: column.id,
                label: column.label,
                mode: 'text' as const,
                options: [],
                value,
                matches: (row: T, text: string) =>
                    value(row).toLocaleLowerCase().includes(text.toLocaleLowerCase()),
            }),
            icon: column.icon,
        };
    });
}
