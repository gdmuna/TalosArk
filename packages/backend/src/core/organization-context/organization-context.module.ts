import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { OrganizationContextKernel } from './organization-context.kernel.js';

@Module({
    imports: [DatabaseModule],
    providers: [OrganizationContextKernel],
    exports: [OrganizationContextKernel],
})
export class OrganizationContextModule {}
