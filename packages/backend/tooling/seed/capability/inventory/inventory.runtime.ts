import { defineSeedRuntime, provideSeedHandler } from '../../runtime/contribution.js';
import { InventoryModule } from '../../../../src/modules/inventory/inventory.module.js';
import { ReceiptSeeder } from './receipt.seeder.js';
import { InventoryHistorySeeder } from './history.seeder.js';
import { receiptKind } from './receipt.kind.js';
import { inventoryHistoryKind } from './history.kind.js';

export const inventoryRuntime = defineSeedRuntime({
    imports: [InventoryModule],
    providers: [],
    handlers: [
        provideSeedHandler(receiptKind, ReceiptSeeder, {
            actor: (input) => input.materials.scope.actorUserId,
        }),
        provideSeedHandler(inventoryHistoryKind, InventoryHistorySeeder, {
            actor: (input) => input.receipt.scope.actorUserId,
        }),
    ],
});
