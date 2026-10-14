import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { TenantKernel } from './tenant.kernel.js';

@Module({ imports: [DatabaseModule], providers: [TenantKernel], exports: [TenantKernel] })
export class TenantModule {}
