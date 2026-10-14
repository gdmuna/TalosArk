import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { TenantModule } from '@/core/tenant/index.js';
import { PermissionModule } from '@/core/permission/index.js';
import { WorkspaceContextModule } from '@/core/workspace/index.js';
import { AuditModule } from '@/core/audit/index.js';
import { PlatformContextModule } from '@/platform/context/context.module.js';
import { WorkspaceController } from './api/workspace.controller.js';
import { WorkspaceService } from './application/workspace.service.js';

@Module({
    imports: [
        DatabaseModule,
        TenantModule,
        PermissionModule,
        WorkspaceContextModule,
        AuditModule,
        PlatformContextModule,
    ],
    controllers: [WorkspaceController],
    providers: [WorkspaceService],
    exports: [WorkspaceService],
})
export class WorkspaceModule {}
