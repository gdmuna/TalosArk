import { defineSeedContribution, datasetListing } from '../../plan/catalog.js';
import { approvalKind } from './approval.kind.js';
import { approvalDataset } from './approval.dataset.js';

export const approvalContribution = defineSeedContribution({
    definition: {
        id: 'approval',
        kinds: [approvalKind],
        datasets: [datasetListing(approvalDataset)],
    },
    load: async () => (await import('./approval.runtime.js')).approvalRuntime,
});
