import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { StorageNodeReader } from './infrastructure/persistence/storage-node.reader.js';
import { StorageNodeWriter } from './infrastructure/persistence/storage-node.writer.js';
import { FacilityStorageTopologyReader } from './public/facility-storage-topology.reader.js';
import { FacilityStorageTopologyWriter } from './public/facility-storage-topology.writer.js';

@Module({
    imports: [DatabaseModule],
    providers: [
        StorageNodeReader,
        StorageNodeWriter,
        { provide: FacilityStorageTopologyReader, useExisting: StorageNodeReader },
        { provide: FacilityStorageTopologyWriter, useExisting: StorageNodeWriter },
    ],
    exports: [FacilityStorageTopologyReader, FacilityStorageTopologyWriter],
})
export class FacilityModule {}
