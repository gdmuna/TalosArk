import { defineSeedRuntime, provideSeedHandler } from '../../runtime/contribution.js';
import { WorkspaceModule } from '../../../../src/modules/workspace/workspace.module.js';
import { TeamGovernanceModule } from '../../../../src/core/team-governance/team-governance.module.js';
import { OrganizationTeamService } from '../../../../src/modules/organization/application/team.service.js';
import { TeamOperations } from '../../../../src/modules/organization/application/team.operations.js';
import { OrganizationInvitationService } from '../../../../src/modules/organization/application/invitation.service.js';
import { INVITATION_DELIVERY } from '../../../../src/modules/organization/application/invitation-delivery.port.js';
import { SeedSecrets } from '../../runtime/secret.js';
import { ExtraWorkspaceSeeder } from './workspace-layout.seeder.js';
import { TeamSeeder } from './team.seeder.js';
import { WorkspaceMembershipSeeder } from './workspace-membership.seeder.js';
import { extraWorkspaceKind, teamKind, workspaceMembershipKind } from './governance.kind.js';

export const governanceRuntime = defineSeedRuntime({
    imports: [WorkspaceModule, TeamGovernanceModule],
    providers: [
        OrganizationTeamService,
        TeamOperations,
        OrganizationInvitationService,
        { provide: INVITATION_DELIVERY, useExisting: SeedSecrets },
    ],
    handlers: [
        provideSeedHandler(extraWorkspaceKind, ExtraWorkspaceSeeder, {
            actor: (input) => input.actorUserId,
        }),
        provideSeedHandler(teamKind, TeamSeeder, { actor: (input) => input.scope.actorUserId }),
        provideSeedHandler(workspaceMembershipKind, WorkspaceMembershipSeeder, {
            actor: (input) => input.scope.actorUserId,
        }),
    ],
});
