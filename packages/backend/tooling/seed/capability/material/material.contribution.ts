import { defineSeedContribution, datasetListing } from '../../plan/catalog.js';
import { materialKind } from './material.kind.js';
import { batchKind } from './batch.kind.js';
import {
    biologicalDemo,
    chemicalDemo,
    consumableDemo,
    materialRegression,
    materialVolume,
} from './material.dataset.js';
import { batchDataset } from './batch.dataset.js';
import { addWorkspaceBaseline } from '../../group/baseline.js';
import { datasetEntry } from '../../plan/catalog.js';
import type { BoundDataset } from '../../definition/dataset.js';
import type { z } from 'zod';
function selectable<P extends z.ZodType>(dataset: BoundDataset<typeof materialKind, P>) {
    return datasetEntry(dataset, (parameters, b) => {
        const scope = addWorkspaceBaseline(b);
        const material = b.stepFromUnknown(dataset.definition.id, dataset, parameters, {
            from: { scope },
            bind: ({ scope }) => scope,
        });
        b.expose({ [dataset.definition.id]: material });
    });
}

export const materialContribution = defineSeedContribution({
    definition: {
        id: 'material',
        kinds: [materialKind, batchKind],
        datasets: [
            datasetListing(biologicalDemo),
            datasetListing(chemicalDemo),
            datasetListing(consumableDemo),
            datasetListing(materialRegression),
            datasetListing(materialVolume),
            datasetListing(batchDataset),
        ],
        entries: [
            selectable(consumableDemo),
            selectable(chemicalDemo),
            selectable(biologicalDemo),
            selectable(materialRegression),
            selectable(materialVolume),
        ],
    },
    load: async () => (await import('./material.runtime.js')).materialRuntime,
});
