import type { InventoryStock } from '../data/source';

export const inventoryStatusLabel: Record<InventoryStock['status'], string> = {
    IN_STOCK: '在库',
    CHECKED_OUT: '已领用',
    QUARANTINED: '隔离',
    DEPLETED: '已耗尽',
    DISPOSED: '已处置',
};
export const inventoryExpiryLabel: Record<InventoryStock['expiryRisk'], string> = {
    UNKNOWN: '未知',
    NONE: '无期限',
    CURRENT: '有效',
    EXPIRED: '已过期',
};
export function inventoryTransactionLabel(type: string) {
    return (
        ({ RECEIPT: '登记入库', CONTAINER_RELOCATION: '容器搬迁' } as Record<string, string>)[
            type
        ] ?? type
    );
}
