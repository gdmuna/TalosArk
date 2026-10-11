import allConfig, { type AllConfig } from '@/config/index.js';

import { AccessModule } from '@/core/access/index.js';

import { KvsModule } from '@/infra/kvs/kvs.module.js';

import { AuthModule } from '@/modules/auth/index.js';

import { PlatformContextModule } from '@/platform/context/context.module.js';
import { HttpErrorFilter } from '@/platform/http/error/http.error.filter.js';
import { errorProviders } from './error.provider.js';
import { PlatformLoggerModule } from '@/platform/observability/logger/logger.module.js';
import { AuthGuard } from '@/platform/http/guards/auth.guard.js';
import { RouteContractGuard } from '@/platform/http/route/route.guard.js';
import { RouteContractInterceptor } from '@/platform/http/route/route.interceptor.js';
import {
    PerformanceInterceptor,
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
import { ZodValidationPipe } from 'nestjs-zod';

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
        PlatformLoggerModule.forRoot(),
        AccessModule,
        KvsModule,
        AuthModule,
        PlatformContextModule,
    ],
    providers: [
        ...errorProviders,
        {
            provide: APP_GUARD,
            useClass: RouteContractGuard,
        },
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
        {
            provide: APP_GUARD,
            useClass: AuthGuard,
        },
        // Route contracts validate inputs before pipes, and the final envelope on output.
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
            useClass: RouteContractInterceptor,
        },
        {
            provide: APP_PIPE,
            useClass: ZodValidationPipe,
        },
        {
            provide: APP_FILTER,
            useClass: HttpErrorFilter,
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
