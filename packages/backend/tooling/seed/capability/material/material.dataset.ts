import { z } from 'zod';
import { defineDatasetFor } from '../../definition/dataset.js';
import { generateMaterials, type MaterialBranch } from './material.factory.js';
import { MaterialBranchSchema } from '@talos-ark/contracts/material';
import { materialKind } from './material.kind.js';

const empty = z.strictObject({});
const defineMaterialDataset = defineDatasetFor(materialKind);
function demo(branch: MaterialBranch, count: number) {
    return defineMaterialDataset({
        id: `${branch}-demo`,
        version: 1,
        tags: ['material', 'demo', branch],
        description: `${count} ${branch} materials`,
        parameters: empty,
        build: (_, context) => generateMaterials(branch, count, context),
    });
}

export const consumableDemo = demo('consumable', 20);
export const chemicalDemo = demo('chemical', 15);
export const biologicalDemo = demo('biological', 15);
export const materialVolume = defineMaterialDataset({
    id: 'material-volume',
    version: 1,
    tags: ['material', 'volume', 'ui'],
    description: 'Deterministic material volume for pagination and filtering',
    parameters: z.strictObject({
        count: z.number().int().min(1).max(10000).default(5000),
        branch: MaterialBranchSchema.default('chemical'),
    }),
    build: (parameters, context) => generateMaterials(parameters.branch, parameters.count, context),
});

export const materialRegression = defineMaterialDataset({
    id: 'material-regression',
    version: 1,
    tags: ['material', 'regression', 'unicode', 'archived', 'legacy'],
    description: 'Current-schema fixtures with archived, Unicode and historical-style codes',
    parameters: empty,
    build: (_, context) => {
        const data = generateMaterials('chemical', 3, context);
        data.materials[0].input.name = '无水乙醇 / Ethanol / Éthanol';
        data.materials[0].input.code = 'LEGACY-ETOH-001';
        data.materials[1].archived = true;
        data.materials[2].input.name = 'A'.repeat(200);
        data.materials[2].input.code = null;
        return data;
    },
});
