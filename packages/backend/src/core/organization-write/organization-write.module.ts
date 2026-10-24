import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { OrganizationWriteKernel } from './organization-write.kernel.js';

@Module({
    imports: [DatabaseModule],
    providers: [OrganizationWriteKernel],
    exports: [OrganizationWriteKernel],
})
export class OrganizationWriteModule {}
