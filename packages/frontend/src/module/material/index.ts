export { createHttpMaterialDataSource } from './data/api';
export { materialDataSourceKey, useMaterialDataSource } from './model/source-context';
export type { MaterialDataSource } from './data/source';
export { useMaterialStore, materialErrorMessage } from './model/store';
export { useMaterialRead } from './model/useMaterialRead';
export { materialBranches, branchPresentation, materialDate } from './model/presentation';
export { default as MaterialEditor } from './ui/MaterialEditor.vue';
export { default as MaterialFacts } from './ui/MaterialFacts.vue';
export { default as MaterialTypeManager } from './ui/MaterialTypeManager.vue';
