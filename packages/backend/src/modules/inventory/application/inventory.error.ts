import { InventoryErrorDefinition } from '@talos-ark/contracts/backend';
import { defineErrorClass } from '@/platform/error/index.js';
export const InventoryError = defineErrorClass(InventoryErrorDefinition, {
    name: 'InventoryError',
});
