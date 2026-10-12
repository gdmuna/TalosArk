import { AccessKernel } from './access.kernel.js';

import { DatabaseModule } from '@/infra/database/database.module.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [DatabaseModule],
    providers: [AccessKernel],
    exports: [AccessKernel],
})
export class AccessModule {}
