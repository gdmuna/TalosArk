import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { OrganizationWriteModule } from '@/core/organization-write/index.js';
import { AuthorizationModule } from '@/core/authorization/index.js';
import { PermissionModule } from '@/core/permission/index.js';
import { AuditModule } from '@/core/audit/index.js';
import { ResourceModule } from '@/core/resource/index.js';
import { IdempotencyKernel } from '@/core/idempotency/index.js';
import { PlatformContextModule } from '@/platform/context/context.module.js';
import { MaterialCatalogModule } from '../material/material-catalog.module.js';
import { FacilityModule } from '../facility/facility.module.js';
import { InventoryController, InventoryOperationController } from './api/inventory.controller.js';
import { InventoryService } from './application/inventory.service.js';
import { InventoryAccessService } from './application/inventory-access.service.js';
import { InventoryRelocationService } from './application/inventory-relocation.service.js';
import { InventoryGovernanceService } from './application/inventory-governance.service.js';
import { InventoryOperationService } from './application/inventory-operation.service.js';
import { InventoryActionService } from './application/inventory-action.service.js';
import { InventoryActionWriter } from './application/inventory-action.writer.js';
import { InventoryActionReader } from './application/inventory-action.reader.js';
import { InventoryCalendar } from './domain/inventory-calendar.js';
import { InventoryIdempotencyRepository } from './infrastructure/persistence/inventory-idempotency.repository.js';
import {
    StockTargetProvider,
    InstanceTargetProvider,
    StockResourceProvider,
    InstanceResourceProvider,
} from './extensions/inventory-resource.provider.js';
@Module({
    imports: [
        DatabaseModule,
        OrganizationWriteModule,
        AuthorizationModule,
        PermissionModule,
        AuditModule,
        ResourceModule,
        PlatformContextModule,
        MaterialCatalogModule,
        FacilityModule,
    ],
    controllers: [InventoryController, InventoryOperationController],
    providers: [
        InventoryService,
        InventoryAccessService,
        InventoryRelocationService,
        InventoryGovernanceService,
        InventoryOperationService,
        InventoryActionService,
        InventoryActionWriter,
        InventoryActionReader,
        InventoryCalendar,
        InventoryIdempotencyRepository,
        StockTargetProvider,
        InstanceTargetProvider,
        StockResourceProvider,
        InstanceResourceProvider,
        {
            provide: IdempotencyKernel,
            inject: [DatabaseRuntime, InventoryIdempotencyRepository],
            useFactory: (database: DatabaseRuntime, repository: InventoryIdempotencyRepository) =>
                new IdempotencyKernel(database, repository),
        },
    ],
    exports: [
        InventoryActionService,
        InventoryActionWriter,
        InventoryActionReader,
        InventoryOperationService,
        InventoryService,
    ],
})
export class InventoryModule {}
