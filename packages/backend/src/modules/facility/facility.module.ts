import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { AuthorizationModule } from '@/core/authorization/index.js';
import { OrganizationWriteModule } from '@/core/organization-write/index.js';
import { PermissionModule } from '@/core/permission/index.js';
import { ResourceModule } from '@/core/resource/index.js';
import { AuditModule } from '@/core/audit/index.js';
import { PlatformContextModule } from '@/platform/context/context.module.js';
import { FacilityService } from './application/facility.service.js';
import { FacilityOperations } from './application/facility.operations.js';
import { FacilityAccessService } from './application/facility-access.service.js';
import { StorageStructureService } from './application/storage-structure.service.js';
import { FacilityStorageReader } from './infrastructure/persistence/facility-storage.reader.js';
import {
    FacilityResourceProvider,
    TopologyResourceProvider,
    StorageNodeResourceProvider,
} from './extensions/facility-resource.provider.js';
import { FacilityController } from './api/facility.controller.js';
import { StorageController } from './api/storage.controller.js';
import { FacilityPositionReader } from './public/facility-position.reader.js';
import { FacilityRelocation } from './public/facility-relocation.js';
import { StorageNodeReader } from './infrastructure/persistence/storage-node.reader.js';
import { StorageNodeWriter } from './infrastructure/persistence/storage-node.writer.js';
import { FacilityStorageTopologyReader } from './public/facility-storage-topology.reader.js';
import { FacilityStorageTopologyWriter } from './public/facility-storage-topology.writer.js';

@Module({
    imports: [
        DatabaseModule,
        AuthorizationModule,
        OrganizationWriteModule,
        PermissionModule,
        ResourceModule,
        AuditModule,
        PlatformContextModule,
    ],
    controllers: [FacilityController, StorageController],
    providers: [
        FacilityService,
        FacilityOperations,
        FacilityAccessService,
        StorageStructureService,
        FacilityStorageReader,
        FacilityPositionReader,
        FacilityRelocation,
        FacilityResourceProvider,
        TopologyResourceProvider,
        StorageNodeResourceProvider,
        StorageNodeReader,
        StorageNodeWriter,
        { provide: FacilityStorageTopologyReader, useExisting: StorageNodeReader },
        { provide: FacilityStorageTopologyWriter, useExisting: StorageNodeWriter },
    ],
    exports: [
        FacilityService,
        StorageStructureService,
        FacilityStorageTopologyReader,
        FacilityStorageTopologyWriter,
        FacilityPositionReader,
        FacilityRelocation,
    ],
})
export class FacilityModule {}
