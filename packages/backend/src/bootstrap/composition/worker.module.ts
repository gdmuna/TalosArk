import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
    appConfig,
    databaseConfig,
    kvsConfig,
    lifecycleConfig,
    observabilityConfig,
    queueConfig,
    storageConfig,
} from '@/config/index.js';
import { PlatformLoggerModule } from '@/platform/observability/logger/logger.module.js';
import { BullmqModule } from '@/infra/queue/bullmq/index.js';
import { StorageModule } from '@/infra/storage/index.js';
import { MaintenanceModule } from '@/system/maintenance/file-cleanup.task.js';
import { HealthModule } from '@/system/health/health.module.js';
import { storageOptions } from './infra.composition.js';
import { fileConfiguration } from './file.provider.js';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [
                appConfig,
                databaseConfig,
                kvsConfig,
                lifecycleConfig,
                observabilityConfig,
                queueConfig,
                storageConfig,
            ],
        }),
        PlatformLoggerModule.forRoot(),
        fileConfiguration,
        StorageModule.forRootAsync(storageOptions),
        MaintenanceModule,
        BullmqModule,
        HealthModule,
    ],
})
export class WorkerModule {}
