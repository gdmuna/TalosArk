import { z } from 'zod';
import { datasetStep } from '../seed.definition.js';
import { governanceSteps } from './governance.group.js';
import type { DatasetGroup } from './seed.group.js';
import {
    chemicalDemo,
    biologicalDemo,
    consumableDemo,
    materialVolume,
} from '../dataset/material/material.dataset.js';
import { facilityDataset } from '../dataset/laboratory.dataset.js';
import {
    batchDataset,
    lifecycleReceiptDataset,
    inventoryHistoryDataset,
} from '../dataset/inventory.dataset.js';
import { approvalDataset } from '../dataset/approval.dataset.js';
import { facilityLifecycleDataset } from '../dataset/facility.dataset.js';

export const businessDemoGroup: DatasetGroup = {
    id: 'business-demo',
    version: 1,
    description:
        'Governance, all three material branches, batches, facilities, stock history and approval lifecycles',
    build(parameters, context) {
        const governance = governanceSteps(context);
        const materials = datasetStep('chemical', chemicalDemo, {}, context.generation, (results) =>
            results.get(governance.primary)
        );
        const consumable = datasetStep(
            'consumable',
            consumableDemo,
            {},
            context.generation,
            (results) => results.get(governance.primary)
        );
        const biological = datasetStep(
            'biological',
            biologicalDemo,
            {},
            context.generation,
            (results) => results.get(governance.primary)
        );
        const isolated = datasetStep(
            'isolated-material',
            materialVolume,
            { branch: 'chemical', count: 2 },
            context.generation,
            (results) => results.get(governance.other)
        );
        const batch = datasetStep('batch', batchDataset, {}, context.generation, (results) =>
            results.get(materials)
        );
        const facility = datasetStep(
            'facility',
            facilityDataset,
            { positions: 20 },
            context.generation,
            (results) => results.get(governance.primary)
        );
        const facilityLifecycle = datasetStep(
            'facility-lifecycle',
            facilityLifecycleDataset,
            {},
            context.generation,
            (results) => ({
                facility: results.get(facility),
                secondary: results.get(governance.secondary),
                empty: results.get(governance.empty),
            })
        );
        const receipt = datasetStep(
            'receipt',
            lifecycleReceiptDataset,
            {},
            context.generation,
            (results) => ({
                materials: results.get(materials),
                facility: results.get(facility),
                batches: results.get(batch),
            })
        );
        const history = datasetStep(
            'inventory-history',
            inventoryHistoryDataset,
            {},
            context.generation,
            (results) => ({ receipt: results.get(receipt), facility: results.get(facility) })
        );
        const approvals = datasetStep(
            'approval',
            approvalDataset,
            {},
            context.generation,
            (results) => ({
                receipt: results.get(receipt),
                facility: results.get(facility),
                reviewer: results.get(governance.accounts).reviewer,
            })
        );
        return {
            parameters: z.strictObject({}).parse(parameters),
            steps: [
                ...governance.steps,
                materials,
                consumable,
                biological,
                isolated,
                batch,
                facility,
                facilityLifecycle,
                receipt,
                history,
                approvals,
            ],
        };
    },
};
