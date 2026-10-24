import type { AllConfig } from '@/config/index.js';
import { serializeError } from '@/platform/error/error.diagnostic.js';
import { Module, RequestMethod, type DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import pino, { type LoggerOptions } from 'pino';
import { LoggerContributionModule, LoggerContributions } from './logger.registry.js';
import { createReadyLogTransport } from './logger.transport.js';
import { samplingHooks } from './logger.sampling.js';
import { currentTraceContext } from '../tracing/trace.context.js';

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
                        const { appName } = configService.get('app', {
                            infer: true,
                        });
                        const { logLevel, logging } = configService.get('observability', {
                            infer: true,
                        });
                        const snapshot = contributions.collect();
                        const serializers = {
                            err: (error: unknown) => serializeError(error, contributions.project),
                            req: () => undefined,
                        };
                        const options: LoggerOptions = {
                            name: appName,
                            level: logLevel,
                            serializers,
                            hooks: samplingHooks(logging.sampleRate),
                            mixin: currentTraceContext,
                        };
                        const logger = pino(
                            options,
                            await createReadyLogTransport(logging, snapshot.pretty)
                        );

                        return {
                            forRoutes: [{ path: '*path', method: RequestMethod.ALL }],
                            pinoHttp: {
                                logger,
                                serializers,
                                wrapSerializers: false,
                                // Fastify lifecycle observation owns the single access record.
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
