import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
    appConfig,
    databaseConfig,
    observabilityConfig,
    queueConfig,
    kvsConfig,
    storageConfig,
} from '../../src/config/index.js';
import { PlatformLoggerModule } from '../../src/platform/observability/logger/logger.module.js';
import { TaskModule } from '../../src/core/task/task.module.js';

@Module({})
export class TaskToolModule {
    static async forAction(action: string): Promise<DynamicModule> {
        const handlers = ['retry', 'file-cleanup', 'recover'].includes(action);
        const imports: NonNullable<DynamicModule['imports']> = [];
        if (handlers) {
            const [
                { MaintenanceModule },
                { StorageModule },
                { storageOptions },
                { fileConfiguration },
            ] = await Promise.all([
                import('../../src/system/maintenance/file-cleanup.task.js'),
                import('../../src/infra/storage/index.js'),
                import('../../src/bootstrap/composition/infra.composition.js'),
                import('../../src/bootstrap/composition/file.provider.js'),
            ]);
            imports.push(
                fileConfiguration,
                StorageModule.forRootAsync(storageOptions),
                MaintenanceModule
            );
        }
        if (action === 'recover')
            imports.push((await import('../../src/infra/queue/bullmq/index.js')).BullmqModule);
        return {
            module: TaskToolModule,
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    ignoreEnvFile: true,
                    load: [
                        appConfig,
                        databaseConfig,
                        observabilityConfig,
                        queueConfig,
                        ...(handlers ? [kvsConfig, storageConfig] : []),
                    ],
                }),
                PlatformLoggerModule.forRoot(),
                TaskModule,
                ...imports,
            ],
        };
    }
}
