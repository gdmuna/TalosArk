export { createHttpMaterialDataSource } from './data/api';
export { materialDataSourceKey, useMaterialDataSource } from './model/source-context';
export type {
    MaterialDataSource,
    MaterialBatch,
    MaterialBatchPage,
    MaterialBatchQuery,
    MaterialBatchWrite,
    MaterialBatchUpdate,
    MaterialBatchArchive,
} from './data/source';
export { useMaterialStore, materialErrorMessage } from './model/store';
export { useMaterialRead } from './model/useMaterialRead';
export { materialBranches, branchPresentation, materialDate } from './model/presentation';
export { default as MaterialEditor } from './ui/MaterialEditor.vue';
export { default as MaterialFacts } from './ui/MaterialFacts.vue';
export { default as MaterialTypeManager } from './ui/MaterialTypeManager.vue';
export { default as MaterialBatchEditor } from './ui/MaterialBatchEditor.vue';
export { default as MaterialBatchList } from './ui/MaterialBatchList.vue';
export { useMaterialAttachmentStore } from './model/attachment';
export { default as MaterialAttachmentList } from './ui/MaterialAttachmentList.vue';
