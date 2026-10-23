import { z } from 'zod';
import { datasetStep } from '../seed.definition.js';
import { materialVolume } from '../dataset/material/material.dataset.js';
import { attachmentDataset } from '../dataset/attachment.dataset.js';
import { baselineSteps, type DatasetGroup } from './seed.group.js';

export const attachmentIntegrationGroup: DatasetGroup = {
    id: 'attachment-integration',
    version: 1,
    description:
        'Opt-in real object-store workflows; requires an explicitly supplied storage-only configuration',
    build(parameters, context) {
        const { scope, steps } = baselineSteps(context);
        const materials = datasetStep(
            'material',
            materialVolume,
            { branch: 'chemical', count: 1 },
            context.generation,
            (results) => results.get(scope)
        );
        const files = datasetStep(
            'attachment',
            attachmentDataset,
            {},
            context.generation,
            (results) => results.get(materials)
        );
        return {
            parameters: z.strictObject({}).parse(parameters),
            steps: [...steps, materials, files],
        };
    },
};
