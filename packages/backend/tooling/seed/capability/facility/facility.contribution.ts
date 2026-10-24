import { defineSeedContribution, datasetListing } from '../../plan/catalog.js';
import { facilityKind } from './facility.kind.js';
import { facilityLifecycleKind } from './lifecycle.kind.js';
import { facilityDataset } from './facility.dataset.js';
import { facilityLifecycleDataset } from './lifecycle.dataset.js';

export const facilityContribution = defineSeedContribution({
    definition: {
        id: 'facility',
        kinds: [facilityKind, facilityLifecycleKind],
        datasets: [datasetListing(facilityDataset), datasetListing(facilityLifecycleDataset)],
    },
    load: async () => (await import('./facility.runtime.js')).facilityRuntime,
});
