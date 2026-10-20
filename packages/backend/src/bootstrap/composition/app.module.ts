import allConfig, { type AllConfig } from '@/config/index.js';

import { SessionModule } from '@/core/session/index.js';

import { KvsModule } from '@/infra/kvs/kvs.module.js';
import { IamModule } from '@/infra/iam/index.js';
import { MailModule } from '@/infra/mail/index.js';
import { StorageModule } from '@/infra/storage/index.js';
import { HealthModule } from '@/system/health/health.module.js';

import { AuthModule } from '@/modules/auth/index.js';
import { AuthRecoveryModule } from '@/modules/auth/auth-recovery.module.js';
import { UserModule } from '@/modules/user/user.module.js';
import { OrganizationModule } from '@/modules/organization/index.js';
import { MaterialModule } from '@/modules/material/index.js';
import { FacilityModule } from '@/modules/facility/index.js';
import { InventoryModule } from '@/modules/inventory/inventory.module.js';
import { ApprovalModule } from '@/modules/approval/index.js';
import { approvalPermission } from '@/modules/approval/contribution/approval-authorization.contribution.js';
import { inventoryPermission } from '@/modules/inventory/contribution/inventory-authorization.contribution.js';
import { WorkspaceConfigurationModule } from '@/modules/workspace/workspace.configuration.js';
import { workspacePermission } from '@/core/team-governance/index.js';
import { materialPermission } from '@/modules/material/contribution/material-authorization.contribution.js';
import { facilityPermission } from '@/modules/facility/contribution/facility-authorization.contribution.js';
import { AuthorizationConfigurationModule } from '@/core/authorization/index.js';

import { PlatformContextModule } from '@/platform/context/context.module.js';
import { HttpErrorFilter } from '@/platform/http/error/http.error.filter.js';
import { errorProviders } from './error.provider.js';
import { permissionConfiguration } from './permission.provider.js';
import { fileConfiguration } from './file.provider.js';
import { FileModule } from '@/core/file/index.js';
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
        PlatformLoggerModule.forRoot(),
        permissionConfiguration,
        AuthorizationConfigurationModule.forRoot({
            required: ['material', 'stock-item', 'material-instance'],
        }),
        WorkspaceConfigurationModule.forRoot([
            workspacePermission.read,
            workspacePermission.members,
            workspacePermission.update,
            workspacePermission.audit,
            ...Object.values(materialPermission),
            ...Object.values(inventoryPermission),
            ...Object.values(approvalPermission),
            facilityPermission.read,
            facilityPermission.use,
            facilityPermission.manage,
        ]),
        fileConfiguration,
        IamModule.forRootAsync(iamOptions),
        MailModule.forRootAsync(mailOptions),
        StorageModule.forRootAsync(storageOptions),
        FileModule,
        SessionModule,
        KvsModule,
        AuthModule,
        AuthRecoveryModule,
        UserModule,
        OrganizationModule,
        MaterialModule,
        FacilityModule,
        InventoryModule,
        ApprovalModule,
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
