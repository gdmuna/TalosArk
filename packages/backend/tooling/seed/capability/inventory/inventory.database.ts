import { databaseTables, type SeedDatabaseRequirement } from '../../definition/database.js';
import { materialDatabase } from '../material/material.database.js';
import { facilityDatabase } from '../facility/facility.database.js';

export const inventoryDatabase: readonly SeedDatabaseRequirement[] = [
    ...materialDatabase,
    ...facilityDatabase,
    ...databaseTables(
        'MaterialBatch',
        'StockItem',
        'InventoryOperation',
        'InventoryTransaction',
        'InventoryTransactionLine'
    ),
    ...[
        ['MaterialInstance', 'MaterialInstance_initialQuantity_check'],
        ['MaterialInstance', 'MaterialInstance_expiry_check'],
        ['StockItem', 'StockItem_quantity_check'],
        ['StockItem', 'StockItem_status_quantity_check'],
        ['InventoryOperation', 'InventoryOperation_scope_check'],
    ].map(([table, name]) => ({ type: 'constraint' as const, schema: 'public', table, name })),
];
