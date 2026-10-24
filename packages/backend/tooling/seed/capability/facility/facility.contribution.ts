import { defineSeedContribution, datasetListing } from '../../plan/catalog.js';
import { facilityKind } from './facility.kind.js';
import { facilityLifecycleKind } from './lifecycle.kind.js';
import { facilityDataset } from './facility.dataset.js';
import { facilityLifecycleDataset } from './lifecycle.dataset.js';
import { facilityDatabase } from './facility.database.js';

export const facilityContribution = defineSeedContribution({
    definition: {
        id: 'facility',
        kinds: [facilityKind, facilityLifecycleKind],
        database: [
            {
                kindId: facilityKind.id,
                requires: facilityDatabase,
                hint: 'Run db:init, synchronize the facility schema, then run db:apply-ddl for the selected environment.',
            },
            {
                kindId: facilityLifecycleKind.id,
                requires: [
                    ...facilityDatabase,
                    {
                        type: 'function',
                        signature:
                            'public.storage_node_move(uuid,uuid,uuid,uuid,uuid,text,integer,integer)',
                    },
                ],
                hint: 'Run db:apply-ddl for the selected environment.',
            },
        ],
        datasets: [datasetListing(facilityDataset), datasetListing(facilityLifecycleDataset)],
    },
    load: async () => (await import('./facility.runtime.js')).facilityRuntime,
});
