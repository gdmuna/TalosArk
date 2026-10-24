import { z } from 'zod';
import { materialKind, type MaterialSeedDraft } from '../seeder/seed.kind.js';
import { batchKind } from '../seeder/batch.kind.js';
import { materialVolume } from '../dataset/material/material.dataset.js';
import {
    datasetStep,
    SeedServices,
    type BusinessSeeder,
    type GenerationContext,
} from '../seed.definition.js';

/** Compile-only assertions. Never imported by the execution entry. */
export function seedTypeBoundaryChecks(
    batch: BusinessSeeder<typeof batchKind>,
    generation: GenerationContext
) {
    // @ts-expect-error A required upstream contract field must fail before runtime parsing.
    const missingUnit: MaterialSeedDraft = { branch: 'chemical', name: 'Missing unit' };
    const wrongBranch: MaterialSeedDraft = {
        branch: 'chemical',
        name: 'Wrong branch',
        quantityUnit: 'mL',
        // @ts-expect-error Chemical attributes cannot silently accept another branch's fields.
        attributes: { species: 'Homo sapiens' },
    };
    // @ts-expect-error Schema kind is fixed before inferring the implementation.
    new SeedServices().register(materialKind, batch);
    // @ts-expect-error Group parameters retain the dataset parameter types.
    datasetStep('wrong-parameter', materialVolume, { count: '100' }, generation, () => ({
        actorUserId: '',
        organizationId: '',
        workspaceId: '',
    }));
    const defaults: z.input<typeof materialKind.data> = { types: [], materials: [] };
    void [missingUnit, wrongBranch, defaults];
}
