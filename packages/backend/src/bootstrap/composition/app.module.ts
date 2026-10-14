import allConfig, { type AllConfig } from '@/config/index.js';

import { AccessModule } from '@/core/access/index.js';

import { KvsModule } from '@/infra/kvs/kvs.module.js';
import { IamModule } from '@/infra/iam/index.js';
import { MailModule } from '@/infra/mail/index.js';
import { StorageModule } from '@/infra/storage/index.js';
import { HealthModule } from '@/system/health/health.module.js';

import { AuthModule } from '@/modules/auth/index.js';
import { AuthRecoveryModule } from '@/modules/auth/auth-recovery.module.js';
import { UserModule } from '@/modules/user/user.module.js';
import { OrganizationModule } from '@/modules/organization/index.js';

import { PlatformContextModule } from '@/platform/context/context.module.js';
import { HttpErrorFilter } from '@/platform/http/error/http.error.filter.js';
import { errorProviders } from './error.provider.js';
import { loggerOptions } from './logger.provider.js';
import { iamOptions, mailOptions, storageOptions } from './infra.composition.js';
import { PlatformLoggerModule } from '@/platform/observability/logger/logger.module.js';
import { AuthGuard } from '@/platform/http/guards/auth.guard.js';
import { RouteContractGuard } from '@/platform/http/route/route.guard.js';
import { RouteContractInterceptor } from '@/platform/http/route/route.interceptor.js';
import { PerformanceInterceptor } from '@/platform/http/interceptors/performance.interceptor.js';
import { TimeoutInterceptor } from '@/platform/http/interceptors/timeout.interceptor.js';
import { CorsMiddleware } from '@/platform/http/middleware/cors.middleware.js';
import { RequestPreprocessingMiddleware } from '@/platform/http/middleware/request-preprocessing.middleware.js';
import { RequestScopeMiddleware } from '@/platform/http/middleware/request-scope.middleware.js';

import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE, APP_FILTER } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';

/**
 * Nest 运行时的组合根。
 *
 * 在这里统一注册共享 Infra，仅将各适配器声明的 Provider 暴露为应用级单例。
 * 业务模块直接注入，不重复注册；底层 SDK 和配置 token 保持私有。
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
        PlatformLoggerModule.forRoot(loggerOptions),
        IamModule.forRootAsync(iamOptions),
        MailModule.forRootAsync(mailOptions),
        StorageModule.forRootAsync(storageOptions),
        AccessModule,
        KvsModule,
        AuthModule,
        AuthRecoveryModule,
        UserModule,
        OrganizationModule,
        PlatformContextModule,
        HealthModule,
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
