import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { TenantModule } from '@/core/tenant/index.js';
import { PermissionModule } from '@/core/permission/index.js';
import { AuditModule } from '@/core/audit/index.js';
import { WorkspaceModule } from '@/modules/workspace/index.js';
import { PlatformContextModule } from '@/platform/context/context.module.js';
import { OrganizationController } from './api/organization.controller.js';
import { OrganizationService } from './application/organization.service.js';

@Module({
    imports: [
        DatabaseModule,
        TenantModule,
        PermissionModule,
        AuditModule,
        WorkspaceModule,
        PlatformContextModule,
    ],
    controllers: [OrganizationController],
    providers: [OrganizationService],
})
export class OrganizationModule {}
