import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { AuditKernel } from './audit.kernel.js';
import { AuditRepository } from './internal/audit.repository.js';

@Module({
    imports: [DatabaseModule],
    providers: [AuditRepository, AuditKernel],
    exports: [AuditKernel],
})
export class AuditModule {}
