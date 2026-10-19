import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { SystemAccessKernel } from './system-access.kernel.js';

@Module({
    imports: [DatabaseModule],
    providers: [SystemAccessKernel],
    exports: [SystemAccessKernel],
})
export class SystemAccessModule {}
