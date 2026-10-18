import { inject, type InjectionKey } from 'vue';
import type { MaterialDataSource } from '../data/source';

export const materialDataSourceKey: InjectionKey<MaterialDataSource> = Symbol('materialDataSource');

export function useMaterialDataSource() {
    const source = inject(materialDataSourceKey);
    if (!source) throw new Error('Material data source is not connected');
    return source;
}
