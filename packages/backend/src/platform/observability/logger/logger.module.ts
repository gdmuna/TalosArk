import { fileURLToPath } from 'node:url';
import type { AllConfig } from '@/config/index.js';
import {
    serializeError,
    type ErrorDiagnosticProjector,
} from '@/platform/error/error.diagnostic.js';
import { Module, RequestMethod, type DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import pino, { type LoggerOptions } from 'pino';

export interface PlatformLoggerOptions {
    prettyAdapterPaths?: readonly string[];
    errorProject?: ErrorDiagnosticProjector;
}

@Module({})
export class PlatformLoggerModule {
    // Register after application imports have declared their InjectPinoLogger contexts.
    static forRoot(loggerOptions: PlatformLoggerOptions = {}): DynamicModule {
        return {
            module: PlatformLoggerModule,
            imports: [
                LoggerModule.forRootAsync({
                    inject: [ConfigService],
                    useFactory: (configService: ConfigService<AllConfig, true>) => {
                        const { isDev, isProd, appName } = configService.get('app', {
                            infer: true,
                        });
                        const { logLevel } = configService.get('observability', { infer: true });
                        const serializers = {
                            err: (error: unknown) =>
                                serializeError(error, loggerOptions.errorProject),
                            req: () => undefined,
                        };
                        const options: LoggerOptions = {
                            name: appName,
                            level: logLevel ?? (!isProd ? 'trace' : 'info'),
                            serializers,
                        };
                        // prettier-ignore
                        const logger = isDev
                            ? pino({
                                ...options,
                                transport: {
                                    target: fileURLToPath(
                                        new URL('./pretty.transport.js', import.meta.url)
                                    ),
                                    options: {
                                        colorize: true,
                                        adapterPaths: loggerOptions.prettyAdapterPaths,
                                    },
                                },
                            })
                            : pino(
                                options,
                                pino.destination({
                                    dest: './data/logs/app.log',
                                    sync: false,
                                    mkdir: true,
                                })
                            );

                        return {
                            forRoutes: [{ path: '*path', method: RequestMethod.ALL }],
                            pinoHttp: {
                                logger,
                                serializers,
                                wrapSerializers: false,
                                // TODO: The first platform telemetry implementation owns access logs.
                                autoLogging: false,
                            },
                        };
                    },
                }),
            ],
        };
    }
}
