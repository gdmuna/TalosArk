import type { RouteRecordRaw } from 'vue-router';
import MaterialOverview from '@/page/material/Overview.vue';
import MaterialList from '@/page/material/List.vue';
import MaterialDetail from '@/page/material/detail/Detail.vue';
import MaterialBank from '@/page/material/detail/Bank.vue';
import MaterialBatch from '@/page/material/detail/Batch.vue';
import MaterialBankBatch from '@/page/material/detail/BankBatch.vue';
import InventoryOverview from '@/page/inventory/Overview.vue';
import InventoryLedger from '@/page/inventory/Ledger.vue';
import StorageTopology from '@/page/inventory/StorageTopology.vue';
import Stocktake from '@/page/inventory/Stocktake.vue';
import InventoryAlert from '@/page/inventory/Alert.vue';
import Transaction from '@/page/inventory/Transaction.vue';
import InventoryDetail from '@/page/inventory/detail/Detail.vue';
import StocktakeExecution from '@/page/inventory/detail/StocktakeExecution.vue';
import EquipmentOverview from '@/page/equipment/Overview.vue';
import EquipmentList from '@/page/equipment/List.vue';
import EquipmentAlert from '@/page/equipment/Alert.vue';
import EquipmentDetail from '@/page/equipment/detail/Detail.vue';
import EquipmentConsole from '@/page/equipment/detail/Console.vue';

import { resourceNavigation, type ResourceDomain } from './resource-navigation';

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
    page('material', 'overview', MaterialOverview),
    page('material', 'list', MaterialList),
    detail('detail/:resourceId', '材料详情', MaterialDetail),
    detail('detail/:resourceId/batch/:batchId', '批次详情', MaterialBatch),
    detail('detail/:resourceId/bank/:bankId', 'Cell Bank', MaterialBank),
    detail('detail/:resourceId/bank/:bankId/batch/:batchId', 'Batch', MaterialBankBatch),
];
export const inventoryRoutes: RouteRecordRaw[] = [
    page('inventory', 'overview', InventoryOverview),
    page('inventory', 'ledger', InventoryLedger),
    page('inventory', 'storage-topology', StorageTopology),
    page('inventory', 'stocktake', Stocktake),
    page('inventory', 'alert', InventoryAlert),
    page('inventory', 'transaction', Transaction),
    detail('detail/:resourceId', '库存实例详情', InventoryDetail),
    detail('stocktake/:taskId', '盘点执行', StocktakeExecution),
];
export const equipmentRoutes: RouteRecordRaw[] = [
    page('equipment', 'overview', EquipmentOverview),
    page('equipment', 'list', EquipmentList),
    page('equipment', 'alert', EquipmentAlert),
    detail('detail/:resourceId', '设备详情', EquipmentDetail),
    detail('detail/:resourceId/console', '设备操作台', EquipmentConsole),
];
