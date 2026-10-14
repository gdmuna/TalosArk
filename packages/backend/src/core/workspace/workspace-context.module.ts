import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { TenantModule } from '@/core/tenant/index.js';
import { PermissionModule } from '@/core/permission/index.js';
import { WorkspaceContextKernel } from './workspace-context.kernel.js';

@Module({
    imports: [DatabaseModule, TenantModule, PermissionModule],
    providers: [WorkspaceContextKernel],
    exports: [WorkspaceContextKernel],
})
export class WorkspaceContextModule {}
