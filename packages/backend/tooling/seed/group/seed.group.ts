import { z } from 'zod';
import { datasetStep, type GenerationContext, type SeedStep } from '../seed.definition.js';
import { workspaceDataset } from '../dataset/workspace.dataset.js';
import {
    biologicalDemo,
    chemicalDemo,
    consumableDemo,
    materialRegression,
    materialVolume,
} from '../dataset/material/material.dataset.js';
import { facilityDataset, receiptDataset } from '../dataset/laboratory.dataset.js';
import { ownerAccount } from '../dataset/account.dataset.js';

export interface GroupContext {
    actorUserId?: string;
    target: { organizationId: string; workspaceId: string } | null;
    generation: GenerationContext;
}
export interface DatasetGroup {
    readonly id: string;
    readonly version: number;
    readonly description: string;
    build(
        parameters: unknown,
        context: GroupContext
    ): { parameters: unknown; steps: readonly SeedStep[] };
}

export function workspaceStep(context: GroupContext) {
    if (!context.actorUserId) throw new Error('Existing workspace selection requires --actor');
    const actorUserId = context.actorUserId;
    return datasetStep('workspace', workspaceDataset, {}, context.generation, () => ({
        actorUserId,
        target: context.target,
    }));
}

export function baselineSteps(context: GroupContext) {
    if (context.actorUserId) {
        const scope = workspaceStep(context);
        return { scope, steps: [scope] };
    }
    if (context.target) throw new Error('--actor is required when selecting an existing scope');
    const account = datasetStep('account', ownerAccount, {}, context.generation, () => ({}));
    const scope = datasetStep('workspace', workspaceDataset, {}, context.generation, (results) => ({
        actorUserId: results.get(account).owner.userId,
        target: null,
    }));
    return { scope, steps: [account, scope] };
}

export const minimalGroup: DatasetGroup = {
    id: 'minimal',
    version: 1,
    description: 'An organization and a workspace for the selected actor',
    build(parameters, context) {
        return {
            parameters: z.strictObject({}).parse(parameters),
            steps: baselineSteps(context).steps,
        };
    },
};

export const materialDemoGroup: DatasetGroup = {
    id: 'material-demo',
    version: 1,
    description: '20 consumable, 15 chemical and 15 biological materials',
    build(parameters, context) {
        const parsed = z.strictObject({}).parse(parameters);
        const { scope: workspace, steps } = baselineSteps(context);
        return {
            parameters: parsed,
            steps: [
                ...steps,
                datasetStep('consumable', consumableDemo, {}, context.generation, (results) =>
                    results.get(workspace)
                ),
                datasetStep('chemical', chemicalDemo, {}, context.generation, (results) =>
                    results.get(workspace)
                ),
                datasetStep('biological', biologicalDemo, {}, context.generation, (results) =>
                    results.get(workspace)
                ),
            ],
        };
    },
};

export const materialVolumeGroup: DatasetGroup = {
    id: 'material-volume',
    version: 1,
    description: 'A parameterized material volume in its own workspace',
    build(parameters, context) {
        const parsed = materialVolume.definition.parameters.parse(parameters);
        const { scope: workspace, steps } = baselineSteps(context);
        return {
            parameters: parsed,
            steps: [
                ...steps,
                datasetStep('material', materialVolume, parsed, context.generation, (results) =>
                    results.get(workspace)
                ),
            ],
        };
    },
};

export const materialRegressionGroup: DatasetGroup = {
    id: 'material-regression',
    version: 1,
    description: 'Valid material boundary and compatibility fixtures',
    build(parameters, context) {
        const parsed = z.strictObject({}).parse(parameters);
        const { scope: workspace, steps } = baselineSteps(context);
        return {
            parameters: parsed,
            steps: [
                ...steps,
                datasetStep('material', materialRegression, {}, context.generation, (results) =>
                    results.get(workspace)
                ),
            ],
        };
    },
};

export const labDemoGroup: DatasetGroup = {
    id: 'lab-demo',
    version: 1,
    description: 'Chemical materials, a facility, ltree storage nodes and real stock receipts',
    build(parameters, context) {
        const parsed = z.strictObject({}).parse(parameters);
        const { scope: workspace, steps } = baselineSteps(context);
        const materials = datasetStep('material', chemicalDemo, {}, context.generation, (results) =>
            results.get(workspace)
        );
        const facility = datasetStep(
            'facility',
            facilityDataset,
            { positions: 15 },
            context.generation,
            (results) => results.get(workspace)
        );
        const receipt = datasetStep(
            'receipt',
            receiptDataset,
            {},
            context.generation,
            (results) => ({ materials: results.get(materials), facility: results.get(facility) })
        );
        return { parameters: parsed, steps: [...steps, materials, facility, receipt] };
    },
};
