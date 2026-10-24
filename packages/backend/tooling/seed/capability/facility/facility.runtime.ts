import { defineSeedRuntime, provideSeedHandler } from '../../runtime/contribution.js';
import { FacilityModule } from '../../../../src/modules/facility/facility.module.js';
import { FacilitySeeder } from './facility.seeder.js';
import { FacilityLifecycleSeeder } from './lifecycle.seeder.js';
import { facilityKind } from './facility.kind.js';
import { facilityLifecycleKind } from './lifecycle.kind.js';
export const facilityRuntime = defineSeedRuntime({
    imports: [FacilityModule],
    providers: [],
    handlers: [
        provideSeedHandler(facilityKind, FacilitySeeder, { actor: (input) => input.actorUserId }),
        provideSeedHandler(facilityLifecycleKind, FacilityLifecycleSeeder, {
            actor: (input) => input.facility.scope.actorUserId,
        }),
    ],
});
