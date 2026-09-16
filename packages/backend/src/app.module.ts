import allConfig, { type AllConfig } from '@/config/index.js';
import { PlatformContextModule } from '@/platform/context/context.module.js';
import {
    AllExceptionFilter,
    ThrottlerExceptionFilter,
} from '@/platform/http/filters/app.filter.js';
import {
    PerformanceInterceptor,
    ResponseFormatInterceptor,
    TimeoutInterceptor,
} from '@/platform/http/interceptors/app.interceptor.js';
import {
    CorsMiddleware,
    RequestPreprocessingMiddleware,
    RequestScopeMiddleware,
} from '@/platform/http/middleware/app.middleware.js';

import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE, APP_FILTER } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import pino from 'pino';

/**
 * Nest 运行时的组合根。
 *
 * 这里只装配跨业务的 Platform 能力。具体业务模块及其 Infra 依赖应当由各自的
 * Module 显式导入，避免 AppModule 重新成为任意基础设施的全局暴露点。
 */
@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: allConfig,
        }),
        ThrottlerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService<AllConfig, true>) => {
                const { throttleTtlMs, throttleLimit } = configService.get('http', {
                    infer: true,
                });

                return [
                    {
                        ttl: throttleTtlMs,
                        limit: throttleLimit,
                    },
                ];
            },
        }),
        LoggerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService<AllConfig, true>) => {
                const { isDev, isProd, appName } = configService.get('app', { infer: true });
                const { logLevel } = configService.get('observability', { infer: true });

                return {
                    forRoutes: [{ path: '*path', method: RequestMethod.ALL }],
                    pinoHttp: [
                        {
                            name: appName,
                            level: logLevel ?? (!isProd ? 'trace' : 'info'),
                            transport: isDev
                                ? {
                                      target: 'pino-pretty',
                                      options: {
                                          sync: true,
                                          colorize: true,
                                          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
                                      },
                                  }
                                : undefined,
                            serializers: {
                                err: () => undefined,
                                req: () => undefined,
                            },
                            // TODO: 第一个平台遥测实现落地后，改由其统一输出访问日志。
                            autoLogging: false,
                        },
                        pino.destination({
                            dest: './data/logs/app.log',
                            sync: false,
                            mkdir: true,
                        }),
                    ],
                };
            },
        }),
        PlatformContextModule,
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
        // 入站按声明顺序执行；出站反向执行，使 Zod 先校验控制器结果再包装成功响应。
        {
            provide: APP_INTERCEPTOR,
            useClass: PerformanceInterceptor,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: TimeoutInterceptor,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: ResponseFormatInterceptor,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: ZodSerializerInterceptor,
        },
        {
            provide: APP_PIPE,
            useClass: ZodValidationPipe,
        },
        {
            provide: APP_FILTER,
            useClass: AllExceptionFilter,
        },
        {
            provide: APP_FILTER,
            useClass: ThrottlerExceptionFilter,
        },
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer
            .apply(RequestPreprocessingMiddleware, RequestScopeMiddleware, CorsMiddleware)
            .forRoutes({ path: '*path', method: RequestMethod.ALL });
    }
}
