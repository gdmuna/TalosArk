import type { AllConfig } from '@/config/index.js';
import { serializeError } from '@/platform/error/error.diagnostic.js';
import { Module, RequestMethod, type DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import pino, { type LoggerOptions } from 'pino';
import { LoggerContributionModule, LoggerContributions } from './logger.registry.js';
import { createReadyPrettyTransport } from './logger.transport.js';

@Module({})
export class PlatformLoggerModule {
    // Register after application imports have declared their InjectPinoLogger contexts.
    static forRoot(): DynamicModule {
        return {
            module: PlatformLoggerModule,
            imports: [
                LoggerContributionModule,
                LoggerModule.forRootAsync({
                    imports: [LoggerContributionModule],
                    inject: [ConfigService, LoggerContributions],
                    useFactory: async (
                        configService: ConfigService<AllConfig, true>,
                        contributions: LoggerContributions
                    ) => {
                        const { isDev, isProd, appName } = configService.get('app', {
                            infer: true,
                        });
                        const { logLevel } = configService.get('observability', { infer: true });
                        const snapshot = contributions.collect();
                        const serializers = {
                            err: (error: unknown) => serializeError(error, contributions.project),
                            req: () => undefined,
                        };
                        const options: LoggerOptions = {
                            name: appName,
                            level: logLevel ?? (!isProd ? 'trace' : 'info'),
                            serializers,
                        };
                        const logger = isDev
                            ? pino(options, await createReadyPrettyTransport(snapshot.pretty))
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
            exports: [LoggerContributionModule],
        };
    }
}
