import { defineSeedContribution, datasetListing } from '../../plan/catalog.js';
import { workspaceKind } from './workspace.kind.js';
import { workspaceDataset } from './workspace.dataset.js';
import { workspaceDatabase } from './workspace.database.js';

export const workspaceContribution = defineSeedContribution({
    definition: {
        id: 'workspace',
        kinds: [workspaceKind],
        database: [
            {
                kindId: workspaceKind.id,
                requires: workspaceDatabase,
                hint: 'Synchronize the organization/workspace schema for the selected environment.',
            },
        ],
        datasets: [datasetListing(workspaceDataset)],
    },
    load: async () => (await import('./workspace.runtime.js')).workspaceRuntime,
});
