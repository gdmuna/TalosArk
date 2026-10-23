import { Module, type DynamicModule } from '@nestjs/common';
import { StorageModule } from '@/infra/storage/storage.module.js';
import { FileConfigurationModule } from '@/core/file/file.configuration.js';
import type { StorageConfig } from '@/config/storage.config.js';
import { MaterialModule } from '@/modules/material/material.module.js';
import { AttachmentSeeder } from '@root/tooling/seed/seeder/attachment.seeder.js';
import { DatabaseModule } from '@/infra/database/database.module.js';

@Module({})
export class SeedStorageModule {
    static forRoot(storage: StorageConfig): DynamicModule {
        return {
            module: SeedStorageModule,
            imports: [
                DatabaseModule,
                StorageModule.forRootAsync({ useFactory: () => ({ options: storage }) }),
                FileConfigurationModule.forRootAsync({
                    useFactory: () => ({
                        stagingBucket: storage.bucketStaging,
                        privateBucket: storage.bucketPrivate,
                    }),
                }),
                MaterialModule,
            ],
            providers: [AttachmentSeeder],
            exports: [AttachmentSeeder],
        };
    }
}
