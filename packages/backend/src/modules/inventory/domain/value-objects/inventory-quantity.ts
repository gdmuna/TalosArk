import { Prisma } from '@root/prisma/generated/client.js';
import { InventoryQuantityError } from './inventory-quantity.error.js';

const QuantityDecimal = Prisma.Decimal.clone({ precision: 40 });
const quantityPattern = /^-?(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,6})?$/;

export type InventoryQuantity = Prisma.Decimal;

export function parseInventoryQuantity(input: string): InventoryQuantity {
    if (typeof input !== 'string' || input.length > 22 || !quantityPattern.test(input))
        throw new InventoryQuantityError({ reason: 'invalid' });
    return new QuantityDecimal(input);
}

export function formatInventoryQuantity(value: InventoryQuantity): string {
    if (
        !Prisma.Decimal.isDecimal(value) ||
        !value.isFinite() ||
        value.decimalPlaces() > 6 ||
        value.abs().gte('100000000000000')
    )
        throw new InventoryQuantityError({ reason: 'invalid' });
    return value.isZero() ? '0.000000' : value.toFixed(6);
}
