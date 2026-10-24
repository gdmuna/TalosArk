import { defineSeedContribution, datasetListing } from '../../plan/catalog.js';
import { workspaceKind } from './workspace.kind.js';
import { workspaceDataset } from './workspace.dataset.js';

export const workspaceContribution = defineSeedContribution({
    definition: {
        id: 'workspace',
        kinds: [workspaceKind],
        datasets: [datasetListing(workspaceDataset)],
    },
    load: async () => (await import('./workspace.runtime.js')).workspaceRuntime,
});
