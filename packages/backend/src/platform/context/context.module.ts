import { AlsContextAdapter } from './als-context.adapter.js';

import { Module } from '@nestjs/common';

@Module({
    providers: [AlsContextAdapter],
    exports: [AlsContextAdapter],
})
export class PlatformContextModule {}
