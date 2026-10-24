import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { OrganizationContextModule } from '@/core/organization-context/index.js';
import { WorkspaceContextKernel } from './workspace-context.kernel.js';

@Module({
    imports: [DatabaseModule, OrganizationContextModule],
    providers: [WorkspaceContextKernel],
    exports: [WorkspaceContextKernel],
})
export class WorkspaceContextModule {}
