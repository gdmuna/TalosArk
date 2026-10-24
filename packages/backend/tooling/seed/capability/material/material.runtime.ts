import { defineSeedRuntime, provideSeedHandler } from '../../runtime/contribution.js';
import { MaterialCatalogModule } from '../../../../src/modules/material/material-catalog.module.js';
import { MaterialSeeder } from './material.seeder.js';
import { BatchSeeder } from './batch.seeder.js';
import { materialKind } from './material.kind.js';
import { batchKind } from './batch.kind.js';

export const materialRuntime = defineSeedRuntime({
    imports: [MaterialCatalogModule],
    providers: [],
    handlers: [
        provideSeedHandler(materialKind, MaterialSeeder, {
            actor: (input) => input.actorUserId,
            recoverable: true,
        }),
        provideSeedHandler(batchKind, BatchSeeder, {
            actor: (input) => input.scope.actorUserId,
            recoverable: true,
        }),
    ],
});
