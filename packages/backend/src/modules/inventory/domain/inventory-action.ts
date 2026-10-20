import type { InventoryQuantity } from './value-objects/inventory-quantity.js';
import { parseInventoryQuantity } from './value-objects/inventory-quantity.js';

type Action =
    | { kind: 'consume'; quantity: InventoryQuantity }
    | { kind: 'adjust'; quantity: InventoryQuantity }
    | { kind: 'transfer' }
    | { kind: 'dispose' };
type Failure = 'state' | 'invalid' | 'consumptionExpired' | 'insufficient';
type Plan =
    | { ok: false; reason: Failure }
    | {
          ok: true;
          quantity: InventoryQuantity;
          status: 'IN_STOCK' | 'DEPLETED' | 'DISPOSED';
          placement: 'keep' | 'move' | 'release';
          transactionType: 'CONSUMPTION' | 'TRANSFER' | 'ADJUSTMENT' | 'DISPOSAL';
      };

export function planInventoryAction(
    stock: { quantity: InventoryQuantity; status: string; quantityScale: number; expired: boolean },
    action: Action
): Plan {
    if (stock.status !== 'IN_STOCK' && stock.status !== 'DEPLETED')
        return { ok: false, reason: 'state' };
    if (action.kind === 'transfer')
        return {
            ok: true,
            quantity: stock.quantity,
            status: stock.status,
            placement: 'move',
            transactionType: 'TRANSFER',
        };
    if (action.kind === 'dispose')
        return {
            ok: true,
            quantity: parseInventoryQuantity('0'),
            status: 'DISPOSED',
            placement: 'release',
            transactionType: 'DISPOSAL',
        };
    if (action.quantity.isNegative() || action.quantity.decimalPlaces() > stock.quantityScale)
        return { ok: false, reason: 'invalid' };
    if (action.kind === 'consume') {
        if (!action.quantity.isPositive()) return { ok: false, reason: 'invalid' };
        if (stock.expired) return { ok: false, reason: 'consumptionExpired' };
        if (stock.status === 'DEPLETED') return { ok: false, reason: 'state' };
        if (action.quantity.gt(stock.quantity)) return { ok: false, reason: 'insufficient' };
    } else if (action.quantity.eq(stock.quantity)) return { ok: false, reason: 'invalid' };
    const quantity =
        action.kind === 'consume' ? stock.quantity.minus(action.quantity) : action.quantity;
    return {
        ok: true,
        quantity,
        status: quantity.isZero() ? 'DEPLETED' : 'IN_STOCK',
        placement: 'keep',
        transactionType: action.kind === 'consume' ? 'CONSUMPTION' : 'ADJUSTMENT',
    };
}
