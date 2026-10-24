import { defineSeedRuntime, provideSeedHandler } from '../../runtime/contribution.js';
import { WorkspaceModule } from '../../../../src/modules/workspace/workspace.module.js';
import { OrganizationService } from '../../../../src/modules/organization/application/organization.service.js';
import { WorkspaceSeeder } from './workspace.seeder.js';
import { workspaceKind } from './workspace.kind.js';
export const workspaceRuntime = defineSeedRuntime({
    imports: [WorkspaceModule],
    providers: [OrganizationService],
    handlers: [
        provideSeedHandler(workspaceKind, WorkspaceSeeder, { actor: (input) => input.actorUserId }),
    ],
});
