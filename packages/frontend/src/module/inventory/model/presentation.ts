import type { InventoryStock } from '../data/source';
import type { StateTone } from '@/component/state-badge';

export function inventoryStockLabel(stock: Pick<InventoryStock, 'code' | 'label' | 'material'>) {
    return stock.code ?? (stock.label || stock.material.name);
}

export const inventoryStatusTone: Record<InventoryStock['status'], StateTone> = {
    IN_STOCK: 'success',
    CHECKED_OUT: 'primary',
    QUARANTINED: 'warning',
    DEPLETED: 'neutral',
    DISPOSED: 'neutral',
};

export const inventoryStatusLabel: Record<InventoryStock['status'], string> = {
    IN_STOCK: '在库',
    CHECKED_OUT: '已领用',
    QUARANTINED: '隔离',
    DEPLETED: '已耗尽',
    DISPOSED: '已移出管理',
};
export const inventoryExpiryLabel: Record<InventoryStock['expiryRisk'], string> = {
    UNKNOWN: '未知',
    NONE: '无期限',
    CURRENT: '有效',
    EXPIRED: '已过期',
};
export function inventoryTransactionLabel(type: string) {
    return (
        (
            {
                RECEIPT: '登记入库',
                CONTAINER_RELOCATION: '容器搬迁',
                CONSUMPTION: '登记消耗',
                TRANSFER: '单件转移',
                ADJUSTMENT: '核实数量',
                DISPOSAL: '移出管理',
            } as Record<string, string>
        )[type] ?? type
    );
}

export const inventoryActionLabel = {
    consume: '登记消耗',
    transfer: '单件转移',
    adjust: '核实数量',
    dispose: '移出管理',
} as const;
