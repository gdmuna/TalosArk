import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { ExtensionDiscovery } from './extension.discovery.js';

@Module({
    imports: [DiscoveryModule],
    providers: [ExtensionDiscovery],
    exports: [ExtensionDiscovery],
})
export class ExtensionDiscoveryModule {}
