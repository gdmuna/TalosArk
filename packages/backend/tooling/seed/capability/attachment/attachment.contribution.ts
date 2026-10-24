import { defineSeedContribution, datasetListing } from '../../plan/catalog.js';
import { attachmentKind } from './attachment.kind.js';
import { attachmentDataset } from './attachment.dataset.js';

export const attachmentContribution = defineSeedContribution({
    definition: {
        id: 'attachment',
        kinds: [attachmentKind],
        datasets: [datasetListing(attachmentDataset)],
        resources: ['object-storage'],
    },
    load: async () => (await import('./attachment.runtime.js')).attachmentRuntime,
});
