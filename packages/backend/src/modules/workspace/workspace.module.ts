import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { PermissionModule } from '@/core/permission/index.js';
import { AuthorizationModule } from '@/core/authorization/index.js';
import { AuditModule } from '@/core/audit/index.js';
import { PlatformContextModule } from '@/platform/context/context.module.js';
import { WorkspaceController } from './api/workspace.controller.js';
import { WorkspaceService } from './application/workspace.service.js';

@Module({
    imports: [
        DatabaseModule,
        PermissionModule,
        AuthorizationModule,
        AuditModule,
        PlatformContextModule,
    ],
    controllers: [WorkspaceController],
    providers: [WorkspaceService],
    exports: [WorkspaceService],
})
export class WorkspaceModule {}
