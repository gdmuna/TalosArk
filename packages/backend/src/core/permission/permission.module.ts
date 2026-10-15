import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { PermissionKernel } from './permission.kernel.js';
import { ExtensionDiscoveryModule } from '@/platform/extensions/discovery/index.js';
import { AuthorizationRegistry } from './authorization.registry.js';
import { PermissionEngine } from './internal/permission.engine.js';
import { PermissionPolicyReader } from './internal/permission.policy-reader.js';
import { PermissionRoleWriter } from './internal/permission.role-writer.js';

@Module({
    imports: [DatabaseModule, ExtensionDiscoveryModule],
    providers: [
        AuthorizationRegistry,
        PermissionEngine,
        PermissionPolicyReader,
        PermissionRoleWriter,
        PermissionKernel,
    ],
    exports: [PermissionKernel],
})
export class PermissionModule {}
