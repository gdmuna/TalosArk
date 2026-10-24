import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { ExtensionDiscoveryModule } from '@/platform/extensions/discovery/index.js';
import { ResourceKernel } from './resource.kernel.js';
import { ResourceProviderRegistry } from './resource-provider.registry.js';

@Module({
    imports: [DatabaseModule, ExtensionDiscoveryModule],
    providers: [ResourceKernel, ResourceProviderRegistry],
    exports: [ResourceKernel],
})
export class ResourceModule {}
