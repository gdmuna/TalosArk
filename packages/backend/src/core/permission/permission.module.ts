import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { PermissionKernel } from './permission.kernel.js';
import { ExtensionDiscoveryModule } from '@/platform/extensions/discovery/index.js';
import { AuthorizationRegistry } from './authorization.registry.js';

@Module({
    imports: [DatabaseModule, ExtensionDiscoveryModule],
    providers: [AuthorizationRegistry, PermissionKernel],
    exports: [PermissionKernel],
})
export class PermissionModule {}
