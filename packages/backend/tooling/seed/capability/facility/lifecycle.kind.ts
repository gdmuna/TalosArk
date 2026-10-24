import { z } from 'zod';
import {
    FacilityWriteSchema,
    FacilityStateSchema,
    FacilityGrantSchema,
} from '@talos-ark/contracts/facility';
import { facilityOutputSchema } from './facility.kind.js';
import { scopeReferenceSchema } from '../../definition/reference.js';
import { type SeederKind } from '../../definition/dataset.js';

export const facilityLifecycleKind = {
    id: 'facility-lifecycle',
    version: 1,
    data: z.strictObject({
        facilities: z
            .array(
                z.strictObject({
                    key: z.string(),
                    input: FacilityWriteSchema.omit({ managementWorkspaceId: true }),
                    state: FacilityStateSchema.shape.state,
                })
            )
            .max(20),
        grants: z
            .array(
                z.strictObject({
                    workspace: z.enum(['secondary', 'empty']),
                    level: FacilityGrantSchema.shape.level,
                })
            )
            .max(2),
    }),
    input: z.strictObject({
        facility: facilityOutputSchema,
        secondary: scopeReferenceSchema,
        empty: scopeReferenceSchema,
    }),
    output: z.strictObject({
        facilities: z.record(z.string(), z.uuid()),
        gridContainerId: z.uuid(),
        gridPositions: z.array(z.uuid()),
    }),
} satisfies SeederKind;
