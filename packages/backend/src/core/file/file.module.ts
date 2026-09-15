import { FileRepository } from './internal/file.repository.js';
import { DocumentStrategy } from './internal/strategies/document.strategy.js';
import { ImageStrategy } from './internal/strategies/image.strategy.js';
import { VideoStrategy } from './internal/strategies/video.strategy.js';
import { FileKernel } from './file.kernel.js';

import { AllConfig } from '@/config/index.js';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { StorageModule } from '@/infra/storage/storage.module.js';

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Module({
    imports: [
        DatabaseModule,
        StorageModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService<AllConfig, true>) => {
                const storageConfig = configService.get('storage', { infer: true });
                return {
                    options: {
                        endpoint: storageConfig.endpoint,
                        region: storageConfig.region,
                        accessKeyId: storageConfig.accessKeyId,
                        secretAccessKey: storageConfig.secretAccessKey,
                        forcePathStyle: storageConfig.forcePathStyle,
                        bucketPublic: storageConfig.bucketPublic,
                        bucketPrivate: storageConfig.bucketPrivate,
                        bucketStaging: storageConfig.bucketStaging,
                    },
                };
            },
        }),
    ],
    providers: [FileKernel, FileRepository, DocumentStrategy, ImageStrategy, VideoStrategy],
    exports: [FileKernel],
})
export class FileKernelModule {}
