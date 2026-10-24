import { databaseTables, type SeedDatabaseRequirement } from '../../definition/database.js';
import { workspaceDatabase } from '../workspace/workspace.database.js';

export const facilityDatabase: readonly SeedDatabaseRequirement[] = [
    ...workspaceDatabase,
    ...databaseTables(
        'Facility',
        'FacilityWorkspaceAccess',
        'StorageTopology',
        'StorageNode',
        'Placement',
        'ResourceIdentity'
    ),
    { type: 'extension', name: 'ltree' },
    { type: 'trigger', schema: 'public', table: 'StorageNode', name: 'storage_node_guard' },
    { type: 'trigger', schema: 'public', table: 'StorageNode', name: 'storage_node_validate' },
];
