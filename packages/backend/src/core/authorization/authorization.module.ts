import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { PermissionModule } from '@/core/permission/index.js';
import { OrganizationContextModule } from '@/core/organization-context/index.js';
import { WorkspaceContextModule } from '@/core/workspace-context/index.js';
import { AuthorizationKernel } from './authorization.kernel.js';
import { AuthorizationContextResolver } from './internal/authorization.context-resolver.js';
import { AuthorizationTargetRegistry } from './internal/authorization-target.registry.js';
import { ExtensionDiscoveryModule } from '@/platform/extensions/discovery/index.js';

@Module({
    imports: [
        DatabaseModule,
        PermissionModule,
        OrganizationContextModule,
        WorkspaceContextModule,
        ExtensionDiscoveryModule,
    ],
    providers: [AuthorizationKernel, AuthorizationContextResolver, AuthorizationTargetRegistry],
    exports: [AuthorizationKernel],
})
export class AuthorizationModule {}
