import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { OrganizationContextModule } from '@/core/organization-context/index.js';
import { PermissionModule } from '@/core/permission/index.js';
import { AuthorizationModule } from '@/core/authorization/index.js';
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

@Module({
    imports: [
        DatabaseModule,
        OrganizationContextModule,
        PermissionModule,
        AuthorizationModule,
        AuditModule,
        WorkspaceModule,
        PlatformContextModule,
    ],
    controllers: [OrganizationController, OrganizationTeamController, InvitationController],
    providers: [
        OrganizationService,
        OrganizationTeamService,
        OrganizationInvitationService,
        InvitationDelivery,
        TeamOperations,
    ],
})
export class OrganizationModule {}
