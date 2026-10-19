import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { OrganizationContextModule } from '@/core/organization-context/index.js';
import { OrganizationWriteModule } from '@/core/organization-write/index.js';
import { PermissionModule } from '@/core/permission/index.js';
import { AuthorizationModule } from '@/core/authorization/index.js';
import { TeamGovernanceModule } from '@/core/team-governance/index.js';
import { AuditModule } from '@/core/audit/index.js';
import { WorkspaceModule } from '@/modules/workspace/index.js';
import { PlatformContextModule } from '@/platform/context/context.module.js';
import { OrganizationController } from './api/organization.controller.js';
import { OrganizationService } from './application/organization.service.js';
import { OrganizationTeamController } from './api/team.controller.js';
import { InvitationController } from './api/invitation.controller.js';
import { OrganizationTeamService } from './application/team.service.js';
import { OrganizationInvitationService } from './application/invitation.service.js';
import { InvitationDelivery } from './application/invitation.delivery.js';
import { TeamOperations } from './application/team.operations.js';
import { TeamDetailController } from './api/team-detail.controller.js';
import { TeamDetailService } from './application/team-detail.service.js';

@Module({
    imports: [
        DatabaseModule,
        OrganizationContextModule,
        OrganizationWriteModule,
        PermissionModule,
        AuthorizationModule,
        TeamGovernanceModule,
        AuditModule,
        WorkspaceModule,
        PlatformContextModule,
    ],
    controllers: [
        OrganizationController,
        OrganizationTeamController,
        TeamDetailController,
        InvitationController,
    ],
    providers: [
        OrganizationService,
        OrganizationTeamService,
        OrganizationInvitationService,
        InvitationDelivery,
        TeamOperations,
        TeamDetailService,
    ],
})
export class OrganizationModule {}
