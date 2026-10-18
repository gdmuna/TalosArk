import { Module, type DynamicModule } from '@nestjs/common';
import { FILE_OPTIONS, resolveFileOptions, type FileModuleAsyncOptions } from './file.options.js';

@Module({})
export class FileConfigurationModule {
    static forRootAsync(options: FileModuleAsyncOptions): DynamicModule {
        return {
            module: FileConfigurationModule,
            global: true,
            imports: options.imports ?? [],
            providers: [
                {
                    provide: FILE_OPTIONS,
                    inject: options.inject ?? [],
                    useFactory: async (...args: unknown[]) =>
                        resolveFileOptions(await options.useFactory(...args)),
                },
            ],
            exports: [FILE_OPTIONS],
        };
    }
}
