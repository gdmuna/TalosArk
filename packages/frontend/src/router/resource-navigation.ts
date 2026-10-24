export type ResourceDomain = 'material' | 'inventory' | 'equipment';
export const resourceNavigation = {
    material: [
        { path: 'overview', label: '概览' },
        { path: 'list', label: '材料列表' },
    ],
    inventory: [
        { path: 'overview', label: '概览' },
        { path: 'ledger', label: '库存列表' },
        { path: 'storage-topology', label: '存储浏览' },
        { path: 'stocktake', label: '盘点' },
        { path: 'alert', label: '库存预警' },
        { path: 'transaction', label: '出入库流水' },
    ],
    equipment: [
        { path: 'overview', label: '概览' },
        { path: 'list', label: '设备列表' },
        { path: 'alert', label: '设备告警' },
    ],
} satisfies Record<ResourceDomain, { path: string; label: string }[]>;
