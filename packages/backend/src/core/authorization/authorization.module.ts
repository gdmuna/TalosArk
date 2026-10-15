import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { PermissionModule } from '@/core/permission/index.js';
import { OrganizationContextModule } from '@/core/organization-context/index.js';
import { WorkspaceContextModule } from '@/core/workspace-context/index.js';
import { AuthorizationKernel } from './authorization.kernel.js';
import { AuthorizationContextResolver } from './internal/authorization.context-resolver.js';

@Module({
    imports: [DatabaseModule, PermissionModule, OrganizationContextModule, WorkspaceContextModule],
    providers: [AuthorizationKernel, AuthorizationContextResolver],
    exports: [AuthorizationKernel],
})
export class AuthorizationModule {}
