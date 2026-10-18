import { inject, type InjectionKey } from 'vue';
import type { ManagementDataSource } from '../data/source';

export const managementDataSourceKey: InjectionKey<ManagementDataSource> =
    Symbol('managementDataSource');

export function useManagementDataSource() {
    const source = inject(managementDataSourceKey);
    if (!source) throw new Error('Management data source is not connected');
    return source;
}
