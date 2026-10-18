import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';

const catalog = defineInternalErrorCatalog('inventory.quantity', ['invalid']);

export const InventoryQuantityError = defineErrorClass(catalog, {
    name: 'InventoryQuantityError',
    diagnosticMessage: () =>
        'Quantity must fit Decimal(20,6) without rounding: at most 14 integer and 6 fractional digits',
});
