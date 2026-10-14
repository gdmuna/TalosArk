import { S3Client } from '@aws-sdk/client-s3';
import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { S3_OPTIONS } from './storage.constant.js';
import type { StorageModuleOptions, StorageModuleAsyncOptions } from './storage.options.js';
import { StorageService } from './storage.service.js';

@Module({})
export class StorageModule {
    static forRootAsync(options: StorageModuleAsyncOptions): DynamicModule {
        return {
            module: StorageModule,
            global: true,
            imports: options.imports ?? [],
            providers: this.createProviders({
                provide: S3_OPTIONS,
                useFactory: options.useFactory,
                inject: options.inject ?? [],
            }),
            exports: [StorageService],
        };
    }

    private static createProviders(optionsProvider: Provider): Provider[] {
        return [
            optionsProvider,
            {
                provide: S3Client,
                useFactory: ({ options }: StorageModuleOptions) =>
                    new S3Client({
                        endpoint: options.endpoint,
                        region: options.region ?? 'us-east-1',
                        forcePathStyle: options.forcePathStyle ?? true,
                        credentials: {
                            accessKeyId: options.accessKeyId,
                            secretAccessKey: options.secretAccessKey,
                        },
                        // Explicit SHA-256 remains supported without automatic CRC32 signing.
                        requestChecksumCalculation: 'WHEN_REQUIRED',
                    }),
                inject: [S3_OPTIONS],
            },
            StorageService,
        ];
    }
}
