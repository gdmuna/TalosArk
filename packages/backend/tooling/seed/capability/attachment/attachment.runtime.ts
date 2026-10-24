import { defineSeedRuntime, provideSeedHandler } from '../../runtime/contribution.js';
import { MaterialModule } from '../../../../src/modules/material/material.module.js';
import { AttachmentSeeder } from './attachment.seeder.js';
import { attachmentKind } from './attachment.kind.js';

export const attachmentRuntime = defineSeedRuntime({
    imports: [MaterialModule],
    providers: [],
    handlers: [
        provideSeedHandler(attachmentKind, AttachmentSeeder, {
            actor: (input) => input.scope.actorUserId,
            recoverable: true,
        }),
    ],
});
