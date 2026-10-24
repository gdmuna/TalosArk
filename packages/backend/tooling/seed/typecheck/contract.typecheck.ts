import { z } from 'zod';
import { materialKind, type MaterialSeedDraft } from '../capability/material/material.kind.js';
import { batchKind } from '../capability/material/batch.kind.js';
import { materialVolume } from '../capability/material/material.dataset.js';
import { type GenerationContext } from '../definition/dataset.js';
import { SeedGroupBuilder } from '../definition/group.js';
import { SeedServices, type BusinessSeeder } from '../runtime/handler.js';

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
    const builder = new SeedGroupBuilder({ scope: { kind: 'provision' }, generation });
    builder.step(
        'wrong-parameter',
        materialVolume,
        // @ts-expect-error Group parameters retain the dataset parameter types.
        { count: '100' },
        { from: {}, bind: () => ({ actorUserId: '', organizationId: '', workspaceId: '' }) }
    );
    builder.step(
        'wrong-input',
        materialVolume,
        { count: 1 },
        // @ts-expect-error The material operation requires a complete scope binding.
        { from: {}, bind: () => ({ actorUserId: '' }) }
    );
    const defaults: z.input<typeof materialKind.data> = { types: [], materials: [] };
    void [missingUnit, wrongBranch, defaults];
}
