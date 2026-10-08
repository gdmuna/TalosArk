import type { RouteRecordRaw } from 'vue-router';

export type ResourceDomain = 'material' | 'inventory' | 'equipment';
export const resourceNavigation = {
    material: [
        { path: 'overview', label: '概览' },
        { path: 'list', label: '材料列表' },
        { path: 'culture', label: '培养物' },
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

function page(
    domain: ResourceDomain,
    path: string,
    component: NonNullable<RouteRecordRaw['component']>
): RouteRecordRaw {
    const label = resourceNavigation[domain].find((item) => item.path === path)?.label;
    return { path, component, meta: { pageLabel: label, defaultTitle: label } };
}
function detail(
    path: string,
    label: string,
    component: NonNullable<RouteRecordRaw['component']>
): RouteRecordRaw {
    return {
        path,
        component,
        meta: { resourceDetail: true, pageLabel: label, defaultTitle: label },
    };
}

export const materialRoutes: RouteRecordRaw[] = [
    page('material', 'overview', () => import('@/page/material/Overview.vue')),
    page('material', 'list', () => import('@/page/material/List.vue')),
    page('material', 'culture', () => import('@/page/material/Culture.vue')),
    detail('detail/:resourceId', '材料详情', () => import('@/page/material/detail/Detail.vue')),
    detail(
        'detail/:resourceId/bank/:bankId',
        'Cell Bank',
        () => import('@/page/material/detail/Bank.vue')
    ),
    detail(
        'detail/:resourceId/bank/:bankId/batch/:batchId',
        'Batch',
        () => import('@/page/material/detail/Batch.vue')
    ),
];
export const inventoryRoutes: RouteRecordRaw[] = [
    page('inventory', 'overview', () => import('@/page/inventory/Overview.vue')),
    page('inventory', 'ledger', () => import('@/page/inventory/Ledger.vue')),
    page('inventory', 'storage-topology', () => import('@/page/inventory/StorageTopology.vue')),
    page('inventory', 'stocktake', () => import('@/page/inventory/Stocktake.vue')),
    page('inventory', 'alert', () => import('@/page/inventory/Alert.vue')),
    page('inventory', 'transaction', () => import('@/page/inventory/Transaction.vue')),
    detail(
        'detail/:resourceId',
        '库存实例详情',
        () => import('@/page/inventory/detail/Detail.vue')
    ),
    detail(
        'stocktake/:taskId',
        '盘点执行',
        () => import('@/page/inventory/detail/StocktakeExecution.vue')
    ),
];
export const equipmentRoutes: RouteRecordRaw[] = [
    page('equipment', 'overview', () => import('@/page/equipment/Overview.vue')),
    page('equipment', 'list', () => import('@/page/equipment/List.vue')),
    page('equipment', 'alert', () => import('@/page/equipment/Alert.vue')),
    detail('detail/:resourceId', '设备详情', () => import('@/page/equipment/detail/Detail.vue')),
    detail(
        'detail/:resourceId/console',
        '设备操作台',
        () => import('@/page/equipment/detail/Console.vue')
    ),
];
