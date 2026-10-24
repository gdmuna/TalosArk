import { z } from 'zod';
import { datasetStep } from '../seed.definition.js';
import { baselineSteps, type DatasetGroup } from './seed.group.js';
import { memberAccounts, memberVolume, memberVolumeParameters } from '../dataset/volume.dataset.js';
import { workspaceDataset } from '../dataset/workspace.dataset.js';
import { materialVolume } from '../dataset/material/material.dataset.js';
import { facilityDataset, receiptDataset } from '../dataset/laboratory.dataset.js';

export const governanceVolumeGroup: DatasetGroup = {
    id: 'governance-volume',
    version: 1,
    description:
        '1-199 real members for governance pagination; password hashing is intentionally bounded',
    build(parameters, context) {
        if (context.actorUserId || context.target)
            throw new Error('Governance volume creates isolated accounts and scopes');
        const parsed = memberVolumeParameters.parse(parameters);
        const accounts = datasetStep(
            'account',
            memberAccounts,
            parsed,
            context.generation,
            () => ({})
        );
        const scope = datasetStep(
            'workspace',
            workspaceDataset,
            {},
            context.generation,
            (results) => ({ actorUserId: results.get(accounts).owner.userId, target: null })
        );
        const members = datasetStep(
            'team',
            memberVolume,
            parsed,
            context.generation,
            (results) => ({ scope: results.get(scope), accounts: results.get(accounts) })
        );
        return { parameters: parsed, steps: [accounts, scope, members] };
    },
};

export const inventoryVolumeGroup: DatasetGroup = {
    id: 'inventory-volume',
    version: 1,
    description: '1-100 real stock items with exclusive positions for inventory pagination',
    build(parameters, context) {
        const parsed = z
            .strictObject({ count: z.number().int().min(1).max(100).default(100) })
            .parse(parameters);
        const { scope, steps } = baselineSteps(context);
        const material = datasetStep(
            'material',
            materialVolume,
            { count: parsed.count, branch: 'chemical' },
            context.generation,
            (results) => results.get(scope)
        );
        const facility = datasetStep(
            'facility',
            facilityDataset,
            { positions: parsed.count },
            context.generation,
            (results) => results.get(scope)
        );
        const receipt = datasetStep(
            'receipt',
            receiptDataset,
            {},
            context.generation,
            (results) => ({ materials: results.get(material), facility: results.get(facility) })
        );
        return { parameters: parsed, steps: [...steps, material, facility, receipt] };
    },
};
