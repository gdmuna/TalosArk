export const RESOURCE_KINDS = [
    'MATERIAL',
    'MATERIAL_BATCH',
    'MATERIAL_INSTANCE',
    'FACILITY',
    'STORAGE_TOPOLOGY',
    'STORAGE_NODE',
    'STOCK_ITEM',
    'STOCKTAKE',
    'APPROVAL_REQUEST',
    'TASK',
    'EQUIPMENT',
] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export interface CreateResourceIdentity {
    readonly organizationId: string;
    readonly kind: ResourceKind;
}
