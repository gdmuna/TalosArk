import {
    CorsMiddleware,
    RequestPreprocessingMiddleware,
    RequestScopeMiddleware,
} from '@/platform/http/middleware/app.middleware.js';
import {
    PerformanceInterceptor,
    ResponseFormatInterceptor,
    TimeoutInterceptor,
} from '@/platform/http/interceptors/app.interceptor.js';
import {
    AllExceptionFilter,
    ZodExceptionFilter,
    ThrottlerExceptionFilter,
} from '@/platform/http/filters/app.filter.js';

import {
    ExceptionCatalogModule,
    AuthModule,
    UserModule,
    FileModule,
    OrgModule,
    NodeModule,
    ReagentModule,
    ReagentTypeModule,
    ShareModule,
    FeedbackModule,
    OperationsModule,
} from '@/modules/index.js';

import allConfig, { AllConfig } from '@/config/index.js';

import { ContextModule } from '@/core/context/context.module.js';

import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_PIPE, APP_INTERCEPTOR, APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe, ZodSerializerInterceptor } from 'nestjs-zod';
import { LoggerModule } from 'nestjs-pino';
import pino from 'pino';

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
                            // prettier-ignore
                            transport:
                            isDev ? {
                                target: 'pino-pretty',
                                options: {
                                    sync: true,
                                    colorize: true,
                                    translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
                                    // messageFormat: '{if req.method}[{req.method}]({req.url}){end} {if context}{context} - {end}{msg}',
                                },
                            } : undefined,
                            serializers: {
                                err: () => undefined, // 错误堆栈交由 exceptions.filter 处理，避免重复记录
                                req: () => undefined, // 请求信息交由 performance.interceptor 处理，避免重复记录
                            },
                            autoLogging: false,
                        },
                        pino.destination({
                            dest: './data/logs/app.log',
                            sync: false, // 异步写入
                            mkdir: true,
                        }),
                    ],
                };
            },
        }),
        ContextModule,
        ExceptionCatalogModule,
        AuthModule,
        UserModule,
        FileModule,
        OrgModule,
        NodeModule,
        ReagentModule,
        ReagentTypeModule,
        ShareModule,
        FeedbackModule,
        OperationsModule,
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: PerformanceInterceptor,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: ResponseFormatInterceptor,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: TimeoutInterceptor,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: ZodSerializerInterceptor,
        },
        {
            provide: APP_PIPE,
            useClass: ZodValidationPipe,
        },
        // Filters — 注册顺序决定 LIFO 执行顺序
        // AllExceptionsFilter 最先注册 = 最后执行 = 兜底所有未匹配异常
        // ZodExceptionFilter / ThrottlerExceptionFilter 后注册 = 优先执行各自匹配的异常类型
        {
            provide: APP_FILTER,
            useClass: AllExceptionFilter,
        },
        {
            provide: APP_FILTER,
            useClass: ZodExceptionFilter,
        },
        {
            provide: APP_FILTER,
            useClass: ThrottlerExceptionFilter,
        },
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(RequestPreprocessingMiddleware, RequestScopeMiddleware, CorsMiddleware)
            .forRoutes('*');
    }
}
