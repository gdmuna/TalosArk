import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { SystemAccessModule } from '@/core/system-access/index.js';
import { OrganizationContextKernel } from './organization-context.kernel.js';

@Module({
    imports: [DatabaseModule, SystemAccessModule],
    providers: [OrganizationContextKernel],
    exports: [OrganizationContextKernel],
})
export class OrganizationContextModule {}
