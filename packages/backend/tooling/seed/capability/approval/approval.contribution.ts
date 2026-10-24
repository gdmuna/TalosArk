import { defineSeedContribution, datasetListing } from '../../plan/catalog.js';
import { approvalKind } from './approval.kind.js';
import { approvalDataset } from './approval.dataset.js';
import { databaseTables } from '../../definition/database.js';
import { inventoryDatabase } from '../inventory/inventory.database.js';

export const approvalContribution = defineSeedContribution({
    definition: {
        id: 'approval',
        kinds: [approvalKind],
        database: [
            {
                kindId: approvalKind.id,
                requires: [
                    ...inventoryDatabase,
                    ...databaseTables(
                        'ApprovalRequest',
                        'ApprovalLine',
                        'ApprovalEvent',
                        'ApprovalOperation'
                    ),
                    {
                        type: 'constraint',
                        schema: 'public',
                        table: 'ApprovalRequest',
                        name: 'ApprovalRequest_state_check',
                    },
                    {
                        type: 'constraint',
                        schema: 'public',
                        table: 'ApprovalLine',
                        name: 'ApprovalLine_state_check',
                    },
                ],
                hint: 'Synchronize the approval schema and apply db:apply-approval-ddl, db:apply-inventory-ddl and db:apply-ddl for the selected environment.',
            },
        ],
        datasets: [datasetListing(approvalDataset)],
    },
    load: async () => (await import('./approval.runtime.js')).approvalRuntime,
});
