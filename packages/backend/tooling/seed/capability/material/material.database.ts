import { databaseTables, type SeedDatabaseRequirement } from '../../definition/database.js';
import { workspaceDatabase } from '../workspace/workspace.database.js';

export const materialDatabase: readonly SeedDatabaseRequirement[] = [
    ...workspaceDatabase,
    ...databaseTables(
        'Material',
        'MaterialType',
        'MaterialAlias',
        'MaterialIdentifier',
        'MaterialInstance',
        'ResourceIdentity'
    ),
    {
        type: 'constraint',
        schema: 'public',
        table: 'Material',
        name: 'Material_quantityScale_check',
    },
];
