import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { OrganizationWriteModule } from '@/core/organization-write/index.js';
import { AuthorizationModule } from '@/core/authorization/index.js';
import { WorkspaceContextModule } from '@/core/workspace-context/index.js';
import { PermissionModule } from '@/core/permission/index.js';
import { ResourceModule } from '@/core/resource/index.js';
import { AuditModule } from '@/core/audit/index.js';
import { IdempotencyKernel } from '@/core/idempotency/index.js';
import { PlatformContextModule } from '@/platform/context/context.module.js';
import { FacilityModule } from '@/modules/facility/facility.module.js';
import { InventoryModule } from '@/modules/inventory/inventory.module.js';
import { ApprovalController, ApprovalGovernanceController } from './api/approval.controller.js';
import { ApprovalGovernanceService } from './application/approval-governance.service.js';
import { ApprovalAccessService } from './application/approval-access.service.js';
import { ApprovalService } from './application/approval.service.js';
import { ApprovalQueryService } from './application/approval-query.service.js';
import { ApprovalExecutionService } from './application/approval-execution.service.js';
import { ApprovalIdempotencyRepository } from './infrastructure/persistence/approval-idempotency.repository.js';
import { ApprovalResourceProvider } from './extensions/approval-resource.provider.js';

@Module({
    imports: [
        DatabaseModule,
        OrganizationWriteModule,
        AuthorizationModule,
        WorkspaceContextModule,
        PermissionModule,
        ResourceModule,
        AuditModule,
        PlatformContextModule,
        FacilityModule,
        InventoryModule,
    ],
    controllers: [ApprovalController, ApprovalGovernanceController],
    providers: [
        ApprovalAccessService,
        ApprovalService,
        ApprovalQueryService,
        ApprovalExecutionService,
        ApprovalIdempotencyRepository,
        ApprovalResourceProvider,
        ApprovalGovernanceService,
        {
            provide: IdempotencyKernel,
            inject: [DatabaseRuntime, ApprovalIdempotencyRepository],
            useFactory: (database: DatabaseRuntime, repository: ApprovalIdempotencyRepository) =>
                new IdempotencyKernel(database, repository),
        },
    ],
})
export class ApprovalModule {}
